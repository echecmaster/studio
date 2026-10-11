// Panneau gauche : éléments, effets, transitions, animations, médias, templates, projets
import { h, btn, iconBtn, contextMenu, section } from './dom.js';
import { icon, KIND_ICONS } from './icons.js';
import { LIBRARY, LIBRARY_CATEGORIES } from '../catalog/elements.js';
import { EFFECTS, EFFECT_CATEGORIES } from '../catalog/effects.js';
import { EFFECT_PRESETS } from '../catalog/effectPresets.js';
import { TRANSITIONS, TRANSITION_GROUPS } from '../catalog/transitions.js';
import { ANIMATION_PRESETS } from '../catalog/animPresets.js';
import { TEMPLATES } from '../templates/templates.generated.js';
import { SFX_TYPES } from '../core/commands/assets.js';
import { thumbnail, buildThumbProject, thumbTime, animateOnHover } from './thumbs.js';
import { bytesToHuman } from '../core/util.js';
import { toast } from './toasts.js';

const TABS = [['elements', 'Éléments'], ['effects', 'Effets'], ['transitions', 'Transitions'], ['animations', 'Animations'], ['media', 'Médias'], ['templates', 'Templates'], ['projects', 'Projets']];

export class Library {
  constructor(app, root) {
    this.app = app;
    this.bus = app.bus;
    this.root = root;
    this.tab = 'elements';
    this.filters = {};
    this.query = '';
    this.tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Bibliothèque' });
    this.body = h('div', { class: 'tab-body', role: 'tabpanel' });
    root.append(this.tabsEl, this.body);
    for (const [id, label] of TABS) {
      const b = h('button', { class: 'tab', role: 'tab', 'aria-selected': String(id === this.tab), onclick: () => this.show(id), dataset: { tab: id } }, label);
      this.tabsEl.append(b);
    }
    this.bus.project.subscribe((p, prev) => { if (this.tab === 'media' && p.assets !== prev.assets) this.render(); });
    this.render();
  }

  show(tab) {
    this.tab = tab;
    for (const b of this.tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    this.render();
  }

  searchBar(placeholder, onInput, extra = []) {
    const inp = h('input', { class: 'input', type: 'search', placeholder, 'aria-label': placeholder, value: this.query });
    inp.addEventListener('input', () => { this.query = inp.value; onInput(); });
    return h('div', { class: 'lib-search' }, inp, ...extra);
  }

  catChips(cats, key, onChange) {
    const wrap = h('div', { class: 'lib-cats' });
    const mk = (id, label) => h('button', { class: 'lib-cat', 'aria-pressed': String((this.filters[key] || '') === id), onclick: () => { this.filters[key] = id; onChange(); } }, label);
    wrap.append(mk('', 'Tout'), ...Object.entries(cats).map(([id, l]) => mk(id, l)));
    return wrap;
  }

  item({ name, iconName, payload, onClick, thumbKey, build, t, hover = true, title }) {
    const thumb = h('div', { class: 'thumb' });
    thumb.innerHTML = icon(iconName || 'sparkles');
    const el = h('button', { class: 'lib-item', draggable: 'true', title: title || `${name} — clic : appliquer / ajouter · glisser vers la timeline ou un clip`, 'aria-label': name, onclick: onClick }, thumb, h('span', { class: 'name' }, name));
    if (payload?.cmd) el.dataset.cmd = payload.cmd;
    el.addEventListener('dragstart', (e) => { this.app.dragPayload = payload; e.dataTransfer.setData('application/x-motion', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'copy'; });
    if (thumbKey && build) {
      const io = new IntersectionObserver((ents) => {
        if (!ents.some((x) => x.isIntersecting)) return;
        io.disconnect();
        thumbnail(thumbKey, build, t ?? 1.2, this.app.media).then((url) => { if (url) { thumb.innerHTML = ''; thumb.append(h('img', { src: url, alt: '' })); } });
      }, { root: this.body });
      io.observe(el);
      if (hover) animateOnHover(el, build, this.app.media);
    }
    return el;
  }

  render() {
    this.body.innerHTML = '';
    const fn = { elements: this.renderElements, effects: this.renderEffects, transitions: this.renderTransitions, animations: this.renderAnimations, media: this.renderMedia, templates: this.renderTemplates, projects: this.renderProjects }[this.tab];
    fn.call(this);
  }

  sel() { return this.bus.app.get().selection; }
  needSel() { const s = this.sel(); if (!s.length) { toast('Sélectionnez d\'abord un clip dans la timeline.', 'warn'); return null; } return s; }

  renderElements() {
    const grid = h('div');
    const draw = () => {
      grid.innerHTML = '';
      const q = this.query.toLowerCase();
      for (const [cat, label] of Object.entries(LIBRARY_CATEGORIES)) {
        if (this.filters.el && this.filters.el !== cat) continue;
        const items = LIBRARY.filter((l) => l.category === cat && (!q || l.name.toLowerCase().includes(q) || l.kind.includes(q)));
        if (!items.length) continue;
        grid.append(h('div', { class: 'lib-group-title' }, `${label} (${items.length})`));
        const g = h('div', { class: 'lib-grid' });
        for (const it of items) {
          g.append(this.item({
            name: it.name, iconName: KIND_ICONS[it.kind], payload: { type: 'element', id: it.id, cmd: 'clip.add' },
            onClick: () => this.bus.run('clip.add', { library: it.id }),
            thumbKey: `el:${it.id}`, build: () => buildThumbProject('element', it.id, { entry: it, measure: (c) => this.app.services.measure({ ...c, sourceTime: 1, localTime: 1 }) }), t: 1.5,
          }));
        }
        grid.append(g);
      }
    };
    this.body.append(this.searchBar('Rechercher un élément…', draw), this.catChips(LIBRARY_CATEGORIES, 'el', () => { this.render(); }), grid);
    draw();
  }

  renderEffects() {
    const grid = h('div');
    const draw = () => {
      grid.innerHTML = '';
      const q = this.query.toLowerCase();
      const presets = h('div', { class: 'lib-grid' });
      for (const p of [...EFFECT_PRESETS, ...(this.bus.project.get().presets || [])]) {
        if (q && !p.name.toLowerCase().includes(q)) continue;
        presets.append(this.item({ name: p.name, iconName: 'wand', payload: { type: 'effectPreset', id: p.id, cmd: 'effect.apply_preset' }, hover: false, onClick: () => { if (this.needSel()) this.bus.run('effect.apply_preset', { presetId: p.id }); } }));
      }
      if (!this.filters.fx && presets.children.length) grid.append(h('div', { class: 'lib-group-title' }, 'Stacks d\'effets'), presets);
      for (const [cat, label] of Object.entries(EFFECT_CATEGORIES)) {
        if (this.filters.fx && this.filters.fx !== cat) continue;
        const items = EFFECTS.filter((e) => e.category === cat && (!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.en.toLowerCase().includes(q)));
        if (!items.length) continue;
        grid.append(h('div', { class: 'lib-group-title' }, `${label} (${items.length})`));
        const g = h('div', { class: 'lib-grid' });
        for (const e of items) {
          g.append(this.item({
            name: e.name, iconName: 'fx', payload: { type: 'effect', id: e.id, cmd: 'effect.add' },
            onClick: () => { const s = this.needSel(); if (s) for (const id of s) this.bus.run('effect.add', { clipId: id, type: e.id }); },
            thumbKey: `fx:${e.id}`, build: () => buildThumbProject('effect', e.id), t: 1.2, hover: !e.temporal,
          }));
        }
        grid.append(g);
      }
    };
    this.body.append(this.searchBar(`Rechercher parmi ${EFFECTS.length} effets…`, draw), this.catChips(EFFECT_CATEGORIES, 'fx', () => this.render()), grid);
    draw();
  }

  renderTransitions() {
    const grid = h('div');
    const draw = () => {
      grid.innerHTML = '';
      const q = this.query.toLowerCase();
      for (const [grp, label] of Object.entries(TRANSITION_GROUPS)) {
        if (this.filters.tr && this.filters.tr !== grp) continue;
        const items = TRANSITIONS.filter((t) => t.group === grp && (!q || t.name.toLowerCase().includes(q) || t.id.includes(q)));
        if (!items.length) continue;
        grid.append(h('div', { class: 'lib-group-title' }, `${label} (${items.length})`));
        const g = h('div', { class: 'lib-grid' });
        for (const t of items) {
          g.append(this.item({
            name: t.name, iconName: 'transition', payload: { type: 'transition', id: t.id, cmd: 'transition.add' },
            title: `${t.name} — clic : entrée du clip sélectionné · Maj+clic : sortie · avec 2 clips sélectionnés : transition entre les deux`,
            onClick: (ev) => {
              const s = this.needSel();
              if (!s) return;
              if (s.length === 2) this.bus.run('transition.add', { clipId: s[0], betweenClipId: s[1], type: t.id });
              else this.bus.run('transition.add', { clipId: s[0], type: t.id, edge: ev.shiftKey ? 'out' : 'in' });
            },
            thumbKey: `tr:${t.id}`, build: () => buildThumbProject('transition', t.id), t: thumbTime('transition', t.id),
          }));
        }
        grid.append(g);
      }
    };
    this.body.append(this.searchBar(`Rechercher parmi ${TRANSITIONS.length} transitions…`, draw), this.catChips(TRANSITION_GROUPS, 'tr', () => this.render()), grid);
    draw();
  }

  renderAnimations() {
    const grid = h('div');
    const types = { in: 'Entrées', out: 'Sorties', emphasis: 'Emphases' };
    const draw = () => {
      grid.innerHTML = '';
      const q = this.query.toLowerCase();
      for (const [type, label] of Object.entries(types)) {
        if (this.filters.an && this.filters.an !== type) continue;
        const items = ANIMATION_PRESETS.filter((p) => p.type === type && (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
        if (!items.length) continue;
        grid.append(h('div', { class: 'lib-group-title' }, `${label} (${items.length})`));
        const g = h('div', { class: 'lib-grid' });
        for (const p of items) {
          g.append(this.item({
            name: p.name, iconName: 'anim', payload: { type: 'animPreset', id: p.id, cmd: 'animation.apply_preset' },
            onClick: () => { if (this.needSel()) this.bus.run('animation.apply_preset', { preset: p.id }); },
            thumbKey: `an:${p.id}`, build: () => buildThumbProject('preset', p.id), t: thumbTime('preset', p.id),
          }));
        }
        grid.append(g);
      }
    };
    this.body.append(this.searchBar(`Rechercher parmi ${ANIMATION_PRESETS.length} animations…`, draw), this.catChips(types, 'an', () => this.render()), grid);
    draw();
  }

  renderMedia() {
    const p = this.bus.project.get();
    const fileInput = h('input', { type: 'file', multiple: true, accept: 'image/*,video/*,audio/*,.svg,.json,.ttf,.otf,.woff,.woff2,.cube,.csv', style: { display: 'none' }, onchange: (e) => { this.app.importFiles([...e.target.files]); e.target.value = ''; } });
    const actions = h('div', { class: 'lib-search', style: { flexWrap: 'wrap' } },
      btn('Importer…', () => fileInput.click(), { iconName: 'upload', cls: 'primary', cmd: 'asset.import_file' }),
      btn('URL…', () => { const u = prompt('URL du média (le serveur doit autoriser CORS)'); if (u) this.bus.run('asset.import_url', { url: u }); }, { iconName: 'link', cmd: 'asset.import_url' }),
      btn('Voix off', () => { const s = prompt('Durée maximale d\'enregistrement (secondes)', '15'); if (s) this.bus.run('asset.record_voice', { seconds: +s || 15, addToTimeline: true }); }, { iconName: 'mic', cmd: 'asset.record_voice' }),
      btn('Coller', async () => { try { const items = await navigator.clipboard.read(); for (const it of items) for (const type of it.types) { if (type.startsWith('image/')) { const b = await it.getType(type); this.app.importFiles([new File([b], `presse-papiers.${type.split('/')[1]}`, { type })]); } } } catch (e) { toast(`Presse-papiers inaccessible : ${e.message}`, 'warn'); } }, { iconName: 'paste', cmd: 'asset.import_file', title: 'Coller une image du presse-papiers (ou Ctrl+V dans la page)' }),
      fileInput);
    this.body.append(actions);
    // bruitages Web Audio
    const sfx = h('div', { class: 'lib-cats' }, ...SFX_TYPES.map((t) => h('button', { class: 'lib-cat', onclick: () => this.bus.run('asset.generate_sfx', { type: t, addToTimeline: true }), dataset: { cmd: 'asset.generate_sfx' }, title: `Générer un bruitage "${t}" et l'insérer à la tête de lecture` }, `♪ ${t}`)));
    this.body.append(section('Bruitages générés (Web Audio)', sfx));
    // polices
    const fontRow = h('div', { class: 'row' }, h('input', { class: 'input grow', placeholder: 'URL .woff2/.ttf', 'aria-label': 'URL de police' }), h('input', { class: 'input', placeholder: 'Famille', style: { width: '90px' }, 'aria-label': 'Famille' }));
    fontRow.append(btn('Charger', () => { const [u, f] = fontRow.querySelectorAll('input'); if (u.value && f.value) this.bus.run('font.load_url', { url: u.value, family: f.value }); }, { cmd: 'font.load_url' }));
    this.body.append(section('Polices', [fontRow, h('div', { class: 'hint' }, 'Ou importez directement un fichier .ttf/.otf/.woff2.')], { collapsed: true }));
    const list = h('div', { class: 'list' });
    if (!p.assets.length) list.append(h('div', { class: 'empty', html: `${icon('folder')}<div>Aucun média. Glissez des fichiers ici, dans la timeline ou le viewport, ou utilisez « Importer… ».</div>` }));
    for (const a of p.assets) {
      const used = p.clips.filter((c) => c.props?.assetId === a.id).length;
      const st = this.app.media.status(a.id);
      const it = h('div', { class: 'list-item', draggable: 'true', title: `${a.name} — glisser vers la timeline` },
        h('span', { html: icon({ image: 'image', svg: 'image', video: 'film', audio: 'music', font: 'text', lottie: 'anim', lut: 'sliders', csv: 'chart', json: 'code' }[a.type] || 'folder') , style: { width: '16px', color: st === 'error' ? 'var(--danger)' : 'var(--accent)' } }),
        h('span', { class: 'grow' }, a.name, h('div', { class: 'hint' }, `${a.type}${a.meta?.width ? ` · ${a.meta.width}×${a.meta.height}` : ''}${a.meta?.duration ? ` · ${a.meta.duration.toFixed(1)}s` : ''} · ${bytesToHuman(a.size)} · utilisé ${used}×${st === 'error' ? ' · INTROUVABLE' : ''}`)),
        iconBtn('plus', 'Ajouter à la timeline', () => this.app.applyDrop({ type: 'asset', id: a.id }, { t: this.bus.app.get().time }), { class: 'ghost sm', cmd: 'clip.add' }),
      );
      it.addEventListener('dragstart', (e) => { const pl = { type: 'asset', id: a.id }; this.app.dragPayload = pl; e.dataTransfer.setData('application/x-motion', JSON.stringify(pl)); });
      it.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rep = h('input', { type: 'file', style: { display: 'none' } });
        rep.addEventListener('change', async () => { const f = rep.files[0]; if (!f) return; const tok = this.app.registerFile(f); const r = await this.bus.run('asset.import_file', { token: tok }); if (r.ok) this.bus.run('asset.replace', { id: a.id, withId: r.result.id }); });
        document.body.append(rep);
        contextMenu(e.clientX, e.clientY, [
          { header: a.name },
          { label: 'Ajouter à la timeline', icon: 'plus', cmd: 'clip.add', action: () => this.app.applyDrop({ type: 'asset', id: a.id }, { t: this.bus.app.get().time }) },
          { label: 'Renommer…', icon: 'text', cmd: 'asset.rename', action: () => { const n = prompt('Nouveau nom', a.name); if (n) this.bus.run('asset.rename', { id: a.id, name: n }); } },
          { label: 'Remplacer le média…', icon: 'refresh', cmd: 'asset.replace', action: () => rep.click() },
          { label: 'Voir l\'usage', icon: 'search', cmd: 'asset.usage', action: async () => { const r = await this.bus.run('asset.usage', { id: a.id }); toast(r.ok ? `Utilisé par : ${r.result.usedBy.map((id) => p.clips.find((c) => c.id === id)?.name || id).join(', ') || 'aucun clip'}` : r.error); } },
          a.type === 'audio' ? { label: 'Détecter les beats → marqueurs', icon: 'marker', cmd: 'audio.detect_beats', action: () => this.bus.run('audio.detect_beats', { assetId: a.id }) } : null,
          a.type === 'lut' ? { label: 'Appliquer la LUT au clip sélectionné', icon: 'sliders', cmd: 'effect.add', action: () => { if (this.needSel()) this.bus.run('effect.add', { type: 'lut3d', params: { lut: a.id } }); } } : null,
          '-',
          { label: 'Supprimer', icon: 'trash', cmd: 'asset.delete', action: () => this.bus.run('asset.delete', { id: a.id, force: used > 0 && confirm(`Cet asset est utilisé par ${used} clip(s). Supprimer aussi ces clips ?`) }) },
        ]);
      });
      list.append(it);
    }
    this.body.append(section(`Assets du projet (${p.assets.length})`, list));
    this.body.addEventListener('dragover', (e) => e.preventDefault());
    this.body.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files?.length) this.app.importFiles([...e.dataTransfer.files], { addToTimeline: false }); });
  }

  renderTemplates() {
    const g = h('div', { class: 'lib-grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', paddingTop: '8px' } });
    for (const t of TEMPLATES) {
      g.append(this.item({
        name: t.name, iconName: 'template', payload: { type: 'template', id: t.id, cmd: 'template.apply' }, title: `${t.name} — ${t.description}`,
        onClick: () => { if (confirm(`Appliquer le template « ${t.name} » ? Le projet courant sera remplacé (annulable avec Ctrl+Z).`)) this.bus.run('template.apply', { id: t.id }); },
        thumbKey: `tpl:${t.id}`, build: () => JSON.parse(JSON.stringify(t.project)), t: t.thumbTime ?? t.project.meta.duration * 0.4,
      }));
    }
    this.body.append(h('div', { class: 'hint', style: { padding: '8px 10px 0' } }, `${TEMPLATES.length} templates de projet — survolez pour prévisualiser.`), g);
  }

  async renderProjects() {
    const fileInput = h('input', { type: 'file', accept: '.json,.zip,application/json', style: { display: 'none' }, onchange: (e) => { this.app.importProjectFile(e.target.files[0]); e.target.value = ''; } });
    this.body.append(h('div', { class: 'lib-search', style: { flexWrap: 'wrap' } },
      btn('Nouveau', () => this.app.ui.newProjectDialog(), { iconName: 'plus', cls: 'primary', cmd: 'project.new' }),
      btn('Enregistrer', () => this.bus.run('project.save'), { iconName: 'save', cmd: 'project.save' }),
      btn('Dupliquer', () => this.bus.run('project.duplicate', {}).then(() => this.render()), { iconName: 'dup', cmd: 'project.duplicate' }),
      btn('Importer…', () => fileInput.click(), { iconName: 'upload', cmd: 'project.import_json' }),
      btn('Exporter JSON', () => this.bus.run('project.export_json', { download: true }), { iconName: 'export', cmd: 'project.export_json' }),
      btn('JSON + médias', () => this.bus.run('project.export_json', { download: true, embedAssets: true }), { iconName: 'export', cmd: 'project.export_json', title: 'Exporter le projet avec les médias embarqués en base64' }),
      btn('.zip', () => this.bus.run('project.export_json', { download: true, zip: true }), { iconName: 'folder', cmd: 'project.export_json', title: 'Archive .motion.zip (projet + médias)' }),
      fileInput));
    const list = h('div', { class: 'list' });
    this.body.append(list);
    const r = await this.bus.run('project.list');
    if (!r.ok) { list.append(h('div', { class: 'empty' }, r.error)); return; }
    const cur = this.bus.project.get().id;
    for (const pr of r.result) {
      const it = h('div', { class: `list-item ${pr.id === cur ? 'sel' : ''}`, tabindex: 0, onclick: () => { if (pr.id !== cur) this.bus.run('project.open', { id: pr.id }).then(() => this.render()); } },
        pr.thumb ? h('img', { src: pr.thumb, alt: '', style: { width: '64px', height: '36px', objectFit: 'cover', borderRadius: '4px' } }) : h('span', { html: icon('film'), style: { width: '16px' } }),
        h('span', { class: 'grow' }, pr.name, h('div', { class: 'hint' }, `${pr.meta.width}×${pr.meta.height} · ${pr.meta.duration}s · ${pr.meta.clips} clips · ${new Date(pr.updatedAt).toLocaleString('fr-FR')}`)),
        pr.id !== cur ? iconBtn('trash', 'Supprimer ce projet', (e) => { e.stopPropagation(); if (confirm(`Supprimer définitivement « ${pr.name} » ?`)) this.bus.run('project.delete', { id: pr.id }).then(() => this.render()); }, { class: 'ghost sm danger', cmd: 'project.delete' }) : h('span', { class: 'badge accent' }, 'ouvert'));
      list.append(it);
    }
    if (!r.result.length) list.append(h('div', { class: 'empty' }, 'Aucun projet enregistré. L\'autosauvegarde enregistre le projet courant toutes les 5 s.'));
  }
}
