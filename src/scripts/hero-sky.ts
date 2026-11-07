// The sky behind the home page's hero. On load the sun comes up over the limb; native
// scrolling then lowers the camera a little as the hero leaves the screen. A terminal on
// the ground stays linked to the nearest satellite and hands over as the shell moves, and
// the pointer can carry it around. Without WebGL the still behind the canvases simply stays.
import { runSky } from './sky/run';

const HIGH = Math.log10(1200); // km, at rest
const LOW = Math.log10(420); // km, when the hero has scrolled away

export function startSky(hero: HTMLElement) {
  const readout = hero.querySelector<HTMLElement>('[data-readout]');
  const count = hero.querySelector<HTMLElement>('[data-sat-count]');
  runSky({
    root: hero,
    start: HIGH,
    altitude: () => HIGH + (LOW - HIGH) * Math.min(1, Math.max(0, scrollY / Math.max(1, hero.offsetHeight))),
    sunrise: () => (document.documentElement.classList.contains('seen') ? 0.8 : 3.4),
    depth: true,
    terminal: () => ({ x: hero.offsetWidth * 0.6, y: hero.offsetHeight * 0.79 }),
    onCount: (seen) => {
      if (!count || !readout) return;
      count.textContent = String(seen);
      readout.hidden = false;
    },
  });
}
