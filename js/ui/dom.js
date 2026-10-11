// Mini-bibliothèque DOM : h(), modales, menus contextuels, glisser
import { icon } from './icons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function iconBtn(name, label, onClick, extra = {}) {
  const b = h('button', { class: `btn icon ${extra.class || ''}`, 'aria-label': label, title: extra.title || label, onclick: onClick, ...extra.attrs });
  b.innerHTML = icon(name);
  if (extra.cmd) b.dataset.cmd = extra.cmd;
  return b;
}

export function btn(label, onClick, { cls = '', iconName, cmd, title } = {}) {
  const b = h('button', { class: `btn ${cls}`, onclick: onClick, title: title || label });
  if (iconName) b.insertAdjacentHTML('afterbegin', icon(iconName));
  b.append(label);
  if (cmd) b.dataset.cmd = cmd;
  return b;
}

let modalStack = [];
export function openModal({ title, body, footer, wide, onClose, className = '', iconName }) {
  const prevFocus = document.activeElement;
  const close = () => {
    backdrop.remove();
    modalStack = modalStack.filter((m) => m !== api);
    onClose?.();
    prevFocus?.focus?.();
  };
  const head = h('header', {}, iconName ? h('span', { html: icon(iconName) }) : null, h('span', { class: 'grow' }, title), iconBtn('x', 'Fermer', close, { class: 'ghost' }));
  const modal = h('div', { class: `modal ${wide ? 'wide' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, title ? head : null, h('div', { class: 'body' }, body), footer ? h('footer', {}, footer) : null);
  const backdrop = h('div', { class: 'modal-backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } }, modal);
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.body.append(backdrop);
  const api = { close, el: modal, backdrop };
  modalStack.push(api);
  setTimeout(() => (modal.querySelector('[autofocus], input, textarea, select, button.primary') || modal.querySelector('button'))?.focus(), 30);
  return api;
}
export const anyModalOpen = () => modalStack.length > 0;
export const closeTopModal = () => modalStack[modalStack.length - 1]?.close();

let ctxMenu = null;
export function contextMenu(x, y, items) {
  ctxMenu?.remove();
  const menu = h('div', { class: 'ctx-menu', role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { menu.append(h('hr')); continue; }
    if (it.header) { menu.append(h('div', { class: 'sub' }, it.header)); continue; }
    const b = h('button', { role: 'menuitem', onclick: () => { menu.remove(); it.action(); } });
    if (it.icon) b.innerHTML = icon(it.icon);
    b.append(it.label);
    if (it.kbd) b.append(h('span', { class: 'spacer' }), h('kbd', {}, it.kbd));
    if (it.cmd) b.dataset.cmd = it.cmd;
    menu.append(b);
  }
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - r.width - 6)}px`;
  menu.style.top = `${Math.min(y, innerHeight - r.height - 6)}px`;
  ctxMenu = menu;
  menu.querySelector('button')?.focus();
  const off = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  menu.addEventListener('keydown', (e) => {
    const bs = [...menu.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') menu.remove();
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
  return menu;
}

// Glisser générique (pointer events) : onMove(dx, dy, e), onEnd(e)
export function drag(e, onMove, onEnd) {
  const sx = e.clientX, sy = e.clientY;
  const move = (ev) => onMove(ev.clientX - sx, ev.clientY - sy, ev);
  const up = (ev) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onEnd?.(ev, ev.clientX - sx, ev.clientY - sy); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function downloadBlob(blob, filename) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export function readFileAsText(file) { return file.text(); }

export function section(title, body, { collapsed = false, actions = null, id } = {}) {
  const s = h('div', { class: `section ${collapsed ? 'collapsed' : ''}`, id });
  const head = h('header', { tabindex: 0, role: 'button', 'aria-expanded': String(!collapsed) });
  head.innerHTML = icon('chevron', 'chev');
  head.append(h('span', { style: { flex: 1 } }, title));
  if (actions) { const a = h('span', { onclick: (e) => e.stopPropagation(), style: { display: 'flex', gap: '4px' } }, actions); head.append(a); }
  const toggle = () => { s.classList.toggle('collapsed'); head.setAttribute('aria-expanded', String(!s.classList.contains('collapsed'))); };
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  s.append(head, h('div', { class: 'body' }, body));
  return s;
}
