// Test d'acceptation : parité UI ⇄ MCP. Échoue si une action de l'UI n'a pas de commande équivalente,
// si l'UI référence une commande inconnue, ou si l'UI modifie le projet sans passer par le CommandBus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildParity, UI_FILES } from '../scripts/build-parity.mjs';
import { registry } from '../js/core/commands/index.js';
import { UI_ACTIONS } from '../js/ui/actions.js';

test('toutes les actions UI (raccourcis/palette) correspondent à une commande MCP', () => {
  for (const a of UI_ACTIONS) assert.ok(registry.get(a.command), `${a.id} → ${a.command}`);
});

test('toutes les références de commandes dans l\'UI existent dans le registre', () => {
  const P = buildParity();
  assert.deepEqual(P.unknown, []);
});

test('l\'UI ne modifie jamais le projet directement', () => {
  const P = buildParity();
  assert.deepEqual(P.violations, []);
});

test('chaque bouton cliquable de l\'UI déclenche une commande ou une navigation', () => {
  // heuristique : les boutons créés avec btn()/iconBtn() ont un gestionnaire ; on vérifie qu'aucun gestionnaire vide n'existe
  for (const f of UI_FILES) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/onclick:\s*\(\)\s*=>\s*\{\s*\}/.test(src), `gestionnaire vide dans ${f}`);
    assert.ok(!/TODO|FIXME/.test(src), `TODO/FIXME restant dans ${f}`);
  }
});

test('PARITY.md est à jour', () => {
  const md = readFileSync(new URL('../PARITY.md', import.meta.url), 'utf8');
  for (const c of registry.list()) assert.ok(md.includes(`\`${c.name}\``), `PARITY.md ne mentionne pas ${c.name} (lancer npm run build:parity)`);
});
