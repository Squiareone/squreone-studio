import gsap from 'gsap';
import type { Lang } from '../i18n/translations';
import type { LanguageController } from '../i18n/LanguageController';

export interface IntroSequenceOptions {
  i18n: LanguageController;
  onComplete: (lang: Lang) => void;
}

/**
 * Entry loader → curtain lift into hero (scroll remains free after exit).
 */
export class IntroSequence {
  private overlay: HTMLElement;

  constructor(private options: IntroSequenceOptions) {
    const el = document.getElementById('intro-overlay');
    if (!el) throw new Error('#intro-overlay not found');
    this.overlay = el;
  }

  async play(): Promise<Lang> {
    this.options.i18n.apply();
    document.body.classList.add('is-intro-active');
    gsap.set('#page-container, #header, #scroll-indicator', { opacity: 0 });
    gsap.set('#canvas', { opacity: 0 });

    await this.runLoaderPhase();
    await this.impactToHome();
    return this.options.i18n.current;
  }

  private runLoaderPhase(): Promise<void> {
    const counter = document.getElementById('intro-loader-count');
    const fill = document.getElementById('intro-loader-fill');
    const foldProgressA = document.getElementById('intro-fold-progress-a') as SVGPathElement | null;
    const foldProgressB = document.getElementById('intro-fold-progress-b') as SVGPathElement | null;
    if (!counter || !fill) return Promise.resolve();

    const state = { value: 0 };
    for (const p of [foldProgressA, foldProgressB]) {
      if (!p) continue;
      const total = p.getTotalLength();
      p.style.strokeDasharray = `${total}`;
      p.style.strokeDashoffset = `${total}`;
    }

    return new Promise((resolve) => {
      gsap.fromTo(
        state,
        { value: 0 },
        {
          value: 100,
          duration: 2.1,
          ease: 'power2.inOut',
          onUpdate: () => {
            const value = Math.round(state.value);
            counter.textContent = `${value}`.padStart(3, '0');
            fill.style.transform = `scaleX(${value / 100})`;
          },
          onComplete: () => resolve(),
        },
      );
    });
  }

  private impactToHome(): Promise<void> {
    return new Promise((resolve) => {
      const foldLogo = document.getElementById('intro-fold-logo');
      // -a = top+right (the "two sides" that appear first, out of the bar);
      // -b = left+bottom+"1" (the sides that grow in after) — see index.html.
      const foldProgressA = document.getElementById('intro-fold-progress-a') as SVGPathElement | null;
      const foldProgressB = document.getElementById('intro-fold-progress-b') as SVGPathElement | null;

      const exitTl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          this.overlay.classList.add('is-hidden');
          document.body.classList.remove('is-intro-active');
          this.options.onComplete(this.options.i18n.current);
          resolve();
        },
      });

      // Logo starts tiny — it unfolds outward from the same point the bar
      // collapses into, so the hand-off reads as one continuous shape
      // changing, not two separate elements swapping out.
      gsap.set(foldLogo, { autoAlpha: 0, scale: 0.16 });

      /*
       * Ref. lusion.co/about's loading progression, same choreography with
       * this project's own mark:
       *   1) the instant the counter hits 100%, the text is just gone — no
       *      lingering fade, a hard cut (product ask: "立即消失")
       *   2) the bar cuts in the middle and collapses into itself at its
       *      own center point — same spot the logo unfolds from
       *   3) the logo unfolds outward from that point IN TWO STAGES,
       *      matching the bar's two halves: top+right sides draw first,
       *      then left+bottom+the "1" grow in after (product ask) — not
       *      one continuous draw
       *   4) hold on the finished mark, then punch through into home
       */

      // ---- Beat 1: text gone immediately ----
      exitTl.to('#intro-loader-count', { opacity: 0, duration: 0.08, ease: 'none' }, 0);
      exitTl.to('#intro-loader-welcome', { opacity: 0, duration: 0.08, ease: 'none' }, 0);

      // ---- Beat 2: the bar collapses into itself, same spot the logo will unfold from ----
      exitTl.to('#intro-loader-bar', { scaleX: 1.1, scaleY: 1.1, duration: 0.08, ease: 'power2.out' }, 0.02);
      exitTl.to(
        '#intro-loader-bar',
        { scaleX: 0.04, scaleY: 0.04, duration: 0.24, ease: 'power4.in' },
        0.1,
      );
      exitTl.to('#intro-loader-fill, #intro-loader-bar', { autoAlpha: 0, duration: 0.1 }, 0.32);

      // ---- Beat 3: logo unfolds in two stages — top+right first, then left+bottom+"1" ----
      const LOGO_START = 0.34;
      // Split roughly by path length (A ≈ 120 units, B ≈ 152 units) so both
      // halves draw at a matching speed. Was one 0.9s draw, then a single
      // 1.08s draw (+20%) — now two beats totalling about the same runtime,
      // with a small gap between them so the split actually reads.
      const STAGE_A_DURATION = 0.48;
      const STAGE_GAP = 0.1;
      const STAGE_B_DURATION = 0.6;
      const FOLD_DURATION = STAGE_A_DURATION + STAGE_GAP + STAGE_B_DURATION;

      exitTl.set(foldLogo, { autoAlpha: 1 }, LOGO_START);
      exitTl.to(foldLogo, { scale: 1, duration: FOLD_DURATION, ease: 'power3.out' }, LOGO_START);
      if (foldProgressA) {
        exitTl.to(
          foldProgressA,
          { strokeDashoffset: 0, duration: STAGE_A_DURATION, ease: 'sine.inOut' },
          LOGO_START,
        );
      }
      if (foldProgressB) {
        exitTl.to(
          foldProgressB,
          { strokeDashoffset: 0, duration: STAGE_B_DURATION, ease: 'sine.inOut' },
          LOGO_START + STAGE_A_DURATION + STAGE_GAP,
        );
      }

      // ---- Beat 4: hold on the finished mark, then punch through it into home ----
      const HOLD_END = LOGO_START + FOLD_DURATION + 0.5;

      /*
       * Ref. lusion.co/about: the mark doesn't just fade out — it scales up
       * fast, like the camera flies through it, and the page arrives right
       * behind that punch rather than after a separate curtain beat.
       */
      exitTl.to(
        foldLogo,
        { scale: 9, autoAlpha: 0, duration: 0.6, ease: 'power2.in' },
        HOLD_END + 0.05,
      );

      exitTl.to('#intro-loader', { opacity: 0, duration: 0.2 }, HOLD_END + 0.2);
      exitTl.to('.intro-curtain--top', { yPercent: -110, duration: 0.6, ease: 'power4.out' }, HOLD_END + 0.22);
      exitTl.to('.intro-curtain--bottom', { yPercent: 110, duration: 0.6, ease: 'power4.out' }, HOLD_END + 0.22);
      exitTl.to(this.overlay, { opacity: 0, duration: 0.3 }, HOLD_END + 0.5);

      exitTl.to('#canvas', { opacity: 1, duration: 0.85 }, HOLD_END + 0.28);
      exitTl.to(
        '#page-container, #header, #scroll-indicator',
        { opacity: 1, duration: 0.7 },
        HOLD_END + 0.32,
      );
      exitTl.add(() => this.revealHero(), HOLD_END + 0.4);
    });
  }

  private revealHero(): void {
    const title = document.getElementById('hero-title');
    const hint = document.getElementById('hero-scroll-hint');
    const words = title?.querySelectorAll('.word');

    // Entrance only — settle to identity transforms so scroll pin never inherits yPercent
    if (words?.length) {
      gsap.fromTo(
        words,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 1,
          ease: 'power4.out',
          overwrite: true,
        },
      );
    }

    if (hint) {
      gsap.fromTo(
        hint,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, delay: 0.5, ease: 'power2.out', overwrite: true },
      );
    }
  }
}
