# Motion Studio

Éditeur de **motion design 100 % navigateur** : bibliothèque d'éléments, **169 effets/filtres**, **70 transitions**, **104 presets d'animation**, **27 modes de fusion**, **15 templates**, keyframes + éditeur de courbes, expressions, particules, caméra 2.5D, audio-réactivité… rendu **WebGL2 temps réel**, timeline complète, et **export MP4** (WebCodecs H.264 + AAC).

**Règle d'or : tout ce que l'interface permet est aussi faisable par une IA via MCP.** L'UI, les raccourcis, la palette (`Ctrl/Cmd+K`), `window.motionAPI`, WebMCP et le serveur MCP Netlify appellent **exactement les mêmes ~190 commandes** (`js/core/commands`). Voir [PARITY.md](PARITY.md) et la page `/parity`.

Thème noir `#050505` / vert `#24D26D`. Interface en français (i18n prête pour l'anglais). Hébergement : **Netlify uniquement** (site statique + Functions + Blobs), aucune base de données externe, aucune clé d'API.

---

## Déploiement Netlify en 3 étapes

1. **Pousser le dépôt** sur GitHub/GitLab (ou glisser-déposer le dossier dans Netlify — dans ce cas les Functions ne sont pas installées : préférez un dépôt Git).
2. **Netlify → Add new site → Import an existing project** → choisir le dépôt. Les réglages sont lus depuis `netlify.toml` (publish `.`, functions `netlify/functions`, bundler esbuild, en-têtes COOP/COEP). Aucune variable d'environnement n'est nécessaire.
3. **Deploy.** Netlify installe `@netlify/blobs` (package.json) et publie le site, les fonctions `/mcp`, `/api/session`, `/api/share`. Netlify Blobs est activé automatiquement pour le site.

Développement local : `npm run dev` → <http://localhost:8888> (fichiers statiques + fonctions avec stockage mémoire + en-têtes COOP/COEP). `netlify dev` fonctionne aussi.

---

## Utilisation

| Zone | Rôle |
|---|---|
| **Barre du haut** | nom du projet, annuler/rétablir, format, palette, sauvegarde, partage, paramètres, statut MCP, **EXPORTER MP4** |
| **Bibliothèque (gauche)** | Éléments (formes, textes animés, générateurs, shaders, particules, data viz, UI/social, calques spéciaux, audio), Effets, Transitions, Animations (miniatures animées rendues par le moteur réel), Médias (import fichiers/URL/presse-papiers, voix off, bruitages Web Audio, polices, LUT), Templates, Projets |
| **Viewport** | rendu temps réel, gizmos (déplacement, échelle, rotation, ancre, inclinaison, Bézier), outils V/T/R/E/P/H, guides intelligents, règles, grille, zones de sécurité, damier, qualité Auto/Pleine/Demi/Quart, avant/après, isolation, vues alpha/histogramme/forme d'onde/vectorscope |
| **Inspecteur (droite)** | propriétés générées par schéma ; ◆ = keyframe ; clic droit = expression, pickwhip, audio-réactivité ; effets empilables (glisser pour réordonner), masques, matte, transitions, animation, temps & vitesse, suivi de mouvement · onglets Contrôles, Historique, MCP, Console, Scopes |
| **Timeline (bas)** | règle timecode, pistes (muet/solo/verrou/masquage, réordonnancement, groupes), clips (glisser, rogner, couper `S`, Alt+glisser = dupliquer, magnétisme, lasso), keyframes, transitions, marqueurs, zone de travail, formes d'onde, filmstrips, barre de cache, éditeur de courbes |

Raccourcis principaux : `Espace` lecture · `J/K/L` · `←/→` (±1 image, `Maj` ±10) · `S` couper · `Suppr` · `Maj+Suppr` ripple delete · `Ctrl+D/C/V/X` · `Ctrl+Z / Ctrl+Maj+Z` · `Ctrl+K` palette · `Ctrl+S` · `Ctrl+E` export · `M` marqueur · `I/O` zone de travail · `+/-` zoom · `\` ajuster · `V/T/R/E/P/H` outils · `Alt+K` (ou `K` à l'arrêt) keyframe · `F9` easing doux · `Ctrl+G` grouper · `Ctrl+Maj+C` précomposer. Tous personnalisables (`Ctrl+/`).

**Persistance** : IndexedDB (projets) + OPFS (médias, repli IndexedDB), autosauvegarde toutes les 5 s et à la fermeture. Export/import `.motion.json` (médias embarqués en base64 en option) ou `.motion.zip`.

**Export** : MP4 (H.264 + AAC), WebM (VP9 + Opus), GIF, séquence PNG (zip), image PNG/JPG. Rendu **image par image déterministe** (identique à la preview), audio mixé hors-ligne (`OfflineAudioContext`), flou de mouvement réel optionnel (4–16 sous-échantillons), écriture en streaming sur disque (File System Access) ou en mémoire, validation des boîtes MP4 (durée, pistes) avant téléchargement. Chaîne de repli : **(1) WebCodecs + mp4-muxer → (2) MediaRecorder MP4 → (3) MediaRecorder WebM → ffmpeg.wasm → MP4**. Les capacités détectées sont affichées dans la fenêtre d'export.

---

## Mode MCP : piloter Motion Studio avec une IA

### A. `window.motionAPI` (agents navigateur, ex. Claude in Chrome)

```js
await motionAPI.listCommands()                         // ~190 commandes + JSON Schemas
await motionAPI.run('clip.add', { kind: 'text', props: { text: 'Bonjour' } })
await motionAPI.batch([{ name: 'clip.add', args: { kind: 'shape' } }, { name: 'effect.add', args: { type: 'glow' } }]) // 1 seul undo
await motionAPI.getFrame(1.5, { format: 'png', width: 960 })   // dataURL
await motionAPI.getFrames([0.5, 1, 2, 3])                      // planche contact
await motionAPI.export({ format: 'mp4' })                      // {ok, filename, size, blobUrl, durationSec, validation}
motionAPI.on('progress', (s) => console.log(s.progress))
```

### B. WebMCP natif

Si `navigator.modelContext` existe, chaque commande est enregistrée comme outil MCP (`registerTool` ou `provideContext`), avec description FR/EN et `inputSchema`. Statut et journal des appels dans l'onglet **MCP** (bouton « Tester » par outil).

### C. Serveur MCP distant (Netlify, Streamable HTTP)

- URL : `https://VOTRE-SITE.netlify.app/mcp` (JSON-RPC 2.0 : `initialize`, `tools/list`, `tools/call`, `resources/list|read`, `resources/templates/list`, `prompts/list|get`, `ping`).
- **Sans navigateur** : `project_create_from_template`, `project_apply_commands` (applique n'importe quelle liste de commandes à un projet JSON, atomique), `project_validate_json`, `project_diff_json`, `catalog_search`, `catalog_describe`, `project_save_shared` / `project_load_shared` (Netlify Blobs). Une IA peut donc construire un projet entièrement en JSON puis l'ouvrir via le lien partagé.
- **Avec onglet** (rendu, lecture, export) : dans le site, onglet **MCP → « Ouvrir une session »**. Connectez le client à `https://VOTRE-SITE.netlify.app/mcp?session=ID` **ou** appelez `session_attach({ code })` avec le code d'appairage à 6 chiffres. Tous les outils (`render_frame`, `render_contact_sheet`, `project_lint`, `export_start`, `export_status`, `export_get_result`…) agissent alors sur l'onglet via un relais (file d'appels dans Netlify Blobs, long-polling de l'onglet).
- Ressources : `motion://project/current`, `motion://catalog/effects`, `motion://catalog/transitions`, `motion://catalog/presets`, `motion://catalog/templates`, `motion://docs/schema`, `motion://docs/commands`, `motion://frame/{t}`.
- Prompts : `create_intro`, `lyric_video`, `product_ad`, `social_story`, `logo_reveal`, `fix_project`, `beat_sync_edit`.

> **Important : le rendu MP4 se fait dans le navigateur ; l'onglet doit rester ouvert (et de préférence au premier plan) pendant l'export.** `export_start` répond immédiatement ; suivez avec `export_status` puis récupérez le fichier avec `export_get_result({ base64: true })` (≤ 25 Mo) ou le lien blob local.

Exemple de configuration de client MCP (HTTP) :

```json
{ "mcpServers": { "motion-studio": { "type": "http", "url": "https://VOTRE-SITE.netlify.app/mcp?session=ID_DE_SESSION" } } }
```

Flux type pour une IA : `project_new` → `clip_add` / `effect_add` / `animation_apply_preset` / `transition_add` → `render_contact_sheet` (vérifier visuellement) → `project_lint` (corriger) → `export_start` → `export_status` → `export_get_result`.

**Sécurité** : jeton de session aléatoire (expiration 12 h) pour l'onglet, code d'appairage expirant, limitation de débit par IP, limites de taille des corps (6 Mo MCP, 4,5 Mo partage), aucune exécution de code arbitraire côté serveur. Les expressions JS s'exécutent uniquement dans le navigateur dans une portée fermée (Proxy, filtrage lexical) ; `app.run_script` exécute le JS utilisateur dans un **Worker isolé** qui ne peut que collecter des appels `run(name, args)`, ensuite validés par le CommandBus.

---

## Architecture

```
UI / Raccourcis / Palette ──┐
WebMCP (navigator.modelContext) ──┼──► CommandBus ──► ProjectStore (JSON) ──► Renderer / Timeline / Export
window.motionAPI ───────────┤            │
Relais MCP distant (Netlify) ┘            └──► Historique undo/redo (patchs JSON + inverses) + événements
```

- `js/core/` : store, CommandBus (validation JSON Schema, transactions atomiques, patchs/inverses), registre, historique, schéma + `validateProject()`, évaluation (keyframes, expressions, chemins, audio), expressions sandboxées, géométrie de tracés. **Aucune dépendance au DOM** : réutilisé tel quel par les Netlify Functions.
- `js/catalog/` : effets (GLSL), transitions (GLSL), générateurs, shaders prêts à l'emploi, LUT, easings, presets d'animation et d'effets, modes de fusion, éléments.
- `js/render/` : `Renderer` WebGL2 (FBO flottants en pool, espace linéaire, alpha prémultiplié, mipmaps), dessin Canvas 2D (formes, texte, data viz, UI…) rasterisé à la résolution de sortie, particules analytiques, médias.
  Ordre : calque → effets → masques → transition → track matte → profondeur de champ → fusion → calques d'ajustement → caméra → sortie sRGB.
- `js/timeline/`, `js/ui/` : interface (aucune logique métier : l'UI appelle des commandes et s'abonne à l'état).
- `js/audio/` : analyse (FFT, 16 bandes), beats, bruitages synthétiques, mixage preview / hors-ligne.
- `js/export/` : exporteur, WebCodecs, muxers, MediaRecorder, ffmpeg.wasm, GIF, ZIP.
- `js/mcp/` : `motionAPI`, WebMCP, relais distant, `tools.generated.js`, `parity.generated.js`.
- `js/storage/` : IndexedDB, OPFS, projets. `js/templates/` : 15 templates (`.json` + module généré).
- `netlify/functions/` : `mcp.mjs`, `session.mjs`, `share.mjs` ; `netlify/lib/` : serveur MCP, sessions, stockage Blobs.
- `vendor/` : mp4-muxer, webm-muxer, lottie-web (canvas), ffmpeg.wasm (core ≈ 31 Mo, chargé à la demande), polices Inter et JetBrains Mono.

## Tests

```bash
npm test                    # cœur, parité UI⇄MCP, serveur MCP (Node, sans navigateur)
npm run build:parity        # régénère PARITY.md + tools.generated.js (échoue si une action UI n'a pas de commande)
npm run build:templates     # régénère les 15 templates via la couche de commandes
npm i -D playwright-core && npm run test:browser   # shaders (263 programmes), déterminisme, non-régression visuelle, export MP4/GIF, démarrage
```

Pages de test : `/tests/shaders.html`, `/tests/render.html`, `/tests/templates.html`, `/tests/visual.html`, `/tests/export.html`, `/parity`.

## Limites connues

- **Navigateurs** : Chrome/Edge recommandés (WebCodecs H.264/AAC, File System Access, OPFS). Firefox : WebCodecs sans AAC → audio Opus dans le MP4 (lisible par VLC et les navigateurs, moins par QuickTime). Safari : WebCodecs vidéo récent ; sinon repli MediaRecorder MP4. Les Chromium sans codecs propriétaires (ex. builds de test) utilisent VP9 dans le MP4.
- **Le rendu et l'export ont lieu dans l'onglet** ; le serveur MCP ne fait que relayer (pas de rendu côté serveur). Durée d'une requête MCP relayée ≈ 8,5 s max (limite des fonctions Netlify) : au-delà, `session_get_result` récupère le résultat.
- **Partage** : seul le JSON du projet est stocké (≤ 4,5 Mo, 30 jours) ; les médias binaires restent sur l'appareil (utilisez `.motion.zip` pour tout transporter).
- Vidéo : formats décodables par le navigateur (MP4/WebM, MOV selon codec). Le seek image par image à l'export est exact mais plus lent que la lecture.
- Suivi de mouvement : correspondance de motif simple (pas d'occlusion) ; la suppression d'arrière-plan est par chroma/luma (pas de segmentation de personne embarquée).
- Lottie : lecture via lottie-web (rendu canvas, déterministe), sans conversion en calques éditables.
- 3D : primitives en projection perspective (Canvas 2D), pas de moteur 3D complet ; caméra 2.5D (Z, parallaxe, profondeur de champ).
- Empreintes de non-régression visuelle dépendantes du GPU : régénérer avec `node scripts/browser-tests.mjs --update` sur la machine de référence.
- `ffmpeg.wasm` (31 Mo) n'est téléchargé que si le repli n°3 est nécessaire.
