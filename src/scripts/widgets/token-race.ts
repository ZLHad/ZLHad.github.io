// The paper's token-level latency and QoE model, evaluated live for one user.
// Equations: IEEE TMC 2026, eqs. for TTFT/TPOT and QoE. Parameters: Tables I and II.
//
// What is simplified, and said so on the page: one user, mean channel, nominal
// link rates, no inter-satellite hops. This is the analytic model, not the learned
// scheduler, and none of its output is presented as a result from the paper.

const WEIGHTS = { q: 5, ttft: 1, tpot: 10 };
const THETA = 0.5;
const BITS = { txt: 32, vis: 128, out: 32 };
const SAT = { a: 3e-3, b: 0.05, b0: 8e-3, b1: 1.5e-5, xi: 1.6, Q: 1.0 };
const UAV_DELTA = 0.005;
const RATE = { g2a: 75e6, a2g: 75e6, a2s: 100e6, s2a: 100e6 }; // bit/s, nominal, for this widget only

// S_m, Q_m, zeta (GFLOP/token), beta0 (GFLOP), beta1 (MFLOP/token).
const MODELS: Record<string, { Q: number; zeta: number; b0: number; b1: number }> = {
  '9b': { Q: 0.92, zeta: 1.8, b0: 244, b1: 2.5 },
  '4b': { Q: 0.8, zeta: 0.8, b0: 144, b1: 1.1 },
  '2b': { Q: 0.7, zeta: 0.4, b0: 80, b1: 0.56 },
};

// Midpoints of the per-category token ranges in the paper's supplement.
const REQUESTS: Record<string, { txt: number; vis: number; out: number }> = {
  text: { txt: 140, vis: 0, out: 200 },
  summary: { txt: 350, vis: 0, out: 100 },
  caption: { txt: 20, vis: 772, out: 100 },
  vqa: { txt: 40, vis: 772, out: 50 },
  chat: { txt: 100, vis: 2304, out: 165 },
};

interface Tier { ttft: number; tpot: number; q: number; qoe: number; total: number; n: number }

function evaluate(reqKey: string, modelKey: string, eta: number, rho: number, fT: number) {
  const req = REQUESTS[reqKey];
  const m = MODELS[modelKey];
  const nIn = req.txt + req.vis;
  const nT = eta * nIn;
  const kIn = (BITS.txt * req.txt + BITS.vis * req.vis) / nIn;
  const tG2A = (kIn * nT) / RATE.g2a;
  const tA2G = BITS.out / RATE.a2g;
  const tA2S = (kIn * nT) / RATE.a2s;
  const tS2A = BITS.out / RATE.s2a;
  const ctx = nT + (req.out - 1) / 2;

  const f = fT * 1e12;
  const uTTFT = tG2A + tA2G + (m.zeta * 1e9 * nT) / f + UAV_DELTA;
  const uTPOT = Math.max((m.b0 * 1e9 + m.b1 * 1e6 * ctx) / f, tA2G);
  const uQ = m.Q * Math.pow(eta, THETA);

  const sTTFT = tG2A + tA2G + tA2S + tS2A + SAT.a * nT + SAT.b + (SAT.xi * rho) / (1 - rho);
  const sTPOT = Math.max(SAT.b0 + SAT.b1 * ctx, tS2A, tA2G);
  const sQ = SAT.Q * Math.pow(eta, THETA);

  const make = (ttft: number, tpot: number, q: number): Tier => ({
    ttft,
    tpot,
    q,
    qoe: WEIGHTS.q * Math.log(1 + q) - WEIGHTS.ttft * ttft - WEIGHTS.tpot * tpot,
    total: ttft + (req.out - 1) * tpot,
    n: req.out,
  });
  return { uav: make(uTTFT, uTPOT, uQ), leo: make(sTTFT, sTPOT, sQ) };
}

function bestEta(tier: 'uav' | 'leo', reqKey: string, modelKey: string, rho: number, fT: number) {
  let best = 1;
  let bestQ = -Infinity;
  for (let e = 0.1; e <= 1.0001; e += 0.01) {
    const v = evaluate(reqKey, modelKey, e, rho, fT)[tier].qoe;
    if (v > bestQ) {
      bestQ = v;
      best = e;
    }
  }
  return best;
}

const fmtS = (x: number) => (x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtMs = (x: number) => (x * 1000).toFixed(x < 0.1 ? 1 : 0);

export function initTokenRace(root: HTMLElement) {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const reqEl = $<HTMLSelectElement>('[data-req]');
  const modelEl = $<HTMLSelectElement>('[data-model]');
  const etaEl = $<HTMLInputElement>('[data-eta]');
  const rhoEl = $<HTMLInputElement>('[data-rho]');
  const fEl = $<HTMLInputElement>('[data-f]');
  const canvas = $<HTMLCanvasElement>('canvas');
  const ctx = canvas.getContext('2d')!;
  const verdict = $<HTMLElement>('[data-verdict]');

  const css = getComputedStyle(root);
  const ink = css.getPropertyValue('--fg').trim() || '#fff';
  const dim = css.getPropertyValue('--fg-3').trim() || 'rgba(255,255,255,.4)';
  const line = css.getPropertyValue('--line').trim() || 'rgba(255,255,255,.2)';
  const signal = css.getPropertyValue('--signal').trim() || '#ff9244';

  let state = evaluate('vqa', '4b', 0.6, 0.3, 2);
  let start = 0;
  let raf = 0;
  let visible = false;
  let done = false;

  const setReadouts = (name: 'uav' | 'leo', t: Tier, win: boolean) => {
    const lane = root.querySelector<HTMLElement>(`[data-lane="${name}"]`)!;
    lane.querySelector('[data-ttft]')!.textContent = `${fmtS(t.ttft)} s`;
    lane.querySelector('[data-tpot]')!.textContent = `${fmtMs(t.tpot)} ms`;
    lane.querySelector('[data-q]')!.textContent = t.q.toFixed(2);
    lane.querySelector('[data-qoe]')!.textContent = t.qoe.toFixed(2);
    lane.classList.toggle('win', win);
  };

  const read = () => {
    const eta = Number(etaEl.value);
    const rho = Number(rhoEl.value);
    const f = Number(fEl.value);
    $('[data-eta-out]').textContent = eta.toFixed(2);
    $('[data-rho-out]').textContent = rho.toFixed(2);
    $('[data-f-out]').textContent = `${f.toFixed(1)} TFLOPS`;
    state = evaluate(reqEl.value, modelEl.value, eta, rho, f);
    setReadouts('uav', state.uav, state.uav.qoe >= state.leo.qoe);
    setReadouts('leo', state.leo, state.leo.qoe > state.uav.qoe);

    const u = state.uav;
    const l = state.leo;
    const firstIsUav = u.ttft < l.ttft;
    const finishIsUav = u.total < l.total;
    const name = (isUav: boolean) => (isUav ? strings.uav : strings.leo);
    const mid = (isUav: boolean) => (isUav ? strings.uavMid : strings.leoMid);
    const parts: string[] = [];
    if (firstIsUav === finishIsUav) {
      parts.push(strings.both.replace('{tier}', name(firstIsUav)));
    } else {
      parts.push(
        strings.first.replace('{tier}', name(firstIsUav)).replace('{dt}', fmtS(Math.abs(u.ttft - l.ttft))),
        strings.finish.replace('{tier}', name(finishIsUav)).replace('{dt}', fmtS(Math.abs(u.total - l.total))),
      );
    }
    parts.push(strings.qoe.replace('{tier}', mid(u.qoe >= l.qoe)));
    verdict.textContent = parts.join(' ');

    const bestU = bestEta('uav', reqEl.value, modelEl.value, rho, f);
    const bestL = bestEta('leo', reqEl.value, modelEl.value, rho, f);
    $('[data-best]').textContent = strings.best.replace('{u}', bestU.toFixed(2)).replace('{l}', bestL.toFixed(2));
    restart();
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(done ? Infinity : (performance.now() - start) / 1000);
  };

  const draw = (rawT: number) => {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const span = Math.max(state.uav.total, state.leo.total) * 1.04;
    const x = (t: number) => (t / span) * W;
    const laneH = (H - 26) / 2;
    const rows: [Tier, number][] = [
      [state.uav, 0],
      [state.leo, laneH],
    ];

    for (const [tier, y0] of rows) {
      const top = y0 + 8;
      const h = laneH - 16;
      // The wait before the first token: hatched, because nothing has reached the user yet.
      const waitEnd = Math.min(rawT, tier.ttft);
      ctx.fillStyle = dim;
      ctx.globalAlpha = 0.28;
      for (let px = 0; px < x(waitEnd); px += 5) ctx.fillRect(px, top, 1, h);
      ctx.globalAlpha = 1;
      // Tokens: one tick each.
      const shown = rawT < tier.ttft ? 0 : Math.min(tier.n, 1 + Math.floor((rawT - tier.ttft) / tier.tpot));
      for (let i = 0; i < shown; i++) {
        const tx = x(tier.ttft + i * tier.tpot);
        ctx.fillStyle = i === 0 ? signal : ink;
        ctx.fillRect(tx, i === 0 ? top - 4 : top, i === 0 ? 2 : 1, i === 0 ? h + 8 : h);
      }
    }

    // Time axis.
    const axisY = H - 18;
    ctx.fillStyle = line;
    ctx.fillRect(0, axisY, W, 1);
    ctx.fillStyle = dim;
    ctx.font = '500 13px "Archivo Variable", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const step = span > 12 ? 4 : span > 6 ? 2 : span > 3 ? 1 : 0.5;
    for (let t = 0; t <= span; t += step) {
      ctx.fillRect(x(t), axisY, 1, 4);
      const label = `${t % 1 === 0 ? t : t.toFixed(1)} s`;
      ctx.textAlign = t === 0 ? 'left' : 'center';
      if (x(t) < W - 16) ctx.fillText(label, x(t), axisY + 6);
    }

    // The clock.
    if (rawT < span) {
      ctx.fillStyle = signal;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x(rawT), 0, 1, axisY);
      ctx.globalAlpha = 1;
    }
  };

  const tick = () => {
    if (!visible) return;
    const span = Math.max(state.uav.total, state.leo.total) * 1.04;
    const speed = span > 7 ? span / 7 : 1;
    const t = ((performance.now() - start) / 1000) * speed;
    draw(t);
    if (t < span) raf = requestAnimationFrame(tick);
    else done = true;
  };

  function restart() {
    cancelAnimationFrame(raf);
    done = false;
    start = performance.now();
    if (reduced) {
      done = true;
      draw(Infinity);
      return;
    }
    if (visible) raf = requestAnimationFrame(tick);
    else draw(0);
  }

  [reqEl, modelEl, etaEl, rhoEl, fEl].forEach((el) => el.addEventListener('input', read));
  $('[data-run]').addEventListener('click', restart);
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(
    ([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was && !done) restart();
    },
    { threshold: 0.25 },
  ).observe(root);

  read();
}

document.querySelectorAll<HTMLElement>('[data-token-race]').forEach(initTokenRace);
