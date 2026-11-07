// The render loop shared by the home page's hero and the research page's descent. The
// caller says where the camera should be; this file eases it there, keeps the satellites
// smooth on their overlay, and draws the sky only as often as it needs to. Drawing stops
// when the root leaves the view. Returns false without WebGL, so the caller can keep a still.
import { cameraAt } from './camera';
import { Sky } from './sky';
import { Orbits, type Pointer } from './orbits';

export interface SkyRun {
  root: HTMLElement; // holds the two canvases
  start: number; // log10 km, where the camera begins
  altitude: () => number; // log10 km, where the camera should be now
  active?: () => boolean; // false while the page has faded the sky away
  sunrise?: () => number; // seconds the first light takes; leave out to skip it
  light?: (lg: number) => number; // scales the exposure at this altitude, in log10 km
  depth?: boolean; // the overlay moves a little against the pointer
  terminal?: () => Pointer; // where a terminal on the ground stands; the pointer carries it
  onCount?: (seen: number) => void;
}

export function runSky(o: SkyRun): boolean {
  const skyCanvas = o.root.querySelector<HTMLCanvasElement>('[data-sky]')!;
  const orbitCanvas = o.root.querySelector<HTMLCanvasElement>('[data-orbits]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches || /Mobi|Android/i.test(navigator.userAgent);

  // Render resolution. The sky is low-frequency, so it can run well under CSS pixels.
  let scale = mobile ? 0.6 : 0.85;
  const sky = Sky.create(skyCanvas, scale);
  if (!sky) return false;
  const orbits = new Orbits(orbitCanvas);

  let visible = true;
  let ready = false;
  let needsDraw = true;
  let current = o.start;
  let lastFrame = performance.now();
  let lastSkyDraw = 0;
  let lastOrbitDraw = 0;
  let lastFrameStart = 0;
  let lastCount = 0;
  let slowFrames = 0;
  let firstFrame = 0;

  // Where the pointer is, for the depth and for the link.
  let pointer: Pointer | null = null;
  let px = 0, py = 0, tx = 0, ty = 0;
  let lx = NaN, ly = NaN; // the terminal, easing between where it stands and the pointer
  if (!reduced && !mobile && (o.depth || o.terminal)) {
    const target = o.root.closest<HTMLElement>('[data-sky-pointer]') ?? o.root;
    target.addEventListener('pointermove', (e) => {
      const r = o.root.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    target.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      pointer = null;
    });
  }

  new ResizeObserver(() => {
    sky.resize();
    orbits.resize();
    needsDraw = true;
  }).observe(o.root);

  const resume = () => {
    lastFrame = performance.now();
    needsDraw = true;
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) resume();
  }).observe(o.root);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) resume();
  });

  function frame(now: number) {
    if (!visible || document.hidden) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (o.active && !o.active()) return;

    const target = o.altitude();
    const before = current;
    current += (target - current) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
    if (Math.abs(current - before) > 1e-5) needsDraw = true;

    // Wait for the shader; the canvas fades in on its first real frame.
    if (!ready) {
      try {
        ready = sky!.isReady();
      } catch (err) {
        console.warn('[sky] shader failed, keeping the still image', err);
        visible = false;
        return;
      }
      if (!ready) return;
      needsDraw = true;
      firstFrame = now;
      requestAnimationFrame(() => o.root.classList.add('sky-ready'));
    }

    const sunrise = o.sunrise?.() ?? 0;
    const age = reduced || !sunrise ? 1 : Math.min(1, (now - firstFrame) / 1000 / sunrise);
    if (age < 1) needsDraw = true;

    const moving = needsDraw;
    needsDraw = false;
    const cam = cameraAt(10 ** current, o.root.offsetWidth / o.root.offsetHeight);
    const rise = age * age * (3 - 2 * age);
    cam.exposure *= (0.16 + 0.84 * rise) * (o.light?.(current) ?? 1);
    const t = reduced ? 40 : now / 1000;

    if (o.depth) {
      px += (tx - px) * (1 - Math.exp(-dt * 2.6));
      py += (ty - py) * (1 - Math.exp(-dt * 2.6));
      orbitCanvas.style.transform = `translate3d(${(-px * 22).toFixed(2)}px, ${(-py * 12).toFixed(2)}px, 0)`;
    }

    let at: Pointer | null = null;
    if (o.terminal) {
      const want = pointer ?? o.terminal();
      if (Number.isNaN(lx)) {
        lx = want.x;
        ly = want.y;
      }
      const follow = 1 - Math.exp(-dt * (pointer ? 16 : 2.4));
      lx += (want.x - lx) * follow;
      ly += (want.y - ly) * follow;
      // The overlay itself has moved for depth, so the terminal is offset to match it.
      at = { x: lx + px * 22, y: ly + py * 12 };
    }

    // Satellites stay smooth on the 2D overlay while the page is still.
    if (moving || (!reduced && now - lastOrbitDraw > 33)) {
      lastOrbitDraw = now;
      const seen = orbits.render(cam, t, at);
      if (o.onCount && now - lastCount > 700) {
        lastCount = now;
        o.onCount(seen);
      }
    }

    // The sky barely changes unless the camera moves, so at rest it runs at about 6 fps.
    if (!moving && now - lastSkyDraw < (reduced ? 1e9 : 160)) return;
    const spent = now - lastFrameStart;
    lastFrameStart = now;
    if (moving) {
      if (spent > 55 && spent < 400) slowFrames++;
      else if (slowFrames > 0 && spent < 26) slowFrames--;
      if (slowFrames > 12 && scale > 0.32) {
        scale *= 0.78;
        sky!.setScale(scale);
        slowFrames = 0;
      }
    }
    lastSkyDraw = now;
    sky!.render(cam, t);
  }
  requestAnimationFrame(frame);
  return true;
}
