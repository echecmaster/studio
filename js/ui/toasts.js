import { h } from './dom.js';
import { icon } from './icons.js';

let root = null;
export function toast(msg, type = 'info', ms = 3800) {
  root ||= document.getElementById('toasts');
  if (!root) return;
  const el = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' });
  el.innerHTML = icon(type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'check');
  el.firstChild.style.cssText = `width:16px;height:16px;flex:none;color:${type === 'error' ? 'var(--danger)' : type === 'warn' ? 'var(--warning)' : 'var(--accent)'}`;
  el.append(h('div', { class: 'msg' }, msg), h('button', { class: 'btn ghost sm icon', 'aria-label': 'Fermer', onclick: () => el.remove(), html: icon('x') }));
  root.append(el);
  while (root.children.length > 5) root.firstChild.remove();
  setTimeout(() => el.remove(), type === 'error' ? ms * 2 : ms);
}
