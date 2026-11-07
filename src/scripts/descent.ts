// The research page's descent. Scrolling lowers the camera from orbit to the cloud deck,
// and it settles at the altitude of each stop while that stop's text is on screen. Without
// WebGL, or with reduced motion, nothing runs and every stop keeps its own still of the sky.
import { runSky } from './sky/run';

const smooth = (t: number) => t * t * (3 - 2 * t);

// Daylight would wash out the page's light text, so low down it is always blue hour.
const LIGHT_LOW = [Math.log10(14), Math.log10(70)];
const BLUE_HOUR = 0.34;

export function startDescent(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const stops = [...root.querySelectorAll<HTMLElement>('[data-alt]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-rail] a')];
  const end = root.querySelector<HTMLElement>('[data-sky-end]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let anchors: { y: number; lg: number }[] = [];
  let fadeFrom = 0;
  let fadeTo = 1;
  let shown = 1;

  const measure = () => {
    anchors = stops.map((s) => {
      const r = s.getBoundingClientRect();
      return { y: r.top + scrollY + r.height / 2 - innerHeight / 2, lg: Math.log10(Number(s.dataset.alt)) };
    });
    anchors[0].y = 0;
    const top = end.getBoundingClientRect().top + scrollY;
    fadeFrom = top - innerHeight * 0.95;
    fadeTo = top - innerHeight * 0.25;
    onScroll();
  };

  const altitude = () => {
    const y = scrollY;
    if (y <= anchors[0].y) return anchors[0].lg;
    for (let i = 1; i < anchors.length; i++) {
      if (y <= anchors[i].y) {
        const t = (y - anchors[i - 1].y) / (anchors[i].y - anchors[i - 1].y);
        return anchors[i - 1].lg + (anchors[i].lg - anchors[i - 1].lg) * smooth(t);
      }
    }
    return anchors[anchors.length - 1].lg;
  };

  // The rail marks the stop nearest the middle of the screen; the sky gives way to the page.
  let current = -1;
  function onScroll() {
    const y = scrollY;
    let at = 0;
    anchors.forEach((a, i) => {
      if (y >= a.y - innerHeight * 0.4) at = i;
    });
    if (at !== current) {
      current = at;
      links.forEach((l, i) => (i === at ? l.setAttribute('aria-current', 'step') : l.removeAttribute('aria-current')));
    }
    shown = 1 - Math.min(1, Math.max(0, (y - fadeFrom) / (fadeTo - fadeFrom)));
    stage.style.opacity = shown.toFixed(3);
  }

  measure();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
  new ResizeObserver(measure).observe(root);

  // A jump lands where the stop's own altitude is, not at the top of its box.
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((l) => {
    const i = stops.findIndex((s) => `#${s.id}` === l.getAttribute('href'));
    if (i < 0) return;
    l.addEventListener('click', (e) => {
      e.preventDefault();
      scrollTo({ top: anchors[i].y, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  // Line drawings only run while their stop is on screen.
  const watch = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('off', !e.isIntersecting);
  });
  root.querySelectorAll('.stop').forEach((s) => watch.observe(s));

  if (reduced) return;
  const live = runSky({
    root: stage,
    start: anchors[0].lg,
    altitude,
    active: () => shown > 0.004,
    light: (lg) => BLUE_HOUR + (1 - BLUE_HOUR) * smooth(Math.min(1, Math.max(0, (lg - LIGHT_LOW[0]) / (LIGHT_LOW[1] - LIGHT_LOW[0])))),
  });
  if (live) root.classList.add('live');
}
