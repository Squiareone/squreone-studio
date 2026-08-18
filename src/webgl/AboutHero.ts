import * as THREE from 'three';
import type { Engine } from './Engine';

/**
 * Simplified AboutHero — placeholder for Lusion's AboutHero* class cluster.
 * TODO: split into AboutHeroParticles, AboutHeroRocks, AboutHeroFaces, etc.
 */
export class AboutHero {
  // Real curated photography, served locally from /public so it loads
  // reliably (no throttling/CORS surprises from a remote placeholder API).
  // Every floating background image comes from this set — bilingual name
  // shown in the hover label (#hero-image-label in index.html), switched
  // live with the site language via the langProvider passed into the ctor.
  private static readonly LOCAL_PHOTOS: Array<{ src: string; name: { en: string; zh: string } }> = [
    { src: '/hero-photos-2/commemorative-coin.jpg', name: { en: 'Commemorative Coin', zh: '纪念币' } },
    { src: '/hero-photos-2/commemorative-coin-alt.jpg', name: { en: 'Commemorative Coin 2', zh: '纪念币 2' } },
    { src: '/hero-photos-2/insulated-travel-mug.jpg', name: { en: 'Insulated Travel Mug', zh: '保温随行杯' } },
    { src: '/hero-photos-2/insulated-travel-mug-2.jpg', name: { en: 'Insulated Travel Mug 2', zh: '保温随行杯 2' } },
    { src: '/hero-photos-2/keychain-sketch.jpg', name: { en: 'Keychain Style 2 Sketch', zh: '钥匙扣款式二 · 手稿' } },
    { src: '/hero-photos-2/keychain.jpg', name: { en: 'Keychain Style 2', zh: '钥匙扣款式二' } },
    { src: '/hero-photos-2/keychain-cube-scenario.jpg', name: { en: 'Keychain Cube Scenario', zh: '魔方钥匙扣 · 使用场景' } },
    { src: '/hero-photos-2/keychain-cube-sketch.jpg', name: { en: 'Keychain Cube Sketch', zh: '魔方钥匙扣 · 手稿' } },
    { src: '/hero-photos-2/keychain-cube.jpg', name: { en: 'Keychain Cube', zh: '魔方钥匙扣' } },
    { src: '/hero-photos-2/notebook-office-kit.jpg', name: { en: 'Notebook Office Kit', zh: '笔记本办公套装' } },
    { src: '/hero-photos-2/pin-badge.jpg', name: { en: 'Pin Badge', zh: '徽章' } },
    { src: '/hero-photos-2/concept-sketch.jpg', name: { en: 'Sketch', zh: '手稿' } },
    { src: '/hero-photos-2/skincare-container-series.jpg', name: { en: 'Skincare Container Series', zh: '护肤瓶罐系列' } },
    { src: '/hero-photos-2/storage-pouch-office-kit.jpg', name: { en: 'Storage Pouch for Office Kit', zh: '办公套装收纳包' } },
    { src: '/hero-photos-2/storage-pouch-office-use.jpg', name: { en: 'Storage Pouch for Office Use', zh: '办公用收纳包' } },
    { src: '/hero-photos-2/storage-pouch.jpg', name: { en: 'Storage Pouch', zh: '收纳包' } },
    { src: '/hero-photos-2/zip-pouch-detail.jpg', name: { en: 'Triangle Zip Pouch Decoration', zh: '三角拉链包 · 挂饰' } },
    { src: '/hero-photos-2/zip-pouch.jpg', name: { en: 'Triangle Zip Pouch', zh: '三角拉链包' } },
    { src: '/hero-photos-2/usb-gift-box.jpg', name: { en: 'USB Gift Box', zh: 'U盘礼盒' } },
    { src: '/hero-photos-2/cafe-brand.jpg', name: { en: 'Cafe Brand', zh: '咖啡品牌' } },
    { src: '/hero-photos-2/coffee-cup.jpg', name: { en: 'Coffee Cup', zh: '咖啡杯' } },
    { src: '/hero-photos-2/keychain-with-bag.jpg', name: { en: 'Keychain Style 2 with Bag', zh: '钥匙扣款式二 · 搭配手袋' } },
    { src: '/hero-photos-2/moisturizing-cream-container.jpg', name: { en: 'Moisturizing Cream Container', zh: '保湿霜瓶罐' } },
    { src: '/hero-photos-2/lotion-container.jpg', name: { en: 'Moisturizing Lotion Container', zh: '身体乳瓶身' } },
    { src: '/hero-photos-2/notebook-1.jpg', name: { en: 'Notebook', zh: '笔记本' } },
    { src: '/hero-photos-2/perfume-bottle.jpg', name: { en: 'Perfume Bottle', zh: '香水瓶' } },
    { src: '/hero-photos-2/perfume-brand.jpg', name: { en: 'Perfume Brand', zh: '香水品牌' } },
    { src: '/hero-photos-2/sketch-1.jpg', name: { en: 'Sketch 1', zh: '手稿一' } },
    { src: '/hero-photos-2/sketch-planting-wall.jpg', name: { en: 'Sketch of Planting Wall', zh: '植物墙手稿' } },
    { src: '/hero-photos-2/sketch-ring.jpg', name: { en: 'Sketch of Ring', zh: '戒指手稿' } },
    { src: '/hero-photos-2/skincare-brand.jpg', name: { en: 'Skincare Brand', zh: '护肤品牌' } },
    { src: '/hero-photos-2/tote-bag.jpg', name: { en: 'Tote Bag', zh: '托特包' } },
  ];

  // Skincare / storage-pouch / badge shots read small at the default size —
  // sized up a bit on top of the base scale, without touching the general
  // field size (a global bump made narrow/portrait photos look like long
  // stretched strips — "不要放大会长").
  private static readonly SIZE_BOOST: Record<string, number> = {
    '/hero-photos-2/skincare-container-series.jpg': 1.6,
    '/hero-photos-2/moisturizing-cream-container.jpg': 1.6,
    '/hero-photos-2/lotion-container.jpg': 1.6,
    '/hero-photos-2/skincare-brand.jpg': 1.6,
    '/hero-photos-2/storage-pouch.jpg': 1.6,
    '/hero-photos-2/storage-pouch-office-kit.jpg': 1.6,
    '/hero-photos-2/storage-pouch-office-use.jpg': 1.6,
    '/hero-photos-2/pin-badge.jpg': 1.6,
  };

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
    name: { en: string; zh: string };
    baseScale: number;
    baseAspect: number;
    sizeBoost: number;
    hoverT: number;
    lastAlpha: number;
  }> = [];
  private lines: THREE.Line | null = null;
  private ground: THREE.Mesh | null = null;
  private halo: THREE.Mesh | null = null;
  private tmpV3 = new THREE.Vector3();
  private textureLoader = new THREE.TextureLoader();

  // Only 32 unique source photos, but 300 floating sprites — without a
  // cache every sprite independently re-fetched + re-tinted the same file,
  // which meant most of the field sat on the flat generated placeholder
  // shape (a "纯色方块") far longer than it should have. Load + tint each
  // unique src exactly once, then fan the result out to every sprite that
  // wants it (already-cached ones apply instantly, no flash at all).
  private static readonly textureCache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();
  private static readonly texturePending = new Map<
    string,
    Array<(entry: { texture: THREE.CanvasTexture; aspect: number }) => void>
  >();

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
  // The floating photo hover pill only makes sense over the hero starfield —
  // once Cases & Scenarios scrolls to fill the screen, its own title/desc
  // (and later the story frames) shouldn't get an unrelated product-name
  // pill floating over them, so the label is suppressed while that section
  // is the one in view.
  private labelSuppressEl: HTMLElement | null = null;
  private readonly onPointerMove = (e: PointerEvent) => {
    this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  constructor(
    private engine: Engine,
    private getLang: () => 'en' | 'zh' = () => 'en',
  ) {
    this.textureLoader.setCrossOrigin('anonymous');
    engine.scene.add(this.group);
    this.buildParticles();
    this.buildMiniObjects();
    this.buildLines();
    this.buildGround();
    this.buildHalo();

    this.labelEl = document.getElementById('hero-image-label');
    this.labelTextEl = document.getElementById('hero-image-label-text');
    this.labelSuppressEl = document.getElementById('cases-scenarios');
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    engine.onRender((dt, elapsed) => {
      this.update(dt, elapsed);
    });
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  /**
   * Soft round falloff for the dust particles. THREE.PointsMaterial renders
   * a hard-edged square per point unless given an alpha-masked map — that
   * was exactly the "紫色纯色的正方形" being seen (2600 solid blue/purple
   * squares via additive blending, far outnumbering the 300 photo sprites).
   */
  private static dotTexture: THREE.CanvasTexture | null = null;
  private static getDotTexture(): THREE.CanvasTexture {
    if (AboutHero.dotTexture) return AboutHero.dotTexture;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    AboutHero.dotTexture = tex;
    return tex;
  }

  private buildParticles(): void {
    // Was 2600 — thinned out so the dust field no longer outweighs the
    // photo sprites in sheer count ("减少紫色纯色的正方形的比例，让用户感觉
    // 更多作品").
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 26;
      const y = Math.random() * 10 - 1.8;
      const z = (Math.random() - 0.5) * 26;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Softened from a strongly blue/purple-dominant mix toward a more
      // neutral, less saturated tint.
      const tint = Math.random();
      colors[i * 3] = 0.14 + tint * 0.22;
      colors[i * 3 + 1] = 0.16 + tint * 0.22;
      colors[i * 3 + 2] = 0.4 + tint * 0.3;

      if (i % 9 === 0) this.particleAnchors.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.078,
      map: AboutHero.getDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
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
      // Was lerp(0.18, 0.42, ...) — bumped up again so real photo detail
      // reads clearly instead of shrinking into an indistinct color patch
      // ("显得大部分都是实际的图" — most of the field should read as an
      // actual photo, not a flat block).
      const seedScale = THREE.MathUtils.lerp(0.22, 0.48, Math.random());
      // Placeholder aspect until the real photo loads and reports its true
      // width/height — see applyPhotoToItem below.
      const aspect = 1;
      sprite.scale.set(seedScale * aspect, seedScale, 1);
      material.rotation = (Math.random() - 0.5) * 0.22;
      const miniIndex = this.miniObjects.length;
      sprite.userData.miniIndex = miniIndex;
      this.group.add(sprite);

      const photo = this.pickPhoto(i);

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
        sizeBoost: AboutHero.SIZE_BOOST[photo.url] ?? 1,
        hoverT: 0,
        lastAlpha: 0,
      });

      this.loadPhotoForItem(photo.url, miniIndex);
    }
  }

  /**
   * Load (or reuse) the tinted texture for `url` and apply it — plus its
   * real aspect ratio — to miniObjects[index]. Every sprite sharing the
   * same src piggybacks on one shared load+tint instead of repeating it.
   */
  private loadPhotoForItem(url: string, index: number): void {
    const cached = AboutHero.textureCache.get(url);
    if (cached) {
      this.applyPhotoToItem(index, cached);
      return;
    }

    const pending = AboutHero.texturePending.get(url);
    if (pending) {
      pending.push((entry) => this.applyPhotoToItem(index, entry));
      return;
    }

    AboutHero.texturePending.set(url, [(entry) => this.applyPhotoToItem(index, entry)]);

    this.textureLoader.load(
      url,
      (loaded) => {
        // Draw onto a canvas with a light tint baked in, so a bright
        // product/lifestyle photo still sits comfortably on the near-black
        // starfield without losing its own detail/color — "显得大部分都是
        // 实际的图" means the tint has to stay light enough that the photo
        // still reads as a photo, not a tinted color chip.
        const image = loaded.image as HTMLImageElement | ImageBitmap;
        const tinted = this.tintToBackground(image);
        const iw = (image as HTMLImageElement).naturalWidth || (image as ImageBitmap).width || 1;
        const ih = (image as HTMLImageElement).naturalHeight || (image as ImageBitmap).height || 1;
        const aspect = THREE.MathUtils.clamp(iw / ih, 0.62, 1.6);
        const entry = { texture: tinted, aspect };
        AboutHero.textureCache.set(url, entry);
        const waiters = AboutHero.texturePending.get(url);
        AboutHero.texturePending.delete(url);
        waiters?.forEach((apply) => apply(entry));
      },
      undefined,
      () => {
        // Keep generated texture fallback if a photo fails to load.
        AboutHero.texturePending.delete(url);
      },
    );
  }

  private applyPhotoToItem(index: number, entry: { texture: THREE.CanvasTexture; aspect: number }): void {
    const item = this.miniObjects[index];
    if (!item) return;
    const material = item.sprite.material as THREE.SpriteMaterial;
    material.map = entry.texture;
    material.needsUpdate = true;
    item.baseAspect = entry.aspect;
  }

  private pickPhoto(seed: number): { url: string; name: { en: string; zh: string } } {
    // All floating background images come from the curated local set
    // (repeating across the field — "图片可以重复的在背景漂浮").
    const local = AboutHero.LOCAL_PHOTOS[seed % AboutHero.LOCAL_PHOTOS.length];
    return { url: local.src, name: local.name };
  }

  private tintToBackground(image: HTMLImageElement | ImageBitmap): THREE.CanvasTexture {
    const iw = (image as HTMLImageElement).naturalWidth || (image as ImageBitmap).width || 1;
    const ih = (image as HTMLImageElement).naturalHeight || (image as ImageBitmap).height || 1;

    // Canvas keeps the photo's own aspect ratio instead of a forced square
    // crop — a portrait product shot no longer loses its top/bottom to a
    // center crop, so the sprite reads as the actual photo at its natural
    // proportions ("调整一下图片的大小比例").
    const longSide = 360;
    const aspect = iw / ih;
    const w = aspect >= 1 ? longSide : Math.round(longSide * aspect);
    const h = aspect >= 1 ? Math.round(longSide / aspect) : longSide;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    ctx.drawImage(image as CanvasImageSource, 0, 0, w, h);

    // Many product shots sit on a plain white/light studio backdrop — at
    // small on-screen size that backdrop dominates and reads as a flat
    // pale square rather than a photo. Darken near-white pixels (up to
    // 50% at pure white) so the backdrop recedes and the actual product
    // stands out — "白色背景的话可以把白色亮度降低50%，减少纯色方块的比例，
    // 让用户感觉更多作品".
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p];
      const g = d[p + 1];
      const b = d[p + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Ramp: untouched below ~205 luminance, up to 50% darker at pure white.
      const t = Math.min(1, Math.max(0, (lum - 205) / (255 - 205)));
      const factor = 1 - t * 0.5;
      d[p] = r * factor;
      d[p + 1] = g * factor;
      d[p + 2] = b * factor;
    }
    ctx.putImageData(imgData, 0, 0);

    // Light cool tint so the photo still sits comfortably against the
    // near-black starfield without being read as a flat color chip —
    // "背景减少一些纯色方块的比例，显得大部分都是实际的图". Was 0.55, which
    // washed out enough fine detail that small on-screen sprites read as
    // solid color rather than a recognizable photo.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(210, 216, 232, 0.22)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Soft edge falloff, pulled back further from center so it only ever
    // touches the corners — the point is to blend the frame edges into the
    // scene, not to darken the photo itself.
    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.max(w, h) * 0.46,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(5,6,10,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

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

    // Soft glow core — briefly visible only until the real (cached) photo
    // texture lands, see loadPhotoForItem. Kept deliberately muted now that
    // it's a transient loading state rather than a permanent look, so it
    // never reads as its own "纯色方块".
    const rg = ctx.createRadialGradient(64, 64, 6, 64, 64, 54);
    rg.addColorStop(0, `hsla(${hue}, 70%, 74%, 0.55)`);
    rg.addColorStop(0.55, `hsla(${(hue + 45) % 360}, 60%, 58%, 0.22)`);
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

        // Base 0.132–0.348 range, scaled up 1.3x across the board on top of
        // the per-category sizeBoost ("整体图片都再放大1.3倍").
        // Hover boost stays +20% per earlier feedback ("鼠标hover的时候，
        // 照片会放大20%").
        const GENERAL_SCALE_BOOST = 1.3;
        const s =
          THREE.MathUtils.lerp(0.132, 0.348, nearMix) *
          GENERAL_SCALE_BOOST *
          (1 + item.hoverT * 0.2) *
          item.sizeBoost;
        item.sprite.scale.set(s * item.baseAspect, s, 1);
      }

      // Hover label — DOM element following the hovered sprite's projected
      // screen position (see #hero-image-label in index.html).
      let sectionSuppressesLabel = false;
      if (this.labelSuppressEl) {
        const rect = this.labelSuppressEl.getBoundingClientRect();
        const viewportMid = window.innerHeight * 0.5;
        sectionSuppressesLabel = rect.top <= viewportMid && rect.bottom >= viewportMid;
      }

      if (this.labelEl && this.labelTextEl) {
        if (this.hoveredIndex >= 0 && !sectionSuppressesLabel) {
          const item = this.miniObjects[this.hoveredIndex];
          this.tmpV3.copy(item.sprite.position).project(camera);
          const behindCamera = this.tmpV3.z > 1;
          if (!behindCamera) {
            const sx = (this.tmpV3.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-this.tmpV3.y * 0.5 + 0.5) * window.innerHeight;
            const label = item.name[this.getLang()];
            if (this.labelTextEl.textContent !== label) this.labelTextEl.textContent = label;
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
