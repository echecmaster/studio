// Historique undo/redo illimité basé sur des patchs JSON (patch + inverse par commande).
import { applyPatch, deepClone } from './util.js';

export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.group = null; // transaction ouverte par history.batch_begin
    this.groupDepth = 0;
  }

  push(entry, { coalesce } = {}) {
    if (!entry.patches.length) return;
    this.redoStack.length = 0;
    if (this.group) {
      this.group.patches.push(...entry.patches);
      this.group.inverse = [...entry.inverse, ...this.group.inverse];
      this.group.commands.push(entry.name);
      return;
    }
    const last = this.undoStack[this.undoStack.length - 1];
    if (coalesce && last && last.coalesce === coalesce && Date.now() - last.time < 1500) {
      last.patches.push(...entry.patches);
      last.inverse = [...entry.inverse, ...last.inverse];
      last.time = Date.now();
      return;
    }
    this.undoStack.push({ ...entry, coalesce, time: Date.now(), commands: [entry.name] });
  }

  begin(label = 'Groupe') {
    this.groupDepth++;
    if (!this.group) this.group = { label, name: 'history.batch', patches: [], inverse: [], commands: [], time: Date.now() };
  }
  end() {
    if (this.groupDepth === 0) return false;
    this.groupDepth--;
    if (this.groupDepth === 0 && this.group) {
      const g = this.group;
      this.group = null;
      if (g.patches.length) { this.redoStack.length = 0; this.undoStack.push(g); }
    }
    return true;
  }

  undo(state) {
    const e = this.undoStack.pop();
    if (!e) return null;
    this.redoStack.push(e);
    return { state: applyPatch(deepClone(state), e.inverse), entry: e };
  }
  redo(state) {
    const e = this.redoStack.pop();
    if (!e) return null;
    this.undoStack.push(e);
    return { state: applyPatch(deepClone(state), e.patches), entry: e };
  }
  list() {
    return {
      undo: this.undoStack.map((e, i) => ({ index: i, label: e.label, commands: e.commands, time: e.time })),
      redo: this.redoStack.map((e, i) => ({ index: i, label: e.label, commands: e.commands, time: e.time })).reverse(),
    };
  }
  clear() { this.undoStack = []; this.redoStack = []; this.group = null; this.groupDepth = 0; }
}
