// The sky is a pure function of altitude: this file maps a camera altitude to
// everything the renderers need. No state, no clock. The stills in public/media/sky-*.webp
// are this same render at 1200, 550, 100 and about 8 km.

export const EARTH_R = 6371;
export const DECK_KM = 3.2;

export interface CameraState {
  h: number;
  pitch: number;
  tanFov: number;
  sun: [number, number, number];
  fog: number;
  cover: number;
  exposure: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      const t = (x - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return table[table.length - 1][1];
}

// Where the limb should sit on screen (NDC, -1 bottom, +1 top), keyed by log10(km).
const LIMB_Y: [number, number][] = [
  [Math.log10(3.2), 0.95],
  [Math.log10(5), 0.2],
  [Math.log10(9), -0.5],
  [Math.log10(30), -0.8],
  [Math.log10(100), -0.84],
  [Math.log10(550), -0.74],
  [Math.log10(1200), -0.62],
];

// Sun elevation above the local horizontal, relative to the geometric limb, in degrees.
// It stays low through orbit, which keeps the planet dark behind the text, then climbs
// fast at lower altitudes until it leaves the top of the frame.
const SUN_OVER_LIMB: [number, number][] = [
  [Math.log10(3.2), 56],
  [Math.log10(12), 46],
  [Math.log10(25), 22],
  [Math.log10(60), 6],
  [Math.log10(140), 3.2],
  [Math.log10(420), 1.6],
  [Math.log10(800), 0.5],
  [Math.log10(1200), -0.9],
];

export function cameraAt(hKm: number, aspect: number): CameraState {
  const h = Math.max(hKm, 0.5);
  const lg = Math.log10(h);

  // A band wider than 16:10 crops the same view instead of widening it.
  const fovDeg = aspect < 1 ? 58 : 38;
  const tanFov = Math.tan((fovDeg * Math.PI) / 360) * Math.min(1, 1.6 / aspect);

  // Geometric dip of the horizon below the local horizontal.
  const dip = Math.acos(EARTH_R / (EARTH_R + h));
  const limbY = aspect < 1 ? Math.min(interp(LIMB_Y, lg), lg < 0.75 ? 1 : -0.88) : interp(LIMB_Y, lg) + (aspect > 1.6 ? Math.max(-0.12, Math.min(0.1, 0.1 - 0.37 * (aspect - 2.86))) : 0);
  const pitch = dip + Math.atan(limbY * tanFov);

  // The sun sits just behind the limb in orbit, then climbs as the camera falls.
  const over = interp(SUN_OVER_LIMB, lg);
  const elev = -dip + (over * Math.PI) / 180;
  const az = (aspect < 1 ? 9 : 22) * (Math.PI / 180);
  const sun: [number, number, number] = [
    Math.sin(az) * Math.cos(elev),
    Math.sin(elev),
    Math.cos(az) * Math.cos(elev),
  ];

  const fog = smooth(DECK_KM + 3.6, DECK_KM + 0.15, h);
  const cover = 0.015 + 0.17 * smooth(30, 4.2, h);
  const exposure = 1.0 - 0.34 * smooth(60, 12, h);
  return { h, pitch, tanFov, sun, fog, cover, exposure };
}

/** Screen projection for overlay marks, in NDC. Returns null when behind the camera. */
export function basis(pitch: number) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    fw: [0, -sp, cp] as const,
    up: [0, cp, sp] as const,
    rt: [1, 0, 0] as const,
  };
}
