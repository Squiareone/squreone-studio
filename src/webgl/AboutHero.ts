import * as THREE from 'three';
import type { Engine } from './Engine';

/**
 * Simplified AboutHero — placeholder for Lusion's AboutHero* class cluster.
 * TODO: split into AboutHeroParticles, AboutHeroRocks, AboutHeroFaces, etc.
 */
export class AboutHero {
  private static readonly PHOTO_KEYWORDS = [
    'chair',
    'mug',
    'cup',
    'lamp',
    'vase',
    'notebook',
    'stationery',
    'tote-bag',
    'ceramic',
    'tableware',
  ];

  // Placeholder project names, parallel-indexed to PHOTO_KEYWORDS — swap for
  // your real project titles when you wire in real photography. Shown in the
  // hover label (#hero-image-label in index.html).
  private static readonly PROJECT_NAMES = [
    '边界系列 · 坐具',
    '晨光马克杯',
    '定制随行杯',
    '微光台灯',
    '山形花器',
    '行迹笔记本',
    '案头文具套组',
    '帆布托特包',
    '陶瓷礼盒',
    '餐桌器物',
  ];

  // Real curated photography, served locally from /public so it loads
  // reliably (no throttling/CORS surprises from a remote placeholder API).
  // Mixed in alongside the PHOTO_KEYWORDS/Picsum pool below rather than
  // replacing it — "其他图片也保留".
  private static readonly LOCAL_PHOTOS: Array<{ src: string; name: string }> = [
    { src: '/hero-photos/bag-open-yellow.jpg', name: '黄色三角零钱包' },
    { src: '/hero-photos/bag-worn-tote.jpg', name: '零钱包 · 随行场景' },
    { src: '/hero-photos/coconut-shampoo.jpg', name: '椰子润养洗发露' },
    { src: '/hero-photos/coconut-set.jpg', name: '椰子护理礼盒组' },
    { src: '/hero-photos/sketch-baskets.jpg', name: '编织结构 · 手稿' },
    { src: '/hero-photos/sketch-fold-panel.jpg', name: '折叠展台 · 尺寸手稿' },
    { src: '/hero-photos/sketch-fixtures.jpg', name: '陈列节点 · 手稿' },
    { src: '/hero-photos/sketch-scenario.jpg', name: '场景情绪 · 手稿' },
  ];

  private group = new THREE.Group();
  private particles: THREE.Points | null = null;
  private readonly particleAnchors: THREE.Vector3[] = [];
  private miniObjects: Array<{
    sprite: THREE.Sprite;
    anchor: THREE.Vector3;
    phase: number;
    speed: number;
    nearStart: number;
    nearEnd: number;
    name: string;
    baseScale: number;
    baseAspect: number;
    hoverT: number;
    lastAlpha: number;
  }> = [];
  private lines: THREE.Line | null = null;
  private ground: THREE.Mesh | null = null;
  private halo: THREE.Mesh | null = null;
  private tmpV3 = new THREE.Vector3();
  private textureLoader = new THREE.TextureLoader();

  // Fixed reference point for image visibility/scale falloff — deliberately
  // NOT the live camera position. The camera dollies to x:-2.1 over the
  // scroll, which made anchors on the +x (right) side read as permanently
  // farther/dimmer than mirror anchors on the -x (left) side, so the field
  // looked left-heavy and the right side went empty. Distance is computed
  // against this static, centered point instead so left/right stay even
  // regardless of where the camera itself drifts to.
  private readonly visibilityAnchor = new THREE.Vector3(0, 3, 6.2);

  // Hover interaction state
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2(2, 2); // start off-screen so nothing hovers before first move
  private hoveredIndex = -1;
  private labelEl: HTMLElement | null = null;
  private labelTextEl: HTMLElement | null = null;
  private readonly onPointerMove = (e: PointerEvent) => {
    this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  constructor(private engine: Engine) {
    this.textureLoader.setCrossOrigin('anonymous');
    engine.scene.add(this.group);
    this.buildParticles();
    this.buildMiniObjects();
    this.buildLines();
    this.buildGround();
    this.buildHalo();

    this.labelEl = document.getElementById('hero-image-label');
    this.labelTextEl = document.getElementById('hero-image-label-text');
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    engine.onRender((dt, elapsed) => {
      this.update(dt, elapsed);
    });
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  private buildParticles(): void {
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 26;
      const y = Math.random() * 10 - 1.8;
      const z = (Math.random() - 0.5) * 26;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const tint = Math.random();
      colors[i * 3] = 0.08 + tint * 0.22;
      colors[i * 3 + 1] = 0.1 + tint * 0.24;
      colors[i * 3 + 2] = 0.54 + tint * 0.4;

      if (i % 9 === 0) this.particleAnchors.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.078,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }

  private buildMiniObjects(): void {
    // Was 210 — bumped up per feedback ("背景照片还是加多一点") for a denser field.
    const objectCount = 300;

    /*
     * Was: pick a random particle anchor per photo. Pure Math.random()
     * scatter across a big volume clumps by luck — on some page loads the
     * right half of the frame ended up nearly empty. Stratified into a
     * jittered grid instead so every column (incl. the far right) always
     * gets its share, regardless of the random seed that load happens to get.
     */
    const COLS = 15;
    const ROWS = Math.ceil(objectCount / COLS);
    const X_MIN = -15;
    const X_MAX = 15;
    const Y_MIN = -2;
    const Y_MAX = 9;
    const cellW = (X_MAX - X_MIN) / COLS;
    const cellH = (Y_MAX - Y_MIN) / ROWS;

    for (let i = 0; i < objectCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = X_MIN + cellW * (col + 0.5) + (Math.random() - 0.5) * cellW * 0.8;
      const y = Y_MIN + cellH * (row + 0.5) + (Math.random() - 0.5) * cellH * 0.8;
      const z = (Math.random() - 0.5) * 26;
      const anchor = new THREE.Vector3(x, y, z);

      const texture = this.createMiniObjectTexture(i);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(anchor);
      // Was lerp(0.22, 0.5, ...) then lerp(0.15, 0.35, ...) — bumped back up
      // ~20% per feedback ("照片稍微大一点 大20%左右").
      const seedScale = THREE.MathUtils.lerp(0.18, 0.42, Math.random());
      const aspect = THREE.MathUtils.lerp(0.78, 1.22, Math.random());
      sprite.scale.set(seedScale * aspect, seedScale, 1);
      material.rotation = (Math.random() - 0.5) * 0.22;
      sprite.userData.miniIndex = this.miniObjects.length;
      this.group.add(sprite);

      const photo = this.pickPhoto(i);
      this.textureLoader.load(
        photo.url,
        (loaded) => {
          // Draw onto a canvas with a dark tint + vignette baked in, so a
          // bright product/lifestyle photo doesn't sit as a harsh cutout on
          // the near-black starfield — "跟背景色协调".
          const tinted = this.tintToBackground(loaded.image as HTMLImageElement | ImageBitmap);
          material.map = tinted;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          // Keep generated texture fallback if a photo fails to load.
        },
      );

      this.miniObjects.push({
        sprite,
        anchor: anchor.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: THREE.MathUtils.lerp(0.2, 1.2, Math.random()),
        // Anchors are scattered across a ~26-unit field but the camera only
        // ever sits within z 4.6–8.2 near the origin, so the original
        // 4.8–14.5 near range only ever caught a handful of sprites — the
        // rest sat at alpha 0 forever. Widened so most of the field reads
        // as visible (with real distance falloff still doing the framing).
        nearStart: THREE.MathUtils.lerp(3, 8, Math.random()),
        nearEnd: THREE.MathUtils.lerp(16, 24, Math.random()),
        name: photo.name,
        baseScale: seedScale,
        baseAspect: aspect,
        hoverT: 0,
        lastAlpha: 0,
      });
    }
  }

  private pickPhoto(seed: number): { url: string; name: string } {
    // Local, real photography/sketches take ~2/3 of the slots (repeating —
    // "图片可以重复的在背景漂浮") since they load instantly and never fail.
    // The remaining third keeps cycling through the remote Picsum pool so
    // the field still has extra variety — "其他图片也保留".
    if (seed % 3 !== 0) {
      const local = AboutHero.LOCAL_PHOTOS[seed % AboutHero.LOCAL_PHOTOS.length];
      return { url: local.src, name: local.name };
    }
    const keyword = AboutHero.PHOTO_KEYWORDS[seed % AboutHero.PHOTO_KEYWORDS.length];
    const sig = (seed * 37 + 11) % 1000;
    return {
      url: `https://picsum.photos/seed/${keyword}-${sig}/512/512`,
      name: AboutHero.PROJECT_NAMES[seed % AboutHero.PROJECT_NAMES.length],
    };
  }

  private tintToBackground(image: HTMLImageElement | ImageBitmap): THREE.CanvasTexture {
    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    const iw = (image as HTMLImageElement).naturalWidth || (image as ImageBitmap).width;
    const ih = (image as HTMLImageElement).naturalHeight || (image as ImageBitmap).height;
    const cover = Math.max(size / iw, size / ih);
    const dw = iw * cover;
    const dh = ih * cover;
    ctx.drawImage(image as CanvasImageSource, (size - dw) / 2, (size - dh) / 2, dw, dh);

    // Cool + darken the highlights slightly so light backgrounds (cream
    // product shots, white sketch paper) don't read as bright cutouts.
    // Was 0.82 — lightened per feedback ("稍微调的明显一些") so photos read
    // more clearly instead of looking muted/washed out.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(206, 212, 228, 0.55)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    // Soft vignette so the edges fade toward the scene's near-black instead
    // of ending in a hard rectangle against the starfield. Edge darkness
    // eased back from 0.5 for the same "more visible" ask.
    const vignette = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.34,
      size / 2,
      size / 2,
      size * 0.6,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(5,6,10,0.32)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  private createMiniObjectTexture(seed: number): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.Texture();
      fallback.needsUpdate = true;
      return fallback;
    }

    const hue = (seed * 29.3) % 360;
    ctx.clearRect(0, 0, 128, 128);

    // Soft glow core.
    const rg = ctx.createRadialGradient(64, 64, 6, 64, 64, 54);
    rg.addColorStop(0, `hsla(${hue}, 92%, 78%, 0.95)`);
    rg.addColorStop(0.55, `hsla(${(hue + 45) % 360}, 84%, 62%, 0.42)`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();

    // Small object silhouette; switches between ring, card, and bead.
    const type = seed % 3;
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(((seed % 9) - 4) * 0.12);
    if (type === 0) {
      ctx.strokeStyle = 'rgba(248,250,255,0.95)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 1) {
      ctx.fillStyle = 'rgba(246,248,255,0.94)';
      ctx.fillRect(-15, -21, 30, 42);
      ctx.strokeStyle = 'rgba(38,44,74,0.58)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -21, 30, 42);
    } else {
      ctx.fillStyle = 'rgba(248,250,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -23);
      ctx.lineTo(20, -2);
      ctx.lineTo(0, 23);
      ctx.lineTo(-20, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  private buildLines(): void {
    const segments = 40;
    const points: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const r = 3 + Math.sin(t * 3) * 0.4;
      points.push(Math.cos(t) * r, -0.5, Math.sin(t) * r);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x1a2ffb,
      transparent: true,
      opacity: 0.25,
    });
    this.lines = new THREE.Line(geo, mat);
    this.group.add(this.lines);
  }

  private buildGround(): void {
    const geo = new THREE.PlaneGeometry(40, 40, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0a0a12,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -1.2;
    this.group.add(this.ground);
  }

  private buildHalo(): void {
    const geo = new THREE.RingGeometry(1.2, 2.4, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8832f7,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.halo = new THREE.Mesh(geo, mat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.5;
    this.group.add(this.halo);
  }

  private update(dt: number, elapsed: number): void {
    // Ease early progress so the first "text freeze" scroll feels the camera push (Lusion-like).
    const raw = this.engine.scrollProgress;
    const p = 1 - Math.pow(1 - raw, 1.35);

    if (this.particles) {
      this.particles.rotation.y += dt * (0.036 + p * 0.052);
      const mat = this.particles.material as THREE.PointsMaterial;
      mat.opacity = THREE.MathUtils.lerp(0.8, 0.34, p);
      mat.size = THREE.MathUtils.lerp(0.078, 0.052, p);
    }

    if (this.miniObjects.length) {
      const camera = this.engine.camera;

      // Hover test against LAST frame's positions/alphas (one frame of lag,
      // imperceptible at 60fps) — only sprites visible enough to actually
      // read as a photo are eligible, so the label never latches onto a
      // near-invisible far-field sprite.
      this.raycaster.setFromCamera(this.pointerNDC, camera);
      const hoverCandidates: THREE.Sprite[] = [];
      for (const item of this.miniObjects) {
        if (item.lastAlpha > 0.35) hoverCandidates.push(item.sprite);
      }
      const hits = hoverCandidates.length ? this.raycaster.intersectObjects(hoverCandidates, false) : [];
      this.hoveredIndex = hits.length ? ((hits[0].object.userData.miniIndex as number) ?? -1) : -1;

      for (let i = 0; i < this.miniObjects.length; i++) {
        const item = this.miniObjects[i];
        const t = elapsed * item.speed + item.phase;
        this.tmpV3.copy(item.anchor);
        // Add multi-axis, per-item jitter so the drift feels less uniform.
        this.tmpV3.x += Math.sin(t * (0.72 + item.speed * 0.18)) * (0.18 + item.speed * 0.06);
        this.tmpV3.y += Math.cos(t * (1.06 + item.speed * 0.14)) * (0.2 + item.speed * 0.07);
        this.tmpV3.z += Math.sin(t * (0.63 + item.speed * 0.22)) * (0.28 + item.speed * 0.08);
        // Scroll-linked approach: the camera sits on the +z side looking
        // back toward the origin, so nudging every sprite's z further
        // toward +z as scroll progresses (p: 0→1) reads as the photos
        // drifting closer to the viewer — "往下滑动的时候，照片会靠近".
        // Real perspective does the rest (nearer sprites project bigger).
        this.tmpV3.z += p * 4.2;
        item.sprite.position.copy(this.tmpV3);

        const d = this.visibilityAnchor.distanceTo(this.tmpV3);
        const nearMix = THREE.MathUtils.clamp((item.nearEnd - d) / (item.nearEnd - item.nearStart), 0, 1);
        const fadeByScroll = THREE.MathUtils.lerp(1, 0.62, p);
        // Floor of 0.22 so far sprites are a faint presence instead of fully
        // gone — the old 0-floor plus the narrow near range is why nothing
        // was visible on load before the camera had moved.
        // Was lerp(0.22, 0.9, ...) — raised per feedback ("稍微调的明显一些")
        // so photos read more clearly against the starfield.
        const alpha = THREE.MathUtils.lerp(0.34, 1, nearMix) * fadeByScroll;

        // Ease toward hovered/unhovered — "稍微放大一点", not a snap.
        const isHovered = i === this.hoveredIndex;
        item.hoverT += ((isHovered ? 1 : 0) - item.hoverT) * Math.min(1, dt * 9);

        const boostedAlpha = THREE.MathUtils.lerp(alpha, Math.max(alpha, 0.95), item.hoverT);
        item.sprite.material.opacity = boostedAlpha;
        item.sprite.visible = true;
        item.lastAlpha = boostedAlpha;

        // Was 0.16–0.42, then 0.11–0.29 — bumped back up ~20% per feedback
        // ("照片稍微大一点 大20%左右").
        // Hover boost was 0.3 (+30%) — set to exactly +20% per feedback
        // ("鼠标hover的时候，照片会放大20%").
        const s = THREE.MathUtils.lerp(0.132, 0.348, nearMix) * (1 + item.hoverT * 0.2);
        item.sprite.scale.set(s * item.baseAspect, s, 1);
      }

      // Hover label — DOM element following the hovered sprite's projected
      // screen position (see #hero-image-label in index.html).
      if (this.labelEl && this.labelTextEl) {
        if (this.hoveredIndex >= 0) {
          const item = this.miniObjects[this.hoveredIndex];
          this.tmpV3.copy(item.sprite.position).project(camera);
          const behindCamera = this.tmpV3.z > 1;
          if (!behindCamera) {
            const sx = (this.tmpV3.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-this.tmpV3.y * 0.5 + 0.5) * window.innerHeight;
            if (this.labelTextEl.textContent !== item.name) this.labelTextEl.textContent = item.name;
            this.labelEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate3d(-50%, -140%, 0)`;
          }
          this.labelEl.classList.toggle('is-visible', !behindCamera);
        } else {
          this.labelEl.classList.remove('is-visible');
        }
      }
    }

    if (this.lines) {
      this.lines.rotation.y = elapsed * (0.07 + p * 0.04);
      const mat = this.lines.material as THREE.LineBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(0.28, 0.08, p);
    }

    if (this.halo) {
      this.halo.scale.setScalar(1 + p * 0.85 + Math.sin(elapsed * 0.5) * 0.05);
      this.halo.rotation.z = elapsed * 0.04 + p * 0.3;
    }

    const cam = this.engine.camera;
    // Stronger dolly / orbit so opening scroll clearly moves the world behind still type
    cam.position.x = THREE.MathUtils.lerp(0, -2.1, p);
    cam.position.y = THREE.MathUtils.lerp(1.15, 2.45, p);
    cam.position.z = THREE.MathUtils.lerp(8.2, 4.6, p);
    cam.lookAt(0, THREE.MathUtils.lerp(0.05, 0.95, p), 0);
  }

  setTeamColor(hex: string): void {
    if (!this.halo) return;
    (this.halo.material as THREE.MeshBasicMaterial).color.set(hex);
  }
}
