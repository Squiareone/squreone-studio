import { copy, type Copy, type Lang } from './translations';

const STORAGE_KEY = 'squareone-lang';
const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
const CJK_PUNCT_SPLIT = /(?<=[，。！？、；：,.!?;:])/;

export class LanguageController {
  private lang: Lang;
  private listeners = new Set<(lang: Lang) => void>();

  constructor(defaultLang: Lang = 'en') {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    this.lang = saved === 'zh' || saved === 'en' ? saved : defaultLang;
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = this.lang;
  }

  get current(): Lang {
    return this.lang;
  }

  get text(): Copy {
    return copy[this.lang];
  }

  set(lang: Lang, persist = true): void {
    const changed = this.lang !== lang;
    this.lang = lang;
    if (persist) localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
    this.apply();
    if (changed) this.listeners.forEach((fn) => fn(lang));
  }

  onChange(fn: (lang: Lang) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  apply(): void {
    const t = this.text;
    document.title = `${t.studioName}`;

    const map: Record<string, string> = {
      'header-logo-text': t.studioShort,
      'header-right-talk-btn-text': t.contact,
      'header-right-menu-btn-text': t.menu,
      'header-right-menu-btn-text-close': t.menuClose,
      'intro-loader-welcome': t.introWelcome,
      'hero-title': t.heroTitle,
      'hero-secondary-title': t.heroSecondary,
      'story-detail-title': t.storyTitle,
      'story-detail-text': t.detailText,
      'process-overview-eyebrow': t.processEyebrow,
      'process-overview-title': t.processTitle,
      'about-capability-title-line-1': t.expertiseTitleLine1,
      'about-capability-title-line-2': t.expertiseTitleLine2,
      'about-capability-subheader-text': t.expertiseSubtitle,
      'cases-title': t.casesTitle,
      'cases-desc': t.casesDesc,
      'lets-work-title': t.letsWorkTitle,
      'end-section-subtitle-text': t.letsWorkSubtitle,
      'contact-label': t.contactLabel,
      'contact-heading': t.contactHeading,
      'contact-enquiry-label': t.contactEnquiryLabel,
      'contact-stay-label': t.contactStayLabel,
      'contact-form-description': t.contactFormDescription,
      'contact-email-label': t.contactEmailLabel,
      'contact-social-xhs-label': t.contactSocialXhs,
      'contact-footer-copy': t.contactFooterCopy,
      'contact-footer-tagline': t.contactFooterTagline,
      'hero-scroll-hint': t.scrollHint,
    };

    for (const [id, value] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    const menuLabels = [t.menuHome, t.menuExpertise, t.menuCases];
    document.querySelectorAll<HTMLAnchorElement>('#header-menu-links > .header-menu-link').forEach((link, i) => {
      const label = menuLabels[i];
      if (!label) return;
      const main = link.querySelector('.header-menu-link-text');
      const clone = link.querySelector('.header-menu-link-text-clone');
      if (main) main.textContent = label;
      if (clone) clone.textContent = label;
    });

    // Mobile-only "Let's talk" row duplicated inside the dropdown (see
    // .header-menu-extra-card in index.html) — same copy as the desktop
    // button, kept in sync here since it lives outside #header-menu-links.
    const talkRowMain = document.querySelector('#header-menu-talk-wrap .header-menu-link-text');
    const talkRowClone = document.querySelector('#header-menu-talk-wrap .header-menu-link-text-clone');
    if (talkRowMain) talkRowMain.textContent = t.contact;
    if (talkRowClone) talkRowClone.textContent = t.contact;

    const emailInput = document.getElementById('contact-email') as HTMLInputElement | null;
    if (emailInput) emailInput.placeholder = t.contactEmailPlaceholder;
    const submitBtn = document.getElementById('contact-submit');
    if (submitBtn) submitBtn.setAttribute('aria-label', t.contactSubmitAria);

    // End-section "CONTINUE TO SCROLL" uses duplicated marquee nodes
    document.querySelectorAll<HTMLElement>('#end-bottom .end-bottom-text').forEach((el) => {
      el.textContent = t.continueScroll;
    });

    // Expertise cards (title + bullet list); letter badges S/B/T/G stay as-is
    document.querySelectorAll<HTMLElement>('.about-capability-card').forEach((card, i) => {
      const copy = t.expertiseCards[i];
      if (!copy) return;
      const title = card.querySelector<HTMLElement>('.about-capability-card-header-text');
      if (title) title.textContent = copy.title;
      const items = card.querySelectorAll<HTMLElement>('.about-capability-card-list li');
      items.forEach((li, j) => {
        const text = copy.bullets[j];
        if (text !== undefined) li.textContent = text;
      });
      // Mirrored footer duplicate (decorative, aria-hidden) — same title as
      // the header, letter badge stays as-is.
      const footerTitle = card.querySelector<HTMLElement>('.about-capability-card-footer-title');
      if (footerTitle) footerTitle.textContent = copy.title;
    });

    // Process overview steps (index number + title + one-line description);
    // index number (01/02/03/04) is language-independent but still driven
    // from copy for a single source of truth.
    document.querySelectorAll<HTMLElement>('.process-step').forEach((step, i) => {
      const stepCopy = t.processSteps[i];
      if (!stepCopy) return;
      const index = step.querySelector<HTMLElement>('.process-step-index');
      if (index) index.textContent = stepCopy.index;
      const title = step.querySelector<HTMLElement>('.process-step-title');
      if (title) title.textContent = stepCopy.title;
      const desc = step.querySelector<HTMLElement>('.process-step-desc');
      if (desc) desc.textContent = stepCopy.desc;
    });

    // Full-bleed Experience story headlines — one per photo step, matched
    // by data-step index back into t.casesExperienceSteps.
    document.querySelectorAll<HTMLElement>('.cases-experience-headline').forEach((el) => {
      const step = Number(el.dataset.step ?? -1);
      const text = t.casesExperienceSteps[step];
      if (text !== undefined) el.textContent = text;
    });
  }

  splitTextIntoChars(el: HTMLElement): HTMLSpanElement[] {
    const text = el.textContent ?? '';
    el.textContent = '';
    el.setAttribute('aria-label', text);
    return [...text].map((char) => {
      const wrap = document.createElement('span');
      wrap.className = 'char-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'char';
      inner.textContent = char === ' ' ? '\u00a0' : char;
      wrap.appendChild(inner);
      el.appendChild(wrap);
      return inner;
    });
  }

  /**
   * Split title text for reveal animation.
   * - Latin: space-separated words
   * - CJK: phrase units (by punctuation), long runs chunked so lines can wrap
   * - Newlines become <br>
   */
  splitTextIntoWords(el: HTMLElement): HTMLSpanElement[] {
    const text = el.textContent ?? '';
    el.textContent = '';
    el.setAttribute('aria-label', text);
    const spans: HTMLSpanElement[] = [];

    const appendUnit = (unit: string, cjk: boolean) => {
      const wrap = document.createElement('span');
      wrap.className = cjk ? 'word-wrap is-cjk' : 'word-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'word';
      inner.textContent = unit;
      wrap.appendChild(inner);
      el.appendChild(wrap);
      spans.push(inner);
    };

    const splitLatinLine = (line: string) => {
      const parts = line.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (!part.trim()) {
          el.appendChild(document.createTextNode(part));
          continue;
        }
        appendUnit(part, false);
      }
    };

    const splitCjkLine = (line: string) => {
      // Prefer browser word segmentation when available.
      if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        let buffer = '';
        const flush = () => {
          if (!buffer) return;
          // Chunk long runs so inline-block units can wrap on narrow screens.
          if (buffer.length > 4) {
            for (let i = 0; i < buffer.length; i += 2) {
              appendUnit(buffer.slice(i, i + 2), true);
            }
          } else {
            appendUnit(buffer, true);
          }
          buffer = '';
        };

        for (const { segment, isWordLike } of segmenter.segment(line)) {
          if (!segment) continue;
          if (/^\s+$/.test(segment)) {
            flush();
            el.appendChild(document.createTextNode(segment));
            continue;
          }
          if (isWordLike) {
            buffer += segment;
            if (buffer.length >= 2) flush();
          } else {
            // Punctuation sticks to previous buffer unit.
            if (buffer) {
              buffer += segment;
              flush();
            } else {
              appendUnit(segment, true);
            }
          }
        }
        flush();
        return;
      }

      // Fallback: split on CJK / Latin punctuation, then 2-char chunks.
      const phrases = line.split(CJK_PUNCT_SPLIT).filter(Boolean);
      for (const phrase of phrases) {
        if (/^\s+$/.test(phrase)) {
          el.appendChild(document.createTextNode(phrase));
          continue;
        }
        if (phrase.length <= 4) {
          appendUnit(phrase, true);
          continue;
        }
        for (let i = 0; i < phrase.length; i += 2) {
          appendUnit(phrase.slice(i, i + 2), true);
        }
      }
    };

    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) el.appendChild(document.createElement('br'));
      if (!line) return;
      if (CJK_RE.test(line)) splitCjkLine(line);
      else splitLatinLine(line);
    });

    return spans;
  }
}
