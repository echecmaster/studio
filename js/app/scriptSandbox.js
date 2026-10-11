// Exécution d'un script utilisateur dans un Worker isolé : seul run(name, args) est disponible.
// Le script ne fait que COLLECTER des appels de commandes ; ils sont ensuite exécutés par le CommandBus (validation incluse).
const WORKER_SRC = `
self.onmessage = (e) => {
  const calls = [];
  const run = (name, args) => { if (typeof name !== 'string') throw new Error('run(name, args) : nom invalide'); calls.push({ name, args: args === undefined ? {} : JSON.parse(JSON.stringify(args)) }); if (calls.length > 500) throw new Error('Trop de commandes (max 500)'); };
  for (const k of ['fetch','XMLHttpRequest','WebSocket','importScripts','indexedDB','caches','EventSource','BroadcastChannel']) { try { self[k] = undefined; } catch {} }
  try {
    const fn = new Function('run', 'console', '"use strict";\\n' + e.data.code);
    fn(run, { log: () => {} });
    self.postMessage({ ok: true, calls });
  } catch (err) { self.postMessage({ ok: false, error: String(err && err.message || err) }); }
};`;

export function collectScript(code, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url);
    const to = setTimeout(() => { w.terminate(); URL.revokeObjectURL(url); reject(new Error('Script interrompu (délai dépassé : boucle infinie ?)')); }, timeoutMs);
    w.onmessage = (e) => {
      clearTimeout(to); w.terminate(); URL.revokeObjectURL(url);
      if (e.data.ok) resolve(e.data.calls); else reject(new Error(`Erreur de script : ${e.data.error}`));
    };
    w.onerror = (e) => { clearTimeout(to); w.terminate(); URL.revokeObjectURL(url); reject(new Error(`Erreur de script : ${e.message}`)); };
    w.postMessage({ code });
  });
}
