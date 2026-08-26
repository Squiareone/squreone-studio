import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type ScrollToFn = (target: string, opts?: { offset?: number }) => void;

function fit(
  v: number,
  in0: number,
  in1: number,
  out0: number,
  out1: number,
  ease?: (t: number) => number,
): number {
  const t = in1 === in0 ? 0 : Math.min(1, Math.max(0, (v - in0) / (in1 - in0)));
  const e = ease ? ease(t) : t;
  return out0 + (out1 - out0) * e;
}

/**
 * Home hero: 4 discrete, gesture-paginated panels (not continuous scrub) —
 *   1) Shaping Brands  2) Process overview ("One-stop service")
 *   3) Story ("Crafting uniqueness...")  4) Expertise cards
 *
 * Rebuilt from a continuous scrub+pin design per feedback: "首页进来的时候
 * 需要滑动3下才能到下一页...这里的过渡不太丝滑，可以改成一次就到下一页么？"
 * One wheel/touch gesture now advances exactly one panel, mirroring the
 * Cases & Scenarios section's own step pagination (see initCasesTimeline's
 * goToStep further down — this ports the same proven pattern: intercept
 * wheel/touch, tween the track + a scroll-position proxy together, lock
 * out further input for a cooldown window). A fixed-duration GSAP tween
 * drives each transition instead of tying it to scroll fraction, so it
 * reads the same regardless of how fast/slow the gesture was — that
 * inconsistency was very likely why the old scrub felt "not smooth".
 */
const STEP_COUNT = 4;
const STEP_DURATION = 0.85;
const CONTENT_DURATION_IN = 0.6;
const CONTENT_DURATION_OUT = 0.4;
const CONTENT_ENTER_DELAY = STEP_DURATION * 0.3;
// Scroll "budget" reserved per step while pinned — doesn't need to map to
// anything visually exact since panel position is driven by discrete step
// state now, not by raw scroll fraction; just needs enough room for the
// wheel/touch interception below to have somewhere to move the real scroll
// position to (see goToStep's scroll-position proxy tween).
const PIN_STEP_VH = 1.1;
export const HOME_PIN_VH = (STEP_COUNT - 1) * PIN_STEP_VH;
// Arriving at the last step (cards) while just browsing it stops just shy
// of the pin's own scroll-position end boundary (1.0) instead of landing
// exactly on it — sitting exactly at the boundary risks GSAP treating the
// trigger as no-longer-active while the cards are still mid-entrance,
// which would let native scroll slip through early. The explicit "leave to
// Cases" action (scrollTo('#cases-scenarios')) is what actually carries
// scroll position past the boundary and releases the pin, not arriving at
// this step.
const STEP_HOLD_P = 0.94;

export function initHomeHeroTimeline(scrollTo: ScrollToFn, onProgress?: (p: number) => void): () => void {
  const section = document.getElementById('home-hero');
  const pinEl = document.getElementById('home-hero-pin');
  const track = document.getElementById('home-hero-track');
  const continuePill = document.getElementById('home-continue-pill');

  if (!section || !pinEl || !track) return () => {};

  const panels = Array.from(track.querySelectorAll<HTMLElement>('.home-panel'));
  const panelInners = panels.map((p) => p.querySelector<HTMLElement>('.home-panel-inner'));
  const processPanel = document.getElementById('process-overview');
  const cardsPanel = document.getElementById('home-cards-panel');
  const cardsGridEl = document.getElementById('home-cards-grid');
  const expertiseCards = Array.from(
    document.querySelectorAll<HTMLElement>('#home-cards-grid .about-capability-card'),
  );
  const DESKTOP_FAN_MIN_WIDTH = 901;
  // Same duration both directions, referenced by both animateCards (the
  // card motion itself) and goToStep (which holds the panel in place and
  // visible for this long before sliding away when leaving) so the exit
  // is a true mirror of the entrance, not a shortened version of it — per
  // feedback: "往回退的时候的交互跟进入的时候一样（反过来）".
  const CARDS_ANIM_DURATION = 3.6;
  let cardTween: gsap.core.Tween | null = null;
  let cardIdleTweens: gsap.core.Tween[] = [];
  let cardW = 0;
  let cardOffset = 0;
  let wrapperW = 0;

  let currentStep = 0;
  let animating = false;
  // Tracks the actual scroll-position proxy value last landed on — needed
  // because step 3's resting value is STEP_HOLD_P, not 3/(STEP_COUNT-1),
  // so the next transition's "from" has to read this instead of
  // recomputing from currentStep (which would jump from the wrong point).
  let lastProxyP = 0;

  /*
   * Cards: literal port of the original "Area of Expertise" section's
   * per-frame fan/flip formulas (applyCardsFromSection in the pre-
   * restructure HomeHeroTimeline), per feedback: "卡片的动效一一模一样".
   * That version derived everything from a continuous `screenRatio`
   * (roughly -1..1 as the section scrolled through view). This panel has
   * no scroll runway to derive that from (fixed 100vh, one discrete
   * step), so instead a synthetic screenRatio is swept from -1 to 1 over
   * a fixed duration by GSAP the moment the panel becomes the active step
   * — every other formula below (n/a/l progress curves, easeExpoOut,
   * easeBackInOut, easeExpoInOut, the per-card fan target/flip/wobble) is
   * unchanged from the original, so the motion *shape* is identical; only
   * the time source changed from "scroll position" to "elapsed seconds".
   */
  const easeExpoOut = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  };
  const easeExpoInOut = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
  };
  const easeBackInOut = (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  };
  const easeCubicInOut = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };

  /** measure() port — card/wrapper geometry the fan math is built on. */
  const measureCards = () => {
    if (!expertiseCards.length || !cardsGridEl) return;
    expertiseCards.forEach((c) => gsap.set(c, { clearProps: 'transform' }));
    wrapperW = cardsGridEl.clientWidth || cardsGridEl.getBoundingClientRect().width;
    const first = expertiseCards[0];
    cardW = first.offsetWidth || wrapperW / expertiseCards.length;
    if (!(cardW > 0) && wrapperW > 0) cardW = wrapperW / expertiseCards.length;
    const cardH = first.offsetHeight || cardW * (438 / 314);
    if (window.innerWidth >= DESKTOP_FAN_MIN_WIDTH) {
      cardsGridEl.style.height = `${cardH}px`;
    } else {
      cardsGridEl.style.height = 'auto';
    }
    cardOffset = Math.max(0, wrapperW - cardW * expertiseCards.length);
  };

  /** applyCardsFromSection port — one frame of the fan/flip/wobble. */
  const applyCardsFrame = (screenRatio: number, elapsed: number) => {
    const n = fit(screenRatio, -0.6, 0.2, 0, 1);
    const a = fit(screenRatio, -0.5, 0.7, 0, 1);
    const l = fit(screenRatio, -0.5, 0.7, -Math.PI / 2, Math.PI - Math.PI / 2);
    const nCards = expertiseCards.length;

    if (window.innerWidth >= DESKTOP_FAN_MIN_WIDTH) {
      const span = nCards > 1 ? wrapperW + cardOffset / (nCards - 1) : wrapperW;
      const center = Math.max(0, wrapperW / 2 - cardW / 2);
      for (let p = 0; p < nCards; p++) {
        const el = expertiseCards[p];
        const target = Math.min(Math.max(0, wrapperW - cardW), (p / nCards) * span);
        const M = fit(n, 0.2, 1, center, target, easeExpoOut);
        const S = fit(a, 0, 0.7 - Math.abs(nCards - 1 - p) / 20, 180, 0, easeBackInOut);
        const b = fit(Math.abs(fit(n, 0, 0.75, 0, 1) * 2 - 1), 1, 0, 0, (p - 1.5) * 9, easeExpoInOut);
        const C = Math.cos(elapsed * 3 + p) * Math.cos(l);
        gsap.set(el, { x: M, y: C * 10, rotationZ: b, rotationY: S, force3D: true });
      }
    } else {
      // Below the fan tier, cards sit in normal flow (static grid) — just
      // flip in place, same as the original's own mobile fallback.
      expertiseCards.forEach((el, p) => {
        const T = fit(screenRatio, -0.85 - (p % 2) / 10, 0, 180, 0, easeCubicInOut);
        gsap.set(el, { rotationY: T, x: 0, y: 0, rotationZ: 0, force3D: true });
      });
    }
  };

  const animateCards = (active: boolean) => {
    if (!expertiseCards.length) return;
    cardTween?.kill();
    cardIdleTweens.forEach((t) => t.kill());
    cardIdleTweens = [];
    measureCards();
    const proxy = { r: active ? -1 : 1 };
    applyCardsFrame(proxy.r, 0);
    // Same gradual duration both directions — the original was purely
    // scroll-linked, so scrolling back out played through the identical
    // curve just as slowly as scrolling in did. Per feedback: "收回的时候
    // 也要有同样的动效" (retracting should have the same motion too), and
    // slowed further per follow-up: "还得慢一点，看清楚背后的纹路才行" (slow
    // enough to actually see the card-back pattern while it's turned).
    const duration = CARDS_ANIM_DURATION;
    const startTime = performance.now();
    cardTween = gsap.to(proxy, {
      r: active ? 1 : -1,
      duration,
      ease: 'none',
      onUpdate: () => applyCardsFrame(proxy.r, (performance.now() - startTime) / 1000),
      onComplete: () => {
        if (!active) return;
        // The original's per-card wobble (the `C = cos(elapsed*3+p)*cos(l)`
        // term in applyCardsFrame) fades out once fully settled — but per
        // feedback the cards should keep a small persistent float once
        // expanded ("展开后卡片也是悬浮有一点点动的效果"), so once the
        // formula-driven entrance finishes, hand off to a slow continuous
        // idle bob (phase-offset per card) that keeps running while this
        // panel stays the active step.
        cardIdleTweens = expertiseCards.map((el, i) =>
          gsap.to(el, {
            y: `+=${5 + (i % 2) * 2}`,
            rotationZ: `+=${i % 2 === 0 ? 1.2 : -1.2}`,
            duration: 1.9 + i * 0.2,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          }),
        );
      },
    });
  };

  gsap.killTweensOf(track);
  gsap.killTweensOf(panelInners.filter((el): el is HTMLElement => !!el));
  gsap.set(track, { xPercent: 0, x: 0, force3D: true });
  panelInners.forEach((el, i) => {
    if (!el) return;
    gsap.set(el, { autoAlpha: i === 0 ? 1 : 0, x: 0, force3D: true });
  });
  processPanel?.classList.remove('is-visible');
  cardsPanel?.classList.remove('is-visible');
  continuePill?.classList.remove('is-visible');

  const animatePanels = (from: number, to: number, outDelay = 0) => {
    const dir = to > from ? 1 : -1;
    panelInners.forEach((el, i) => {
      if (!el) return;
      gsap.killTweensOf(el);
      if (i === to) {
        gsap.fromTo(
          el,
          { autoAlpha: 0, x: dir * 48 },
          {
            autoAlpha: 1,
            x: 0,
            duration: CONTENT_DURATION_IN,
            ease: 'power2.out',
            delay: outDelay + CONTENT_ENTER_DELAY,
            force3D: true,
          },
        );
      } else if (i === from) {
        gsap.to(el, {
          autoAlpha: 0,
          x: -dir * 48,
          duration: CONTENT_DURATION_OUT,
          ease: 'power2.in',
          delay: outDelay,
          force3D: true,
        });
      }
    });
  };

  const setPanelClasses = (idx: number) => {
    // Reveal-on-arrival stagger classes (dot/card timing lives in CSS via
    // transition-delay) — toggled off first so re-entering a panel replays
    // the stagger instead of just staying in its already-revealed state.
    processPanel?.classList.toggle('is-visible', idx === 1);
    cardsPanel?.classList.toggle('is-visible', idx === 3);
    continuePill?.classList.toggle('is-visible', idx === STEP_COUNT - 1);
    animateCards(idx === 3);
  };

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * HOME_PIN_VH}`,
    pin: pinEl,
    pinSpacing: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefresh: () => {
      gsap.set(track, { xPercent: -(currentStep * (100 / STEP_COUNT)) });
      panelInners.forEach((el, i) => {
        if (!el) return;
        gsap.set(el, { autoAlpha: i === currentStep ? 1 : 0, x: 0 });
      });
    },
    // #home-continue-pill is position:fixed, so once scrolled past this
    // pinned section it would otherwise stay stuck on screen (still
    // .is-visible from step 3) all the way through Cases & Scenarios'
    // intro frame — it should only ever be visible while pinned on the
    // cards step. Per feedback: "这里没有，只有出现 let's work together
    // 的时候才有" (Cases & Scenarios' own #end-bottom, further down that
    // section's own timeline, is what should show a "continue" pill there
    // instead — this one is unrelated to it).
    onLeave: () => continuePill?.classList.remove('is-visible'),
    onLeaveBack: () => continuePill?.classList.remove('is-visible'),
    onEnterBack: () => continuePill?.classList.toggle('is-visible', currentStep === STEP_COUNT - 1),
  });

  let stepUnlockTimer = 0;

  const goToStep = (next: number) => {
    const clamped = Math.min(STEP_COUNT - 1, Math.max(0, next));
    if (clamped === currentStep || animating) return;
    animating = true;
    const from = currentStep;
    currentStep = clamped;

    // Leaving the cards panel holds the slide/fade until the retract has
    // fully played (same duration as the entrance) — a true mirror of
    // entering, where the panel is already in place and visible for the
    // whole fan/flip. Per feedback: "往回退的时候的交互跟进入的时候一样
    // （反过来）" (going back should be the same interaction as coming in,
    // just reversed).
    const outDelay = from === 3 ? CARDS_ANIM_DURATION : 0;

    // Entering the cards panel: the horizontal slide itself only takes
    // STEP_DURATION, but the cards' own fan/flip entrance keeps playing
    // for CARDS_ANIM_DURATION afterward. `animating` used to clear right
    // when the slide finished, so a single trackpad flick's momentum tail
    // could still be feeding wheel events at that point and immediately
    // trigger the NEXT step (or the leave-to-Cases threshold) before the
    // cards had even finished appearing — the whole panel got skipped.
    // Per feedback: "9秒开始滑动到卡片的页面，根本没看到卡片，直接滑动到
    // 下面的页面了". Holding the lock for the full card-animation duration
    // here (mirroring the symmetric hold already used when leaving) fixes
    // it — momentum scroll dies down well within that window.
    const enterHold = clamped === 3 ? CARDS_ANIM_DURATION : 0;
    const unlockAfterMs = (outDelay + STEP_DURATION + enterHold) * 1000;

    gsap.to(track, {
      xPercent: -(clamped * (100 / STEP_COUNT)),
      duration: STEP_DURATION,
      delay: outDelay,
      ease: 'power3.inOut',
      force3D: true,
    });

    window.clearTimeout(stepUnlockTimer);
    stepUnlockTimer = window.setTimeout(() => {
      animating = false;
    }, unlockAfterMs);

    animatePanels(from, clamped, outDelay);
    setPanelClasses(clamped);

    // Keep the underlying scroll position (and the WebGL camera progress
    // callback, via onProgress) tweening in step with the visual transition
    // — same technique as Cases & Scenarios' own goToStep below. Target
    // caps at STEP_HOLD_P (not 1.0) when landing on the cards step, so
    // resting there never sits exactly on the pin's end boundary — see
    // STEP_HOLD_P's own comment above for why that matters.
    const targetP = clamped === STEP_COUNT - 1 ? STEP_HOLD_P : clamped / (STEP_COUNT - 1);
    const proxy = { p: lastProxyP };
    gsap.to(proxy, {
      p: targetP,
      duration: STEP_DURATION,
      delay: outDelay,
      ease: 'power3.inOut',
      onUpdate: () => {
        st.scroll(st.start + (st.end - st.start) * proxy.p);
        onProgress?.(proxy.p);
      },
    });
    lastProxyP = targetP;
  };

  // Actually departing the pin (as opposed to just resting on the cards
  // step at STEP_HOLD_P) — reports full progress once here so main.ts's
  // homePinActive flips over to real-scroll-driven camera progress at the
  // moment the user truly leaves, not when they merely arrive at step 3.
  const leaveToCases = () => {
    onProgress?.(1);
    scrollTo('#cases-scenarios', {});
  };

  const WHEEL_TRIGGER_THRESHOLD = 40;
  const WHEEL_RESET_GAP_MS = 260;
  const WHEEL_COOLDOWN = 900;
  const TOUCH_THRESHOLD = 40;
  let locked = false;
  let lockTimer = 0;
  let wheelAccum = 0;
  let lastWheelTs = 0;

  const lock = () => {
    locked = true;
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      locked = false;
    }, WHEEL_COOLDOWN);
  };

  const onWheel = (e: WheelEvent) => {
    // `animating` (our own explicit hold, extended through the cards'
    // full entrance/retract) MUST be checked before st.isActive — the
    // proxy scroll position sits right at the pin's own end boundary once
    // step 3 is reached, which could make GSAP briefly report the trigger
    // as inactive on its own; if that check ran first it would bail out
    // WITHOUT calling preventDefault, letting native scroll slip straight
    // through and skip the cards panel entirely regardless of how long
    // `animating` was held. Per feedback: "第3秒的时候还是整个页面卡片都
    // 没展示清楚，就跳走啦" — this was still happening after the previous
    // hold-duration fix specifically because of that bypass order.
    if (animating) {
      e.preventDefault();
      wheelAccum = 0;
      return;
    }
    if (!st.isActive) {
      wheelAccum = 0;
      return;
    }
    const dir = e.deltaY > 0 ? 1 : -1;
    if (currentStep === 0 && dir < 0) {
      wheelAccum = 0;
      return; // let it scroll up out of the pin normally
    }
    // Leaving the last (cards) step forward now requires the same
    // deliberate full-gesture threshold as every other step transition
    // (below) instead of releasing the pin on the very first wheel tick —
    // per feedback: "这里的时候页面固定住，不能飘，不要自动往下，需要用户
    // 点击页面或滑动鼠标才能到下一个模块". preventDefault always runs while
    // pinned now, so nothing drifts until that gesture (or the pill click)
    // actually happens.
    e.preventDefault();
    if (locked) return;
    const now = performance.now();
    if (now - lastWheelTs > WHEEL_RESET_GAP_MS) wheelAccum = 0;
    lastWheelTs = now;
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) < WHEEL_TRIGGER_THRESHOLD) return;
    wheelAccum = 0;
    lock();
    if (currentStep === STEP_COUNT - 1 && dir > 0) {
      leaveToCases();
      return;
    }
    goToStep(currentStep + dir);
  };
  window.addEventListener('wheel', onWheel, { passive: false });

  let touchStartY = 0;
  let touchHandled = false;
  const onTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0]?.clientY ?? 0;
    touchHandled = false;
  };
  const onTouchMove = (e: TouchEvent) => {
    // Same ordering fix as onWheel above — animating must be checked (and
    // preventDefault called) before st.isActive, otherwise a touch event
    // arriving right as the pin sits at its end boundary can slip through
    // untouched and skip the panel.
    if (animating) {
      e.preventDefault();
      return;
    }
    if (!st.isActive || touchHandled || locked) return;
    const y = e.touches[0]?.clientY ?? touchStartY;
    const delta = touchStartY - y;
    const dir = delta > 0 ? 1 : -1;
    if (currentStep === 0 && dir < 0) return;
    // Same full-swipe requirement leaving the last step forward as the
    // wheel handler above — no more releasing on first touch movement.
    if (Math.abs(delta) < TOUCH_THRESHOLD) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    touchHandled = true;
    lock();
    if (currentStep === STEP_COUNT - 1 && dir > 0) {
      leaveToCases();
      return;
    }
    goToStep(currentStep + dir);
  };
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });

  const onPillClick = (e: Event) => {
    e.preventDefault();
    leaveToCases();
  };
  continuePill?.addEventListener('click', onPillClick);

  // Keep the fanned/flipped cards aligned with their (re-measured) grid
  // slots across a viewport resize/orientation change — snaps instantly to
  // the rest frame (screenRatio = 1) rather than replaying the entrance.
  const onCardsResize = () => {
    if (currentStep !== 3 || !expertiseCards.length) return;
    cardTween?.kill();
    cardIdleTweens.forEach((t) => t.kill());
    cardIdleTweens = [];
    measureCards();
    applyCardsFrame(1, 0);
    cardIdleTweens = expertiseCards.map((el, i) =>
      gsap.to(el, {
        y: `+=${5 + (i % 2) * 2}`,
        rotationZ: `+=${i % 2 === 0 ? 1.2 : -1.2}`,
        duration: 1.9 + i * 0.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      }),
    );
  };
  window.addEventListener('resize', onCardsResize);

  return () => {
    st.kill();
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    continuePill?.removeEventListener('click', onPillClick);
    window.removeEventListener('resize', onCardsResize);
    window.clearTimeout(lockTimer);
    window.clearTimeout(stepUnlockTimer);
    cardTween?.kill();
    cardIdleTweens.forEach((t) => t.kill());
  };
}

/**
 * Splits #hero-title into `.word` spans for IntroSequence's page-load
 * reveal and the language-toggle fromTo animation in main.ts — the only
 * remaining consumer of word-level splitting now that panel transitions
 * are whole-panel fades (see initHomeHeroTimeline above). Story/process
 * copy no longer needs splitting: LanguageController.apply() already sets
 * their plain textContent directly.
 */
export function prepareHeroText(
  i18n: { text: { heroTitle: string } },
  i18nCtrl: { splitTextIntoWords: (el: HTMLElement) => HTMLSpanElement[] },
): void {
  const title = document.getElementById('hero-title');
  if (!title) return;
  gsap.killTweensOf(title);
  gsap.killTweensOf(title.querySelectorAll('.word, .word-wrap'));
  title.textContent = i18n.text.heroTitle;
  i18nCtrl.splitTextIntoWords(title);
}

/**
 * Cases multi-frame + Lusion EndSection port for "Let's work together".
 *
 * EndSection rules (from lusion EndSection class):
 * - activeRatio saturates over ~1s once finale is shown
 * - crosses: scale 0→1 + rotate 0→180 staggered
 * - subtitle words: y 200%→0 + rotate 30→0 staggered
 * - title chars: y 100%→0 staggered by word+char; periodic rollup clone
 * - hover decorations: scaleX underlines
 */
export function initCasesTimeline(): () => void {
  const section = document.getElementById('cases-scenarios');
  const track = document.getElementById('cases-track');
  const intro = document.getElementById('cases-frame-intro');
  const experienceFrame = document.getElementById('cases-frame-experience');
  const experienceImgs = Array.from(
    document.querySelectorAll<HTMLImageElement>('.cases-experience-frame-img'),
  ).sort((a, b) => Number(a.dataset.step ?? 0) - Number(b.dataset.step ?? 0));
  const progressSegs = Array.from(
    document.querySelectorAll<HTMLElement>('.cases-experience-progress-seg > i'),
  );
  const headlineEls = Array.from(
    document.querySelectorAll<HTMLElement>('.cases-experience-headline'),
  ).sort((a, b) => Number(a.dataset.step ?? 0) - Number(b.dataset.step ?? 0));
  const finale = document.getElementById('cases-frame-finale');
  const title = document.getElementById('cases-title');
  const desc = document.getElementById('cases-desc');
  const letsWork = document.getElementById('lets-work-title');
  const endTitle = document.getElementById('end-section-title');
  const endContent = document.getElementById('end-section-content');
  const endSubtitle = document.getElementById('end-section-subtitle-text');
  const endBottom = document.getElementById('end-bottom');
  const crosses = Array.from(document.querySelectorAll<HTMLElement>('.end-section-content-cross'));

  if (
    !section ||
    !track ||
    !intro ||
    !experienceFrame ||
    !experienceImgs.length ||
    !progressSegs.length ||
    !headlineEls.length ||
    !finale ||
    !title ||
    !desc ||
    !letsWork ||
    !endTitle ||
    !endContent ||
    !endSubtitle ||
    !endBottom
  ) {
    return () => {};
  }

  /** Decorations live inside title lines; recreate if lang textContent wiped them. */
  const ensureDeco = (id: string, className: string): HTMLElement => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('span');
      el.id = id;
      el.className = className;
      el.setAttribute('aria-hidden', 'true');
      endTitle.appendChild(el);
    }
    return el;
  };
  let topDeco = ensureDeco('end-section-title-top-decoration', 'end-section-title-top-decoration');
  let botLeftDeco = ensureDeco(
    'end-section-title-bottom-left-decoration',
    'end-section-title-bottom-left-decoration',
  );
  let botRightDeco = ensureDeco(
    'end-section-title-bottom-right-decoration',
    'end-section-title-bottom-right-decoration',
  );

  gsap.set(intro, { autoAlpha: 1 });
  gsap.set([experienceFrame, finale], { autoAlpha: 0 });
  gsap.set(title, { x: -200, autoAlpha: 0 });
  gsap.set(desc, { x: 220, autoAlpha: 0 });
  gsap.set(endBottom, { autoAlpha: 0, y: 12 });

  let finaleActive = false;

  // EndSection state
  const ROLLUP_DURATION = 1;
  const ROLLUP_INTERVAL = 2;
  let activeRatio = 0;
  let hoverRatio = 0;
  let endTime = 0;
  let isHover = false;
  let needsEndReset = true;
  let textSplit = false;

  type EndWord = {
    el: HTMLElement;
    chars: HTMLElement[];
    wrappers: HTMLElement[];
    ratio: number;
    randCharIndex: number;
  };
  let endWords: EndWord[] = [];
  let subWords: HTMLElement[] = [];

  const easeLusion = (t: number) => {
    // cubicBezier(.35, 0, 0, 1) approx — smoothstep is close enough & used elsewhere
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };
  const easeCubicInOut = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const saturate = (v: number) => Math.min(1, Math.max(0, v));

  const isCjk = (s: string) => /[぀-ヿ㐀-鿿豈-﫿]/.test(s);

  const tokenizeWords = (line: string): string[] => {
    const trimmed = line.replace(/\s+/g, ' ').trim();
    if (!trimmed) return [];
    if (isCjk(trimmed)) {
      // 2-char units (matches project CJK split elsewhere)
      const units: string[] = [];
      for (let i = 0; i < trimmed.length; i += 2) {
        units.push(trimmed.slice(i, i + 2));
      }
      return units;
    }
    return trimmed.split(' ').filter(Boolean);
  };

  const splitEndText = () => {
    topDeco = ensureDeco('end-section-title-top-decoration', 'end-section-title-top-decoration');
    botLeftDeco = ensureDeco(
      'end-section-title-bottom-left-decoration',
      'end-section-title-bottom-left-decoration',
    );
    botRightDeco = ensureDeco(
      'end-section-title-bottom-right-decoration',
      'end-section-title-bottom-right-decoration',
    );

    // Prefer live plain text after i18n; else cached raw / aria
    const liveTitle = (letsWork.textContent || '').replace(/\s*\n\s*/g, '\n').trim();
    const hasSplit = !!letsWork.querySelector('.end-section-title-link-word');
    const rawTitle = (
      (!hasSplit && liveTitle) ||
      letsWork.getAttribute('data-raw') ||
      letsWork.getAttribute('aria-label') ||
      "Let's work\ntogether!"
    )
      .replace(/\s*\n\s*/g, '\n')
      .trim();

    const liveSub = (endSubtitle.textContent || '').replace(/\s+/g, ' ').trim();
    const subHasSplit = !!endSubtitle.querySelector('.end-sub-word');
    const rawSub = (
      (!subHasSplit && liveSub) ||
      endSubtitle.getAttribute('data-raw') ||
      endSubtitle.getAttribute('aria-label') ||
      'Is Your Big Idea Ready to Go Wild?'
    )
      .replace(/\s+/g, ' ')
      .trim();

    letsWork.setAttribute('data-raw', rawTitle);
    letsWork.setAttribute('aria-label', rawTitle.replace(/\n/g, ' '));
    endSubtitle.setAttribute('data-raw', rawSub);
    endSubtitle.setAttribute('aria-label', rawSub);

    // Park decorations outside before wiping title
    endTitle.appendChild(topDeco);
    endTitle.appendChild(botLeftDeco);
    endTitle.appendChild(botRightDeco);

    // --- subtitle: words in overflow masks ---
    endSubtitle.textContent = '';
    subWords = [];
    tokenizeWords(rawSub).forEach((w) => {
      const mask = document.createElement('div');
      mask.className = 'end-sub-word-mask';
      const span = document.createElement('span');
      span.className = 'end-sub-word';
      span.textContent = w;
      mask.appendChild(span);
      endSubtitle.appendChild(mask);
      subWords.push(span);
    });

    // --- title: lines → words → chars + rollup clone ---
    letsWork.textContent = '';
    endWords = [];

    const lines = rawTitle.split('\n').filter((l) => l.trim().length > 0);
    const lineList = lines.length ? lines : [rawTitle || "Let's work together!"];

    lineList.forEach((lineText, lineIdx) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'end-section-title-link-line';

      tokenizeWords(lineText).forEach((wordText) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'end-section-title-link-word';

        const chars: HTMLElement[] = [];
        const wrappers: HTMLElement[] = [];
        const glyphs = Array.from(wordText);

        glyphs.forEach((ch) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'char-wrapper';
          wrapper.style.display = 'inline-block';

          const char = document.createElement('span');
          char.className = 'char';
          char.textContent = ch;

          const clone = char.cloneNode(true) as HTMLElement;
          clone.className = 'char';

          wrapper.appendChild(char);
          wrapper.appendChild(clone);
          wordEl.appendChild(wrapper);

          chars.push(char);
          wrappers.push(wrapper);
        });

        lineEl.appendChild(wordEl);
        endWords.push({
          el: wordEl,
          chars,
          wrappers,
          ratio: 0,
          randCharIndex: Math.floor(Math.random() * Math.max(1, chars.length)),
        });
      });

      // Decorations attach to line like Lusion: first line → top; rest → bottom left/right
      if (lineIdx === 0) {
        lineEl.appendChild(topDeco);
      } else {
        lineEl.appendChild(botLeftDeco);
        lineEl.appendChild(botRightDeco);
      }

      letsWork.appendChild(lineEl);
    });

    // Single-line fallback: still show bottom decorations on the only line
    if (lineList.length === 1) {
      const only = letsWork.querySelector('.end-section-title-link-line');
      only?.appendChild(botLeftDeco);
      only?.appendChild(botRightDeco);
    }

    textSplit = true;
    needsEndReset = true;
  };

  const resetEndAnim = () => {
    needsEndReset = false;
    endTime = 0;
    activeRatio = 0;
    hoverRatio = 0;
    endWords.forEach((w) => {
      w.ratio = 0;
      w.randCharIndex = Math.floor(Math.random() * Math.max(1, w.chars.length));
      w.chars.forEach((c) => {
        c.style.transform = 'translate3d(0, 100%, 0)';
      });
      w.wrappers.forEach((wr) => {
        wr.style.transform = 'translate3d(0, 0, 0)';
      });
    });
    subWords.forEach((w) => {
      w.style.transform = 'translate3d(0, 200%, 0) rotate(30deg)';
    });
    crosses.forEach((c) => {
      c.style.transform = 'scale(0) rotate(0deg)';
    });
    topDeco.style.transform = 'scale3d(0, 1, 1)';
    botLeftDeco.style.transform = 'scale3d(0, 1, 1)';
    botRightDeco.style.transform = 'scale3d(0, 1, 1)';
    endTitle.classList.remove('is-interactive');
  };

  const updateEndSection = (dt: number) => {
    if (!textSplit || !letsWork.querySelector('.end-section-title-link-word')) {
      // Lang switch wiped text — re-split from data-raw / live textContent
      textSplit = false;
      splitEndText();
      resetEndAnim();
    }
    if (needsEndReset) resetEndAnim();

    const prevTime = endTime;
    // Advance active when finale is up
    activeRatio = saturate(activeRatio + (finaleActive ? dt : -dt));
    hoverRatio = saturate(hoverRatio + (isHover && activeRatio === 1 ? dt : -dt));
    endTime += dt;

    const prevMod = prevTime % ROLLUP_INTERVAL;
    const curMod = endTime % ROLLUP_INTERVAL;
    const crossedInterval = prevMod > curMod; // wrap

    endTitle.style.pointerEvents = finaleActive && activeRatio > 0.75 ? 'auto' : 'none';
    if (finaleActive && activeRatio > 0.75) endTitle.classList.add('is-interactive');
    else endTitle.classList.remove('is-interactive');

    // Crosses
    for (let v = 0; v < crosses.length; v++) {
      const t = crosses.length > 1 ? v / (crosses.length - 1) : 0;
      const T = fit(activeRatio, t * 0.2, t * 0.2 + 0.7, 0, 1, easeLusion);
      const S = fit(T, 0, 1, 0, 1, easeLusion);
      const b = fit(T, 0, 1, 0, 180, easeLusion);
      crosses[v].style.transform = `scale(${S}) rotate(${b}deg)`;
    }

    // Subtitle words
    for (let v = 0; v < subWords.length; v++) {
      const t = subWords.length > 1 ? v / (subWords.length - 1) : 0;
      const M = fit(activeRatio, t * 0.15, t * 0.15 + 0.75, 200, 0, easeLusion);
      const S = fit(activeRatio, t * 0.1, t * 0.1 + 0.8, 30, 0, easeLusion);
      subWords[v].style.transform = `translate3d(0, ${M}%, 0) rotate(${S}deg)`;
    }

    // Title words / chars + rollup
    for (let v = 0; v < endWords.length; v++) {
      const word = endWords[v];
      const T = endWords.length > 1 ? v / (endWords.length - 1) : 0;

      if (crossedInterval) {
        word.randCharIndex = Math.floor(Math.random() * Math.max(1, word.chars.length));
        if (word.ratio === 0) word.ratio = 0.001;
      }
      if (word.ratio > 0) {
        word.ratio = saturate(word.ratio + (finaleActive ? dt / ROLLUP_DURATION : -dt * 2));
        if (word.ratio === 1) word.ratio = 0;
      }

      for (let M = 0; M < word.chars.length; M++) {
        const char = word.chars[M];
        const wrapper = word.wrappers[M];
        const b = word.chars.length > 1 ? M / (word.chars.length - 1) : 0;
        // Desktop reveal: char slides up from 100% → 0
        const C =
          window.innerWidth >= 560
            ? fit(activeRatio, T * 0.15 + b * 0.15, T * 0.15 + b * 0.15 + 0.7, 100, 0, easeLusion)
            : 0;
        char.style.transform = `translate3d(0, ${C}%, 0)`;

        if (M === word.randCharIndex) {
          const roll = fit(word.ratio, T * 0.2, T * 0.2 + 0.8, 0, -100, easeLusion);
          wrapper.style.transform = `translate3d(0, ${roll}%, 0)`;
        } else {
          wrapper.style.transform = 'translateZ(0)';
        }
      }
    }

    // Hover decorations
    topDeco.style.transform = `scale3d(${fit(hoverRatio, 0, 0.7, 0, 1, easeCubicInOut)}, 1, 1)`;
    const g = fit(hoverRatio, 0.2, 1, 0, 1, easeCubicInOut);
    botLeftDeco.style.transform = `scale3d(${fit(g, 0, 0.35, 0, 1)}, 1, 1)`;
    botRightDeco.style.transform = `scale3d(${fit(g, 0.4, 1, 0, 1)}, 1, 1)`;

    // Soft scale of whole content as section settles (Lusion hideScreenOffset)
    const a = fit(activeRatio, 0, 1, 0.96, 1, easeLusion);
    endContent.style.transform = `translate3d(-50%, -50%, 0) scale3d(${a}, ${a}, ${a})`;
  };

  const activateFinale = () => {
    if (finaleActive) return;
    finaleActive = true;
    if (!textSplit) splitEndText();
    needsEndReset = true;
    gsap.to(endBottom, { autoAlpha: 1, y: 0, duration: 0.55, delay: 0.55, ease: 'power3.out' });
  };

  // Pre-split so first paint of finale is ready
  splitEndText();
  resetEndAnim();

  const ticker = (_time: number, delta: number) => {
    if (!finaleActive && activeRatio <= 0 && !needsEndReset) return;
    const dt = Math.min(0.05, delta / 1000);
    updateEndSection(dt);
  };
  gsap.ticker.add(ticker);

  const onTitleEnter = () => {
    isHover = true;
  };
  const onTitleLeave = () => {
    isHover = false;
  };
  endTitle.addEventListener('mouseenter', onTitleEnter);
  endTitle.addEventListener('mouseleave', onTitleLeave);

  const resplitFromLang = () => {
    // LanguageController wrote plain textContent — drop cached raw so we re-read
    letsWork.removeAttribute('data-raw');
    endSubtitle.removeAttribute('data-raw');
    textSplit = false;
    splitEndText();
    if (finaleActive) {
      needsEndReset = true;
      // Keep bottom visible if already in finale
      gsap.set(endBottom, { autoAlpha: 1, y: 0 });
    } else {
      resetEndAnim();
    }
  };
  const onLangChange = () => resplitFromLang();
  window.addEventListener('app:langchange', onLangChange);

  // Experience window: the device-frame story sequence is visible across tl
  // progress [0.4, 0.82), then crossfades into the finale. Each of the 7
  // photos owns an equal slice of that window — no click/hover gate, it
  // plays purely off scroll position, like scrubbing a video timeline.
  const EXPERIENCE_IN = 0.4;
  const EXPERIENCE_OUT = 0.82;
  const STEP_COUNT = experienceImgs.length;
  const STEP_SIZE = (EXPERIENCE_OUT - EXPERIENCE_IN) / STEP_COUNT;
  let activeStep = -1;
  // True while tl's scroll progress sits inside the story window — gates
  // both the scroll-driven step math and the idle-autoplay loop below.
  let experienceActive = false;

  const applyStepClasses = (idx: number) => {
    experienceImgs.forEach((img, i) => img.classList.toggle('is-active', i === idx));
    headlineEls.forEach((el, i) => el.classList.toggle('is-active', i === idx));
  };

  const updateExperienceStep = (progress: number) => {
    const raw = fit(progress, EXPERIENCE_IN, EXPERIENCE_OUT, 0, STEP_COUNT);
    const idx = Math.min(STEP_COUNT - 1, Math.max(0, Math.floor(raw)));
    const within = Math.min(1, Math.max(0, raw - idx));

    if (idx !== activeStep) {
      activeStep = idx;
      applyStepClasses(idx);
      autoplayStepStart = performance.now();
    }

    progressSegs.forEach((seg, i) => {
      const fillPct = i < idx ? 100 : i === idx ? within * 100 : 0;
      seg.style.width = `${fillPct}%`;
    });
  };

  const resetExperienceStep = () => {
    if (activeStep === -1) return;
    activeStep = -1;
    applyStepClasses(0);
    progressSegs.forEach((seg) => {
      seg.style.width = '0%';
    });
  };

  // Idle autoplay: once the story frame is on screen and the visitor hasn't
  // scrolled/touched/pressed a key for a beat, keep the pages advancing on
  // their own — looping back to step 0 after the last one — so the story
  // reads even if nobody scrolls. Any real scroll/touch/key input hands
  // control straight back to the scrollbar-driven position.
  const AUTOPLAY_IDLE_DELAY = 1200;
  const AUTOPLAY_STEP_DURATION = 3400;
  let lastInputAt = 0;
  let autoplayStepStart = 0;
  let autoplayRAF = 0;

  const markInput = () => {
    lastInputAt = performance.now();
  };
  // wheel/touch input itself is marked by the pagination handlers below
  // (they need to run first to intercept the event); keydown has no
  // dedicated handler, so it just marks input directly.
  window.addEventListener('keydown', markInput);

  const autoplayTick = (now: number) => {
    autoplayRAF = requestAnimationFrame(autoplayTick);

    if (!experienceActive || activeStep === -1) {
      autoplayStepStart = now;
      return;
    }

    const idle = now - lastInputAt;
    if (idle < AUTOPLAY_IDLE_DELAY) {
      autoplayStepStart = now;
      return;
    }

    const elapsed = now - autoplayStepStart;
    const seg = progressSegs[activeStep];
    if (seg) seg.style.width = `${Math.min(100, (elapsed / AUTOPLAY_STEP_DURATION) * 100)}%`;

    if (elapsed >= AUTOPLAY_STEP_DURATION) {
      const next = (activeStep + 1) % STEP_COUNT;
      activeStep = next;
      applyStepClasses(next);
      progressSegs.forEach((s, i) => {
        s.style.width = next === 0 ? '0%' : i < next ? '100%' : '0%';
      });
      autoplayStepStart = now;
    }
  };
  autoplayRAF = requestAnimationFrame(autoplayTick);

  // Snap only inside the story window: each scroll gesture settles on the
  // nearest whole page instead of leaving the crossfade mid-flight. Outside
  // that window (title reveal, finale) progress stays freely scrubbed.
  const snapExperienceStep = (value: number): number => {
    if (value <= EXPERIENCE_IN || value >= EXPERIENCE_OUT) return value;
    const rel = (value - EXPERIENCE_IN) / STEP_SIZE;
    const idx = Math.min(STEP_COUNT - 1, Math.max(0, Math.round(rel)));
    return EXPERIENCE_IN + idx * STEP_SIZE;
  };

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * 1.8}`,
      scrub: 1,
      pin: track,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      snap: {
        snapTo: snapExperienceStep,
        duration: { min: 0.2, max: 0.6 },
        ease: 'power1.inOut',
      },
      onUpdate: (self) => {
        const inExperience = self.progress >= EXPERIENCE_IN && self.progress < EXPERIENCE_OUT;
        experienceActive = inExperience;
        experienceFrame.classList.toggle('is-playing', inExperience);
        if (inExperience) {
          updateExperienceStep(self.progress);
        } else if (self.progress < EXPERIENCE_IN) {
          resetExperienceStep();
        }
      },
    },
  });

  // One-step-per-gesture pagination inside the story window: wheel/touch
  // input is intercepted and always moves exactly one page, then locks out
  // further input for a beat so a single fast flick or trackpad swipe can't
  // blow through several pages at once. At the first/last page, input is
  // left alone so the visitor can keep scrolling into the intro or finale.
  const st = tl.scrollTrigger!;
  const WHEEL_COOLDOWN = 850;
  const TOUCH_THRESHOLD = 36;
  let paginateLocked = false;
  let paginateLockTimer = 0;
  let touchStartY = 0;
  let touchHandled = false;

  const stepProgress = (idx: number) => EXPERIENCE_IN + idx * STEP_SIZE;

  const goToStep = (idx: number) => {
    const clamped = Math.min(STEP_COUNT - 1, Math.max(0, idx));
    const targetScroll = st.start + (st.end - st.start) * stepProgress(clamped);
    const proxy = { v: st.scroll() };
    gsap.to(proxy, {
      v: targetScroll,
      duration: 0.7,
      ease: 'power2.inOut',
      onUpdate: () => st.scroll(proxy.v),
    });
  };

  const lockPaginate = () => {
    paginateLocked = true;
    window.clearTimeout(paginateLockTimer);
    paginateLockTimer = window.setTimeout(() => {
      paginateLocked = false;
    }, WHEEL_COOLDOWN);
  };

  const onWheel = (e: WheelEvent) => {
    markInput();
    if (!experienceActive) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (activeStep === 0 && dir < 0) return; // let the scroll continue back into the intro
    if (activeStep === STEP_COUNT - 1 && dir > 0) return; // let the scroll continue on into the finale
    e.preventDefault();
    if (paginateLocked) return;
    lockPaginate();
    goToStep(activeStep + dir);
  };

  const onTouchStart = (e: TouchEvent) => {
    markInput();
    touchStartY = e.touches[0]?.clientY ?? 0;
    touchHandled = false;
  };

  const onTouchMove = (e: TouchEvent) => {
    markInput();
    if (!experienceActive || touchHandled || paginateLocked) return;
    const y = e.touches[0]?.clientY ?? touchStartY;
    const delta = touchStartY - y; // positive = finger dragged up = scrolling down
    const dir = delta > 0 ? 1 : -1;
    if (activeStep === 0 && dir < 0) return;
    if (activeStep === STEP_COUNT - 1 && dir > 0) return;
    if (Math.abs(delta) < TOUCH_THRESHOLD) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    touchHandled = true;
    lockPaginate();
    goToStep(activeStep + dir);
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });

  tl.to(title, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' }, 0.02);
  tl.to(desc, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' }, 0.08);

  tl.to(title, { x: -160, autoAlpha: 0, duration: 0.28, ease: 'power2.in' }, 0.32);
  tl.to(desc, { x: 180, autoAlpha: 0, duration: 0.28, ease: 'power2.in' }, 0.34);
  tl.to(intro, { autoAlpha: 0, duration: 0.12 }, 0.4);
  tl.to(experienceFrame, { autoAlpha: 1, duration: 0.14 }, 0.4);

  tl.to({}, { duration: 0.28 }, 0.44); // hold — story sequence plays through this range

  tl.to(experienceFrame, { autoAlpha: 0, duration: 0.14 }, 0.8);
  tl.to(
    finale,
    {
      autoAlpha: 1,
      duration: 0.2,
      onStart: () => activateFinale(),
    },
    0.82,
  );
  tl.to({}, { duration: 0.13 }, 0.95);

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
    gsap.ticker.remove(ticker);
    cancelAnimationFrame(autoplayRAF);
    window.clearTimeout(paginateLockTimer);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', markInput);
    window.removeEventListener('app:langchange', onLangChange);
    endTitle.removeEventListener('mouseenter', onTitleEnter);
    endTitle.removeEventListener('mouseleave', onTitleLeave);
  };
}
