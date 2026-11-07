// Overlay drawn on a crisp 2D canvas above the sky: stars, a real Walker-delta
// shell propagated with Keplerian motion, and hairline orbit planes.
//
// The camera hovers above NUS (1.30° N, 103.78° E). The shell is 53°: 1584/72/1
// at 550 km. Satellites are only drawn when the line of sight clears the planet,
// and are only bright when they are in sunlight, as they are in reality.
import { EARTH_R, basis, type CameraState } from './camera';

// What the home page's readout says about this shell comes from these numbers.
export const SHELL = { planes: 72, perPlane: 22, inclination: 53, altitude: 550, speedup: 18 };
const INC = (SHELL.inclination * Math.PI) / 180;
const SAT_R = EARTH_R + SHELL.altitude;
const PLANES = SHELL.planes;
const PER_PLANE = SHELL.perPlane;
const MU = 398600.4418;
const N = Math.sqrt(MU / (SAT_R * SAT_R * SAT_R)); // rad/s
const SPEEDUP = SHELL.speedup;
const SITE_LAT = (1.2966 * Math.PI) / 180;
const SITE_LON = (103.7764 * Math.PI) / 180;

type V3 = [number, number, number];
export interface Pointer { x: number; y: number }
interface Sat { x: number; y: number; lit: boolean; size: number }
const dot = (a: V3 | readonly number[], b: V3 | readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class Orbits {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private stars: { d: V3; m: number }[] = [];
  private X: V3;
  private Y: V3;
  private Z: V3;
  private serving = -1; // the satellite the terminal is linked to
  private flash = 0; // how recently it changed

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    // Site frame: +Y through NUS, +Z to local north, +X to local east.
    this.Y = [
      Math.cos(SITE_LAT) * Math.cos(SITE_LON),
      Math.cos(SITE_LAT) * Math.sin(SITE_LON),
      Math.sin(SITE_LAT),
    ];
    this.Z = [
      -Math.sin(SITE_LAT) * Math.cos(SITE_LON),
      -Math.sin(SITE_LAT) * Math.sin(SITE_LON),
      Math.cos(SITE_LAT),
    ];
    this.X = [
      this.Z[1] * this.Y[2] - this.Z[2] * this.Y[1],
      this.Z[2] * this.Y[0] - this.Z[0] * this.Y[2],
      this.Z[0] * this.Y[1] - this.Z[1] * this.Y[0],
    ];

    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1500; i++) {
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      this.stars.push({
        d: [s * Math.cos(a), z, s * Math.sin(a)],
        m: Math.pow(rnd(), 5.5),
      });
    }
    this.resize();
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private satWorld(plane: number, m: number): V3 {
    const raan = (2 * Math.PI * plane) / PLANES;
    const cO = Math.cos(raan), sO = Math.sin(raan);
    const cM = Math.cos(m), sM = Math.sin(m);
    const cI = Math.cos(INC), sI = Math.sin(INC);
    const eci: V3 = [
      SAT_R * (cO * cM - sO * sM * cI),
      SAT_R * (sO * cM + cO * sM * cI),
      SAT_R * sM * sI,
    ];
    return [dot(eci, this.X), dot(eci, this.Y), dot(eci, this.Z)];
  }

  /** Draws one frame and returns how many satellites are above the horizon. */
  render(cam: CameraState, t: number, pointer: Pointer | null = null): number {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const fade = smooth(40, 150, cam.h);
    if (fade <= 0) return 0;

    const { fw, up, rt } = basis(cam.pitch);
    const aspect = w / h;
    const ro: V3 = [0, EARTH_R + cam.h, 0];
    const rNorm = ro[1];
    const toScreen = (dx: number, dy: number, dz: number): [number, number, number] | null => {
      const z = dx * fw[0] + dy * fw[1] + dz * fw[2];
      if (z <= 0.01) return null;
      const x = dx * rt[0] + dy * rt[1] + dz * rt[2];
      const y = dx * up[0] + dy * up[1] + dz * up[2];
      const sx = x / (z * cam.tanFov * aspect);
      const sy = y / (z * cam.tanFov);
      if (Math.abs(sx) > 1.05 || Math.abs(sy) > 1.05) return null;
      return [(sx * 0.5 + 0.5) * w, (0.5 - sy * 0.5) * h, z];
    };
    // Does the ray from the camera along (dx,dy,dz)/len hit the planet before distance len?
    const blocked = (dy: number, len: number) => {
      const b = (ro[1] * dy) / len;
      if (b >= 0) return false;
      const perp2 = rNorm * rNorm - b * b;
      if (perp2 > EARTH_R * EARTH_R) return false;
      return len === 1 || -b - Math.sqrt(EARTH_R * EARTH_R - perp2) < len;
    };

    // Stars.
    for (const s of this.stars) {
      const p = toScreen(s.d[0], s.d[1], s.d[2]);
      if (!p) continue;
      if (blocked(s.d[1], 1)) continue;
      const a = (0.1 + s.m * 0.9) * fade;
      const size = s.m > 0.5 ? 1.4 : s.m > 0.12 ? 1.05 : 0.8;
      ctx.fillStyle = `rgba(214,226,240,${a.toFixed(3)})`;
      ctx.fillRect(p[0], p[1], size, size);
    }

    const sun = cam.sun as V3;
    const tt = t * SPEEDUP;

    // Hairline orbit planes, for scale. Six planes only, or the drawing turns to fog.
    ctx.lineWidth = 0.6;
    for (let pl = 0; pl < PLANES; pl += 12) {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 180; i++) {
        const m = (i / 180) * Math.PI * 2;
        const q = this.satWorld(pl, m);
        const dx = q[0] - ro[0], dy = q[1] - ro[1], dz = q[2] - ro[2];
        const len = Math.hypot(dx, dy, dz);
        const p = toScreen(dx, dy, dz);
        if (!p || blocked(dy, len)) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
        pen = true;
      }
      ctx.strokeStyle = `rgba(190,208,226,${(0.13 * fade).toFixed(3)})`;
      ctx.stroke();
    }

    // The shell. First find who is above the horizon, then draw links under the satellites.
    const seen = new Map<number, Sat>();
    for (let pl = 0; pl < PLANES; pl++) {
      for (let j = 0; j < PER_PLANE; j++) {
        const m = (2 * Math.PI * j) / PER_PLANE + (2 * Math.PI * pl) / (PLANES * PER_PLANE) + N * tt;
        const q = this.satWorld(pl, m);
        const dx = q[0] - ro[0], dy = q[1] - ro[1], dz = q[2] - ro[2];
        const len = Math.hypot(dx, dy, dz);
        const p = toScreen(dx, dy, dz);
        if (!p || blocked(dy, len)) continue;
        const along = dot(q, sun);
        const perp2 = dot(q, q) - along * along;
        const near = 1 / Math.max(len / 1800, 0.35);
        seen.set(pl * PER_PLANE + j, {
          x: p[0],
          y: p[1],
          lit: along > 0 || perp2 > EARTH_R * EARTH_R,
          size: Math.min(2.6, 0.9 + near * 0.55),
        });
      }
    }

    // +Grid inter-satellite links: the next satellite in the plane and the same slot in
    // the next plane. Traffic is drawn on one link in five.
    const maxLink = Math.max(150, w * 0.17);
    const flow = (t * 0.22) % 1;
    ctx.lineWidth = 0.6;
    for (const [id, a] of seen) {
      const pl = Math.floor(id / PER_PLANE);
      const j = id % PER_PLANE;
      const ends = [pl * PER_PLANE + ((j + 1) % PER_PLANE), ((pl + 1) % PLANES) * PER_PLANE + j];
      for (let e = 0; e < 2; e++) {
        const b = seen.get(ends[e]);
        if (!b) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d > maxLink) continue;
        const alpha = 0.2 * fade * (1 - d / maxLink) * (a.lit && b.lit ? 1 : 0.45);
        ctx.strokeStyle = `rgba(150,196,240,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if ((id * 7 + e * 3) % 5 === 0 && a.lit && b.lit) {
          const u = (flow + ((id * 13) % 17) / 17) % 1;
          ctx.fillStyle = `rgba(255,150,92,${(0.95 * fade * Math.sin(Math.PI * u)).toFixed(3)})`;
          ctx.fillRect(a.x + (b.x - a.x) * u - 1, a.y + (b.y - a.y) * u - 1, 2, 2);
        }
      }
    }

    if (pointer) this.drawLink(seen, pointer, fade);
    else this.serving = -1;

    for (const s of seen.values()) {
      ctx.fillStyle = s.lit
        ? `rgba(255,244,226,${(0.86 * fade).toFixed(3)})`
        : `rgba(150,170,195,${(0.22 * fade).toFixed(3)})`;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    return seen.size;
  }

  // The pointer stands for a terminal on the ground. It stays on its satellite until
  // another is clearly closer, the way a real link hands over, and marks the change.
  private drawLink(seen: Map<number, Sat>, at: Pointer, fade: number) {
    const { ctx } = this;
    const reach = Math.max(240, this.w * 0.24);
    const dist = (s: Sat) => Math.hypot(s.x - at.x, s.y - at.y);
    let best = -1;
    let bestD = reach;
    for (const [id, s] of seen) {
      if (!s.lit) continue;
      const d = dist(s);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    const held = seen.get(this.serving);
    const heldD = held?.lit ? dist(held) : Infinity;
    if (heldD > reach || bestD < heldD * 0.7) {
      if (best !== this.serving && best >= 0) this.flash = 1;
      this.serving = best;
    }
    ctx.fillStyle = `rgba(255,170,120,${(0.95 * fade).toFixed(3)})`;
    ctx.fillRect(at.x - 1.5, at.y - 1.5, 3, 3);
    const sat = seen.get(this.serving);
    if (!sat) return;

    const line = ctx.createLinearGradient(at.x, at.y, sat.x, sat.y);
    line.addColorStop(0, `rgba(255,150,92,${(0.4 * fade).toFixed(3)})`);
    line.addColorStop(1, `rgba(255,170,120,${(0.9 * fade).toFixed(3)})`);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(sat.x, sat.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,170,120,${(0.9 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, 4.5, 0, 6.2832);
    ctx.stroke();
    if (this.flash > 0.02) {
      ctx.strokeStyle = `rgba(255,190,150,${(this.flash * 0.8 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sat.x, sat.y, 4.5 + (1 - this.flash) * 22, 0, 6.2832);
      ctx.stroke();
      this.flash *= 0.9;
    }
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
