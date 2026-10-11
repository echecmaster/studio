// Génère PARITY.md, js/mcp/parity.generated.js et js/mcp/tools.generated.js à partir du registre et du code de l'UI.
// Échoue (code 1) si une action de l'UI référence une commande inexistante ou si l'UI modifie l'état sans commande.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../js/core/commands/index.js';
import { UI_ACTIONS } from '../js/ui/actions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
export const UI_FILES = [...walk(join(root, 'js/ui')), ...walk(join(root, 'js/timeline')), join(root, 'js/main.js')].filter((f) => f.endsWith('.js'));

export function scanUi() {
  const refs = new Map(); // commande -> [{file, line, label}]
  const violations = [];
  const unknown = [];
  const patterns = [/bus\.run\(\s*'([a-z_]+\.[a-z_]+)'/g, /bus\.batch\(\s*[^)]*?name:\s*'([a-z_]+\.[a-z_]+)'/g, /name:\s*'([a-z_]+\.[a-z_]+)'/g, /cmd:\s*'([a-z_]+\.[a-z_]+)'/g, /command:\s*'([a-z_]+\.[a-z_]+)'/g];
  for (const f of UI_FILES) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          const name = m[1];
          if (!registry.get(name)) unknown.push({ name, file: relative(root, f), line: i + 1 });
          else {
            const label = (line.match(/label:\s*'([^']+)'/) || line.match(/btn\('([^']+)'/) || line.match(/iconBtn\('[^']+',\s*'([^']+)'/) || line.match(/title:\s*'([^']+)'/) || [])[1] || '';
            if (!refs.has(name)) refs.set(name, []);
            refs.get(name).push({ file: relative(root, f), line: i + 1, label: label.replace(/\\'/g, '\'') });
          }
        }
      }
      // l'UI ne doit jamais modifier le projet directement
      if (/bus\.project\.(set|patch)\(|\.replaceProject\(|history\.(push|undo|redo)\(/.test(line) && !/\/\/ parity-ok/.test(line)) violations.push({ file: relative(root, f), line: i + 1, code: line.trim().slice(0, 120) });
    });
  }
  return { refs, violations, unknown };
}

export function buildParity() {
  const { refs, violations, unknown } = scanUi();
  const actionsMissing = UI_ACTIONS.filter((a) => !registry.get(a.command));
  const commands = registry.list();
  const rows = commands.map((c) => ({ command: c.name, tool: c.tool, title: c.title.fr, env: c.env, ui: (refs.get(c.name) || []).map((r) => r.label).filter(Boolean).slice(0, 4), uiRefs: (refs.get(c.name) || []).length, shortcut: UI_ACTIONS.filter((a) => a.command === c.name).map((a) => a.keys) }));
  return { rows, actions: UI_ACTIONS.map((a) => ({ id: a.id, label: a.label, keys: a.keys, command: a.command, ok: !!registry.get(a.command) })), violations, unknown, actionsMissing, stats: { commands: commands.length, withUi: rows.filter((r) => r.uiRefs).length, uiActions: UI_ACTIONS.length, uiRefs: [...refs.values()].reduce((s, v) => s + v.length, 0) } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const P = buildParity();
  // tools.generated.js : définitions d'outils MCP (documentation statique)
  writeFileSync(join(root, 'js/mcp/tools.generated.js'), `// Généré par scripts/build-parity.mjs — définitions des ${P.stats.commands} outils MCP (une par commande du registre).\nexport const TOOLS = ${JSON.stringify(registry.toMcpTools('both'), null, 1)};\n`);
  writeFileSync(join(root, 'js/mcp/parity.generated.js'), `// Généré par scripts/build-parity.mjs\nexport const PARITY = ${JSON.stringify({ ...P, rows: P.rows }, null, 0)};\n`);
  let md = `# Parité UI ⇄ MCP — Motion Studio\n\n> Généré automatiquement par \`npm run build:parity\` (scripts/build-parity.mjs) et vérifié par \`tests/parity.test.mjs\`.\n\n`;
  md += `**Principe :** l'interface, les raccourcis, la palette de commandes, \`window.motionAPI\`, WebMCP et le serveur MCP Netlify appellent **exactement les mêmes commandes** du registre (\`js/core/commands\`). Aucune action n'existe uniquement dans l'interface : chaque bouton porte un attribut \`data-cmd\` / appelle \`bus.run(…)\`, et l'UI n'écrit jamais directement dans le store du projet.\n\n`;
  md += `| Indicateur | Valeur |\n|---|---|\n| Commandes / outils MCP | ${P.stats.commands} |\n| Commandes déclenchables depuis l'UI (boutons, menus, champs) | ${P.stats.withUi} (+ toutes via la palette Ctrl+K) |\n| Points d'appel de commandes dans l'UI | ${P.stats.uiRefs} |\n| Actions clavier / palette | ${P.stats.uiActions} |\n| Références UI inconnues | ${P.unknown.length} |\n| Mutations directes du projet par l'UI | ${P.violations.length} |\n\n`;
  md += `## Actions de l'interface (raccourcis & palette) → commandes\n\n| Action UI | Raccourci | Commande MCP | Outil MCP |\n|---|---|---|---|\n`;
  for (const a of P.actions) md += `| ${a.label} | \`${a.keys}\` | \`${a.command}\` | \`${a.command.replace(/\./, '_')}\` |\n`;
  md += `\n## Toutes les commandes et leurs points d'entrée dans l'UI\n\n| Commande | Outil MCP | Environnement | Accès UI |\n|---|---|---|---|\n`;
  for (const r of P.rows) md += `| \`${r.command}\` — ${r.title} | \`${r.tool}\` | ${r.env === 'browser' ? 'onglet' : 'partout (serveur + onglet)'} | ${r.uiRefs ? `${r.uiRefs} point(s)${r.ui.length ? ` : ${r.ui.map((x) => x.replace(/\|/g, '/')).join(' · ')}` : ''}` : 'palette Ctrl+K'}${r.shortcut.length ? ` · \`${r.shortcut.join('`, `')}\`` : ''} |\n`;
  md += `\n## Outils MCP supplémentaires (serveur Netlify, sans navigateur)\n\n\`session_attach\`, \`session_status\`, \`session_get_result\`, \`project_create_from_template\`, \`project_apply_commands\`, \`project_validate_json\`, \`project_diff_json\`, \`catalog_search\`, \`catalog_describe\`, \`project_save_shared\`, \`project_load_shared\`.\n`;
  writeFileSync(join(root, 'PARITY.md'), md);
  console.log(`PARITY.md : ${P.stats.commands} commandes, ${P.stats.withUi} avec accès UI direct, ${P.unknown.length} référence(s) inconnue(s), ${P.violations.length} violation(s).`);
  if (P.unknown.length || P.violations.length || P.actionsMissing.length) {
    console.error(JSON.stringify({ unknown: P.unknown, violations: P.violations, actionsMissing: P.actionsMissing }, null, 2));
    process.exit(1);
  }
}
