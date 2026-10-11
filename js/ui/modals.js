// Fenêtres : export (+ progression), nouveau projet, éditeur de shader, raccourcis, courbe de Bézier, lint, partage, aide, script
import { h, btn, openModal } from './dom.js';
import { icon } from './icons.js';
import { bytesToHuman, formatTimecode } from '../core/util.js';
import { FORMAT_PRESETS } from '../core/commands/project.js';
import { TEMPLATES } from '../templates/templates.generated.js';
import { UI_ACTIONS, keysFor, normalizeCombo } from './actions.js';
import { cubicBezier, BEZIER_PRESETS } from '../catalog/easings.js';
import { SHADER_PRESETS } from '../catalog/shaders.js';
import { toast } from './toasts.js';

const F = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);

export async function exportDialog(app) {
  const bus = app.bus;
  const p = bus.project.get();
  const caps = await app.exporter.capabilities();
  const fmt = h('select', { class: 'input' }, ...[['mp4', 'MP4 (H.264 + AAC)'], ['webm', 'WebM (VP9 + Opus)'], ['gif', 'GIF animé'], ['png-sequence', 'Séquence PNG (.zip)'], ['png', 'Image PNG (frame courante)'], ['jpg', 'Image JPG (frame courante)']].map(([v, l]) => h('option', { value: v }, l)));
  const res = h('select', { class: 'input' }, h('option', { value: '' }, `Projet (${p.meta.width}×${p.meta.height})`), ...[[3840, 2160, '4K'], [2560, 1440, '1440p'], [1920, 1080, '1080p'], [1280, 720, '720p'], [1080, 1920, '9:16 1080'], [1080, 1080, '1:1 1080'], [640, 360, '360p']].map(([w, hh, l]) => h('option', { value: `${w}x${hh}`, disabled: (w > 1920 || hh > 1920) && !caps.max4k }, `${l} — ${w}×${hh}`)));
  const fps = h('select', { class: 'input' }, h('option', { value: '' }, `Projet (${p.meta.fps})`), ...[24, 25, 30, 50, 60].map((f) => h('option', { value: f }, String(f))));
  const quality = h('select', { class: 'input' }, ...[['high', 'Haute'], ['medium', 'Moyenne'], ['low', 'Basse'], ['custom', 'Personnalisée (Mbps)']].map(([v, l]) => h('option', { value: v }, l)));
  const bitrate = h('input', { class: 'input', type: 'number', min: 0.5, max: 200, step: 0.5, value: 12, disabled: true });
  const range = h('select', { class: 'input' }, h('option', { value: 'all' }, 'Tout'), h('option', { value: 'workarea' }, `Zone de travail (${p.workArea.in.toFixed(2)}–${p.workArea.out.toFixed(2)}s)`), h('option', { value: 'selection', disabled: !bus.app.get().selection.length }, 'Sélection'));
  const hw = h('select', { class: 'input' }, h('option', { value: 'prefer-hardware' }, 'Accélération matérielle (préférée)'), h('option', { value: 'prefer-software' }, 'Logicielle'), h('option', { value: 'no-preference' }, 'Automatique'));
  const audio = h('input', { type: 'checkbox', checked: true });
  const mb = h('input', { type: 'checkbox', checked: !!p.meta.motionBlur?.enabled });
  const stream = h('input', { type: 'checkbox', disabled: !caps.fileSystemAccess });
  const name = h('input', { class: 'input', value: p.meta.name });
  const est = h('div', { class: 'hint' });
  const opts = () => {
    const [w, hh] = res.value ? res.value.split('x').map(Number) : [];
    return { format: fmt.value, width: w, height: hh, fps: fps.value ? +fps.value : undefined, quality: quality.value, bitrate: +bitrate.value, range: range.value, hardware: hw.value, includeAudio: audio.checked, motionBlur: mb.checked, stream: stream.checked, filename: name.value, t: bus.app.get().time };
  };
  const update = () => {
    bitrate.disabled = quality.value !== 'custom';
    try {
      const e = app.exporter.estimate(p, opts());
      est.textContent = `${e.w}×${e.h} @ ${e.fps} i/s · ${e.frames} images · ${e.seconds.toFixed(2)} s · taille estimée ≈ ${bytesToHuman(e.bytes)} · durée estimée ≈ ${e.etaSeconds} s`;
    } catch (er) { est.textContent = er.message; }
  };
  for (const el of [fmt, res, fps, quality, bitrate, range, mb]) el.addEventListener('input', update);
  const capsInfo = h('div', { class: 'hint', html: `${icon('info')} <b>Encodage :</b> ${caps.mp4Path}${caps.codecs.h264 ? '' : ' — H.264 indisponible ici : repli automatique (VP9 dans MP4 ou MediaRecorder/ffmpeg.wasm).'}` });
  capsInfo.firstChild.style.cssText = 'width:14px;height:14px;vertical-align:-2px;color:var(--accent)';
  const m = openModal({
    title: 'Exporter', iconName: 'export', wide: false,
    body: [capsInfo, h('div', { class: 'grid2' }, F('Format', fmt), F('Résolution', res), F('Images/s', fps), F('Qualité', quality), F('Débit vidéo (Mbps)', bitrate), F('Plage', range), F('Encodeur', hw), F('Nom du fichier', name)),
      h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px 16px' } }, h('label', { class: 'row' }, audio, ' Inclure l\'audio'), h('label', { class: 'row' }, mb, ' Flou de mouvement réel'), h('label', { class: 'row', title: caps.fileSystemAccess ? '' : 'Non pris en charge par ce navigateur' }, stream, ' Écrire directement sur le disque')),
      est, h('div', { class: 'hint' }, 'Le rendu est image par image et déterministe : il est identique à la preview et ne dépend pas de la vitesse de votre machine. Gardez l\'onglet ouvert pendant l\'export.')],
    footer: [btn('Annuler', () => m.close()), btn('Exporter', async () => { const r = await bus.run('export.start', opts()); if (r.ok) m.close(); else toast(r.error, 'error'); }, { cls: 'primary', iconName: 'export', cmd: 'export.start' })],
  });
  update();
}

export function exportProgress(app) {
  if (app._expModal) return;
  const bar = h('div');
  const prog = h('div', { class: 'progress' }, bar);
  const info = h('div', { class: 'mono hint' });
  const prev = h('canvas', { width: 320, height: 180, style: { width: '100%', maxWidth: '480px', borderRadius: '6px', background: '#000', alignSelf: 'center' } });
  const result = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  const cancel = btn('Annuler l\'export', () => app.bus.run('export.cancel'), { cls: 'danger', cmd: 'export.cancel' });
  const m = openModal({ title: 'Export en cours', iconName: 'export', body: [prev, prog, info, result], footer: [cancel, btn('Fermer', () => m.close())], onClose: () => { app._expModal = null; off(); } });
  app._expModal = m;
  const draw = (st) => {
    bar.style.width = `${Math.round((st.progress || 0) * 100)}%`;
    info.textContent = st.status === 'running' ? `Image ${st.frame}/${st.total} · ${Math.round((st.progress || 0) * 100)} % · reste ≈ ${st.eta ?? '…'} s${st.phase === 'ffmpeg' ? ' · conversion ffmpeg.wasm…' : ''}` : st.status === 'done' ? 'Terminé ✓' : st.status === 'cancelled' ? 'Annulé.' : st.status === 'error' ? `Erreur : ${st.error}` : '';
    if (st.status !== 'running') {
      cancel.disabled = true;
      m.el.querySelector('header span.grow').textContent = st.status === 'done' ? 'Export terminé' : 'Export interrompu';
      if (st.status === 'done' && st.result) {
        const r = st.result;
        result.innerHTML = '';
        const isVideo = /video/.test(r.mime || '');
        if (isVideo) result.append(h('video', { src: r.blobUrl, controls: true, style: { width: '100%', borderRadius: '6px' } }));
        else if (/image/.test(r.mime || '')) result.append(h('img', { src: r.blobUrl, alt: 'Résultat', style: { maxWidth: '100%', borderRadius: '6px' } }));
        const v = r.validation;
        result.append(h('div', { class: 'hint' }, `${r.filename} · ${bytesToHuman(r.size)} · ${r.durationSec}s · ${r.method}`),
          v ? h('div', { class: v.valid ? 'hint' : 'err' }, v.valid ? `MP4 vérifié ✓ : durée ${v.duration.toFixed(2)} s, piste vidéo ${v.video?.codec || '?'}${v.audio ? `, piste audio ${v.audio.codec}` : ', sans audio'}` : `MP4 suspect : ${v.errors.join(', ')}`) : null,
          h('div', { class: 'row' }, btn('Télécharger', () => app.bus.run('export.download'), { iconName: 'export', cls: 'primary', cmd: 'export.download' }), btn('Revoir', () => result.querySelector('video')?.play(), { iconName: 'play' }), btn('Copier le lien', () => { navigator.clipboard.writeText(r.blobUrl); toast('Lien blob copié (valable dans cet onglet).'); }, { iconName: 'link', cmd: 'export.download_link' })));
      }
    }
  };
  const off = app.onExport((st) => {
    draw(st);
    if (st.status === 'running') {
      // aperçu live de l'image en cours de rendu
      const c = prev.getContext('2d');
      const src = app.exporter.currentCanvas;
      c.fillStyle = '#050505'; c.fillRect(0, 0, 320, 180);
      if (src) { try { const k = Math.min(320 / src.width, 180 / src.height); c.drawImage(src, (320 - src.width * k) / 2, (180 - src.height * k) / 2, src.width * k, src.height * k); } catch { /* */ } }
      c.fillStyle = '#24D26D'; c.font = '600 13px "JetBrains Mono"'; c.fillText(formatTimecode((st.frame || 0) / (st.fps || 30), st.fps || 30), 10, 20);
    }
  });
  draw(app.exporter.status());
}

export function newProjectDialog(app) {
  const name = h('input', { class: 'input', value: 'Nouveau projet' });
  const preset = h('select', { class: 'input' }, ...Object.entries(FORMAT_PRESETS).map(([k, [w, hh]]) => h('option', { value: k }, `${k} — ${w}×${hh}`)));
  const fps = h('select', { class: 'input' }, ...[24, 25, 30, 50, 60].map((f) => h('option', { value: f, selected: f === 30 }, String(f))));
  const dur = h('input', { class: 'input', type: 'number', value: 10, min: 0.5, step: 0.5 });
  const bg = h('input', { class: 'input', type: 'color', value: '#000000' });
  const tpl = h('select', { class: 'input' }, h('option', { value: '' }, '— projet vide —'), ...TEMPLATES.map((t) => h('option', { value: t.id }, t.name)));
  const m = openModal({ title: 'Nouveau projet', iconName: 'plus', body: [h('div', { class: 'grid2' }, F('Nom', name), F('Format', preset), F('Images/s', fps), F('Durée (s)', dur), F('Fond', bg), F('Template', tpl))], footer: [btn('Annuler', () => m.close()), btn('Créer', async () => {
    if (app.bus.project.get().clips.length) await app.bus.run('project.save');
    const r = await app.bus.run('project.new', { name: name.value, preset: preset.value, fps: +fps.value, duration: +dur.value, background: bg.value, template: tpl.value || undefined });
    if (r.ok) { m.close(); if (tpl.value) app.bus.run('project.rename', { name: name.value }); }
    else toast(r.error, 'error');
  }, { cls: 'primary', cmd: 'project.new' })] });
}

export function shaderEditor(app, clipId, effectId) {
  const bus = app.bus;
  const c = bus.project.get().clips.find((x) => x.id === clipId);
  if (!c) return;
  const eff = effectId ? c.effects.find((e) => e.id === effectId) : null;
  const code = eff ? eff.params.code : c.props.code;
  const gutter = h('div', { class: 'gutter' });
  const ta = h('textarea', { spellcheck: 'false', 'aria-label': 'Code GLSL' });
  ta.value = code || '';
  const errs = h('div', { class: 'shader-errors' });
  const editor = h('div', { class: 'code-editor' }, gutter, ta);
  let bad = new Set();
  const lines = () => { const n = ta.value.split('\n').length; gutter.innerHTML = Array.from({ length: n }, (_, i) => (bad.has(i + 1) ? `<span class="bad">${i + 1}</span>` : String(i + 1))).join('\n'); ta.style.height = `${Math.max(320, n * 18 + 20)}px`; };
  let to;
  const validate = async () => {
    const r = await bus.run('shader.validate', { code: ta.value, target: effectId ? 'effect' : 'clip' });
    const list = r.ok ? r.result.errors : [{ line: 0, message: r.error }];
    bad = new Set(list.map((e) => e.line));
    errs.textContent = list.length ? list.map((e) => `Ligne ${e.line} : ${e.message}`).join('\n') : '✓ Compilation réussie';
    errs.style.color = list.length ? 'var(--danger)' : 'var(--accent)';
    lines();
  };
  ta.addEventListener('input', () => { lines(); clearTimeout(to); to = setTimeout(validate, 400); });
  ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = `${ta.value.slice(0, s)}  ${ta.value.slice(ta.selectionEnd)}`; ta.selectionStart = ta.selectionEnd = s + 2; } });
  const presetSel = h('select', { class: 'input', onchange: (e) => { const s = SHADER_PRESETS.find((x) => x.id === e.target.value); if (s) { ta.value = s.code; lines(); validate(); } } }, h('option', { value: '' }, `Charger un shader prêt à l'emploi (${SHADER_PRESETS.length})…`), ...SHADER_PRESETS.map((s) => h('option', { value: s.id }, s.name)));
  const help = h('div', { class: 'hint' }, 'Style ShaderToy : void mainImage(out vec4 fragColor, in vec2 fragCoord). Uniforms : iTime, iResolution, iMouse, iFrame, iChannel0..3 (iChannel0 = calque pour un effet). Paramètres : `uniform float vitesse; // @param 0 5 1 "Vitesse"` ou `uniform vec3 teinte; // @color #24d26d "Teinte"` → curseurs automatiques. Ajoutez // @alpha pour conserver l\'alpha.');
  const m = openModal({ title: `Éditeur de shader GLSL — ${c.name}`, iconName: 'shader', wide: true, body: [help, presetSel, editor, errs], footer: [btn('Fermer', () => m.close()), btn('Appliquer', async () => {
    const r = await bus.run('shader.set_code', { clipId, effectId, code: ta.value });
    if (r.ok && r.result.ok) { toast('Shader appliqué.'); m.close(); } else if (r.ok) { errs.textContent = r.result.errors.map((e) => `Ligne ${e.line} : ${e.message}`).join('\n'); toast('Shader appliqué mais en erreur (voir détails).', 'warn'); } else errs.textContent = r.error;
  }, { cls: 'primary', cmd: 'shader.set_code' })] });
  lines(); validate();
}

export function shortcutsDialog(app) {
  const bus = app.bus;
  const list = h('div', { class: 'list' });
  const draw = () => {
    list.innerHTML = '';
    const ov = bus.app.get().shortcuts || {};
    for (const a of UI_ACTIONS) {
      const k = h('button', { class: 'btn sm mono', title: 'Cliquer puis presser la nouvelle combinaison (Échap = annuler, Retour arrière = défaut)' }, keysFor(a, ov));
      k.addEventListener('click', () => {
        k.textContent = '…';
        const handler = (e) => {
          e.preventDefault(); e.stopPropagation();
          window.removeEventListener('keydown', handler, true);
          if (e.key === 'Escape') { draw(); return; }
          if (e.key === 'Backspace') { bus.run('app.set_shortcut', { command: a.id, keys: '' }).then(draw); return; }
          bus.run('app.set_shortcut', { command: a.id, keys: normalizeCombo(e) }).then(draw);
        };
        window.addEventListener('keydown', handler, true);
      });
      list.append(h('div', { class: 'list-item' }, h('span', { class: 'grow' }, a.label, h('div', { class: 'hint mono' }, a.command)), ov[a.id] ? h('span', { class: 'badge accent' }, 'perso') : null, k));
    }
  };
  draw();
  openModal({ title: 'Raccourcis clavier', iconName: 'command', body: [h('div', { class: 'hint' }, 'Toutes les actions sont aussi accessibles depuis la palette (Ctrl/Cmd+K) et par MCP.'), list], footer: [btn('Réinitialiser', () => bus.run('app.reset_shortcuts').then(draw), { cmd: 'app.reset_shortcuts' })] });
}

export function bezierEditor(app, clipId, path, index) {
  const bus = app.bus;
  const c = bus.project.get().clips.find((x) => x.id === clipId);
  const k = c?.keyframes[path]?.[index];
  if (!k) return;
  let bz = [...(k.bezier || [0.42, 0, 0.58, 1])];
  const cv = h('canvas', { class: 'curve-editor', width: 640, height: 400, 'aria-label': 'Courbe de Bézier' });
  const out = h('input', { class: 'input mono', value: `cubic-bezier(${bz.join(', ')})`, 'aria-label': 'Valeurs' });
  const pad = 40;
  const X = (u) => pad + u * (640 - 2 * pad), Y = (v) => 400 - pad - v * (400 - 2 * pad) * 0.7 - 60;
  const draw = () => {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 640, 400);
    ctx.strokeStyle = '#1F1F1F'; ctx.strokeRect(X(0), Y(1), X(1) - X(0), Y(0) - Y(1));
    const f = cubicBezier(...bz);
    ctx.strokeStyle = '#24D26D'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const u = i / 100; i ? ctx.lineTo(X(u), Y(f(u))) : ctx.moveTo(X(u), Y(f(u))); }
    ctx.stroke();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(bz[0]), Y(bz[1])); ctx.moveTo(X(1), Y(1)); ctx.lineTo(X(bz[2]), Y(bz[3])); ctx.stroke();
    ctx.fillStyle = '#FFD23D';
    for (const [u, v] of [[bz[0], bz[1]], [bz[2], bz[3]]]) { ctx.beginPath(); ctx.arc(X(u), Y(v), 7, 0, 7); ctx.fill(); }
    out.value = `cubic-bezier(${bz.map((x) => +x.toFixed(3)).join(', ')})`;
  };
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const sx = 640 / r.width, sy = 400 / r.height;
    const mx = (e.clientX - r.left) * sx, my = (e.clientY - r.top) * sy;
    const which = Math.hypot(X(bz[0]) - mx, Y(bz[1]) - my) < Math.hypot(X(bz[2]) - mx, Y(bz[3]) - my) ? 0 : 2;
    const mv = (ev) => { const x = (ev.clientX - r.left) * sx, y = (ev.clientY - r.top) * sy; bz[which] = Math.max(0, Math.min(1, (x - pad) / (640 - 2 * pad))); bz[which + 1] = (Y(0) - y) / ((400 - 2 * pad) * 0.7); draw(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    mv(e);
  });
  const presets = h('div', { class: 'row', style: { flexWrap: 'wrap' } }, ...Object.entries(BEZIER_PRESETS).map(([n, v]) => btn(n, () => { bz = [...v]; draw(); }, { cls: 'sm' })));
  const m = openModal({ title: `Courbe de Bézier — ${path} #${index}`, iconName: 'graph', body: [cv, presets, out], footer: [btn('Annuler', () => m.close()), btn('Appliquer', async () => { const r = await bus.run('keyframe.set_bezier', { clipId, path, index, bezier: bz.map((x) => +x.toFixed(4)) }); if (r.ok) m.close(); else toast(r.error, 'error'); }, { cls: 'primary', cmd: 'keyframe.set_bezier' })] });
  draw();
}

export async function lintDialog(app) {
  const r = await app.bus.run('project.lint');
  if (!r.ok) { toast(r.error, 'error'); return; }
  const list = h('div', { class: 'list' });
  for (const i of r.result.issues) list.append(h('div', { class: 'list-item', onclick: () => { if (i.clipId) app.bus.run('clip.select', { ids: [i.clipId] }); } }, h('span', { html: icon(i.level === 'error' ? 'alert' : i.level === 'warning' ? 'alert' : 'info'), style: { width: '16px', color: i.level === 'error' ? 'var(--danger)' : i.level === 'warning' ? 'var(--warning)' : 'var(--info)' } }), h('span', { class: 'grow' }, i.message), h('span', { class: 'badge' }, i.code)));
  if (!r.result.issues.length) list.append(h('div', { class: 'empty', html: `${icon('check')}<div>Aucun problème détecté.</div>` }));
  openModal({ title: `Analyse du projet — ${r.result.count} point(s)`, iconName: 'alert', body: list });
}

export async function shareDialog(app) {
  const body = h('div', { class: 'hint' }, 'Création du lien…');
  const m = openModal({ title: 'Partager le projet', iconName: 'share', body });
  const r = await app.bus.run('project.save_shared', {});
  body.innerHTML = '';
  if (!r.ok) { body.append(h('div', { class: 'err' }, r.error)); return; }
  const inp = h('input', { class: 'input mono', readonly: true, value: r.result.url });
  body.append(F('Lien du projet', h('div', { class: 'row' }, inp, btn('Copier', () => { navigator.clipboard.writeText(r.result.url); toast('Lien copié.'); }, { iconName: 'copy' }))), h('div', { class: 'hint' }, r.result.note), r.result.expiresAt ? h('div', { class: 'hint' }, `Expire le ${new Date(r.result.expiresAt).toLocaleDateString('fr-FR')}.`) : null);
  void m;
}

export function scriptDialog(app) {
  const ta = h('textarea', { class: 'input', rows: 12, 'aria-label': 'Script', value: '// Exécuté dans un Worker isolé : seule la fonction run(name, args) est disponible.\nfor (let i = 0; i < 5; i++) {\n  run(\'clip.add\', { kind: \'shape\', props: { shape: \'circle\', width: 120 }, transform: { x: -400 + i * 200 }, start: i * 0.3, duration: 3 });\n}\nrun(\'marker.add\', { t: 0, label: \'Script\' });' });
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  const out = h('pre', { class: 'mono hint', style: { whiteSpace: 'pre-wrap' } });
  const m = openModal({ title: 'Exécuter un script de commandes', iconName: 'terminal', wide: true, body: [h('div', { class: 'hint' }, 'JS (sandbox Worker) ou JSON [{"name":…,"args":{…}}]. L\'ensemble forme une seule action annulable.'), ta, out], footer: [btn('Fermer', () => m.close()), btn('Exécuter', async () => { const r = await app.bus.run('app.run_script', { script: ta.value }); out.textContent = r.ok ? `✓ ${r.result.count} commande(s) exécutée(s).` : `✗ ${r.error}`; }, { cls: 'primary', cmd: 'app.run_script' })] });
}

export function helpDialog(app) {
  const p = app.bus.registry.list().length;
  openModal({ title: 'Aide — Motion Studio', iconName: 'help', wide: true, body: [h('div', { html: `
    <p><b>Flux de travail :</b> ajoutez des éléments depuis la <b>bibliothèque</b> (clic ou glisser vers la timeline), réglez-les dans l'<b>inspecteur</b> (◆ = keyframe, clic droit = expression / audio-réactivité), organisez-les dans la <b>timeline</b>, puis cliquez <b>EXPORTER MP4</b>.</p>
    <p><b>Palette de commandes :</b> <kbd>Ctrl/Cmd+K</kbd> — ${p} commandes, identiques à celles exposées en MCP.</p>
    <p><b>Mode MCP :</b> <code>window.motionAPI</code> (agents navigateur), WebMCP (<code>navigator.modelContext</code>) si disponible, et relais distant via le serveur MCP Netlify (onglet MCP → « Ouvrir une session »). Le rendu MP4 se fait dans le navigateur : l'onglet doit rester ouvert pendant l'export.</p>
    <p><b>Viewport :</b> molette = zoom, Espace+glisser = pan, double-clic sur un texte = édition, poignées = échelle/rotation/ancre, Ctrl+poignée latérale = inclinaison, Alt+glisser = échelle non uniforme.</p>
    <p><b>Timeline :</b> glisser = déplacer (magnétisme), bords = rogner, Alt+glisser = dupliquer, Ctrl+molette = zoom, glisser dans le vide = lasso, clic droit = menu.</p>` }), btn('Raccourcis clavier', () => shortcutsDialog(app), { iconName: 'command' }), btn('Tableau de parité UI ⇄ MCP', () => window.open('/parity.html', '_blank'), { iconName: 'robot' })] });
}

export function settingsDialog(app) {
  const bus = app.bus;
  const accent = h('input', { class: 'input', type: 'color', value: bus.app.get().accent });
  const lang = h('select', { class: 'input' }, h('option', { value: 'fr' }, 'Français'), h('option', { value: 'en', selected: bus.app.get().lang === 'en' }, 'English'));
  accent.addEventListener('input', () => bus.run('app.set_theme_accent', { color: accent.value }));
  lang.addEventListener('change', () => bus.run('app.set_lang', { lang: lang.value }));
  openModal({ title: 'Paramètres', iconName: 'settings', body: [h('div', { class: 'grid2' }, F('Couleur d\'accent', accent), F('Langue', lang)), btn('Accent par défaut (#24D26D)', () => { accent.value = '#24D26D'; bus.run('app.set_theme_accent', { color: '#24D26D' }); }, { cmd: 'app.set_theme_accent' })] });
}
