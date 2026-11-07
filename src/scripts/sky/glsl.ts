// Atmosphere fragment shader. Units are kilometres.
//
// Single scattering with an analytic optical depth (Schüler's approximation of
// the Chapman grazing-incidence function). No ray marching, so the limb stays
// smooth at any altitude and the shader is cheap enough for integrated GPUs.
export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uH;        // camera altitude, km
uniform float uPitch;    // radians, positive looks down
uniform float uTanFov;
uniform vec3  uSun;
uniform float uT;        // seconds
uniform float uFog;      // 0..1 white-out inside the cloud deck
uniform vec3  uFogCol;
uniform float uDeck;     // cloud-deck altitude, km
uniform float uCover;    // cloud coverage bias
uniform float uExposure;
out vec4 frag;

const float R  = 6371.0;
const float HR = 8.0;
const float HM = 1.4;
const vec3  BR = vec3(5.8e-3, 13.5e-3, 33.1e-3);
const float BM = 6e-3;
const float G  = 0.82;
const float SUN = 26.0;
const float PI = 3.14159265;

float hash(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// Fractal zoom. Octaves are locked to the world, and the band of active octaves
// follows view distance, so cloud detail never swims and never runs out as the
// camera falls from orbit to the cloud tops.
float zfbm(vec3 p, float dist, float base) {
  float L = log2(base / max(dist, 0.04));
  float k0 = floor(L), fr = L - k0;
  float v = 0.0, w = 0.0;
  for (int i = 0; i < 5; i++) {
    float k = k0 + float(i);
    float a = pow(0.52, float(i) - fr);
    float win = i == 0 ? 1.0 - fr : (i == 4 ? fr : 1.0);
    v += win * a * vnoise(p * pow(2.0, k) / base + vec3(k * 17.13, k * 3.71, k * 29.3));
    w += win * a;
  }
  return v / w;
}

float chapman(float r, float mu, float H) {
  float X = R / H;
  float h = max((r - R) / H, 0.0);
  float c = 1.2533 * sqrt(X + h);
  float up = c / ((c - 1.0) * abs(mu) + 1.0) * exp(-h);
  if (mu >= 0.0) return up;
  float x0 = sqrt(max(1.0 - mu * mu, 0.0)) * (X + h);
  float c0 = 1.2533 * sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 24.0)) - up;
}

vec3 tauTo(vec3 p, vec3 dir) {
  float r = length(p);
  float mu = dot(p, dir) / r;
  return BR * HR * chapman(r, mu, HR) + vec3(1.1 * BM * HM * chapman(r, mu, HM));
}

float hitSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  if (b > 0.0) return -1.0;
  float m = length(cross(ro, rd));
  if (m > r) return -1.0;
  float t = -b - sqrt((r - m) * (r + m));
  return t > 0.0 ? t : -1.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(0.0, R + uH, 0.0);
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 fw = vec3(0.0, -sp, cp), up = vec3(0.0, cp, sp), rt = vec3(1.0, 0.0, 0.0);
  vec3 rd = normalize(fw + (rt * uv.x + up * uv.y) * uTanFov);

  float r0 = length(ro);
  float mu0 = dot(ro, rd) / r0;
  float tG = hitSphere(ro, rd, R);
  float deckR = R + uDeck;
  float tC = uH > uDeck ? hitSphere(ro, rd, deckR) : -1.0;

  // Optical depth along the view ray, and a representative scattering point.
  float odR, odM;
  vec3 P;
  if (tG > 0.0) {
    vec3 pH = ro + rd * tG;
    float rH = length(pH), muH = dot(pH, rd) / rH;
    odR = chapman(rH, -muH, HR) - chapman(r0, -mu0, HR);
    odM = chapman(rH, -muH, HM) - chapman(r0, -mu0, HM);
    float back = min(tG, HR / max(abs(muH), 0.04));
    P = ro + rd * (tG - back);
  } else {
    odR = chapman(r0, mu0, HR);
    odM = chapman(r0, mu0, HM);
    float tP = max(-dot(ro, rd), 0.0);
    P = ro + rd * tP;
    if (length(P) - R > 80.0 && uH < 80.0) P = ro + rd * 8.0;
  }
  odR = max(odR, 0.0); odM = max(odM, 0.0);

  vec3 tauR = BR * HR * odR;
  float tauM = BM * HM * odM;
  vec3 tau = tauR + 1.1 * tauM;

  float cosT = dot(rd, uSun);
  float pR = 3.0 / (16.0 * PI) * (1.0 + cosT * cosT);
  float g2 = G * G;
  float pM = 3.0 / (8.0 * PI) * (1.0 - g2) * (1.0 + cosT * cosT)
           / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * G * cosT, 1e-3), 1.5));

  vec3 Tsun = exp(-min(tauTo(P, uSun), vec3(40.0)));
  vec3 attenuation = exp(-tau);
  vec3 scatterFrac = (1.0 - attenuation) / max(tau, vec3(1e-4));
  vec3 L = SUN * Tsun * scatterFrac * (tauR * pR + vec3(tauM * pM));

  // Surface and cloud tops.
  vec3 surf = vec3(0.0);
  bool hasSurf = tG > 0.0 || tC > 0.0;
  if (hasSurf) {
    float t = tC > 0.0 ? tC : tG;
    vec3 ps = ro + rd * t;
    vec3 n = normalize(ps);
    float nl = dot(n, uSun);
    vec3 Ts = exp(-min(tauTo(ps, uSun), vec3(40.0)));
    vec3 q = ps - vec3(0.0, R, 0.0);
    q += vec3(uT * 0.012, 0.0, uT * 0.006);

    float seas = smoothstep(0.46, 0.60, vnoise(ps / 900.0 + 3.1) * 0.6 + vnoise(ps / 280.0) * 0.4);
    vec3 albedo = mix(vec3(0.012, 0.03, 0.06), vec3(0.055, 0.06, 0.04), seas);
    surf = albedo * SUN * Ts * max(nl, 0.0) / PI;

    float base = 2600.0;
    float warp = vnoise(q * 3.0 / base) - 0.5;
    float d = zfbm(q + warp * t * 0.30, t, base);
    float edge = 0.47 - uCover;
    float cover = smoothstep(edge, edge + 0.17, d);
    vec3 lightDir = normalize(uSun + n * 0.15);
    float dSun = zfbm(q + warp * t * 0.30 + lightDir * t * 0.016, t, base);
    float relief = clamp(0.58 + (d - dSun) * 11.0, 0.10, 1.25);
    float cloudGain = mix(0.34, 1.0, smoothstep(160.0, 14.0, uH));
    vec3 cloud = cloudGain * vec3(0.92, 0.94, 0.97) * SUN * Ts * max(nl + 0.06, 0.0) / PI * relief
               + vec3(0.30, 0.42, 0.62) * 0.07 * cloudGain * SUN * smoothstep(-0.12, 0.25, nl);
    surf = mix(surf, cloud, cover);
    L += surf * attenuation;
  }

  // Sun disc, only where nothing blocks it.
  if (!hasSurf) {
    float disc = smoothstep(0.999975, 0.999995, cosT);
    L += pow(attenuation, vec3(0.3)) * disc * 120.0; // the disc stays bright even through a long path
    float c2 = max(cosT, 0.0);
    L += attenuation * (pow(c2, 26000.0) * 2.4 + pow(c2, 3200.0) * 0.34 + pow(c2, 420.0) * 0.045)
       * vec3(1.0, 0.90, 0.78);
  }

  vec3 col = 1.0 - exp(-L * uExposure);
  col = pow(col, vec3(1.0 / 2.2));

  // Deep space is a blue-black, never pure black, and matches --space on the page.
  col = max(col, vec3(0.018, 0.024, 0.033));

  // The cloud deck: wisps first, then a full white-out.
  if (uFog > 0.0) {
    vec3 wp = vec3(uv * 1.15 * (1.0 + uFog), uT * 0.05 + uH * 2.0);
    float wisp = vnoise(wp * 1.3) * 0.6 + vnoise(wp * 3.1) * 0.3 + vnoise(wp * 7.3) * 0.1;
    float a = smoothstep(0.0, 1.0, uFog * 1.7 - 0.7 + wisp * 0.7);
    col = mix(col, uFogCol, clamp(a, 0.0, 1.0));
  }

  // Dither to break banding in the very dark gradients.
  vec2 ig = gl_FragCoord.xy + 5.588238 * mod(floor(uT * 12.0), 64.0);
  float n = fract(52.9829189 * fract(dot(ig, vec2(0.06711056, 0.00583715)))) - 0.5;
  col += n * 1.4 / 255.0;
  frag = vec4(col, 1.0);
}`;
