import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface ScrollControllerOptions {
  /** Single source of truth for page scroll progress in [0, 1]. */
  onProgress?: (progress: number) => void;
}

/**
 * Smooth scroll + ScrollTrigger bridge.
 * Page scroll progress is computed once here and pushed to listeners (e.g. WebGL).
 */
export class ScrollController {
  readonly lenis: Lenis;
  private readonly tickerFn: (time: number) => void;

  constructor(options: ScrollControllerOptions = {}) {
    this.lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    this.tickerFn = (time: number) => {
      this.lenis.raf(time * 1000);
    };

    this.lenis.on('scroll', ({ scroll }: { scroll: number }) => {
      ScrollTrigger.update();
      if (options.onProgress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        options.onProgress(max > 0 ? Math.min(Math.max(scroll / max, 0), 1) : 0);
      }
    });

    gsap.ticker.add(this.tickerFn);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.addEventListener('refresh', () => this.lenis.resize());
    ScrollTrigger.refresh();
  }

  scrollTo(target: string | number, opts?: { offset?: number }): void {
    this.lenis.scrollTo(target, { offset: opts?.offset ?? 0 });
  }

  dispose(): void {
    gsap.ticker.remove(this.tickerFn);
    this.lenis.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  }
}

export function setViewportHeight(): void {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

export function bindScrollIndicator(): void {
  const bar = document.getElementById('scroll-indicator-bar');
  if (!bar) return;

  gsap.set(bar, { scaleY: 0, transformOrigin: '0 0' });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      // Match Lusion: progress via transform, not bar height
      gsap.set(bar, { scaleY: self.progress });
    },
  });
}
