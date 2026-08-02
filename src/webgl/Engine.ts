import * as THREE from 'three';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
}

/**
 * Core WebGL runtime — mirrors Lusion's fixed canvas + render loop.
 * Extend via AboutHero and future post-processing passes.
 */
export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly clock = new THREE.Clock();

  private rafId = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private renderCallbacks: Array<(dt: number, elapsed: number) => void> = [];

  scrollProgress = 0;

  constructor({ canvas }: EngineOptions) {
    this.canvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.035);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(0, 1.2, 8);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  onRender(cb: (dt: number, elapsed: number) => void): () => void {
    this.renderCallbacks.push(cb);
    return () => {
      this.renderCallbacks = this.renderCallbacks.filter((fn) => fn !== cb);
    };
  }

  setScrollProgress(p: number): void {
    this.scrollProgress = THREE.MathUtils.clamp(p, 0, 1);
  }

  start(): void {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      for (const cb of this.renderCallbacks) cb(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  private resize = (): void => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  };
}
