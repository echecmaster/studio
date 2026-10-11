// Serveur MCP (JSON-RPC 2.0, transport Streamable HTTP) de Motion Studio.
// - Outils "sans navigateur" exécutés ici (construction de projets JSON, catalogues, partage).
// - Outils "avec onglet" relayés vers l'onglet Motion Studio appairé (rendu, lecture, export…).
import { createRegistry, registry } from '../../js/core/commands/index.js';
import { toToolName } from '../../js/core/registry.js';
import { CommandBus } from '../../js/core/commandBus.js';
import { createProject, normalizeProject, validateProject, projectSchema } from '../../js/core/schema.js';
import { diff, deepClone } from '../../js/core/util.js';
import { EFFECTS, describeEffect } from '../../js/catalog/effects.js';
import { TRANSITIONS } from '../../js/catalog/transitions.js';
import { ANIMATION_PRESETS } from '../../js/catalog/animPresets.js';
import { EFFECT_PRESETS } from '../../js/catalog/effectPresets.js';
import { BLEND_MODES } from '../../js/catalog/blendModes.js';
import { GENERATORS } from '../../js/catalog/generators.js';
import { SHADER_PRESETS } from '../../js/catalog/shaders.js';
import { LIBRARY } from '../../js/catalog/elements.js';
import { TEMPLATES } from '../../js/templates/templates.generated.js';
import { getSession, resolvePair, bindMcpSession, boundSession, enqueue, waitResult, peekResult } from './sessions.mjs';
import { saveShared, loadShared } from './share.mjs';

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'motion-studio', title: 'Motion Studio', version: '1.0.0' };

const INSTRUCTIONS = `Motion Studio — éditeur de motion design piloté par commandes.
DEUX MODES :
1) Sans navigateur : construisez un projet JSON avec project_create_from_template puis project_apply_commands (mêmes commandes que l'UI : clip_add, effect_add, animation_apply_preset, transition_add…). Partagez-le avec project_save_shared → lien à ouvrir dans le site.
2) Avec onglet : l'utilisateur ouvre Motion Studio, onglet MCP → "Ouvrir une session". Connectez-vous avec l'URL /mcp?session=ID ou appelez session_attach({code}) avec le code d'appairage. Tous les outils (render_frame, render_contact_sheet, project_lint, export_start…) agissent alors sur l'onglet.
Bonnes pratiques : vérifiez visuellement avec render_contact_sheet, corrigez avec project_lint, puis export_start (MP4) et export_status / export_get_result. Le rendu MP4 se fait dans le navigateur : l'onglet doit rester ouvert pendant l'export.
Repère : x,y en pixels depuis le CENTRE de la composition ; temps en secondes.`;

// ---------------------------------------------------------------- outils serveur
const SERVER_TOOLS = [
  { name: 'session_attach', description: 'Associer cette connexion MCP à un onglet Motion Studio via son code d\'appairage (6 chiffres, onglet MCP du site) / Attach to an open tab with its pairing code.', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Code d\'appairage' } }, required: ['code'] } },
  { name: 'session_status', description: 'État de la session : onglet associé, dernière activité / Session status.', inputSchema: { type: 'object', properties: {} } },
  { name: 'session_get_result', description: 'Récupérer le résultat d\'un appel encore en cours dans l\'onglet / Fetch a pending tab call result.', inputSchema: { type: 'object', properties: { callId: { type: 'string' } }, required: ['callId'] } },
  { name: 'project_create_from_template', description: 'Créer un projet JSON (vide ou depuis un template), sans navigateur / Create a project JSON from a template (server-side).', inputSchema: { type: 'object', properties: { template: { type: 'string', description: `Template : ${TEMPLATES.map((t) => t.id).join(', ')} (vide = projet vierge)` }, name: { type: 'string' }, width: { type: 'integer' }, height: { type: 'integer' }, fps: { type: 'number' }, duration: { type: 'number' }, background: { type: 'string' } } } },
  { name: 'project_apply_commands', description: 'Appliquer une liste de commandes [{name, args}] à un projet JSON et renvoyer le projet modifié (sans navigateur, atomique) / Apply commands to a project JSON server-side.', inputSchema: { type: 'object', properties: { project: { description: 'Projet JSON (objet ou chaîne). Absent = projet vierge.' }, commands: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, args: { type: 'object' } }, required: ['name'] } }, returnProject: { type: 'boolean', description: 'Inclure le projet complet dans la réponse (défaut : oui)' } }, required: ['commands'] } },
  { name: 'project_validate_json', description: 'Valider un projet JSON contre le JSON Schema / Validate a project JSON.', inputSchema: { type: 'object', properties: { project: {} }, required: ['project'] } },
  { name: 'project_diff_json', description: 'Différences entre deux projets JSON / Diff two project JSONs.', inputSchema: { type: 'object', properties: { a: {}, b: {} }, required: ['a', 'b'] } },
  { name: 'catalog_search', description: 'Chercher dans les catalogues : effets, transitions, presets d\'animation, presets d\'effets, générateurs, shaders, éléments, templates, modes de fusion / Search catalogs.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, kind: { type: 'string', enum: ['effect', 'transition', 'animation', 'effectPreset', 'generator', 'shader', 'element', 'template', 'blend', 'all'] }, limit: { type: 'integer' } } } },
  { name: 'catalog_describe', description: 'Décrire un élément de catalogue (paramètres, plages, valeurs par défaut) / Describe a catalog item.', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['effect', 'transition', 'animation', 'generator', 'shader', 'element', 'template', 'command'] }, id: { type: 'string' } }, required: ['kind', 'id'] } },
  { name: 'project_save_shared', description: 'Stocker un projet JSON dans Netlify Blobs et obtenir un lien d\'ouverture (sans "project" : partage le projet de l\'onglet associé) / Share a project (Netlify Blobs).', inputSchema: { type: 'object', properties: { project: { description: 'Projet JSON (optionnel si un onglet est associé)' } } } },
  { name: 'project_load_shared', description: 'Charger un projet partagé : renvoie le JSON, ou l\'ouvre dans l\'onglet associé / Load a shared project.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];
const SERVER_NAMES = new Set(SERVER_TOOLS.map((t) => t.name));

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] });
const err = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const parse = (p) => (typeof p === 'string' ? JSON.parse(p) : p);

function catalogItems(kind) {
  const all = [];
  if (kind === 'effect' || kind === 'all') all.push(...EFFECTS.map((e) => ({ kind: 'effect', id: e.id, name: e.name, en: e.en, category: e.category })));
  if (kind === 'transition' || kind === 'all') all.push(...TRANSITIONS.map((t) => ({ kind: 'transition', id: t.id, name: t.name, en: t.en, category: t.group })));
  if (kind === 'animation' || kind === 'all') all.push(...ANIMATION_PRESETS.map((p) => ({ kind: 'animation', id: p.id, name: p.name, en: p.en, category: p.type })));
  if (kind === 'effectPreset' || kind === 'all') all.push(...EFFECT_PRESETS.map((p) => ({ kind: 'effectPreset', id: p.id, name: p.name })));
  if (kind === 'generator' || kind === 'all') all.push(...GENERATORS.map((g) => ({ kind: 'generator', id: g.id, name: g.name, en: g.en })));
  if (kind === 'shader' || kind === 'all') all.push(...SHADER_PRESETS.map((s) => ({ kind: 'shader', id: s.id, name: s.name })));
  if (kind === 'element' || kind === 'all') all.push(...LIBRARY.map((l) => ({ kind: 'element', id: l.id, name: l.name, category: l.category, clipKind: l.kind })));
  if (kind === 'template' || kind === 'all') all.push(...TEMPLATES.map((t) => ({ kind: 'template', id: t.id, name: t.name, description: t.description })));
  if (kind === 'blend' || kind === 'all') all.push(...BLEND_MODES.map((b) => ({ kind: 'blend', id: b.id, name: b.name })));
  return all;
}

async function runServerTool(name, a, ctx) {
  switch (name) {
    case 'session_attach': {
      const id = await resolvePair(a.code);
      if (!id) return err('Code d\'appairage invalide ou expiré. Ouvrez Motion Studio → onglet MCP → « Ouvrir une session ».');
      if (!ctx.mcpSessionId) return err('Cette connexion n\'a pas d\'identifiant de session MCP (en-tête Mcp-Session-Id). Utilisez plutôt l\'URL /mcp?session=ID.');
      await bindMcpSession(ctx.mcpSessionId, id);
      return text({ attached: true, session: id });
    }
    case 'session_status': {
      const id = ctx.motionSession;
      if (!id) return text({ attached: false, hint: 'Aucun onglet associé : utilisez session_attach({code}) ou l\'URL /mcp?session=ID. Les outils serveur (project_apply_commands…) restent disponibles.' });
      const s = await getSession(id);
      return text(s ? { attached: true, session: id, name: s.name, lastSeenSecondsAgo: Math.round((Date.now() - s.lastSeen) / 1000), tabOnline: Date.now() - s.lastSeen < 20000, expiresAt: new Date(s.expiresAt).toISOString() } : { attached: false, error: 'Session expirée' });
    }
    case 'session_get_result': {
      if (!ctx.motionSession) return err('Aucune session associée.');
      const r = await peekResult(ctx.motionSession, a.callId);
      return r || text({ pending: true, callId: a.callId });
    }
    case 'project_create_from_template': {
      const bus = new CommandBus({ registry: createRegistry(), project: createProject({ meta: { name: a.name || 'Projet IA', width: a.width || 1920, height: a.height || 1080, fps: a.fps || 30, duration: a.duration || 10, background: a.background || '#000000' } }), env: 'node' });
      if (a.template) { const r = await bus.run('template.apply', { id: a.template, keepFormat: !!(a.width || a.height), name: a.name }); if (!r.ok) return err(r.error); }
      return text(bus.project.get());
    }
    case 'project_apply_commands': {
      let project;
      try { project = a.project ? normalizeProject(parse(a.project)) : createProject(); } catch (e) { return err(`Projet invalide : ${e.message}`); }
      const bus = new CommandBus({ registry: createRegistry(), project, env: 'node', services: { share: shareService } });
      if (!Array.isArray(a.commands) || a.commands.length > 1000) return err('commands : tableau de 1 à 1000 commandes attendu.');
      const r = await bus.batch(a.commands.map((c) => ({ name: c.name.includes('.') ? c.name : registry.get(c.name)?.name || c.name, args: c.args || {} })), { label: 'MCP' });
      if (!r.ok) return err(`Commande ${r.index ?? ''} (${r.command}) en échec : ${r.error}. Aucune modification appliquée (transaction atomique).`);
      const v = validateProject(bus.project.get());
      return text({ ok: true, results: r.result, valid: v.ok, errors: v.errors, project: a.returnProject === false ? undefined : bus.project.get() });
    }
    case 'project_validate_json': try { return text(validateProject(normalizeProject(parse(a.project)))); } catch (e) { return err(e.message); }
    case 'project_diff_json': try { const d = diff(parse(a.a), parse(a.b)); return text({ count: d.length, changes: d.slice(0, 500).map((x) => ({ op: x.op, path: x.path.join('.'), value: x.value })) }); } catch (e) { return err(e.message); }
    case 'catalog_search': {
      const q = String(a.query || '').toLowerCase();
      const items = catalogItems(a.kind || 'all').filter((i) => !q || `${i.id} ${i.name} ${i.en || ''} ${i.category || ''} ${i.description || ''}`.toLowerCase().includes(q));
      return text({ count: items.length, items: items.slice(0, a.limit || 80) });
    }
    case 'catalog_describe': {
      const id = a.id;
      const found = {
        effect: () => { const e = EFFECTS.find((x) => x.id === id); return e && describeEffect(e); },
        transition: () => { const t = TRANSITIONS.find((x) => x.id === id); return t && { type: t.id, name: t.name, group: t.group, params: t.params }; },
        animation: () => { const p = ANIMATION_PRESETS.find((x) => x.id === id); return p && { id: p.id, name: p.name, type: p.type, duration: p.duration, animates: Object.keys(p.tracks || {}), effects: (p.effects || []).map((e) => e.type), transition: p.transition || null }; },
        generator: () => { const g = GENERATORS.find((x) => x.id === id); return g && { id: g.id, name: g.name, params: g.params }; },
        shader: () => SHADER_PRESETS.find((x) => x.id === id),
        element: () => LIBRARY.find((x) => x.id === id),
        template: () => { const t = TEMPLATES.find((x) => x.id === id); return t && { id: t.id, name: t.name, description: t.description, meta: t.project.meta, clips: t.project.clips.map((c) => ({ id: c.id, name: c.name, kind: c.kind, start: c.start, duration: c.duration })) }; },
        command: () => { const d = registry.get(id); return d && { name: d.name, tool: toToolName(d.name), description: d.description, inputSchema: d.args, env: d.env }; },
      }[a.kind]?.();
      return found ? text(found) : err(`${a.kind} introuvable : ${id}`);
    }
    case 'project_save_shared':
      if (!a.project) { if (ctx.motionSession) return relayToTab('project.save_shared', {}, ctx); return err('Indiquez "project" (ou associez un onglet).'); }
      try { return text(await saveShared(parse(a.project), ctx.origin)); } catch (e) { return err(e.message); }
    case 'project_load_shared': {
      if (ctx.motionSession) return relayToTab('project.load_shared', { id: a.id }, ctx);
      const p = await loadShared(a.id);
      return p ? text(p) : err('Projet partagé introuvable ou expiré.');
    }
    default: return err(`Outil serveur inconnu : ${name}`);
  }
}

const shareService = { save: (p) => saveShared(p, ''), load: (id) => loadShared(id) };

// ---------------------------------------------------------------- relais vers l'onglet
async function relayToTab(tool, args, ctx) {
  const sid = ctx.motionSession;
  const def = registry.get(tool);
  if (!sid) {
    if (def && def.env !== 'browser') return err(`Aucun onglet Motion Studio associé. Pour "${tool}" sans navigateur, utilisez project_apply_commands({project, commands:[{name:"${def.name}", args:{…}}]}). Pour agir sur un onglet : session_attach({code}) ou URL /mcp?session=ID.`);
    return err(`"${tool}" nécessite un onglet Motion Studio ouvert (rendu/export dans le navigateur). Ouvrez le site → onglet MCP → « Ouvrir une session », puis session_attach({code}) ou connectez-vous via /mcp?session=ID.`);
  }
  const sess = await getSession(sid);
  if (!sess) return err('Session expirée : rouvrez une session depuis l\'onglet MCP du site.');
  if (Date.now() - sess.lastSeen > 30000) return err('L\'onglet Motion Studio associé ne répond plus (fermé ou en veille). Gardez-le ouvert et au premier plan.');
  const callId = await enqueue(sid, tool, args || {});
  const res = await waitResult(sid, callId, 8500);
  if (res) return res;
  return text({ pending: true, callId, message: `L'appel s'exécute encore dans l'onglet. Rappelez session_get_result({callId:"${callId}"}) dans quelques secondes.` });
}

// ---------------------------------------------------------------- ressources & prompts
const RESOURCES = [
  { uri: 'motion://project/current', name: 'Projet courant (onglet)', mimeType: 'application/json' },
  { uri: 'motion://catalog/effects', name: `Catalogue des effets (${EFFECTS.length})`, mimeType: 'application/json' },
  { uri: 'motion://catalog/transitions', name: `Catalogue des transitions (${TRANSITIONS.length})`, mimeType: 'application/json' },
  { uri: 'motion://catalog/presets', name: 'Presets d\'animation et d\'effets', mimeType: 'application/json' },
  { uri: 'motion://catalog/templates', name: 'Templates de projet', mimeType: 'application/json' },
  { uri: 'motion://docs/schema', name: 'JSON Schema du projet', mimeType: 'application/schema+json' },
  { uri: 'motion://docs/commands', name: 'Documentation des commandes', mimeType: 'application/json' },
];
const RESOURCE_TEMPLATES = [{ uriTemplate: 'motion://frame/{t}', name: 'Image rendue à l\'instant t (secondes) — nécessite un onglet', mimeType: 'image/jpeg' }];

async function readResource(uri, ctx) {
  const J = (obj) => ({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(obj) }] });
  if (uri === 'motion://catalog/effects') return J(EFFECTS.map(describeEffect));
  if (uri === 'motion://catalog/transitions') return J(TRANSITIONS.map((t) => ({ type: t.id, name: t.name, group: t.group, params: t.params })));
  if (uri === 'motion://catalog/presets') return J({ animation: ANIMATION_PRESETS.map((p) => ({ id: p.id, name: p.name, type: p.type, duration: p.duration })), effects: EFFECT_PRESETS });
  if (uri === 'motion://catalog/templates') return J(TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description })));
  if (uri === 'motion://docs/schema') return { contents: [{ uri, mimeType: 'application/schema+json', text: JSON.stringify(projectSchema) }] };
  if (uri === 'motion://docs/commands') return J(registry.list().map((c) => ({ tool: c.tool, name: c.name, description: c.description.fr, env: c.env, inputSchema: c.inputSchema })));
  if (uri === 'motion://project/current') {
    const r = await relayToTab('project.get', {}, ctx);
    if (r.isError) throw new Error(r.content[0].text);
    return { contents: [{ uri, mimeType: 'application/json', text: r.content.find((c) => c.type === 'text')?.text || '{}' }] };
  }
  const m = /^motion:\/\/frame\/([\d.]+)$/.exec(uri);
  if (m) {
    const r = await relayToTab('render.frame', { t: +m[1], format: 'jpeg', width: 960 }, ctx);
    if (r.isError) throw new Error(r.content[0].text);
    const img = r.content.find((c) => c.type === 'image');
    if (!img) throw new Error('Rendu indisponible');
    return { contents: [{ uri, mimeType: img.mimeType, blob: img.data }] };
  }
  throw new Error(`Ressource inconnue : ${uri}`);
}

const PROMPTS = {
  create_intro: { description: 'Créer une intro de chaîne / marque', args: [{ name: 'brand', description: 'Nom de la marque ou chaîne', required: true }, { name: 'style', description: 'Style visuel (ex. néon, minimal, cinématique)' }], text: (a) => `Crée une intro vidéo de 5 à 7 secondes pour « ${a.brand} » dans un style ${a.style || 'moderne noir et vert'}. Étapes : 1) template.apply ou project.new (1920×1080, 30 i/s), 2) fond animé (générateur ou shader), 3) titre avec animation d'entrée (animation.apply_preset) et text animator, 4) effets (glow, grain, LUT), 5) transitions, 6) vérifie avec render.contact_sheet puis project.lint, corrige, 7) export.start au format mp4 et récupère le résultat avec export.status / export.get_result.` },
  lyric_video: { description: 'Lyric video synchronisée', args: [{ name: 'lyrics', description: 'Paroles (une ligne par phrase)', required: true }, { name: 'bpm', description: 'Tempo (optionnel)' }], text: (a) => `Fabrique une lyric video. Paroles :\n${a.lyrics}\n\nSi un audio est présent, utilise audio.detect_beats pour obtenir des marqueurs, puis place une ligne de texte par phrase (clip.add kind text) calée sur les marqueurs, avec animation.text_animator (wave ou slide par mot). Ajoute un fond audio-réactif (audio.link_property sur l'échelle ou un paramètre d'effet). ${a.bpm ? `Tempo : ${a.bpm} BPM.` : ''} Vérifie avec render.contact_sheet puis exporte en MP4.` },
  product_ad: { description: 'Publicité produit', args: [{ name: 'product', required: true, description: 'Produit' }, { name: 'price', description: 'Prix' }, { name: 'cta', description: 'Appel à l\'action' }], text: (a) => `Crée une publicité de 8 secondes pour ${a.product}${a.price ? ` à ${a.price}` : ''}. Utilise le template pub-produit comme base (template.apply), adapte les textes (clip.set_text), le compteur de prix, ajoute un appel à l'action « ${a.cta || 'Découvrir'} » (ui button), vérifie avec project.lint et render.contact_sheet, puis exporte en MP4.` },
  social_story: { description: 'Story verticale 9:16', args: [{ name: 'topic', required: true, description: 'Sujet' }], text: (a) => `Crée une story Instagram/TikTok 1080×1920 sur « ${a.topic} » : project.new avec preset vertical, titre accrocheur animé mot par mot, 2-3 points clés, barre de progression, sticker, CTA. Respecte les zones de sécurité (texte non coupé : project.lint). Exporte en MP4.` },
  logo_reveal: { description: 'Révélation de logo', args: [{ name: 'brand', required: true, description: 'Marque' }, { name: 'logoUrl', description: 'URL du logo (CORS) ou SVG' }], text: (a) => `Réalise un logo reveal pour ${a.brand}. ${a.logoUrl ? `Importe le logo avec asset.import_url({url:"${a.logoUrl}"}) ou asset.import_text pour un SVG.` : 'Crée un logo avec des formes (shape star/polygon) si aucun fichier n\'est fourni.'} Révèle-le avec une transition iris ou un masque animé, ajoute glow/lens flare, puis le nom avec un text animator. Vérifie et exporte.` },
  fix_project: { description: 'Analyser et corriger un projet', args: [], text: () => 'Appelle project.lint, puis pour chaque problème : corrige-le avec les commandes adaptées (clip.set_transform pour le hors-cadre, clip.set_style pour le contraste/la taille du texte, clip.set_audio pour la saturation audio, asset.replace pour un média manquant, shader.set_code pour un shader en erreur, project.set_format pour la durée). Relance project.lint jusqu\'à n\'avoir plus d\'erreur, puis vérifie avec render.contact_sheet.' },
  beat_sync_edit: { description: 'Montage synchronisé sur les beats', args: [{ name: 'assetId', description: 'Audio (optionnel : premier audio du projet)' }], text: (a) => `Synchronise le montage sur la musique : audio.detect_beats${a.assetId ? `({assetId:"${a.assetId}"})` : ''} → marqueurs. Ensuite, coupe/répartis les clips visuels pour que chaque changement tombe sur un beat (clip.move, clip.split), ajoute un zoomPunch ou glitchPulse (animation.apply_preset type emphasis) sur les temps forts, et lie l'échelle d'un élément à l'amplitude (audio.link_property). Vérifie avec render.contact_sheet, puis exporte en MP4.` },
};

// ---------------------------------------------------------------- dispatch JSON-RPC
export function listTools() {
  return [
    ...SERVER_TOOLS,
    ...registry.toMcpTools('both').filter((t) => !SERVER_NAMES.has(t.name)),
  ];
}

export async function handleRpc(msg, ctx) {
  const { id, method, params = {} } = msg;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message, data) => ({ jsonrpc: '2.0', id, error: { code, message, data } });
  try {
    switch (method) {
      case 'initialize': {
        const v = PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0];
        return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false }, logging: {} }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      }
      case 'ping': return ok({});
      case 'logging/setLevel': return ok({});
      case 'tools/list': return ok({ tools: listTools() });
      case 'tools/call': {
        const name = params.name;
        const args = params.arguments || {};
        if (SERVER_NAMES.has(name)) return ok(await runServerTool(name, args, ctx));
        const def = registry.get(name);
        if (!def) return ok(err(`Outil inconnu : ${name}`));
        return ok(await relayToTab(def.name, args, ctx));
      }
      case 'resources/list': return ok({ resources: RESOURCES });
      case 'resources/templates/list': return ok({ resourceTemplates: RESOURCE_TEMPLATES });
      case 'resources/read': return ok(await readResource(params.uri, ctx));
      case 'prompts/list': return ok({ prompts: Object.entries(PROMPTS).map(([name, p]) => ({ name, description: p.description, arguments: p.args })) });
      case 'prompts/get': {
        const p = PROMPTS[params.name];
        if (!p) return fail(-32602, `Prompt inconnu : ${params.name}`);
        for (const a of p.args) if (a.required && !params.arguments?.[a.name]) return fail(-32602, `Argument requis : ${a.name}`);
        return ok({ description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text(params.arguments || {}) } }] });
      }
      case 'completion/complete': return ok({ completion: { values: [], hasMore: false } });
      default:
        if (method?.startsWith('notifications/')) return null;
        return fail(-32601, `Méthode inconnue : ${method}`);
    }
  } catch (e) {
    return fail(-32603, e.message);
  }
}

export async function resolveMotionSession(ctx) {
  if (ctx.explicitSession) return ctx.explicitSession;
  return boundSession(ctx.mcpSessionId);
}

export { deepClone };
