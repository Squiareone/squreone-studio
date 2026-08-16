import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bindLusionFaceCursor } from './LusionFaceCursor';

gsap.registerPlugin(ScrollTrigger);

export type ScrollToFn = (target: string, opts?: { offset?: number }) => void;

/**
 * Sequential multi-panel home (NOT left+right on same screen):
 *   panel1 Shaping Brands → panel2 We are a design-built → panel3 Story
 * Text motion still uses Lusion-style per-word opacity + translate3d.
 */
const RANGE_START_WAIT = 2.2;
const RANGE_SLIDE_12 = 1.6;
const RANGE_SLIDE_23 = 1.5;
const RANGE_END_WAIT = 1.0;
export const HOME_PIN_VH = RANGE_START_WAIT + RANGE_SLIDE_12 + RANGE_SLIDE_23 + RANGE_END_WAIT;

/** Same scrubbed progress as home pin visuals (story arrow must use this, not a raw ST). */
const homeHeroProgressListeners = new Set<(p: number) => void>();
let lastHomeHeroProgress = 0;

function easeCubicOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeCubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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

function units(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('.word-wrap'));
}

/**
 * Group word-wraps by visual line (offsetTop).
 * Lusion animates whole lines / keeps same-line words glued — different per-word x
 * causes "your" + "business" to overlap. Same line → same transform.
 */
function groupByLine(els: HTMLElement[]): HTMLElement[][] {
  if (!els.length) return [];
  const lines: HTMLElement[][] = [];
  let row: HTMLElement[] = [];
  let lastTop = Number.NaN;

  // Force layout read after any previous transforms reset
  els.forEach((el) => {
    const top = el.offsetTop;
    if (row.length && Math.abs(top - lastTop) > 3) {
      lines.push(row);
      row = [];
    }
    row.push(el);
    lastTop = top;
  });
  if (row.length) lines.push(row);
  return lines;
}

/** Apply identical x/opacity to every word on a line (no intra-line overlap). */
function setLineMotion(line: HTMLElement[], x: number, opacity: number): void {
  line.forEach((el) => {
    gsap.set(el, { x, opacity, force3D: true });
  });
}

export function initHomeHeroTimeline(onProgress?: (p: number) => void): () => void {
  const section = document.getElementById('home-hero');
  const pinEl = document.getElementById('home-hero-pin');
  const track = document.getElementById('home-hero-track');
  const title = document.getElementById('hero-title');
  const hint = document.getElementById('hero-scroll-hint');
  const secondary = document.getElementById('hero-secondary-title');
  const storyTitle = document.getElementById('story-detail-title');
  const storyText = document.getElementById('story-detail-text');

  if (!section || !pinEl || !track) return () => {};

  gsap.killTweensOf([track, title, hint, secondary, storyTitle, storyText, pinEl]);
  gsap.killTweensOf(
    '#hero-title .word-wrap, #hero-secondary-title .word-wrap, #story-detail-title .word-wrap, #story-detail-text .word-wrap',
  );

  gsap.set(track, { x: 0, xPercent: 0, y: 0, force3D: true });
  gsap.set('#hero-title .word', { yPercent: 0, autoAlpha: 1 });

  const tHold = RANGE_START_WAIT / HOME_PIN_VH;
  const tP2 = (RANGE_START_WAIT + RANGE_SLIDE_12) / HOME_PIN_VH;
  const tP3 = (RANGE_START_WAIT + RANGE_SLIDE_12 + RANGE_SLIDE_23) / HOME_PIN_VH;

  // Cache line groups after layout is ready (refreshed on resize via onRefresh)
  let titleLines: HTMLElement[][] = [];
  let secondaryLines: HTMLElement[][] = [];
  let storyTitleLines: HTMLElement[][] = [];
  let storyTextLines: HTMLElement[][] = [];

  const rebuildLines = () => {
    // Reset transforms so offsetTop reflects true layout positions
    const all = [
      ...units(title),
      ...units(secondary),
      ...units(storyTitle),
      ...units(storyText),
    ];
    all.forEach((el) => gsap.set(el, { x: 0, y: 0, clearProps: 'transform' }));
    titleLines = groupByLine(units(title));
    secondaryLines = groupByLine(units(secondary));
    storyTitleLines = groupByLine(units(storyTitle));
    storyTextLines = groupByLine(units(storyText));
  };

  const applyProgress = (p: number) => {
    onProgress?.(p);
    // Same scrubbed progress as the pin — story arrow must use this, not a raw ST
    lastHomeHeroProgress = p;
    homeHeroProgressListeners.forEach((fn) => fn(p));

    const unit = Math.max(60, window.innerWidth * 0.08);

    let xPercent = 0;
    let slide12 = 0;
    let slide23 = 0;

    if (p <= tHold) {
      xPercent = 0;
    } else if (p <= tP2) {
      slide12 = (p - tHold) / (tP2 - tHold);
      xPercent = -33.333 * easeCubicInOut(slide12);
    } else if (p <= tP3) {
      slide12 = 1;
      slide23 = (p - tP2) / (tP3 - tP2);
      xPercent = -33.333 - 33.333 * easeCubicInOut(slide23);
    } else {
      slide12 = 1;
      slide23 = 1;
      xPercent = -66.666;
    }

    gsap.set(track, { xPercent, x: 0, force3D: true });

    if (hint) {
      const hide = fit(p, tHold * 0.72, tHold + (tP2 - tHold) * 0.2, 0, 1, easeCubicOut);
      gsap.set(hint, { opacity: 1 - hide, y: hide * unit * 1.2, force3D: true });
    }

    // Panel 1 — exit left, stagger by LINE only
    if (!titleLines.length && units(title).length) rebuildLines();
    titleLines.forEach((line, li) => {
      const n = Math.max(1, titleLines.length - 1);
      const s = n === 0 ? 0 : li / n;
      if (slide12 <= 0.001) {
        setLineMotion(line, 0, 1);
        return;
      }
      const leave = fit(slide12, s * 0.1, 0.55 + s * 0.25, 0, 1, easeCubicOut);
      const drift = fit(slide12, 0, 0.55, 0, -6, easeCubicOut);
      setLineMotion(line, (leave * 1.2 + drift) * unit, 1 - leave * 0.98);
    });

    // Panel 2 — enter from right / exit left, stagger by LINE only
    if (!secondaryLines.length && units(secondary).length) rebuildLines();
    if (secondaryLines.length) {
      secondaryLines.forEach((line, li) => {
        const n = Math.max(1, secondaryLines.length - 1);
        const s = n === 0 ? 0 : li / n;
        const enter = fit(slide12, 0.1 + s * 0.08, 0.6 + s * 0.25, 0, 1, easeCubicOut);
        const leave = fit(slide23, s * 0.08, 0.52 + s * 0.25, 0, 1, easeCubicOut);
        const show = Math.max(0, enter - leave);
        const x = ((1 - enter) * 7 - leave * 6) * unit;
        setLineMotion(line, x, show);
      });
    } else if (secondary) {
      const enter = fit(slide12, 0.18, 0.78, 0, 1, easeCubicOut);
      const leave = fit(slide23, 0.05, 0.55, 0, 1, easeCubicOut);
      gsap.set(secondary, {
        x: ((1 - enter) * 8 - leave * 6) * unit,
        opacity: Math.max(0, enter - leave),
        force3D: true,
      });
    }

    // Panel 3 title — enter from left, stagger by LINE only
    if (!storyTitleLines.length && units(storyTitle).length) rebuildLines();
    if (storyTitleLines.length) {
      storyTitleLines.forEach((line, li) => {
        const n = Math.max(1, storyTitleLines.length - 1);
        const s = n === 0 ? 0 : li / n;
        const enter = fit(slide23, 0.06 + s * 0.1, 0.58 + s * 0.22, 0, 1, easeCubicOut);
        setLineMotion(line, (1 - enter) * -6.5 * unit, enter);
      });
    } else if (storyTitle) {
      const enter = fit(slide23, 0.12, 0.7, 0, 1, easeCubicOut);
      gsap.set(storyTitle, { x: (1 - enter) * -7 * unit, opacity: enter, force3D: true });
    }

    // Panel 3 body — enter from right, stagger by LINE only (never per-word x)
    if (!storyTextLines.length && units(storyText).length) rebuildLines();
    if (storyTextLines.length) {
      storyTextLines.forEach((line, li) => {
        const n = Math.max(1, storyTextLines.length - 1);
        const s = n === 0 ? 0 : li / n;
        const enter = fit(slide23, 0.15 + s * 0.12, 0.7 + s * 0.22, 0, 1, easeCubicOut);
        // whole line shares one x — "your" / "business" never cross
        setLineMotion(line, (1 - enter) * 9 * unit, enter);
      });
    } else if (storyText) {
      const enter = fit(slide23, 0.25, 0.9, 0, 1, easeCubicOut);
      gsap.set(storyText, {
        x: (1 - enter) * 12 * unit,
        opacity: enter,
        force3D: true,
      });
    }
  };

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * HOME_PIN_VH}`,
    scrub: 0.85,
    pin: pinEl,
    pinSpacing: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => applyProgress(self.progress),
    onRefresh: (self) => {
      rebuildLines();
      applyProgress(self.progress);
    },
  });

  // After pin layout settles, measure lines then paint frame 0
  requestAnimationFrame(() => {
    rebuildLines();
    applyProgress(0);
  });

  return () => {
    st.kill();
  };
}

export function prepareHeroText(
  i18n: { text: { heroTitle: string; heroSecondary: string; storyTitle: string; detailText: string } },
  i18nCtrl: {
    splitTextIntoWords: (el: HTMLElement) => HTMLSpanElement[];
  },
): void {
  const title = document.getElementById('hero-title');
  const secondary = document.getElementById('hero-secondary-title');
  const storyTitle = document.getElementById('story-detail-title');
  const detail = document.getElementById('story-detail-text');

  const split = (el: HTMLElement | null, text: string) => {
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.killTweensOf(el.querySelectorAll('.word, .word-wrap'));
    el.textContent = text;
    i18nCtrl.splitTextIntoWords(el);
  };

  split(title, i18n.text.heroTitle);
  split(secondary, i18n.text.heroSecondary);
  split(storyTitle, i18n.text.storyTitle);
  split(detail, i18n.text.detailText);
}

/**
 * story-next-arrow
 *
 * SHOW TIMING (product, not Lusion): original end-wait of home pin
 *   progress ∈ [endWaitStart, 0.999) using the SAME scrubbed pin progress
 *   as the panel visuals (applyProgress).
 *
 * MOTION (Lusion): #about-who-face-cursor math via bindLusionFaceCursor.
 *
 * Do not couple show timing to hover ramps beyond Lusion activeRatio entrance.
 */
export function initStoryNextArrow(scrollTo: ScrollToFn): () => void {
  const domCursor = document.getElementById('story-next-arrow');
  const domCursorArrow = document.getElementById('story-next-arrow-svg');
  if (!domCursor) return () => {};

  const endWaitStart = (RANGE_START_WAIT + RANGE_SLIDE_12 + RANGE_SLIDE_23) / HOME_PIN_VH;
  const aboutTarget = '#about-capability';
  const aboutOffset = 0;
  const WHEEL_TRIGGER_THRESHOLD = 180;
  const WHEEL_RESET_GAP_MS = 240;
  const LAST_FRAME_HOLD_MS = 420;

  let atLastFrame = false;
  let jumping = false;
  let lastFrameEnteredAt = 0;
  let wheelDownAccum = 0;
  let lastWheelTs = 0;

  const setMobileVisible = (show: boolean) => {
    domCursor.classList.toggle('is-visible', show);
  };

  const syncFromProgress = (p: number) => {
    const wasAtLastFrame = atLastFrame;
    // Original threshold — unchanged
    atLastFrame = p >= endWaitStart && p < 0.999;
    if (atLastFrame && !wasAtLastFrame) {
      lastFrameEnteredAt = performance.now();
      wheelDownAccum = 0;
      lastWheelTs = 0;
    }
    if (!atLastFrame && wasAtLastFrame) {
      wheelDownAccum = 0;
      lastWheelTs = 0;
    }
    setMobileVisible(atLastFrame && !jumping);
  };
  homeHeroProgressListeners.add(syncFromProgress);
  syncFromProgress(lastHomeHeroProgress);

  const jump = () => {
    if (jumping) return;
    jumping = true;
    wheelDownAccum = 0;
    lastWheelTs = 0;
    setMobileVisible(false);
    scrollTo(aboutTarget, { offset: aboutOffset });
    window.setTimeout(() => {
      jumping = false;
      setMobileVisible(atLastFrame && !jumping);
    }, 900);
  };

  const faceZone = document.getElementById('story-next-cursor-zone');

  const faceCursor = bindLusionFaceCursor({
    el: domCursor,
    arrowEl: domCursorArrow,
    // Lusion `c` — team subsection visible. We use original end-wait scroll gate.
    isSectionActive: () => atLastFrame && !jumping,
    /*
     * Lusion: mouse must be over #about-who-team-faces (left mass), NOT team-right.
     * We measure #story-next-cursor-zone (left ~70vw) every frame.
     * Moving into the right copy area → overFace=false → scale-out / hide.
     */
    getFaceRect: () => {
      if (faceZone) {
        const r = faceZone.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      }
      // Fallback: left 58% of viewport
      return {
        x: 0,
        y: 0,
        width: window.innerWidth * 0.58,
        height: window.innerHeight,
      };
    },
    isMobile: () => window.innerWidth <= 767,
  });

  const onDocClick = (e: MouseEvent) => {
    if (!atLastFrame || jumping || window.innerWidth <= 767) return;
    if (faceCursor.hitTest(e.clientX, e.clientY)) {
      e.preventDefault();
      jump();
    }
  };
  document.addEventListener('click', onDocClick, true);

  const onWheel = (e: WheelEvent) => {
    // Keep click and wheel behavior consistent: from the last home frame,
    // scrolling down should land on the same about-capability anchor.
    if (!atLastFrame || jumping) return;
    const now = performance.now();
    // Keep button visible shortly after arriving at this frame.
    if (now - lastFrameEnteredAt < LAST_FRAME_HOLD_MS) return;
    if (e.deltaY <= 0) {
      wheelDownAccum = 0;
      lastWheelTs = now;
      return;
    }
    if (now - lastWheelTs > WHEEL_RESET_GAP_MS) {
      wheelDownAccum = 0;
    }
    lastWheelTs = now;
    wheelDownAccum += e.deltaY;
    if (wheelDownAccum >= WHEEL_TRIGGER_THRESHOLD) {
      jump();
    }
  };
  window.addEventListener('wheel', onWheel, { passive: true });

  const onBtnClick = (e: Event) => {
    if (window.innerWidth > 767) return;
    e.preventDefault();
    jump();
  };
  domCursor.addEventListener('click', onBtnClick);

  /*
   * Do NOT intercept wheel with preventDefault + programmatic jump.
   * That fights Lenis at the home↔expertise boundary and feels like a hitch
   * both scrolling down into expertise and back up into the pin.
   * Natural pin end releases into #about-capability; click still jumps.
   */
  return () => {
    homeHeroProgressListeners.delete(syncFromProgress);
    faceCursor();
    document.removeEventListener('click', onDocClick, true);
    window.removeEventListener('wheel', onWheel);
    domCursor.removeEventListener('click', onBtnClick);
  };
}

/**
 * AREA OF EXPERTISE — Lusion AboutCapabilitySection port.
 *
 * Key Lusion rules we previously got wrong:
 * 1) Card fan uses SECTION screenRatio (not wrapper ST progress)
 * 2) Vertical motion is getEaseInOutOffset over viewportHeight*3
 *    (not a harsh mid-viewport map that flings cards up)
 * 3) Long cards-wrapper margin (~300vh) so section stays active while animating
 * 4) No S/B/T/G letter chips (not in original SquareOne design)
 */
export function initCapabilityTimeline(): () => void {
  const section = document.getElementById('about-capability');
  const title = document.getElementById('about-capability-title');
  const line1 = document.getElementById('about-capability-title-line-1');
  const line2 = document.getElementById('about-capability-title-line-2');
  const subText = document.getElementById('about-capability-subheader-text');
  const cardsWrapper = document.getElementById('about-capability-cards-wrapper');
  const cardsEl = document.getElementById('about-capability-cards');
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.about-capability-card'));

  if (!section || !title || !line1 || !line2 || !subText || !cardsWrapper || !cardsEl || !cards.length) {
    return () => {};
  }

  const NUMBER_OF_CARDS = cards.length;
  const DESKTOP_FAN_MIN_WIDTH = 901;
  let titleTime = 0;
  let needsReset = true;
  let sectionActive = false;
  let titleInView = false;
  let line2TranslateX = 0;
  let cardW = 0;
  let wrapperW = 0;
  let cardOffset = 0;
  let elapsed = 0;

  const easeLusion = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  };
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

  /**
   * Port of Lusion scrollManager.getEaseInOutOffset(e, t, r=0, n=0.5)
   * Cards call: getEaseInOutOffset(e, viewportHeight * 3, 5, 1)
   */
  const getEaseInOutOffset = (e: number, t: number, r = 0, n = 0.5): number => {
    const a = 1.5 + n;
    const l = (a - 1) * 2 + r;
    const c = 0;
    const u = a;
    const f = u + r;
    const p = f + a;
    const g = (t * p) / l;
    const v = e + g * 0.5 - t * 0.5;
    const _ = Math.min(1, v / g);
    if (!(_ > 0)) return 0;
    const M = _ * p;
    let T = M;
    if (M > c && M <= u) {
      const S = (M - c) / (u - c);
      // cubicBezier(c, (u-c)/3+c, 1, 1, S) simplified ≈ ease toward 1
      T = c + (1 - c) * (S * S * (3 - 2 * S));
    } else if (M > u && M <= f) {
      T = 1;
    } else if (M > f && M <= p) {
      const S = (M - f) / (p - f);
      T = 1 + (2 - 1) * (S * S * (3 - 2 * S));
      // ease from 1 toward 2
      T = 1 + S * S * (3 - 2 * S);
    } else if (M > p) {
      T = M - l;
    }
    return ((M - T) / l) * t;
  };

  /** Lusion ScrollDomRange.screenRatio approx from getBoundingClientRect */
  const getScreenRatio = (el: HTMLElement): number => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // fit(rect.top, vh, -height, -1, 1)
    return fit(rect.top, vh, -rect.height, -1, 1);
  };

  const splitTitle = () => {
    const prepLine = (lineEl: HTMLElement) => {
      const raw = (lineEl.textContent || '').replace(/\s+/g, ' ').trim();
      lineEl.replaceChildren();
      // ZH uses one line only (line2 empty) — hide so it does not take a row
      if (!raw) {
        lineEl.style.display = 'none';
        lineEl.setAttribute('aria-hidden', 'true');
        return;
      }
      lineEl.style.display = '';
      lineEl.removeAttribute('aria-hidden');
      const mask = document.createElement('div');
      mask.className = 'cap-line-mask';
      // CJK titles have no spaces — treat whole string as one unit
      const tokens = /[\u3400-\u9fff]/.test(raw) ? [raw] : raw.split(' ').filter(Boolean);
      tokens.forEach((w, i, arr) => {
        const word = document.createElement('span');
        word.className = 'cap-word';
        word.textContent = w;
        if (i < arr.length - 1) word.style.marginRight = '0.28em';
        mask.appendChild(word);
      });
      lineEl.appendChild(mask);
    };
    prepLine(line1);
    prepLine(line2);
  };

  const splitSubheader = () => {
    const raw = (subText.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw) return;
    subText.textContent = '';
    const words = raw.split(' ');
    const mid = Math.ceil(words.length / 2);
    const chunks = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean);
    chunks.forEach((chunk) => {
      const mask = document.createElement('div');
      mask.className = 'cap-line-mask';
      const line = document.createElement('span');
      line.className = 'cap-line';
      line.textContent = chunk;
      mask.appendChild(line);
      subText.appendChild(mask);
    });
  };

  const getTitleWords = () => Array.from(title.querySelectorAll<HTMLElement>('.cap-word'));
  const getSubLines = () => Array.from(subText.querySelectorAll<HTMLElement>('.cap-line'));

  const resetTitleAnim = () => {
    titleTime = 0;
    needsReset = false;
    getTitleWords().forEach((w) => {
      w.style.transform = 'translate3d(0, 100%, 0)';
    });
    getSubLines().forEach((l) => {
      l.style.transform = 'translate3d(0, 110%, 0)';
    });
  };

  const measure = () => {
    const first = cards[0];
    if (!first) return;
    // Clear transforms so width/height reflect CSS layout, not fan offsets
    cards.forEach((c) => {
      c.style.transform = 'none';
    });
    cardsEl.style.transform = 'none';

    wrapperW = cardsWrapper.clientWidth || cardsWrapper.getBoundingClientRect().width;
    // offsetWidth after transform:none = CSS calc((100% - gap*3)/4) in real px
    cardW = first.offsetWidth || first.getBoundingClientRect().width;
    if (!(cardW > 0) && wrapperW > 0) {
      // Fallback if not laid out yet — approximate 4-up with typical gap
      cardW = wrapperW / NUMBER_OF_CARDS;
    }
    const cardH =
      first.offsetHeight ||
      first.getBoundingClientRect().height ||
      cardW * (438 / 314);

    if (window.innerWidth >= DESKTOP_FAN_MIN_WIDTH) {
      cardsEl.style.height = `${cardH}px`;
    } else {
      cardsEl.style.height = 'auto';
    }
    // Space between first and last card when fully fanned (Lusion cardOffset)
    cardOffset = Math.max(0, wrapperW - cardW * NUMBER_OF_CARDS);
    const l1 = line1.getBoundingClientRect();
    // line2 may be empty/hidden in ZH — only measure offset when it has content
    if (line2.querySelector('.cap-word')) {
      const l2 = line2.getBoundingClientRect();
      line2TranslateX = l2.left - l1.left;
    } else {
      line2TranslateX = 0;
    }
  };

  const applyTitle = () => {
    // Rebuild when i18n wiped text (no .cap-word on line1).
    // Do NOT require line2 words — ZH keeps line2 empty on purpose.
    if (!line1.querySelector('.cap-word')) {
      splitTitle();
      measure();
      resetTitleAnim();
    }
    if (!subText.querySelector('.cap-line')) {
      splitSubheader();
      resetTitleAnim();
    }

    const words = getTitleWords();
    // EN: first 2 words = "AREA OF" (line1); rest = "EXPERTISE" (line2, with left offset).
    // ZH: single word "专业领域" on line1 only — all use the line1 y-entrance.
    const line1WordCount = line1.querySelectorAll('.cap-word').length || 2;
    words.forEach((u, f) => {
      if (window.innerWidth <= 767) {
        u.style.transform = 'translate3d(0, 0, 0)';
        return;
      }
      if (f < line1WordCount) {
        const py = fit(titleTime - f / 10, 0, 1, 100, 0, easeLusion);
        u.style.transform = `translate3d(0, ${py}%, 0)`;
      } else {
        const px = fit(titleTime - f / 10, 1, 2, -line2TranslateX, 0, easeLusion);
        const py = fit(titleTime - f / 10, 0.1, 1.1, -100, 0, easeLusion);
        u.style.transform = `translate3d(${px}px, ${py}%, 0)`;
      }
    });
    getSubLines().forEach((u, f) => {
      const g = titleInView ? Math.min(1, Math.max(0, titleTime - f / 10 - 0.25)) : 0;
      const v = window.innerWidth >= 768 ? easeExpoOut(g) : 1;
      u.style.transform = `translate3d(0, ${fit(v, 0, 1, 110, 0)}%, 0)`;
    });
  };

  const applyCardsFromSection = (dt: number) => {
    elapsed += dt;
    const isDesktop = window.innerWidth >= DESKTOP_FAN_MIN_WIDTH;
    // CRITICAL: use SECTION screenRatio like Lusion (t.screenRatio on domContainer)
    const screenRatio = getScreenRatio(section);

    const n = fit(screenRatio, -0.6, 0.2, 0, 1);
    const a = fit(screenRatio, -0.5, 0.7, 0, 1);
    const l = fit(screenRatio, -0.5, 0.7, -Math.PI / 2, Math.PI - Math.PI / 2);

    if (isDesktop) {
      if (!(wrapperW > 0) || !(cardW > 0)) measure();

      // Lusion vertical offset: getEaseInOutOffset(e, vh*3, 5, 1)
      // e = -rect.top + (vh - height) * 0.5  (center-to-center scroll metric)
      const wrapRect = cardsWrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const e = -wrapRect.top + (vh - wrapRect.height) * 0.5;
      const f = getEaseInOutOffset(e, vh * 3, 5, 1);
      cardsEl.style.transform = `translate3d(0, ${f}px, 0)`;

      const nCards = NUMBER_OF_CARDS;
      const span =
        nCards > 1 ? wrapperW + cardOffset / (nCards - 1) : wrapperW;
      const center = Math.max(0, wrapperW / 2 - cardW / 2);

      for (let p = 0; p < nCards; p++) {
        const v = cards[p];
        // Lusion: target = p/N * (wrapperW + cardOffset/(N-1))
        // clamp so last card's left edge stays within wrapper (no right blank / left bleed)
        const target = Math.min(
          Math.max(0, wrapperW - cardW),
          (p / nCards) * span,
        );
        const M = fit(n, 0.2, 1, center, target, easeExpoOut);
        const S = fit(a, 0, 0.7 - Math.abs(nCards - 1 - p) / 20, 180, 0, easeBackInOut);
        const b = fit(Math.abs(fit(n, 0, 0.75, 0, 1) * 2 - 1), 1, 0, 0, (p - 1.5) * 9, easeExpoInOut);
        const C = Math.cos(elapsed * 3 + p) * Math.cos(l);
        v.style.transform = `translate3d(${M}px, ${C * 10}px, 0) rotateZ(${b}deg) rotate3d(0, 1, 0, ${S}deg)`;
      }
    } else {
      cardsEl.style.transform = 'none';
      cards.forEach((v, p) => {
        const ratio = getScreenRatio(v);
        const T = fit(ratio, -0.85 - (p % 2) / 10, 0, 180, 0, easeCubicInOut);
        v.style.transform = `rotateY(${T}deg)`;
      });
    }
  };

  const sectionST = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      sectionActive = self.isActive;
      if (sectionActive && needsReset) resetTitleAnim();
      if (!sectionActive) needsReset = true;
    },
    onEnter: () => {
      sectionActive = true;
      if (needsReset) resetTitleAnim();
    },
    onEnterBack: () => {
      sectionActive = true;
      if (needsReset) resetTitleAnim();
    },
    onLeave: () => {
      sectionActive = false;
      needsReset = true;
    },
    onLeaveBack: () => {
      sectionActive = false;
      needsReset = true;
    },
  });

  const titleST = ScrollTrigger.create({
    trigger: title,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      // Lusion: titleTime advances when title.screenRatio > -1 (in/near view)
      titleInView = self.isActive;
    },
  });

  // Drive cards every frame from live section geometry (not a short scrub range)
  const ticker = (_time: number, delta: number) => {
    const dt = Math.min(0.05, delta / 1000);
    if (sectionActive) {
      if (titleInView) {
        titleTime += dt;
        applyTitle();
      }
      applyCardsFromSection(dt);
    }
  };
  gsap.ticker.add(ticker);

  const onResize = () => {
    measure();
    applyTitle();
    applyCardsFromSection(0);
  };

  splitTitle();
  splitSubheader();
  requestAnimationFrame(() => {
    measure();
    resetTitleAnim();
    applyCardsFromSection(0);
    ScrollTrigger.refresh();
  });

  window.addEventListener('resize', onResize);

  return () => {
    sectionST.kill();
    titleST.kill();
    gsap.ticker.remove(ticker);
    window.removeEventListener('resize', onResize);
  };
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

  const isCjk = (s: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(s);

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
