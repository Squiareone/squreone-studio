import './styles/main.css';
import { Engine } from './webgl/Engine';
import { AboutHero } from './webgl/AboutHero';
import {
  ScrollController,
  setViewportHeight,
  bindScrollIndicator,
} from './scroll/ScrollController';
import {
  initCapabilityTimeline,
  initCasesTimeline,
  initHomeHeroTimeline,
  initStoryNextArrow,
  prepareHeroText,
} from './scroll/HomeHeroTimeline';
import { LanguageController } from './i18n/LanguageController';
import { IntroSequence } from './intro/IntroSequence';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

async function init(): Promise<void> {
  setViewportHeight();
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('is-ready', 'is-desktop');

  window.addEventListener('resize', () => {
    setViewportHeight();
    ScrollTrigger.refresh();
  });

  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas not found');

  const i18n = new LanguageController();
  i18n.apply();
  prepareHeroText(i18n, i18n);

  const engine = new Engine({ canvas });
  const hero = new AboutHero(engine, () => i18n.current);
  engine.start();

  // Lenis before ScrollTriggers so pin/scroll stay in sync
  const HOME_SCENE_END = 0.7;
  let homePinActive = true;

  const scroll = new ScrollController({
    onProgress: (p) => {
      if (!homePinActive) {
        engine.setScrollProgress(HOME_SCENE_END + (1 - HOME_SCENE_END) * p);
      }
    },
  });

  let destroyHeroTimeline: (() => void) | null = null;
  let destroyCasesTimeline: (() => void) | null = null;

  const mountTimelines = () => {
    destroyHeroTimeline?.();
    destroyCasesTimeline?.();

    // Clear intro word reveal so leftover yPercent never looks like scroll-up
    gsap.killTweensOf('#hero-title .word, #hero-scroll-hint, #hero-title');
    gsap.set('#hero-title .word, #hero-scroll-hint, #hero-title', {
      clearProps: 'transform,opacity,y,x,yPercent,xPercent',
    });

    homePinActive = true;
    destroyHeroTimeline = initHomeHeroTimeline((p) => {
      homePinActive = p < 0.999;
      if (homePinActive) {
        // Lusion aboutHero.introRatio: early pin progress still moves the camera
        // while START_WAIT keeps type pinned (x=0).
        const eased = 1 - Math.pow(1 - p, 1.25);
        engine.setScrollProgress(eased * HOME_SCENE_END);
      }
    });
    initCapabilityTimeline();
    destroyCasesTimeline = initCasesTimeline();
    ScrollTrigger.refresh();
  };

  const intro = new IntroSequence({
    i18n,
    onComplete: () => {
      prepareHeroText(i18n, i18n);
      mountTimelines();
    },
  });

  await intro.play();

  // Safety: if intro already finished timelines, refresh after Lenis is warm
  ScrollTrigger.refresh();

  bindScrollIndicator();
  // The custom small in-panel arrow (#process-next-arrow) was removed —
  // this Lusion cursor-following arrow is the one continue-to-Expertise
  // affordance now, same as it always was pre-panel-4. Its endWaitStart
  // timing and target already account for the new 4-panel pin (see
  // HomeHeroTimeline.ts), so it now appears once panel 4's hold period
  // starts, not right after panel 3.
  initStoryNextArrow((target, opts) => scroll.scrollTo(target, opts));

  // Process overview panel (panel 4 of the home-hero pinned track). Its
  // enter/exit fade and the one-time .is-visible trigger for the internal
  // dot/line stagger live in applyProgress inside initHomeHeroTimeline (see
  // HomeHeroTimeline.ts), driven by the same scrubbed pin progress as
  // panels 1-3. Only the cursor tilt is wired here, since it's independent
  // of that reveal timing.
  const processSection = document.getElementById('process-overview');
  if (processSection && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // Subtle cursor-follow tilt per step, desktop/pointer only (matches the
    // `@media (hover: hover) and (pointer: fine)` guard in the CSS hover
    // rules) — skipped entirely on touch so there's no stray listener cost
    // on mobile, and no "stuck" tilt after a tap. Plain mousemove + a CSS
    // custom property; no GSAP involved, so it can't touch the pinned
    // timelines elsewhere.
    const TILT_MAX_DEG = 8;
    processSection.querySelectorAll<HTMLElement>('.process-step').forEach((step) => {
      const inner = step.querySelector<HTMLElement>('.process-step-inner');
      if (!inner) return;
      step.addEventListener('mousemove', (e) => {
        const rect = step.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        inner.style.setProperty('--tilt-x', `${(-py * TILT_MAX_DEG).toFixed(2)}deg`);
        inner.style.setProperty('--tilt-y', `${(px * TILT_MAX_DEG).toFixed(2)}deg`);
      });
      step.addEventListener('mouseleave', () => {
        inner.style.setProperty('--tilt-x', '0deg');
        inner.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  const header = document.getElementById('header');
  const setHeaderLightMode = (isLight: boolean) => {
    if (!header) return;
    header.classList.toggle('is-on-light', isLight);
  };

  ScrollTrigger.create({
    trigger: '#contact-section',
    start: 'top 22%',
    end: 'bottom top',
    onEnter: () => setHeaderLightMode(true),
    onEnterBack: () => setHeaderLightMode(true),
    onLeave: () => setHeaderLightMode(false),
    onLeaveBack: () => setHeaderLightMode(false),
  });

  const talkBtn = document.getElementById('header-right-talk-btn');
  talkBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    scroll.scrollTo('#contact-section', { offset: -12 });
  });

  const menuBtn = document.getElementById('header-right-menu-btn') as HTMLButtonElement | null;
  const menu = document.getElementById('header-menu');
  const menuLinks = document.querySelectorAll<HTMLAnchorElement>('.header-menu-link');
  const menuLinkItems = Array.from(menuLinks);
  let menuTl: gsap.core.Timeline | null = null;

  if (menu) {
    gsap.set(menu, { autoAlpha: 0, y: 88, rotate: 3.5, pointerEvents: 'none' });
    if (menuLinkItems.length) {
      gsap.set(menuLinkItems, { autoAlpha: 0, y: 18, rotate: 2 });
    }

    menuTl = gsap.timeline({
      paused: true,
      defaults: { ease: 'power3.out' },
      onStart: () => gsap.set(menu, { pointerEvents: 'auto' }),
      onReverseComplete: () => gsap.set(menu, { pointerEvents: 'none' }),
    });

    menuTl.to(menu, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.36 }, 0);
    if (menuLinkItems.length) {
      menuTl.to(menuLinkItems, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.34, stagger: 0.06 }, 0.06);
    }
  }

  const closeMenu = () => {
    if (!menuBtn || !menu) return;
    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menuTl?.reverse();
  };

  const openMenu = () => {
    if (!menuBtn || !menu) return;
    menuBtn.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menuTl?.play();
  };

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) closeMenu();
    else openMenu();
  });

  menuLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = link.dataset.target;
      if (target) scroll.scrollTo(target, { offset: -16 });
      closeMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!menuBtn || !menu) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (menu.contains(target) || menuBtn.contains(target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  const langBtn = document.getElementById('header-right-lang-btn');
  const langBtnText = document.getElementById('header-right-lang-btn-text');
  // Mobile-only duplicate row inside the dropdown (see index.html /
  // .header-menu-extra-card) — kept in sync with the same toggle logic.
  const menuLangBtn = document.getElementById('header-menu-lang-btn');
  const menuLangBtnText = document.getElementById('header-menu-lang-btn-text');

  const syncLangButton = () => {
    const label = i18n.current === 'en' ? 'EN' : '中文';
    if (langBtnText) langBtnText.textContent = label;
    if (menuLangBtnText) menuLangBtnText.textContent = label;
  };

  syncLangButton();

  const onLangToggle = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    const next = i18n.current === 'en' ? 'zh' : 'en';
    i18n.set(next);
    syncLangButton();
    prepareHeroText(i18n, i18n);
    // EndSection listens for this and re-splits title/subtitle chars for EN/ZH
    window.dispatchEvent(new CustomEvent('app:langchange'));
    gsap.fromTo(
      '#hero-title .word, #hero-secondary-title, #story-detail-title, #story-detail-text, #about-capability-title-line-1, #about-capability-title-line-2, #about-capability-subheader-text, #cases-title, #cases-desc',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.04, duration: 0.7, ease: 'power3.out' },
    );
    ScrollTrigger.refresh();
  };

  langBtn?.addEventListener('click', onLangToggle);
  menuLangBtn?.addEventListener('click', onLangToggle);

  (window as unknown as { __app: object }).__app = { engine, scroll, hero, i18n };
}

init().catch(console.error);
