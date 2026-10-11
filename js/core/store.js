// Store minimaliste : l'état est remplacé (jamais muté en place) à chaque commande.
export class Store {
  constructor(initial) {
    this.state = initial;
    this.version = 0;
    this._subs = new Set();
  }
  get() { return this.state; }
  set(next, meta = {}) {
    const prev = this.state;
    this.state = next;
    this.version++;
    for (const fn of this._subs) {
      try { fn(next, prev, meta); } catch (e) { console.error('[store] abonné en erreur', e); }
    }
  }
  patch(partial, meta) { this.set({ ...this.state, ...partial }, meta); }
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
}

export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) {
    if (!this._h.has(ev)) this._h.set(ev, new Set());
    this._h.get(ev).add(fn);
    return () => this.off(ev, fn);
  }
  off(ev, fn) { this._h.get(ev)?.delete(fn); }
  emit(ev, data) {
    for (const fn of this._h.get(ev) || []) {
      try { fn(data); } catch (e) { console.error(`[emitter] ${ev}`, e); }
    }
    for (const fn of this._h.get('*') || []) {
      try { fn({ event: ev, data }); } catch (e) { console.error('[emitter] *', e); }
    }
  }
}
