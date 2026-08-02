/**
 * Port of Lusion about `#about-who-face-cursor`
 * (lusion.co/_astro/hoisted — WhoSubsectionTeam + Input + SecondOrderDynamics).
 *
 * Lusion update block (desktop, deobfuscated):
 *
 *   preUpdate: cursor.display = "none"
 *   c = teamSubsectionVisible          // our: isSectionActive()
 *   wasActive || (activeRatio = 0)
 *   S = c && mouseOverFaceRect         // our: c && pointerInside (see note)
 *   activeRatio = saturate(activeRatio + (S?dt:-dt)*1.5)
 *   S = activeRatio > 0                // keep drawing while ramping out
 *   direction = mouseX > faceCenter ? 1 : -1
 *   if (S) {
 *     display = flex
 *     scale = min(2.5, |vel|/5+1) * backOut(activeRatio) * scrollFit
 *     transform = translate3d(x,y,0) translate3d(-50%,-50%,0) scale(scale)
 *     rotateRatio += direction>0 ? dt*3 : -dt*3
 *     extraRotation.update(dt, clamp(vel.y * -direction, -1, 1))
 *     arrow.rotate = backInOut(rotateRatio)*180 + extra*75
 *   } else display = none
 *   wasActive = c
 *
 * Leave-page note:
 *   Lusion Input has NO mouseleave. mouseXY freezes. Face rect is ~70%×90%
 *   of the team column — moving off-window usually exits the face first, so
 *   the disc shrinks (activeRatio↓) while still following, then hides.
 *   A full-viewport zone cannot detect that with coords alone (last sample
 *   stays inside). We map "left the document" → not over face (pointerInside),
 *   which reproduces the observed leave-page shrink-out.
 */

class V2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
  set(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(v: V2) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  clone() {
    return new V2(this.x, this.y);
  }
  setScalar(s: number) {
    this.x = s;
    this.y = s;
    return this;
  }
  add(v: V2) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v: V2) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  divideScalar(s: number) {
    this.x /= s;
    this.y /= s;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}

/** Lusion SecondOrderDynamics (robust default). */
class SecondOrderDynamics {
  target0: V2 | number;
  target: V2 | number;
  prevTarget: V2 | number;
  value: V2 | number;
  valueVel: V2 | number;
  k1 = 0;
  k2 = 0;
  k3 = 0;
  private _f = 1.5;
  private _z = 0.8;
  private _r = 2;
  private _w = 0;
  private _d = 0;
  private _k1Stable = 0;
  private _k2Stable = 0;
  private readonly isVector: boolean;
  private readonly isRobust: boolean;
  private _targetVelCache?: V2;
  private _cache1?: V2;
  private _cache2?: V2;

  constructor(initial: V2 | number, f = 1.5, z = 0.8, r = 2, isRobust = true) {
    this.isRobust = isRobust;
    this.isVector = typeof initial === 'object';
    this.setFZR(f, z, r);
    if (this.isVector) {
      const v = initial as V2;
      this.target = v;
      this.target0 = v.clone();
      this.prevTarget = v.clone();
      this.value = v.clone();
      this.valueVel = v.clone().setScalar(0);
      this._targetVelCache = (this.valueVel as V2).clone();
      this._cache1 = (this.valueVel as V2).clone();
      this._cache2 = (this.valueVel as V2).clone();
    } else {
      const n = initial as number;
      this.target0 = n;
      this.prevTarget = n;
      this.target = n;
      this.value = n;
      this.valueVel = 0;
    }
  }

  setFZR(f = this._f, z = this._z, r = this._r) {
    this._f = f;
    const w = Math.PI * 2 * f;
    if (this.isRobust) {
      this._w = w;
      this._z = z;
      this._d = this._w * Math.sqrt(Math.abs(this._z * this._z - 1));
    } else {
      this._z = z;
    }
    this._r = r;
    this.k1 = z / (Math.PI * f);
    this.k2 = 1 / (w * w);
    this.k3 = (r * z) / w;
  }

  private computeStableCoefficients(dt: number) {
    if (this.isRobust) {
      if (this._w * dt < this._z) {
        this._k1Stable = this.k1;
        this._k2Stable = Math.max(this.k2, (dt * dt) / 2 + (dt * this.k1) / 2, dt * this.k1);
      } else {
        const exp = Math.exp(-this._z * this._w * dt);
        const osc =
          2 * exp * (this._z <= 1 ? Math.cos(dt * this._d) : Math.cosh(dt * this._d));
        const n = exp * exp;
        const a = dt / (1 + n - osc);
        this._k1Stable = (1 - n) * a;
        this._k2Stable = dt * a;
      }
    } else {
      this._k1Stable = this.k1;
      this._k2Stable = Math.max(this.k2, (1.1 * dt * dt) / 4 + (dt * this.k1) / 2);
    }
  }

  reset(v?: V2 | number | null) {
    if (this.isVector) {
      const src = (v as V2) || (this.target0 as V2);
      (this.valueVel as V2).setScalar(0);
      (this.prevTarget as V2).copy(src);
      (this.target as V2).copy(src);
      (this.value as V2).copy(src);
    } else {
      const src = (v as number) ?? (this.target0 as number);
      this.valueVel = 0;
      this.prevTarget = src;
      this.target = src;
      this.value = src;
    }
  }

  update(dt: number, numberTarget?: number) {
    if (dt <= 0) return;
    if (this.isVector) {
      const t = this.target as V2;
      const prev = this.prevTarget as V2;
      const value = this.value as V2;
      const valueVel = this.valueVel as V2;
      const tvc = this._targetVelCache!;
      const c1 = this._cache1!;
      const c2 = this._cache2!;
      tvc.copy(t).sub(prev).divideScalar(dt);
      prev.copy(t);
      this.computeStableCoefficients(dt);
      value.add(c1.copy(valueVel).multiplyScalar(dt));
      c1
        .copy(t)
        .add(tvc.multiplyScalar(this.k3))
        .sub(value)
        .sub(c2.copy(valueVel).multiplyScalar(this._k1Stable))
        .multiplyScalar(dt / this._k2Stable);
      valueVel.add(c1);
    } else {
      const t = numberTarget !== undefined ? numberTarget : (this.target as number);
      const targetVel = (t - (this.prevTarget as number)) / dt;
      this.prevTarget = t;
      this.computeStableCoefficients(dt);
      this.valueVel =
        (this.valueVel as number) +
        ((t +
          this.k3 * targetVel -
          (this.value as number) -
          this._k1Stable * (this.valueVel as number)) *
          dt) /
          this._k2Stable;
      this.value = (this.value as number) + (this.valueVel as number) * dt;
    }
  }
}

const ease = {
  backOut(e: number) {
    const t = 1.70158;
    --e;
    return e * e * ((t + 1) * e + t) + 1;
  },
  backInOut(e: number) {
    const t = 2.5949095;
    e *= 2;
    if (e < 1) return 0.5 * e * e * ((t + 1) * e - t);
    e -= 2;
    return 0.5 * (e * e * ((t + 1) * e + t) + 2);
  },
};

function saturate(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export type LusionFaceCursorOptions = {
  el: HTMLElement;
  arrowEl?: HTMLElement | null;
  /** Lusion `c` — subsection / section visible */
  isSectionActive: () => boolean;
  /**
   * Face rect in viewport px (Lusion: #about-who-team-faces bbox).
   * Default: full viewport (story continue).
   */
  getFaceRect?: () => { x: number; y: number; width: number; height: number };
  /** Lusion math.fit(n, 0, vh, 1, 0) — default 1 */
  getScrollScaleFit?: () => number;
  isMobile?: () => boolean;
};

export type LusionFaceCursorHandle = (() => void) & {
  hitTest: (clientX: number, clientY: number) => boolean;
};

export function bindLusionFaceCursor(opts: LusionFaceCursorOptions): LusionFaceCursorHandle {
  const domCursor = opts.el;
  const domCursorArrow = opts.arrowEl ?? null;
  const isMobile = opts.isMobile ?? (() => window.innerWidth <= 812);
  const getFaceRect =
    opts.getFaceRect ??
    (() => ({
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  const getScrollScaleFit = opts.getScrollScaleFit ?? (() => 1);

  let wasActive: boolean | null = null;
  let domCursorDirection = -1;
  let domCursorActiveRatio = 0;
  let domCursorRotateRatio = 0;
  const domCursorExtraRotationMotion = new SecondOrderDynamics(0, 1, 0.8, 1.2);
  const AUTO_REVEAL_MS = 900;
  let autoRevealUntil = 0;

  const mouseXY = new V2(0, 0);
  const easedMouse = new SecondOrderDynamics(new V2(0, 0), 1.35, 0.5, 1.25);

  let lastTX = 0;
  let lastTY = 0;
  let lastScale = 0;

  const vw = () => window.innerWidth || 1;
  const vh = () => window.innerHeight || 1;

  const writeMouse = (e: { clientX: number; clientY: number }) => {
    const w = vw();
    const h = vh();
    mouseXY.set((e.clientX / w) * 2 - 1, 1 - (e.clientY / h) * 2);
  };

  mouseXY.set(0, 0);
  easedMouse.reset(mouseXY);

  /*
   * Stand-in for "mouse left the face" when the face is full-viewport:
   * documentElement mouseleave. See file header.
   */
  let pointerInside = true;

  const onMove = (e: MouseEvent) => {
    if (e.button === 2 || e.button === 1) return;
    pointerInside = true;
    writeMouse(e);
  };
  const onEnter = () => {
    pointerInside = true;
  };
  const onLeave = () => {
    pointerInside = false;
  };

  document.addEventListener('mousemove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseenter', onEnter);
  document.documentElement.addEventListener('mouseleave', onLeave);

  let lastTime = performance.now();
  let rafId = 0;
  let disposed = false;

  const loop = (now: number) => {
    if (disposed) return;
    rafId = requestAnimationFrame(loop);

    let dt = (now - lastTime) / 1e3;
    lastTime = now;
    dt = Math.min(dt, 1 / 20);

    const viewportWidth = vw();
    const viewportHeight = vh();

    // Input.update(dt) — global every frame
    (easedMouse.target as V2).copy(mouseXY);
    easedMouse.update(dt);

    // Lusion preUpdate: force hide before decide
    // (we set display in the branch below; start from logical hide)

    const c = opts.isSectionActive(); // team subsection visible / our end-wait
    if (c && !wasActive) {
      // Entering the frame: reveal cursor immediately so user sees the CTA
      // without needing to move the mouse first.
      autoRevealUntil = now + AUTO_REVEAL_MS;
    }

    if (isMobile()) {
      domCursor.style.display = 'none';
      wasActive = c;
      lastScale = 0;
      return;
    }

    // wasActive || (activeRatio = 0)
    if (!wasActive) domCursorActiveRatio = 0;

    const eased = easedMouse.value as V2;
    const easedVel = easedMouse.valueVel as V2;
    const T = (eased.x * 0.5 + 0.5) * viewportWidth;
    const M = (0.5 - eased.y * 0.5) * viewportHeight;

    const face = getFaceRect();
    const u = face.x;
    const f = face.y;
    const p = face.width;
    const g = face.height;

    // S = c && over face. pointerInside approximates leave-face on full-viewport.
    const overFace = pointerInside && T > u && T < u + p && M > f && M < f + g;
    const forceReveal = c && now < autoRevealUntil;
    let S = c && (overFace || forceReveal);

    domCursorActiveRatio = saturate(domCursorActiveRatio + (S ? dt : -dt) * 1.5);
    S = domCursorActiveRatio > 0;

    domCursorDirection = T - u - p * 0.5 > 0 ? 1 : -1;

    if (S) {
      // Only touch display when it changes — setting every frame causes scroll jank
      if (domCursor.style.display !== 'flex') domCursor.style.display = 'flex';

      const scrollFit = getScrollScaleFit();
      const I =
        Math.min(2.5, easedVel.length() / 5 + 1) *
        ease.backOut(domCursorActiveRatio) *
        scrollFit;

      /*
       * Lusion positions relative to the face-cursor's offset parent:
       *   R = T - u,  E = M + faceRect.offsetY - f
       * We use position:fixed; top:0; left:0 → absolute viewport pixels.
       */
      const drawX = overFace ? T : u + p * 0.5;
      const drawY = overFace ? M : f + g * 0.5;
      domCursor.style.transform = `translate3d(${drawX}px, ${drawY}px, 0) translate3d(-50%, -50%, 0) scale(${I})`;

      domCursorRotateRatio = saturate(
        domCursorRotateRatio + (domCursorDirection > 0 ? dt * 3 : -dt * 3),
      );

      domCursorExtraRotationMotion.update(
        dt,
        clamp(easedVel.y * -domCursorDirection, -1, 1),
      );

      if (domCursorArrow) {
        const F = ease.backInOut(domCursorRotateRatio);
        const extra = domCursorExtraRotationMotion.value as number;
        domCursorArrow.style.transform = `rotate(${F * 180 + extra * 75}deg)`;
      }

      lastTX = drawX;
      lastTY = drawY;
      lastScale = I;
    } else {
      if (domCursor.style.display !== 'none') domCursor.style.display = 'none';
      lastScale = 0;
    }

    wasActive = c;
  };

  rafId = requestAnimationFrame(loop);

  const hitTest = (clientX: number, clientY: number) => {
    if (lastScale <= 0) return false;
    const rect = domCursor.getBoundingClientRect();
    const rw = rect.width || 8.6 * 16 * lastScale;
    const rh = rect.height || rw;
    const dx = clientX - lastTX;
    const dy = clientY - lastTY;
    const rx = rw * 0.5;
    const ry = rh * 0.5;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  };

  const dispose: LusionFaceCursorHandle = Object.assign(
    () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      domCursor.style.display = 'none';
    },
    { hitTest },
  );
  return dispose;
}
