// Tests du cœur (sans navigateur) : commandes, undo/redo, transactions, schéma, catalogues, templates
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../js/core/commands/index.js';
import { CommandBus } from '../js/core/commandBus.js';
import { createProject, validateProject } from '../js/core/schema.js';
import { EFFECTS } from '../js/catalog/effects.js';
import { TRANSITIONS } from '../js/catalog/transitions.js';
import { ANIMATION_PRESETS } from '../js/catalog/animPresets.js';
import { BLEND_MODES } from '../js/catalog/blendModes.js';
import { TEMPLATES } from '../js/templates/templates.generated.js';
import { evalKeys, resolveClip } from '../js/core/evaluate.js';
import { runExpression, checkExpression } from '../js/core/expressions.js';
import { computeParticles } from '../js/render/particles.js';
import { particlePreset } from '../js/catalog/elements.js';

const newBus = () => new CommandBus({ registry: createRegistry(), project: createProject(), env: 'node' });

test('volumes du catalogue (critères d\'acceptation)', () => {
  assert.ok(EFFECTS.length >= 150, `effets : ${EFFECTS.length}`);
  assert.ok(TRANSITIONS.length >= 60, `transitions : ${TRANSITIONS.length}`);
  assert.ok(ANIMATION_PRESETS.length >= 80, `presets : ${ANIMATION_PRESETS.length}`);
  assert.ok(BLEND_MODES.length >= 24, `fusions : ${BLEND_MODES.length}`);
  assert.equal(TEMPLATES.length, 15);
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length, 'ids d\'effets uniques');
  assert.equal(new Set(TRANSITIONS.map((e) => e.id)).size, TRANSITIONS.length, 'ids de transitions uniques');
  assert.equal(new Set(ANIMATION_PRESETS.map((e) => e.id)).size, ANIMATION_PRESETS.length, 'ids de presets uniques');
});

test('chaque commande a un nom, un schéma d\'arguments et une description FR/EN', () => {
  const reg = createRegistry();
  const list = reg.list();
  assert.ok(list.length >= 180);
  for (const c of list) {
    assert.match(c.name, /^[a-z]+\.[a-z0-9_]+$/);
    assert.equal(c.inputSchema.type, 'object', c.name);
    assert.ok(c.description.fr && c.description.en, c.name);
    assert.ok(/^[a-zA-Z0-9_-]{1,64}$/.test(c.tool), `nom d'outil MCP valide : ${c.tool}`);
  }
});

test('templates valides et rejouables', () => {
  for (const t of TEMPLATES) assert.ok(validateProject(t.project).ok, t.id);
});

test('clip.add / undo / redo / batch atomique', async () => {
  const bus = newBus();
  const r = await bus.run('clip.add', { kind: 'text', props: { text: 'A' }, start: 0, duration: 2 });
  assert.ok(r.ok);
  assert.equal(bus.project.get().clips.length, 1);
  await bus.run('history.undo');
  assert.equal(bus.project.get().clips.length, 0);
  await bus.run('history.redo');
  assert.equal(bus.project.get().clips.length, 1);
  const bad = await bus.batch([{ name: 'clip.add', args: { kind: 'shape' } }, { name: 'effect.add', args: { clipId: 'nope', type: 'glow' } }]);
  assert.equal(bad.ok, false);
  assert.equal(bus.project.get().clips.length, 1, 'aucun effet de bord après un lot en échec');
  const good = await bus.batch([{ name: 'clip.add', args: { kind: 'shape' } }, { name: 'clip.add', args: { kind: 'shape' } }]);
  assert.ok(good.ok);
  assert.equal(bus.project.get().clips.length, 3);
  await bus.run('history.undo');
  assert.equal(bus.project.get().clips.length, 1, 'un lot = un seul undo');
});

test('history.batch_begin / batch_end regroupent plusieurs commandes', async () => {
  const bus = newBus();
  await bus.run('history.batch_begin', { label: 'Groupe' });
  await bus.run('clip.add', { kind: 'shape' });
  await bus.run('clip.add', { kind: 'shape' });
  await bus.run('history.batch_end');
  assert.equal(bus.project.get().clips.length, 2);
  await bus.run('history.undo');
  assert.equal(bus.project.get().clips.length, 0);
});

test('validation des arguments par JSON Schema', async () => {
  const bus = newBus();
  const r = await bus.run('clip.add', { kind: 'licorne' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Arguments invalides/);
  const r2 = await bus.run('render.frame', {});
  assert.equal(r2.ok, false);
  assert.match(r2.error, /session navigateur/);
});

test('split, trim, keyframes, easing, presets, transitions', async () => {
  const bus = newBus();
  const { result: { id } } = await bus.run('clip.add', { kind: 'shape', start: 0, duration: 4 });
  await bus.run('keyframe.add', { clipId: id, path: 'transform.x', t: 0, value: -100 });
  await bus.run('keyframe.add', { clipId: id, path: 'transform.x', t: 4, value: 100, easing: 'linear' });
  await bus.run('keyframe.set_easing', { clipId: id, path: 'transform.x', easing: 'linear' });
  const c = bus.project.get().clips[0];
  assert.equal(evalKeys(c.keyframes['transform.x'], 2), 0);
  const s = await bus.run('clip.split', { ids: [id], t: 2 });
  assert.ok(s.ok);
  const [a, b] = bus.project.get().clips;
  assert.equal(a.duration, 2);
  assert.equal(b.start, 2);
  assert.equal(evalKeys(b.keyframes['transform.x'], 0), 0, 'continuité de valeur au point de coupe');
  const tr = await bus.run('clip.trim', { id: b.id, edge: 'out', time: 3 });
  assert.equal(tr.result.duration, 1);
  for (const p of ANIMATION_PRESETS) { const r = await bus.run('animation.apply_preset', { clipId: a.id, preset: p.id }); assert.ok(r.ok, `${p.id} : ${r.error}`); }
  for (const t of TRANSITIONS) { const r = await bus.run('transition.add', { clipId: a.id, type: t.id, edge: 'in' }); assert.ok(r.ok, t.id); }
  for (const e of EFFECTS) { const r = await bus.run('effect.add', { clipId: b.id, type: e.id }); assert.ok(r.ok, e.id); }
  assert.ok(validateProject(bus.project.get()).ok);
});

test('expressions sandboxées', () => {
  assert.equal(runExpression('value * 2', { value: 3, time: 0 }), 6);
  assert.ok(Math.abs(runExpression('wiggle(2, 10)', { value: 0, time: 1.3, seed: 1 })) <= 20);
  for (const evil of ['this.constructor', 'constructor', '(()=>1)()', 'window.alert(1)', 'x["constructor"]', 'fetch("/")', 'while(1){}']) {
    assert.ok(checkExpression(evil) || (() => { try { runExpression(evil, { value: 0, time: 0 }); return 'ran'; } catch { return 'err'; } })() !== 'ran', `bloqué : ${evil}`);
  }
  assert.equal(runExpression('localStorage', { value: 5, time: 0 }), 5, 'globales inaccessibles (résolues à undefined)');
  assert.throws(() => runExpression('fetch', { value: 5, time: 0 }));
});

test('particules analytiques déterministes', () => {
  const p = particlePreset('confetti');
  const a = JSON.stringify(computeParticles(p, 1.234));
  const b = JSON.stringify(computeParticles(p, 1.234));
  assert.equal(a, b);
  assert.ok(computeParticles(p, 1).length > 10);
});

test('resolveClip applique keyframes + expressions + chemin', async () => {
  const bus = newBus();
  const { result: { id } } = await bus.run('clip.add', { kind: 'text', start: 1, duration: 3 });
  await bus.run('expression.set', { clipId: id, path: 'transform.rotation', code: 'time * 10' });
  await bus.run('path.follow', { clipId: id, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], start: 0, end: 2, easing: 'linear' });
  const r = resolveClip(bus.project.get().clips[0], 2, {});
  assert.equal(r.transform.rotation, 10);
  assert.ok(Math.abs(r.transform.x - 50) < 1e-6);
});

test('lint détecte assets manquants et texte hors cadre', async () => {
  const bus = newBus();
  await bus.run('clip.add', { kind: 'text', props: { text: 'Hors cadre' }, transform: { x: 5000 } });
  bus.project.get().clips.push({ ...bus.project.get().clips[0], id: 'clp_x', kind: 'image', props: { assetId: 'ast_missing' } });
  const r = await bus.run('project.lint');
  const codes = r.result.issues.map((i) => i.code);
  assert.ok(codes.includes('offscreen'));
  assert.ok(codes.includes('missing-asset'));
});

test('template.apply et project.set_format', async () => {
  const bus = newBus();
  for (const t of TEMPLATES) { const r = await bus.run('template.apply', { id: t.id }); assert.ok(r.ok, t.id); }
  const r = await bus.run('project.set_format', { preset: 'vertical', duration: 5 });
  assert.equal(r.result.meta.width, 1080);
  assert.equal(bus.project.get().workArea.out, 5);
});

test('app.run_script (JSON) est atomique', async () => {
  const bus = newBus();
  const r = await bus.run('app.run_script', { script: [{ name: 'clip.add', args: { kind: 'shape' } }, { name: 'marker.add', args: { t: 1 } }] });
  assert.ok(r.ok);
  assert.equal(bus.history.undoStack.length, 1);
});
