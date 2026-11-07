// Behaviour shared by every page: the paper overview popup and its stage, the figure
// inspector, copy buttons, tooltips, the pointer light on cards, counters and reveal-on-view.

const root = document.documentElement;
const paperDialog = document.getElementById('paper-dialog') as HTMLDialogElement | null;
const zoomDialog = document.getElementById('zoom-dialog') as HTMLDialogElement | null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canMorph = 'startViewTransition' in document && !reduced;
if (canMorph) root.classList.add('has-vt');
let currentPaper = '';

/* ---------- Images ---------- */

// Figures fade in as they arrive rather than popping into place.
document.addEventListener(
  'load',
  (e) => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('loaded');
  },
  true,
);
document.addEventListener(
  'error',
  (e) => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('loaded');
  },
  true,
);
const markLoaded = (within: ParentNode) =>
  within.querySelectorAll('img').forEach((img) => {
    if (img.complete) img.classList.add('loaded');
  });
markLoaded(document);

/* ---------- The popup ---------- */

// The papers on this page, for the previous and next buttons: the list first, in its
// order and under its filter, then anything else on the page that opens a paper.
const paperOrder = () => {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-paper-row]')]
    .filter((el) => !el.closest('[hidden]'))
    .map((el) => el.dataset.paperRow!);
  const others = document.querySelector('[data-publist]')
    ? []
    : [...document.querySelectorAll<HTMLElement>('[data-open-paper]')].map((el) => el.dataset.openPaper!);
  return [...new Set([...rows, ...others])];
};

// The plate a paper would fly from or back to, when it is on screen.
function thumbFor(slug: string) {
  const el = document.querySelector<HTMLElement>(`[data-paper-row="${slug}"] [data-thumb]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight ? el : null;
}

// Runs a change so that one element appears to become another.
function morph(change: () => void, from: () => HTMLElement | null, to: () => HTMLElement | null) {
  if (!canMorph) return change();
  // In a popup transition the bar is part of the page behind it, not a layer above.
  root.classList.add('vt-modal');
  const a = from();
  if (a) a.style.viewTransitionName = 'paper-figure';
  let b: HTMLElement | null = null;
  const vt = document.startViewTransition(() => {
    if (a) a.style.viewTransitionName = '';
    change();
    b = to();
    if (a && b) b.style.viewTransitionName = 'paper-figure';
  });
  // A transition the browser abandons (say, the viewport changed) still applies the change.
  vt.ready.catch(() => {});
  vt.finished.catch(() => {}).finally(() => {
    root.classList.remove('vt-modal');
    if (b) b.style.viewTransitionName = '';
  });
}

function fillPaper(slug: string) {
  const tpl = document.getElementById(`paper-${slug}`) as HTMLTemplateElement;
  paperDialog!.querySelector('[data-paper-body]')!.replaceChildren(tpl.content.cloneNode(true));
  markLoaded(paperDialog!);
  currentPaper = slug;
}

export function openPaper(slug: string, updateUrl = true, animate = true) {
  if (!paperDialog || !document.getElementById(`paper-${slug}`)) return false;
  const show = () => {
    fillPaper(slug);
    // Keep the page from jumping sideways when its scrollbar goes away.
    document.body.style.paddingRight = `${innerWidth - root.clientWidth}px`;
    root.classList.add('modal-open');
    paperDialog.showModal();
  };
  if (animate) morph(show, () => thumbFor(slug), () => paperDialog.querySelector('[data-stage-view]'));
  else show();
  if (updateUrl) history.replaceState(null, '', `#paper=${slug}`);
  return true;
}

function closePaper() {
  if (!paperDialog?.open) return;
  morph(
    () => paperDialog.close(),
    () => (thumbFor(currentPaper) ? paperDialog.querySelector('[data-stage-view]') : null),
    () => thumbFor(currentPaper),
  );
}

function stepPaper(by: number) {
  const order = paperOrder();
  if (order.length < 2) return;
  fillPaper(order[(order.indexOf(currentPaper) + by + order.length) % order.length]);
  history.replaceState(null, '', `#paper=${currentPaper}`);
  const body = paperDialog!.querySelector<HTMLElement>('[data-paper-body]')!;
  body.classList.remove('step-next', 'step-prev');
  void body.offsetWidth;
  body.classList.add(by > 0 ? 'step-next' : 'step-prev');
}

paperDialog?.addEventListener('cancel', (e) => {
  e.preventDefault();
  closePaper();
});
paperDialog?.addEventListener('close', () => {
  root.classList.remove('modal-open');
  document.body.style.paddingRight = '';
  if (location.hash.startsWith('#paper=')) history.replaceState(null, '', location.pathname + location.search);
});

export async function copyText(text: string, host: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Plain http, or the permission was refused. Inside a modal dialog only its own
    // contents can take focus, so the temporary field goes next to the button.
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0';
    host.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

/* ---------- The figure inspector ---------- */

const zm = zoomDialog && {
  canvas: zoomDialog.querySelector<HTMLElement>('[data-zm-canvas]')!,
  sheet: zoomDialog.querySelector<HTMLElement>('[data-zm-sheet]')!,
  img: zoomDialog.querySelector('img')!,
  cap: zoomDialog.querySelector<HTMLElement>('[data-zm-cap]')!,
  level: zoomDialog.querySelector<HTMLElement>('[data-zm-level]')!,
  fit: 1,
  s: 1,
  x: 0,
  y: 0,
};

function zmApply(smooth = false) {
  if (!zm) return;
  zm.sheet.style.transition = smooth ? 'transform 0.28s var(--ease-out)' : 'none';
  zm.sheet.style.transform = `translate(${zm.x}px, ${zm.y}px) scale(${zm.s})`;
  zm.level.textContent = `${Math.round((zm.s / zm.fit) * 100)}%`;
}

function zmFit(smooth = false) {
  if (!zm) return;
  const pad = innerWidth < 760 ? 12 : 32;
  const cw = zm.canvas.clientWidth;
  const ch = zm.canvas.clientHeight;
  const nw = zm.img.naturalWidth || 1;
  const nh = zm.img.naturalHeight || 1;
  zm.fit = Math.min((cw - 2 * pad) / nw, (ch - 2 * pad) / nh);
  zm.s = zm.fit;
  zm.x = (cw - nw * zm.s) / 2;
  zm.y = (ch - nh * zm.s) / 2;
  zmApply(smooth);
}

function zmAt(cx: number, cy: number, k: number, smooth = false) {
  if (!zm) return;
  const next = Math.min(zm.fit * 8, Math.max(zm.fit, zm.s * k));
  const r = zm.canvas.getBoundingClientRect();
  const px = cx - r.left;
  const py = cy - r.top;
  zm.x = px - ((px - zm.x) / zm.s) * next;
  zm.y = py - ((py - zm.y) / zm.s) * next;
  zm.s = next;
  if (next === zm.fit) return zmFit(smooth);
  zmApply(smooth);
}

function openZoom(src: string, alt: string) {
  if (!zm || !zoomDialog) return;
  zm.cap.textContent = alt;
  zm.img.alt = alt;
  zm.sheet.style.visibility = 'hidden';
  zm.img.onload = () => {
    zm.img.style.width = `${zm.img.naturalWidth}px`;
    zm.img.style.height = `${zm.img.naturalHeight}px`;
    zm.sheet.style.width = `${zm.img.naturalWidth}px`;
    zm.sheet.style.height = `${zm.img.naturalHeight}px`;
    zmFit();
    zm.sheet.style.visibility = '';
  };
  zoomDialog.showModal();
  zm.img.src = src;
  if (zm.img.complete && zm.img.naturalWidth) zm.img.onload(new Event('load'));
}

if (zm) {
  const c = zm.canvas;
  c.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zmAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
    },
    { passive: false },
  );
  const pts = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch = 0;
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    c.classList.add('grabbing');
  });
  c.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zmAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d;
      moved += 8;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    if (zm.s > zm.fit * 1.001) {
      zm.x += dx;
      zm.y += dy;
      zmApply();
    }
  });
  const end = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    pinch = 0;
    if (!pts.size) c.classList.remove('grabbing');
  };
  c.addEventListener('pointerup', (e) => {
    end(e);
    // A plain click on the empty canvas closes it.
    const r = zm.sheet.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (moved < 4 && !inside && !pts.size) zoomDialog!.close();
  });
  c.addEventListener('pointercancel', end);
  c.addEventListener('dblclick', (e) => {
    if (zm.s > zm.fit * 1.01) zmFit(true);
    else zmAt(e.clientX, e.clientY, 2.4, true);
  });
  addEventListener('resize', () => {
    if (zoomDialog!.open) zmFit();
  });
  zoomDialog!.addEventListener('close', () => {
    zm.img.removeAttribute('src');
  });
}

/* ---------- Keys ---------- */

document.addEventListener('keydown', (e) => {
  if (zoomDialog?.open && zm) {
    const r = zm.canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (e.key === '+' || e.key === '=') zmAt(cx, cy, 1.4, true);
    if (e.key === '-') zmAt(cx, cy, 1 / 1.4, true);
    if (e.key === '0') zmFit(true);
    return;
  }
  if (!paperDialog?.open) return;
  if (e.key === 'ArrowLeft') stepPaper(-1);
  if (e.key === 'ArrowRight') stepPaper(1);
});

/* ---------- Clicks ---------- */

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const mouse = e as MouseEvent;

  // The inspector's own controls.
  const zb = target.closest<HTMLElement>('[data-zm]');
  if (zb && zm) {
    const r = zm.canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (zb.dataset.zm === 'close') zoomDialog!.close();
    if (zb.dataset.zm === 'in') zmAt(cx, cy, 1.4, true);
    if (zb.dataset.zm === 'out') zmAt(cx, cy, 1 / 1.4, true);
    if (zb.dataset.zm === 'fit') zmFit(true);
    return;
  }
  if (target.closest('#zoom-dialog')) return;

  const zoom = target.closest<HTMLElement>('[data-zoom]');
  if (zoom) {
    e.preventDefault();
    openZoom(zoom.dataset.zoom!, zoom.dataset.alt ?? '');
    return;
  }

  const slideTo = target.closest<HTMLElement>('[data-slide-to]');
  if (slideTo) {
    const stage = slideTo.closest('.ov-stage')!;
    const i = slideTo.dataset.slideTo;
    stage.querySelectorAll<HTMLElement>('[data-slide]').forEach((s) => s.classList.toggle('on', s.dataset.slide === i));
    stage.querySelectorAll<HTMLElement>('[data-slide-to]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.slideTo === i)));
    slideTo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }

  // A normal click opens the popup; ctrl or cmd-click still opens the paper's own page.
  const opener = target.closest<HTMLElement>('[data-open-paper]');
  if (opener && !mouse.metaKey && !mouse.ctrlKey && !mouse.shiftKey) {
    if (openPaper(opener.dataset.openPaper!)) e.preventDefault();
    return;
  }

  if (target.closest('[data-close-paper]') || target === paperDialog) {
    closePaper();
    return;
  }
  const step = target.closest<HTMLElement>('[data-step-paper]');
  if (step) {
    stepPaper(Number(step.dataset.stepPaper));
    return;
  }

  const copy = target.closest<HTMLElement>('[data-copy]');
  if (copy) {
    const box = copy.parentElement!;
    const label = copy.querySelector('span')!;
    copyText(copy.dataset.copy ?? '', box).then((ok) => {
      const before = copy.dataset.label ?? label.textContent!;
      copy.dataset.label = before;
      label.textContent = ok ? copy.dataset.copied! : copy.dataset.failed!;
      copy.classList.toggle('done', ok);
      if (!ok) getSelection()?.selectAllChildren(box.querySelector('[data-copy-source]')!);
      setTimeout(() => {
        label.textContent = before;
        copy.classList.remove('done');
      }, ok ? 1500 : 4000);
      copy.focus();
    });
    return;
  }

  // Citation format tabs inside an overview.
  const tab = target.closest<HTMLElement>('[data-cite-tab]');
  if (tab) {
    const box = tab.closest('[data-cite]')!;
    box.querySelectorAll<HTMLElement>('[data-cite-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    box.querySelectorAll<HTMLElement>('[data-cite-pane]').forEach((p) => (p.hidden = p.dataset.citePane !== tab.dataset.citeTab));
    return;
  }

  // A click anywhere on a paper's row opens it, unless the reader is selecting text.
  const row = target.closest<HTMLElement>('[data-paper-row]');
  if (row && !target.closest('a, button') && !getSelection()?.toString()) openPaper(row.dataset.paperRow!);
});

/* ---------- Tooltips ---------- */

let tip: HTMLElement | null = null;
function showTip(el: HTMLElement) {
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tip';
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
  }
  tip.replaceChildren();
  if (el.dataset.tipHead) {
    const b = document.createElement('b');
    b.textContent = el.dataset.tipHead;
    tip.append(b);
  }
  tip.append(el.dataset.tip!);
  const r = el.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const x = Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8;
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(above > 8 ? above : r.bottom + 8)}px)`;
  tip.classList.add('on');
}
document.addEventListener('pointerover', (e) => {
  const el = (e.target as Element).closest?.<HTMLElement>('[data-tip]');
  if (el) showTip(el);
  else tip?.classList.remove('on');
});
document.addEventListener('focusin', (e) => {
  const el = (e.target as Element).closest?.<HTMLElement>('[data-tip]');
  if (el) showTip(el);
});
document.addEventListener('focusout', () => tip?.classList.remove('on'));

/* ---------- The light on cards ---------- */

if (matchMedia('(hover: hover)').matches) {
  let frame = 0;
  let last: PointerEvent | null = null;
  document.addEventListener('pointermove', (e) => {
    last = e;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const spot = (last!.target as Element).closest?.<HTMLElement>('[data-spot]');
      if (!spot) return;
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--mx', `${last!.clientX - r.left}px`);
      spot.style.setProperty('--my', `${last!.clientY - r.top}px`);
    });
  });
}

/* ---------- Arrivals ---------- */

// Elements marked [data-reveal] get .in once they enter the view; CSS does the rest.
const reveal = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        reveal.unobserve(entry.target);
      }
    }
  },
  { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
);
document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));

// Numbers count up once. The real value is in the HTML, so without JS it is simply there.
if (!reduced) {
  const counter = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        counter.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        const to = Number(el.dataset.count);
        const t0 = performance.now();
        const tick = (now: number) => {
          const u = Math.min(1, (now - t0) / 1300);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - u, 4))));
          if (u < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll('[data-count]').forEach((el) => counter.observe(el));
}

/* ---------- Deep links ---------- */

// A shared link to a paper opens straight into its popup. Other deep links land
// correctly even if web fonts shift the layout after the first jump.
addEventListener('load', () => {
  const settle = () => {
    const hash = location.hash;
    if (hash.startsWith('#paper=')) openPaper(hash.slice(7), false, false);
    else if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    setTimeout(() => root.classList.add('smooth'), 200);
  };
  (document.fonts?.ready ?? Promise.resolve()).then(settle);
});
