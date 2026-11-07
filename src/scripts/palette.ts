// Cmd/Ctrl-K or "/" from anywhere. Typing narrows the list; every word has to match.
import { openPaper, copyText } from './page';

interface Item { g: string; t: string; s?: string; k?: string; h?: string; p?: string; copy?: string }

const dialog = document.getElementById('palette') as HTMLDialogElement;
const input = dialog.querySelector<HTMLInputElement>('[data-pl-input]')!;
const list = dialog.querySelector<HTMLElement>('[data-pl-list]')!;
const items = JSON.parse(document.getElementById('palette-data')!.textContent!) as Item[];
const hay = items.map((i) => `${i.t} ${i.s ?? ''} ${i.k ?? ''}`.toLowerCase());
let shown: Item[] = [];
let active = 0;

function paint() {
  const words = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  shown = items.filter((_, i) => words.every((w) => hay[i].includes(w)));
  active = Math.min(active, Math.max(0, shown.length - 1));
  list.replaceChildren();
  if (!shown.length) {
    const none = document.createElement('li');
    none.className = 'pl-none';
    none.textContent = dialog.dataset.none!;
    list.append(none);
    return;
  }
  let group = '';
  shown.forEach((item, i) => {
    if (item.g !== group) {
      group = item.g;
      const head = document.createElement('li');
      head.className = 'pl-group';
      head.textContent = group;
      list.append(head);
    }
    const li = document.createElement('li');
    li.className = 'pl-item';
    li.setAttribute('role', 'option');
    li.dataset.i = String(i);
    const title = document.createElement('span');
    title.textContent = item.t;
    li.append(title);
    if (item.s) {
      const sub = document.createElement('span');
      sub.textContent = item.s;
      li.append(sub);
    }
    list.append(li);
  });
  mark();
}

function mark() {
  list.querySelectorAll<HTMLElement>('.pl-item').forEach((el) => {
    const on = Number(el.dataset.i) === active;
    el.classList.toggle('on', on);
    el.setAttribute('aria-selected', String(on));
    if (on) el.scrollIntoView({ block: 'nearest' });
  });
}

function run(item: Item | undefined) {
  if (!item) return;
  if (item.copy) {
    copyText(item.copy, dialog).then(() => {
      const el = list.querySelector<HTMLElement>('.pl-item.on span:first-child');
      if (el) el.textContent = dialog.dataset.copied!;
      setTimeout(() => dialog.close(), 700);
    });
    return;
  }
  dialog.close();
  if (item.p && openPaper(item.p)) return;
  if (item.h) location.href = item.h;
}

function open() {
  if (dialog.open) return;
  input.value = '';
  active = 0;
  paint();
  dialog.showModal();
  input.focus();
}

input.addEventListener('input', () => {
  active = 0;
  paint();
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = shown.length;
    if (n) active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    mark();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    run(shown[active]);
  }
});
list.addEventListener('pointermove', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.pl-item');
  if (el && Number(el.dataset.i) !== active) {
    active = Number(el.dataset.i);
    list.querySelectorAll<HTMLElement>('.pl-item').forEach((x) => x.classList.toggle('on', x === el));
  }
});
list.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.pl-item');
  if (el) run(shown[Number(el.dataset.i)]);
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
document.addEventListener('keydown', (e) => {
  const field = (e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]');
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !field && !e.metaKey && !e.ctrlKey)) {
    e.preventDefault();
    if (dialog.open) dialog.close();
    else open();
  }
});
