// Généré par scripts/build-parity.mjs — définitions des 190 outils MCP (une par commande du registre).
export const TOOLS = [
 {
  "name": "project_new",
  "title": "Nouveau projet",
  "description": "Nouveau projet — crée un projet vide (format, fps, durée, fond) / New project",
  "inputSchema": {
   "type": "object",
   "properties": {
    "name": {
     "type": "string",
     "description": "Nom du projet"
    },
    "width": {
     "type": "integer",
     "description": "Largeur",
     "minimum": 16,
     "maximum": 7680
    },
    "height": {
     "type": "integer",
     "description": "Hauteur",
     "minimum": 16,
     "maximum": 7680
    },
    "fps": {
     "type": "number",
     "description": "Images par seconde",
     "minimum": 1,
     "maximum": 120
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0,
     "maximum": 3600
    },
    "background": {
     "type": "string",
     "description": "Couleur de fond"
    },
    "preset": {
     "type": "string",
     "enum": [
      "1080p",
      "4k",
      "720p",
      "vertical",
      "square",
      "4:5",
      "21:9",
      "1440p"
     ],
     "description": "Préset de format"
    },
    "template": {
     "type": "string",
     "description": "Identifiant de template à appliquer"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_open",
  "title": "Ouvrir un projet enregistré localement",
  "description": "Ouvrir un projet enregistré localement (IndexedDB) / Open a locally saved project [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Identifiant du projet"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "project_save",
  "title": "Enregistrer le projet",
  "description": "Enregistrer le projet (IndexedDB/OPFS) / Save project [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "project_duplicate",
  "title": "Dupliquer le projet courant",
  "description": "Dupliquer le projet courant (nouvel identifiant) / Duplicate project",
  "inputSchema": {
   "type": "object",
   "properties": {
    "name": {
     "type": "string",
     "description": "Nom de la copie"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_rename",
  "title": "Renommer le projet",
  "description": "Renommer le projet / Rename project",
  "inputSchema": {
   "type": "object",
   "properties": {
    "name": {
     "type": "string",
     "description": "Nouveau nom",
     "minLength": 1
    }
   },
   "required": [
    "name"
   ]
  }
 },
 {
  "name": "project_set_format",
  "title": "Format du projet",
  "description": "Format du projet — largeur, hauteur, fps, durée, fond, préset / Set project format",
  "inputSchema": {
   "type": "object",
   "properties": {
    "width": {
     "type": "integer",
     "description": "Largeur",
     "minimum": 16,
     "maximum": 7680
    },
    "height": {
     "type": "integer",
     "description": "Hauteur",
     "minimum": 16,
     "maximum": 7680
    },
    "fps": {
     "type": "number",
     "description": "FPS",
     "minimum": 1,
     "maximum": 120
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0,
     "maximum": 3600
    },
    "background": {
     "type": "string",
     "description": "Couleur de fond"
    },
    "preset": {
     "type": "string",
     "enum": [
      "1080p",
      "4k",
      "720p",
      "vertical",
      "square",
      "4:5",
      "21:9",
      "1440p"
     ],
     "description": "Préset"
    },
    "sampleRate": {
     "type": "integer",
     "description": "Fréquence audio"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_set_motion_blur",
  "title": "Flou de mouvement réel à l'export",
  "description": "Flou de mouvement réel à l'export (sous-échantillonnage temporel) / Export motion blur",
  "inputSchema": {
   "type": "object",
   "properties": {
    "enabled": {
     "type": "boolean",
     "description": "Activer"
    },
    "samples": {
     "type": "integer",
     "description": "Échantillons (4-16)",
     "minimum": 2,
     "maximum": 16
    },
    "shutter": {
     "type": "number",
     "description": "Angle d'obturateur (°)",
     "minimum": 0,
     "maximum": 720
    }
   },
   "required": []
  }
 },
 {
  "name": "project_import_json",
  "title": "Importer un projet complet depuis du JSON",
  "description": "Importer un projet complet depuis du JSON (.motion.json) / Import project JSON",
  "inputSchema": {
   "type": "object",
   "properties": {
    "project": {
     "description": "Objet projet ou chaîne JSON"
    }
   },
   "required": [
    "project"
   ]
  }
 },
 {
  "name": "project_export_json",
  "title": "Exporter le projet en JSON",
  "description": "Exporter le projet en JSON (option : assets embarqués en base64, téléchargement) / Export project JSON",
  "inputSchema": {
   "type": "object",
   "properties": {
    "embedAssets": {
     "type": "boolean",
     "description": "Embarquer les médias en base64"
    },
    "download": {
     "type": "boolean",
     "description": "Déclencher un téléchargement (navigateur)"
    },
    "zip": {
     "type": "boolean",
     "description": "Archive .zip (projet + médias)"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_list",
  "title": "Lister les projets enregistrés localement",
  "description": "Lister les projets enregistrés localement / List saved projects [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "project_delete",
  "title": "Supprimer un projet enregistré",
  "description": "Supprimer un projet enregistré / Delete saved project [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Identifiant"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "project_validate",
  "title": "Valider le projet contre le JSON Schema",
  "description": "Valider le projet contre le JSON Schema / Validate project against JSON Schema",
  "inputSchema": {
   "type": "object",
   "properties": {
    "project": {
     "description": "Projet à valider (défaut : projet courant)"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_schema",
  "title": "Obtenir le JSON Schema du projet",
  "description": "Obtenir le JSON Schema du projet / Get project JSON Schema",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "project_diff",
  "title": "Différences JSON entre deux projets",
  "description": "Différences JSON entre deux projets (ou avec le projet courant) / Diff two projects",
  "inputSchema": {
   "type": "object",
   "properties": {
    "a": {
     "description": "Projet A (défaut : courant)"
    },
    "b": {
     "description": "Projet B"
    }
   },
   "required": [
    "b"
   ]
  }
 },
 {
  "name": "project_describe",
  "title": "Décrire la scène en texte à l'instant t",
  "description": "Décrire la scène en texte à l'instant t (pour une IA) / Describe the scene at time t",
  "inputSchema": {
   "type": "object",
   "properties": {
    "t": {
     "type": "number",
     "description": "Instant (s)",
     "minimum": 0
    }
   },
   "required": []
  }
 },
 {
  "name": "project_lint",
  "title": "Analyser le projet",
  "description": "Analyser le projet : hors cadre, texte illisible, audio saturé, assets manquants, durée, shaders / Lint project",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "project_get",
  "title": "Obtenir le JSON complet du projet courant",
  "description": "Obtenir le JSON complet du projet courant / Get current project JSON",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "project_save_shared",
  "title": "Partager",
  "description": "Partager : stocker le projet dans Netlify Blobs et obtenir un lien / Share project via Netlify Blobs",
  "inputSchema": {
   "type": "object",
   "properties": {
    "project": {
     "description": "Projet (défaut : courant)"
    }
   },
   "required": []
  }
 },
 {
  "name": "project_load_shared",
  "title": "Charger un projet partagé",
  "description": "Charger un projet partagé (Netlify Blobs) par identifiant / Load shared project",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Identifiant de partage"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "template_list",
  "title": "Lister les templates de projet",
  "description": "Lister les templates de projet / List project templates",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "template_apply",
  "title": "Appliquer un template",
  "description": "Appliquer un template (remplace le projet courant) / Apply a template",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Identifiant du template"
    },
    "keepFormat": {
     "type": "boolean",
     "description": "Conserver le format actuel"
    },
    "name": {
     "type": "string",
     "description": "Nom du projet"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "asset_import_url",
  "title": "Importer un média depuis une URL",
  "description": "Importer un média depuis une URL (CORS requis) / Import media from URL [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "url": {
     "type": "string",
     "description": "URL"
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "type": {
     "type": "string",
     "enum": [
      "image",
      "video",
      "audio",
      "svg",
      "lottie",
      "font",
      "lut"
     ],
     "description": "Type forcé"
    }
   },
   "required": [
    "url"
   ]
  }
 },
 {
  "name": "asset_import_base64",
  "title": "Importer un média encodé en base64",
  "description": "Importer un média encodé en base64 (data URL ou base64 brut + mime) / Import base64 media [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "data": {
     "type": "string",
     "description": "Base64 ou data URL"
    },
    "name": {
     "type": "string",
     "description": "Nom du fichier"
    },
    "mime": {
     "type": "string",
     "description": "Type MIME (ex. image/png)"
    }
   },
   "required": [
    "data",
    "name"
   ]
  }
 },
 {
  "name": "asset_import_file",
  "title": "Importer un fichier choisi/déposé par l'utilisateur",
  "description": "Importer un fichier choisi/déposé par l'utilisateur (jeton de fichier) / Import a user-picked file [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "token": {
     "type": "string",
     "description": "Jeton du fichier (fourni par l'UI)"
    }
   },
   "required": [
    "token"
   ]
  }
 },
 {
  "name": "asset_import_text",
  "title": "Importer un asset texte",
  "description": "Importer un asset texte : SVG, Lottie JSON, JSON, CSV ou LUT .cube / Import text asset (svg/lottie/json/csv/cube)",
  "inputSchema": {
   "type": "object",
   "properties": {
    "text": {
     "type": "string",
     "description": "Contenu",
     "maxLength": 4000000
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "type": {
     "type": "string",
     "enum": [
      "svg",
      "lottie",
      "json",
      "csv",
      "lut"
     ],
     "description": "Type"
    }
   },
   "required": [
    "text",
    "type"
   ]
  }
 },
 {
  "name": "asset_list",
  "title": "Lister les assets du projet",
  "description": "Lister les assets du projet (avec usage) / List project assets",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {
     "type": "string",
     "description": "Filtrer par type"
    }
   },
   "required": []
  }
 },
 {
  "name": "asset_rename",
  "title": "Renommer un asset",
  "description": "Renommer un asset / Rename asset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Asset"
    },
    "name": {
     "type": "string",
     "description": "Nom",
     "minLength": 1
    }
   },
   "required": [
    "id",
    "name"
   ]
  }
 },
 {
  "name": "asset_delete",
  "title": "Supprimer un asset",
  "description": "Supprimer un asset (refusé s'il est utilisé, sauf force) / Delete asset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Asset"
    },
    "force": {
     "type": "boolean",
     "description": "Supprimer aussi les clips qui l'utilisent"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "asset_replace",
  "title": "Remplacer le média d'un asset sans casser les liens",
  "description": "Remplacer le média d'un asset sans casser les liens (par un autre asset, une URL ou du base64) / Replace asset media",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Asset à remplacer"
    },
    "withId": {
     "type": "string",
     "description": "Asset source"
    },
    "url": {
     "type": "string",
     "description": "URL"
    },
    "data": {
     "type": "string",
     "description": "Base64"
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "mime": {
     "type": "string",
     "description": "MIME"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "asset_usage",
  "title": "Voir quels clips utilisent un asset",
  "description": "Voir quels clips utilisent un asset / Asset usage",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Asset"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "asset_generate_sfx",
  "title": "Générer un bruitage synthétique",
  "description": "Générer un bruitage synthétique (Web Audio) : whoosh, pop, click, riser, impact… / Generate a synthesized SFX [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {
     "type": "string",
     "enum": [
      "whoosh",
      "pop",
      "click",
      "riser",
      "impact",
      "swoosh",
      "ding",
      "glitch",
      "beep",
      "drum",
      "bass",
      "sparkle"
     ],
     "description": "Type de son"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "minimum": 0.05,
     "maximum": 10
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "addToTimeline": {
     "type": "boolean",
     "description": "Ajouter aussi un clip audio"
    },
    "at": {
     "type": "number",
     "description": "Instant d'insertion (s)",
     "minimum": 0
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "asset_record_voice",
  "title": "Enregistrer une voix off au micro",
  "description": "Enregistrer une voix off au micro (getUserMedia) / Record voice-over [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "seconds": {
     "type": "number",
     "description": "Durée max (s)",
     "minimum": 1,
     "maximum": 600
    },
    "addToTimeline": {
     "type": "boolean",
     "description": "Ajouter à la timeline"
    },
    "at": {
     "type": "number",
     "description": "Instant (s)"
    }
   },
   "required": []
  }
 },
 {
  "name": "font_list",
  "title": "Lister les polices disponibles",
  "description": "Lister les polices disponibles (système + importées) / List fonts",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "font_load_url",
  "title": "Charger une police depuis une URL",
  "description": "Charger une police depuis une URL (.ttf/.otf/.woff2) / Load font from URL [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "url": {
     "type": "string",
     "description": "URL"
    },
    "family": {
     "type": "string",
     "description": "Nom de famille"
    }
   },
   "required": [
    "url",
    "family"
   ]
  }
 },
 {
  "name": "lut_import",
  "title": "Importer une LUT 3D",
  "description": "Importer une LUT 3D (.cube) en texte — utilisable via l'effet \"LUT 3D importée\" / Import 3D LUT (.cube)",
  "inputSchema": {
   "type": "object",
   "properties": {
    "text": {
     "type": "string",
     "description": "Contenu .cube",
     "maxLength": 8000000
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "applyTo": {
     "type": "string",
     "description": "Clip auquel ajouter l'effet"
    }
   },
   "required": [
    "text"
   ]
  }
 },
 {
  "name": "track_add",
  "title": "Ajouter une piste",
  "description": "Ajouter une piste (vidéo, audio, texte, formes, effets, ajustement, caméra) / Add track",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {
     "type": "string",
     "enum": [
      "video",
      "audio",
      "text",
      "shape",
      "effect",
      "adjustment",
      "camera"
     ],
     "description": "Type de piste"
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "index": {
     "type": "integer",
     "description": "Position (0 = haut)",
     "minimum": 0
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "track_remove",
  "title": "Supprimer une piste et ses clips",
  "description": "Supprimer une piste et ses clips / Remove track",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Piste"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "track_rename",
  "title": "Renommer une piste",
  "description": "Renommer une piste / Rename track",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Piste"
    },
    "name": {
     "type": "string",
     "description": "Nom",
     "minLength": 1
    }
   },
   "required": [
    "id",
    "name"
   ]
  }
 },
 {
  "name": "track_reorder",
  "title": "Déplacer une piste à un nouvel index",
  "description": "Déplacer une piste à un nouvel index (0 = haut, rendu au-dessus) / Reorder track",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Piste"
    },
    "index": {
     "type": "integer",
     "description": "Nouvel index",
     "minimum": 0
    }
   },
   "required": [
    "id",
    "index"
   ]
  }
 },
 {
  "name": "track_set",
  "title": "Propriétés de piste",
  "description": "Propriétés de piste : muet, solo, verrou, masquée, couleur, hauteur, repliée / Set track properties",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Piste"
    },
    "muted": {
     "type": "boolean",
     "description": "Muet"
    },
    "solo": {
     "type": "boolean",
     "description": "Solo"
    },
    "locked": {
     "type": "boolean",
     "description": "Verrouillée"
    },
    "hidden": {
     "type": "boolean",
     "description": "Masquée"
    },
    "color": {
     "type": "string",
     "description": "Couleur"
    },
    "height": {
     "type": "number",
     "description": "Hauteur (px)",
     "minimum": 24,
     "maximum": 200
    },
    "collapsed": {
     "type": "boolean",
     "description": "Repliée"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "track_group",
  "title": "Grouper des pistes",
  "description": "Grouper des pistes (repli commun) / Group tracks",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "description": "Pistes",
     "items": {
      "type": "string"
     }
    },
    "name": {
     "type": "string",
     "description": "Nom du groupe"
    }
   },
   "required": [
    "ids"
   ]
  }
 },
 {
  "name": "track_ungroup",
  "title": "Dégrouper des pistes",
  "description": "Dégrouper des pistes / Ungroup tracks",
  "inputSchema": {
   "type": "object",
   "properties": {
    "groupId": {
     "type": "string",
     "description": "Groupe"
    }
   },
   "required": [
    "groupId"
   ]
  }
 },
 {
  "name": "track_list",
  "title": "Lister les pistes",
  "description": "Lister les pistes / List tracks",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "clip_add",
  "title": "Ajouter un élément / clip sur la timeline",
  "description": "Ajouter un élément / clip sur la timeline (tous les types : forme, texte, média, particules, générateur, shader, data viz, UI, 3D, caméra…) / Add a clip/element",
  "inputSchema": {
   "type": "object",
   "properties": {
    "kind": {
     "type": "string",
     "enum": [
      "shape",
      "text",
      "image",
      "video",
      "audio",
      "svg",
      "lottie",
      "particles",
      "generator",
      "shader",
      "group",
      "adjustment",
      "null",
      "camera",
      "light",
      "3d",
      "chart",
      "code",
      "counter",
      "progress",
      "clock",
      "ui",
      "audioviz",
      "mockup"
     ],
     "description": "Type d'élément"
    },
    "library": {
     "type": "string",
     "description": "Identifiant d'un élément de la bibliothèque (alternative à kind)"
    },
    "trackId": {
     "type": "string",
     "description": "Piste (auto si absent)"
    },
    "start": {
     "type": "number",
     "description": "Début (s)",
     "minimum": 0
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "props": {
     "type": "object",
     "description": "Propriétés spécifiques au type (voir clip.kinds)",
     "properties": {}
    },
    "transform": {
     "type": "object",
     "description": "Transformation {x,y,scale,rotation,opacity,anchorX,anchorY,…} (x,y relatifs au centre)",
     "properties": {}
    },
    "effects": {
     "type": "array",
     "description": "Effets [{type, params}]",
     "items": {
      "type": "object"
     }
    },
    "keyframes": {
     "type": "object",
     "description": "Keyframes {chemin: [{t,v,easing}]}",
     "properties": {}
    },
    "expressions": {
     "type": "object",
     "description": "Expressions {chemin: code}",
     "properties": {}
    },
    "blendMode": {
     "type": "string",
     "description": "Mode de fusion"
    },
    "transitionIn": {
     "type": "object",
     "description": "Transition d'entrée {type,duration}",
     "properties": {}
    },
    "transitionOut": {
     "type": "object",
     "description": "Transition de sortie {type,duration}",
     "properties": {}
    },
    "parentId": {
     "type": "string",
     "description": "Parent"
    },
    "select": {
     "type": "boolean",
     "description": "Sélectionner le clip créé"
    },
    "id": {
     "type": "string",
     "description": "Identifiant imposé (optionnel)"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_remove",
  "title": "Supprimer des clips",
  "description": "Supprimer des clips / Remove clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_ripple_delete",
  "title": "Suppression avec propagation",
  "description": "Suppression avec propagation (décale les clips suivants de la piste) / Ripple delete",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_update",
  "title": "Mettre à jour un clip par fusion profonde d'un patch",
  "description": "Mettre à jour un clip par fusion profonde d'un patch (props, transform, nom, timing…) / Update clip (deep merge)",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "patch": {
     "type": "object",
     "description": "Patch à fusionner",
     "properties": {}
    }
   },
   "required": [
    "id",
    "patch"
   ]
  }
 },
 {
  "name": "clip_set",
  "title": "Définir une propriété par chemin",
  "description": "Définir une propriété par chemin (ex. props.fontSize, transform.x, effects.<id>.params.amount) — crée une keyframe si la propriété est animée / Set a property by path",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "value": {
     "description": "Valeur"
    },
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Plusieurs clips (optionnel)"
    },
    "t": {
     "type": "number",
     "description": "Instant local (s) pour la keyframe"
    }
   },
   "required": [
    "path"
   ]
  }
 },
 {
  "name": "clip_move",
  "title": "Déplacer des clips dans le temps et/ou vers une autre piste",
  "description": "Déplacer des clips dans le temps et/ou vers une autre piste / Move clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "start": {
     "type": "number",
     "description": "Nouveau début du 1er clip (s)",
     "minimum": 0
    },
    "delta": {
     "type": "number",
     "description": "Décalage (s)"
    },
    "trackId": {
     "type": "string",
     "description": "Piste cible"
    },
    "trackDelta": {
     "type": "integer",
     "description": "Décalage de piste (+ = vers le bas)"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_trim",
  "title": "Rogner un clip par son bord d'entrée",
  "description": "Rogner un clip par son bord d'entrée (in) ou de sortie (out) à l'instant donné / Trim clip edge",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "edge": {
     "type": "string",
     "enum": [
      "in",
      "out"
     ],
     "description": "Bord"
    },
    "time": {
     "type": "number",
     "description": "Nouvel instant du bord (s, composition)",
     "minimum": 0
    }
   },
   "required": [
    "id",
    "edge",
    "time"
   ]
  }
 },
 {
  "name": "clip_set_duration",
  "title": "Définir la durée d'un clip",
  "description": "Définir la durée d'un clip / Set clip duration",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0
    }
   },
   "required": [
    "id",
    "duration"
   ]
  }
 },
 {
  "name": "clip_split",
  "title": "Couper les clips à la tête de lecture",
  "description": "Couper les clips à la tête de lecture (ou à t) / Split clips at playhead",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Clips (défaut : sélection, sinon tous ceux sous la tête de lecture)"
    },
    "t": {
     "type": "number",
     "description": "Instant (s)",
     "minimum": 0
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_duplicate",
  "title": "Dupliquer des clips",
  "description": "Dupliquer des clips (placés juste après) / Duplicate clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "offset": {
     "type": "number",
     "description": "Décalage temporel (défaut : durée du clip)"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_copy",
  "title": "Copier des clips dans le presse-papiers",
  "description": "Copier des clips dans le presse-papiers (inter-projets) / Copy clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_cut",
  "title": "Couper",
  "description": "Couper (copier puis supprimer) des clips / Cut clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_paste",
  "title": "Coller les clips du presse-papiers à la tête de lecture",
  "description": "Coller les clips du presse-papiers à la tête de lecture (ou à t) / Paste clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "t": {
     "type": "number",
     "description": "Instant (s)",
     "minimum": 0
    },
    "trackId": {
     "type": "string",
     "description": "Piste cible"
    },
    "data": {
     "type": "object",
     "description": "Contenu de presse-papiers explicite",
     "properties": {}
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_set_speed",
  "title": "Vitesse constante du clip",
  "description": "Vitesse constante du clip (0.1x – 10x) / Set clip speed",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "speed": {
     "type": "number",
     "description": "Vitesse",
     "minimum": 0.1,
     "maximum": 10
    },
    "keepDuration": {
     "type": "boolean",
     "description": "Conserver la durée sur la timeline"
    }
   },
   "required": [
    "id",
    "speed"
   ]
  }
 },
 {
  "name": "clip_reverse",
  "title": "Inverser la lecture du clip",
  "description": "Inverser la lecture du clip / Reverse clip",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "reverse": {
     "type": "boolean",
     "description": "Inversé"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "clip_time_remap",
  "title": "Time remap",
  "description": "Time remap : courbe temps local → temps source [{t, v}] / Time remap curve",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "enabled": {
     "type": "boolean",
     "description": "Activé"
    },
    "keys": {
     "type": "array",
     "description": "Clés {t (local), v (temps source), easing}",
     "items": {
      "type": "object"
     }
    },
    "preset": {
     "type": "string",
     "enum": [
      "slowmo-middle",
      "speed-ramp",
      "freeze-end",
      "rewind"
     ],
     "description": "Préset de courbe"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "clip_set_blend_mode",
  "title": "Mode de fusion du clip",
  "description": "Mode de fusion du clip (27 modes) / Set blend mode",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "mode": {
     "type": "string",
     "enum": [
      "normal",
      "dissolve",
      "darken",
      "multiply",
      "colorBurn",
      "linearBurn",
      "darkerColor",
      "lighten",
      "screen",
      "colorDodge",
      "add",
      "lighterColor",
      "overlay",
      "softLight",
      "hardLight",
      "vividLight",
      "linearLight",
      "pinLight",
      "hardMix",
      "difference",
      "exclusion",
      "subtract",
      "divide",
      "hue",
      "saturation",
      "color",
      "luminosity"
     ],
     "description": "Mode"
    }
   },
   "required": [
    "mode"
   ]
  }
 },
 {
  "name": "clip_set_parent",
  "title": "Parentage",
  "description": "Parentage : lier la transformation d'un clip à un parent (ou null) / Set parent",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip enfant"
    },
    "parentId": {
     "type": [
      "string",
      "null"
     ],
     "description": "Parent (null pour délier)"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "clip_precompose",
  "title": "Précomposer des clips dans un groupe",
  "description": "Précomposer des clips dans un groupe (composition imbriquée) / Precompose clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "name": {
     "type": "string",
     "description": "Nom de la précomposition"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_group",
  "title": "Grouper des clips",
  "description": "Grouper des clips (crée une précomposition) / Group clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "name": {
     "type": "string",
     "description": "Nom du groupe"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_ungroup",
  "title": "Dégrouper / extraire le contenu d'une précomposition",
  "description": "Dégrouper / extraire le contenu d'une précomposition / Ungroup",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip groupe"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_align",
  "title": "Aligner des clips dans le cadre",
  "description": "Aligner des clips dans le cadre (gauche, centre, droite, haut, milieu, bas) / Align clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "to": {
     "type": "string",
     "enum": [
      "left",
      "center",
      "right",
      "top",
      "middle",
      "bottom"
     ],
     "description": "Alignement"
    },
    "relative": {
     "type": "string",
     "enum": [
      "comp",
      "selection"
     ],
     "description": "Référence"
    }
   },
   "required": [
    "to"
   ]
  }
 },
 {
  "name": "clip_distribute",
  "title": "Répartir des clips uniformément",
  "description": "Répartir des clips uniformément (x, y ou dans le temps) / Distribute clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "axis": {
     "type": "string",
     "enum": [
      "x",
      "y",
      "time"
     ],
     "description": "Axe"
    },
    "gap": {
     "type": "number",
     "description": "Écart fixe (optionnel)"
    }
   },
   "required": [
    "axis"
   ]
  }
 },
 {
  "name": "clip_set_transform",
  "title": "Transformation",
  "description": "Transformation : x, y (relatifs au centre), z, échelle, rotation, rotations 3D, skew, ancre, opacité — crée des keyframes si animé / Set transform",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Plusieurs clips"
    },
    "x": {
     "type": "number",
     "description": "X (px depuis le centre)"
    },
    "y": {
     "type": "number",
     "description": "Y (px depuis le centre)"
    },
    "z": {
     "type": "number",
     "description": "Z (profondeur caméra)"
    },
    "scale": {
     "type": "number",
     "description": "Échelle"
    },
    "scaleX": {
     "type": "number",
     "description": "Échelle X"
    },
    "scaleY": {
     "type": "number",
     "description": "Échelle Y"
    },
    "rotation": {
     "type": "number",
     "description": "Rotation (°)"
    },
    "rotationX": {
     "type": "number",
     "description": "Rotation X 3D (°)"
    },
    "rotationY": {
     "type": "number",
     "description": "Rotation Y 3D (°)"
    },
    "skewX": {
     "type": "number",
     "description": "Inclinaison X (°)"
    },
    "skewY": {
     "type": "number",
     "description": "Inclinaison Y (°)"
    },
    "anchorX": {
     "type": "number",
     "description": "Ancre X (0-1)"
    },
    "anchorY": {
     "type": "number",
     "description": "Ancre Y (0-1)"
    },
    "opacity": {
     "type": "number",
     "description": "Opacité (0-1)",
     "minimum": 0,
     "maximum": 1
    },
    "relative": {
     "type": "boolean",
     "description": "Valeurs relatives (ajoutées)"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_nudge",
  "title": "Décaler la position de clips de quelques pixels",
  "description": "Décaler la position de clips de quelques pixels / Nudge clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "dx": {
     "type": "number",
     "description": "Δx"
    },
    "dy": {
     "type": "number",
     "description": "Δy"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_set_text",
  "title": "Modifier le texte",
  "description": "Modifier le texte (et éventuellement le style) d'un clip texte / Set text",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "text": {
     "type": "string",
     "description": "Texte"
    },
    "style": {
     "type": "object",
     "description": "Style (fontFamily, fontSize, color…)",
     "properties": {}
    }
   },
   "required": [
    "text"
   ]
  }
 },
 {
  "name": "clip_set_style",
  "title": "Fusionner un style dans les props",
  "description": "Fusionner un style dans les props (couleurs, police, remplissage, contour, ombre…) / Set style",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "style": {
     "type": "object",
     "description": "Props à fusionner",
     "properties": {}
    }
   },
   "required": [
    "style"
   ]
  }
 },
 {
  "name": "clip_set_audio",
  "title": "Audio du clip",
  "description": "Audio du clip : volume, fondus, muet, panoramique / Set clip audio",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "volume": {
     "type": "number",
     "description": "Volume (0-2)",
     "minimum": 0,
     "maximum": 4
    },
    "fadeIn": {
     "type": "number",
     "description": "Fondu entrée (s)",
     "minimum": 0
    },
    "fadeOut": {
     "type": "number",
     "description": "Fondu sortie (s)",
     "minimum": 0
    },
    "muted": {
     "type": "boolean",
     "description": "Muet"
    },
    "pan": {
     "type": "number",
     "description": "Panoramique (-1..1)",
     "minimum": -1,
     "maximum": 1
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "clip_select",
  "title": "Sélectionner des clips",
  "description": "Sélectionner des clips (remplacer, ajouter, basculer, tout, aucun) / Select clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "mode": {
     "type": "string",
     "enum": [
      "set",
      "add",
      "toggle",
      "remove",
      "all",
      "clear",
      "at-playhead"
     ],
     "description": "Mode"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_list",
  "title": "Lister les clips",
  "description": "Lister les clips (filtres : piste, instant, type) / List clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "trackId": {
     "type": "string",
     "description": "Piste"
    },
    "at": {
     "type": "number",
     "description": "Actifs à l'instant t"
    },
    "kind": {
     "type": "string",
     "description": "Type"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_get",
  "title": "Obtenir le JSON complet d'un clip",
  "description": "Obtenir le JSON complet d'un clip (option : valeurs résolues à t) / Get clip JSON",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "t": {
     "type": "number",
     "description": "Résoudre les valeurs animées à cet instant"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "clip_lock",
  "title": "Verrouiller / déverrouiller des clips",
  "description": "Verrouiller / déverrouiller des clips / Lock clips",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "locked": {
     "type": "boolean",
     "description": "Verrouillé"
    }
   },
   "required": []
  }
 },
 {
  "name": "clip_rename",
  "title": "Renommer un clip",
  "description": "Renommer un clip / Rename clip",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Clip"
    },
    "name": {
     "type": "string",
     "description": "Nom",
     "minLength": 1
    }
   },
   "required": [
    "id",
    "name"
   ]
  }
 },
 {
  "name": "clip_set_color",
  "title": "Couleur d'étiquette d'un clip dans la timeline",
  "description": "Couleur d'étiquette d'un clip dans la timeline / Set clip label color",
  "inputSchema": {
   "type": "object",
   "properties": {
    "ids": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "color": {
     "type": "string",
     "description": "Couleur"
    }
   },
   "required": [
    "color"
   ]
  }
 },
 {
  "name": "clip_kinds",
  "title": "Lister les types d'éléments et la bibliothèque",
  "description": "Lister les types d'éléments et la bibliothèque (avec propriétés par défaut) / List element kinds & library",
  "inputSchema": {
   "type": "object",
   "properties": {
    "category": {
     "type": "string",
     "description": "Catégorie"
    }
   },
   "required": []
  }
 },
 {
  "name": "effect_catalog",
  "title": "Catalogue des effets/filtres",
  "description": "Catalogue des effets/filtres (filtrable) avec paramètres, plages et valeurs par défaut / Effects catalog",
  "inputSchema": {
   "type": "object",
   "properties": {
    "category": {
     "type": "string",
     "enum": [
      "couleur",
      "flou",
      "nettete",
      "distorsion",
      "stylisation",
      "texture",
      "temps",
      "mattes",
      "shader"
     ],
     "description": "Catégorie"
    },
    "query": {
     "type": "string",
     "description": "Recherche texte"
    },
    "compact": {
     "type": "boolean",
     "description": "Liste compacte (sans paramètres)"
    }
   },
   "required": []
  }
 },
 {
  "name": "effect_add",
  "title": "Ajouter un effet à un clip",
  "description": "Ajouter un effet à un clip (paramètres optionnels) / Add effect",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip (défaut : sélection)"
    },
    "type": {
     "type": "string",
     "description": "Type d'effet (voir effect.catalog)"
    },
    "params": {
     "type": "object",
     "description": "Paramètres",
     "properties": {}
    },
    "index": {
     "type": "integer",
     "description": "Position dans la pile",
     "minimum": 0
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "effect_remove",
  "title": "Retirer un effet d'un clip",
  "description": "Retirer un effet d'un clip / Remove effect",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet"
    }
   },
   "required": [
    "clipId",
    "effectId"
   ]
  }
 },
 {
  "name": "effect_update",
  "title": "Modifier les paramètres d'un effet",
  "description": "Modifier les paramètres d'un effet / Update effect params",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet"
    },
    "params": {
     "type": "object",
     "description": "Paramètres",
     "properties": {}
    },
    "enabled": {
     "type": "boolean",
     "description": "Activé"
    }
   },
   "required": [
    "clipId",
    "effectId"
   ]
  }
 },
 {
  "name": "effect_reorder",
  "title": "Réordonner un effet dans la pile",
  "description": "Réordonner un effet dans la pile / Reorder effect",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet"
    },
    "index": {
     "type": "integer",
     "description": "Nouvelle position",
     "minimum": 0
    }
   },
   "required": [
    "clipId",
    "effectId",
    "index"
   ]
  }
 },
 {
  "name": "effect_toggle",
  "title": "Activer / désactiver un effet",
  "description": "Activer / désactiver un effet / Toggle effect",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet"
    },
    "enabled": {
     "type": "boolean",
     "description": "Activé"
    }
   },
   "required": [
    "clipId",
    "effectId"
   ]
  }
 },
 {
  "name": "effect_duplicate",
  "title": "Dupliquer un effet",
  "description": "Dupliquer un effet / Duplicate effect",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet"
    }
   },
   "required": [
    "clipId",
    "effectId"
   ]
  }
 },
 {
  "name": "effect_copy_stack",
  "title": "Copier la pile d'effets d'un clip",
  "description": "Copier la pile d'effets d'un clip / Copy effect stack",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    }
   },
   "required": []
  }
 },
 {
  "name": "effect_paste_stack",
  "title": "Coller une pile d'effets sur des clips",
  "description": "Coller une pile d'effets sur des clips (remplacer ou ajouter) / Paste effect stack",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipIds": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "mode": {
     "type": "string",
     "enum": [
      "append",
      "replace"
     ],
     "description": "Mode"
    },
    "stack": {
     "type": "array",
     "description": "Pile explicite [{type, params}]",
     "items": {
      "type": "object"
     }
    }
   },
   "required": []
  }
 },
 {
  "name": "effect_list_presets",
  "title": "Lister les presets d'effets",
  "description": "Lister les presets d'effets (intégrés + utilisateur) / List effect presets",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "effect_apply_preset",
  "title": "Appliquer un preset de pile d'effets",
  "description": "Appliquer un preset de pile d'effets (ex. Cinéma chaud, Cyberpunk, Rétro VHS) / Apply effect preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipIds": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "presetId": {
     "type": "string",
     "description": "Preset"
    },
    "mode": {
     "type": "string",
     "enum": [
      "append",
      "replace"
     ],
     "description": "Mode"
    }
   },
   "required": [
    "presetId"
   ]
  }
 },
 {
  "name": "effect_save_preset",
  "title": "Enregistrer la pile d'effets d'un clip comme preset nommé",
  "description": "Enregistrer la pile d'effets d'un clip comme preset nommé (dans le projet) / Save effect preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "name": {
     "type": "string",
     "description": "Nom",
     "minLength": 1
    }
   },
   "required": [
    "name"
   ]
  }
 },
 {
  "name": "effect_import_preset",
  "title": "Importer un preset d'effets",
  "description": "Importer un preset d'effets (JSON) / Import effect preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "preset": {
     "description": "Objet {name, effects:[{type,params}]} ou JSON"
    }
   },
   "required": [
    "preset"
   ]
  }
 },
 {
  "name": "effect_export_preset",
  "title": "Exporter un preset d'effets en JSON",
  "description": "Exporter un preset d'effets en JSON / Export effect preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "presetId": {
     "type": "string",
     "description": "Preset"
    }
   },
   "required": [
    "presetId"
   ]
  }
 },
 {
  "name": "effect_delete_preset",
  "title": "Supprimer un preset utilisateur",
  "description": "Supprimer un preset utilisateur / Delete user preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "presetId": {
     "type": "string",
     "description": "Preset"
    }
   },
   "required": [
    "presetId"
   ]
  }
 },
 {
  "name": "shader_set_code",
  "title": "Définir le code GLSL d'un clip shader ou d'un effet \"Shader personnalisé\"",
  "description": "Définir le code GLSL d'un clip shader ou d'un effet \"Shader personnalisé\" (mainImage, iTime, iResolution, iMouse, iChannel0..3) / Set GLSL shader code",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet customShader (sinon : clip shader)"
    },
    "code": {
     "type": "string",
     "description": "Code GLSL",
     "maxLength": 100000
    }
   },
   "required": [
    "clipId",
    "code"
   ]
  }
 },
 {
  "name": "shader_validate",
  "title": "Compiler un shader GLSL et renvoyer les erreurs ligne par ligne",
  "description": "Compiler un shader GLSL et renvoyer les erreurs ligne par ligne / Validate GLSL shader",
  "inputSchema": {
   "type": "object",
   "properties": {
    "code": {
     "type": "string",
     "description": "Code GLSL"
    },
    "target": {
     "type": "string",
     "enum": [
      "clip",
      "effect"
     ],
     "description": "Contexte"
    }
   },
   "required": [
    "code"
   ]
  }
 },
 {
  "name": "mask_add",
  "title": "Ajouter un masque",
  "description": "Ajouter un masque (rectangle, ellipse, polygone, Bézier) avec contour progressif, expansion, inversion, mode / Add mask",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "type": {
     "type": "string",
     "enum": [
      "rect",
      "ellipse",
      "polygon",
      "bezier"
     ],
     "description": "Type"
    },
    "x": {
     "type": "number",
     "description": "Centre X (px, repère du calque, 0 = centre)"
    },
    "y": {
     "type": "number",
     "description": "Centre Y"
    },
    "width": {
     "type": "number",
     "description": "Largeur"
    },
    "height": {
     "type": "number",
     "description": "Hauteur"
    },
    "points": {
     "type": "array",
     "description": "Points [{x,y,ix,iy,ox,oy}] (polygone / Bézier, repère calque centré)",
     "items": {
      "type": "object"
     }
    },
    "feather": {
     "type": "number",
     "description": "Contour progressif (px)",
     "minimum": 0
    },
    "expansion": {
     "type": "number",
     "description": "Expansion (px)"
    },
    "invert": {
     "type": "boolean",
     "description": "Inverser"
    },
    "opacity": {
     "type": "number",
     "description": "Opacité",
     "minimum": 0,
     "maximum": 1
    },
    "mode": {
     "type": "string",
     "enum": [
      "add",
      "subtract",
      "intersect",
      "difference"
     ],
     "description": "Mode"
    }
   },
   "required": [
    "clipId",
    "type"
   ]
  }
 },
 {
  "name": "mask_update",
  "title": "Modifier un masque",
  "description": "Modifier un masque / Update mask",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "maskId": {
     "type": "string",
     "description": "Masque"
    },
    "patch": {
     "type": "object",
     "description": "Champs à modifier (x, y, width, height, points, feather, expansion, invert, opacity, mode, enabled)",
     "properties": {}
    }
   },
   "required": [
    "clipId",
    "maskId",
    "patch"
   ]
  }
 },
 {
  "name": "mask_remove",
  "title": "Supprimer un masque",
  "description": "Supprimer un masque / Remove mask",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "maskId": {
     "type": "string",
     "description": "Masque"
    }
   },
   "required": [
    "clipId",
    "maskId"
   ]
  }
 },
 {
  "name": "matte_set",
  "title": "Track matte",
  "description": "Track matte : utiliser un autre clip comme cache (alpha, alpha inversé, luma, luma inversé) ou null / Set track matte",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "sourceId": {
     "type": [
      "string",
      "null"
     ],
     "description": "Clip source du cache (null pour retirer)"
    },
    "type": {
     "type": "string",
     "enum": [
      "alpha",
      "alphaInverted",
      "luma",
      "lumaInverted"
     ],
     "description": "Type"
    },
    "hideSource": {
     "type": "boolean",
     "description": "Masquer le clip source (défaut : oui)"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "keyframe_add",
  "title": "Ajouter une keyframe sur une propriété",
  "description": "Ajouter une keyframe sur une propriété (valeur courante par défaut) / Add keyframe",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin (ex. transform.x, props.color, effects.<id>.params.amount)"
    },
    "t": {
     "type": "number",
     "description": "Instant local au clip (s) — défaut : tête de lecture"
    },
    "value": {
     "description": "Valeur"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "hold": {
     "type": "boolean",
     "description": "Maintien (pas d'interpolation)"
    },
    "spring": {
     "type": "object",
     "description": "Ressort {stiffness, damping, mass}",
     "properties": {}
    }
   },
   "required": [
    "path"
   ]
  }
 },
 {
  "name": "keyframe_update",
  "title": "Modifier une keyframe",
  "description": "Modifier une keyframe (temps, valeur, easing, maintien) / Update keyframe",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "index": {
     "type": "integer",
     "description": "Index",
     "minimum": 0
    },
    "t": {
     "type": "number",
     "description": "Nouvel instant local"
    },
    "value": {
     "description": "Valeur"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "hold": {
     "type": "boolean",
     "description": "Maintien"
    },
    "bezier": {
     "type": "array",
     "description": "Bézier [x1,y1,x2,y2]",
     "items": {
      "type": "number"
     }
    },
    "spring": {
     "type": "object",
     "description": "Ressort",
     "properties": {}
    }
   },
   "required": [
    "clipId",
    "path",
    "index"
   ]
  }
 },
 {
  "name": "keyframe_remove",
  "title": "Supprimer des keyframes",
  "description": "Supprimer des keyframes (par index, ou toutes sur le chemin) / Remove keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "index": {
     "type": "integer",
     "description": "Index"
    },
    "indices": {
     "type": "array",
     "description": "Indices",
     "items": {
      "type": "integer"
     }
    },
    "all": {
     "type": "boolean",
     "description": "Toutes (la valeur courante devient statique)"
    }
   },
   "required": [
    "clipId",
    "path"
   ]
  }
 },
 {
  "name": "keyframe_move",
  "title": "Déplacer des keyframes dans le temps",
  "description": "Déplacer des keyframes dans le temps / Move keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "indices": {
     "type": "array",
     "description": "Indices",
     "items": {
      "type": "integer"
     }
    },
    "delta": {
     "type": "number",
     "description": "Décalage (s)"
    },
    "t": {
     "type": "number",
     "description": "Nouvel instant (1 seule keyframe)"
    }
   },
   "required": [
    "clipId",
    "path",
    "indices"
   ]
  }
 },
 {
  "name": "keyframe_set_easing",
  "title": "Changer l'interpolation de keyframes",
  "description": "Changer l'interpolation de keyframes (linéaire, Bézier, maintien, ressort, Penner…) / Set keyframe easing",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "indices": {
     "type": "array",
     "description": "Indices (défaut : toutes)",
     "items": {
      "type": "integer"
     }
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "spring": {
     "type": "object",
     "description": "Ressort {stiffness, damping, mass}",
     "properties": {}
    }
   },
   "required": [
    "clipId",
    "path",
    "easing"
   ]
  }
 },
 {
  "name": "keyframe_set_bezier",
  "title": "Définir une courbe de Bézier personnalisée [x1,y1,x2,y2] sur des keyframes",
  "description": "Définir une courbe de Bézier personnalisée [x1,y1,x2,y2] sur des keyframes / Set keyframe bezier",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "indices": {
     "type": "array",
     "description": "Indices",
     "items": {
      "type": "integer"
     }
    },
    "index": {
     "type": "integer",
     "description": "Index"
    },
    "bezier": {
     "type": "array",
     "description": "[x1,y1,x2,y2]",
     "items": {
      "type": "number"
     },
     "minItems": 4,
     "maxItems": 4
    }
   },
   "required": [
    "clipId",
    "path",
    "bezier"
   ]
  }
 },
 {
  "name": "keyframe_list",
  "title": "Lister les keyframes d'un clip",
  "description": "Lister les keyframes d'un clip / List keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin (optionnel)"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "keyframe_select",
  "title": "Sélectionner des keyframes",
  "description": "Sélectionner des keyframes (graph editor / timeline) / Select keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "items": {
     "type": "array",
     "description": "[{clipId, path, index}]",
     "items": {
      "type": "object"
     }
    },
    "mode": {
     "type": "string",
     "enum": [
      "set",
      "add",
      "toggle",
      "clear"
     ],
     "description": "Mode"
    }
   },
   "required": []
  }
 },
 {
  "name": "keyframe_copy",
  "title": "Copier des keyframes",
  "description": "Copier des keyframes / Copy keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "indices": {
     "type": "array",
     "description": "Indices",
     "items": {
      "type": "integer"
     }
    }
   },
   "required": [
    "clipId",
    "path"
   ]
  }
 },
 {
  "name": "keyframe_paste",
  "title": "Coller des keyframes à la tête de lecture",
  "description": "Coller des keyframes à la tête de lecture / Paste keyframes",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin cible (défaut : chemin copié)"
    },
    "t": {
     "type": "number",
     "description": "Instant local (défaut : tête de lecture)"
    }
   },
   "required": []
  }
 },
 {
  "name": "animation_list_presets",
  "title": "Lister les presets d'animation",
  "description": "Lister les presets d'animation (entrée, sortie, emphase) / List animation presets",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {
     "type": "string",
     "enum": [
      "in",
      "out",
      "emphasis"
     ],
     "description": "Type"
    }
   },
   "required": []
  }
 },
 {
  "name": "animation_apply_preset",
  "title": "Appliquer un preset d'animation",
  "description": "Appliquer un preset d'animation (entrée/sortie/emphase) avec durée et easing / Apply animation preset",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipIds": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "Identifiants de clips"
    },
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "preset": {
     "type": "string",
     "description": "Identifiant du preset (voir animation.list_presets)"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "at": {
     "type": "number",
     "description": "Instant local pour une emphase (s)"
    }
   },
   "required": [
    "preset"
   ]
  }
 },
 {
  "name": "animation_text_animator",
  "title": "Animateur de texte par caractère / mot / ligne",
  "description": "Animateur de texte par caractère / mot / ligne (typewriter, fade, slide, bounce, wave, scramble, split, glitch, blurIn, maskReveal, rotate3d, random, pop) / Text animator",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip texte"
    },
    "type": {
     "type": "string",
     "enum": [
      "none",
      "typewriter",
      "fade",
      "slide",
      "bounce",
      "wave",
      "scramble",
      "split",
      "glitch",
      "blurIn",
      "maskReveal",
      "rotate3d",
      "random",
      "pop"
     ],
     "description": "Type"
    },
    "by": {
     "type": "string",
     "enum": [
      "char",
      "word",
      "line"
     ],
     "description": "Unité"
    },
    "direction": {
     "type": "string",
     "enum": [
      "in",
      "out"
     ],
     "description": "Sens"
    },
    "start": {
     "type": "number",
     "description": "Début local (s)"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)"
    },
    "stagger": {
     "type": "number",
     "description": "Décalage entre unités (s)"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "amount": {
     "type": "number",
     "description": "Intensité"
    },
    "random": {
     "type": "boolean",
     "description": "Ordre aléatoire"
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "animation_clear",
  "title": "Supprimer toutes les animations",
  "description": "Supprimer toutes les animations (keyframes, transitions, expressions) d'un clip / Clear animation",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "paths": {
     "type": "array",
     "description": "Chemins (défaut : tous)",
     "items": {
      "type": "string"
     }
    },
    "keepTransitions": {
     "type": "boolean",
     "description": "Conserver les transitions"
    }
   },
   "required": []
  }
 },
 {
  "name": "expression_set",
  "title": "Définir une expression JS sandboxée sur une propriété",
  "description": "Définir une expression JS sandboxée sur une propriété (time, value, wiggle(), loopOut(), linear(), ease(), random(), noise(), thisLayer, thisComp.layer(\"Nom\"), control(\"Nom\"), audio.amplitude, audio.band(i)) / Set expression",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    },
    "code": {
     "type": "string",
     "description": "Expression",
     "maxLength": 2000
    }
   },
   "required": [
    "path",
    "code"
   ]
  }
 },
 {
  "name": "expression_clear",
  "title": "Retirer une expression",
  "description": "Retirer une expression / Clear expression",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    }
   },
   "required": [
    "clipId",
    "path"
   ]
  }
 },
 {
  "name": "expression_list",
  "title": "Lister les expressions d'un clip",
  "description": "Lister les expressions d'un clip / List expressions",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "audio_link_property",
  "title": "Audio-réactivité",
  "description": "Audio-réactivité : lier une propriété à l'amplitude ou à une bande de fréquences (lissage, gain) / Link property to audio",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin numérique"
    },
    "assetId": {
     "type": "string",
     "description": "Source audio (défaut : mixage global)"
    },
    "band": {
     "description": "\"amplitude\" ou index de bande 0-15 (graves → aigus)"
    },
    "gain": {
     "type": "number",
     "description": "Gain"
    },
    "smoothing": {
     "type": "number",
     "description": "Lissage 0-0.99",
     "minimum": 0,
     "maximum": 0.99
    },
    "mode": {
     "type": "string",
     "enum": [
      "add",
      "multiply"
     ],
     "description": "Mode"
    },
    "range": {
     "type": "number",
     "description": "Amplitude ajoutée (mode add)"
    }
   },
   "required": [
    "path"
   ]
  }
 },
 {
  "name": "audio_unlink_property",
  "title": "Retirer un lien audio-réactif",
  "description": "Retirer un lien audio-réactif / Unlink audio property",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "path": {
     "type": "string",
     "description": "Chemin"
    }
   },
   "required": [
    "clipId",
    "path"
   ]
  }
 },
 {
  "name": "audio_detect_beats",
  "title": "Détecter les beats d'un audio et créer des marqueurs",
  "description": "Détecter les beats d'un audio et créer des marqueurs / Detect beats → markers [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "assetId": {
     "type": "string",
     "description": "Asset audio"
    },
    "clipId": {
     "type": "string",
     "description": "Clip audio (décalage = début du clip)"
    },
    "sensitivity": {
     "type": "number",
     "description": "Sensibilité 0-1",
     "minimum": 0,
     "maximum": 1
    },
    "minInterval": {
     "type": "number",
     "description": "Intervalle min (s)"
    },
    "addMarkers": {
     "type": "boolean",
     "description": "Créer des marqueurs (défaut : oui)"
    },
    "color": {
     "type": "string",
     "description": "Couleur des marqueurs"
    }
   },
   "required": []
  }
 },
 {
  "name": "path_follow",
  "title": "Faire suivre un tracé à un calque",
  "description": "Faire suivre un tracé à un calque (auto-orientation, timing, easing) / Follow path",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip à animer"
    },
    "points": {
     "type": "array",
     "description": "Points du tracé [{x,y,ix,iy,ox,oy}] (repère composition, 0 = centre)",
     "items": {
      "type": "object"
     }
    },
    "sourceClipId": {
     "type": "string",
     "description": "Clip forme dont le tracé est utilisé"
    },
    "closed": {
     "type": "boolean",
     "description": "Tracé fermé"
    },
    "start": {
     "type": "number",
     "description": "Début local (s)"
    },
    "end": {
     "type": "number",
     "description": "Fin locale (s)"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    },
    "autoOrient": {
     "type": "boolean",
     "description": "Orientation automatique"
    },
    "rotationOffset": {
     "type": "number",
     "description": "Décalage de rotation (°)"
    },
    "remove": {
     "type": "boolean",
     "description": "Retirer le suivi"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "path_morph",
  "title": "Morphing de forme",
  "description": "Morphing de forme : interpole la forme d'un clip vers une autre forme / Shape morph",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip forme"
    },
    "to": {
     "type": "object",
     "description": "Forme cible {shape, width, height, sides, points, path…}",
     "properties": {}
    },
    "toClipId": {
     "type": "string",
     "description": "Ou clip forme cible"
    },
    "start": {
     "type": "number",
     "description": "Début local (s)"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "camera_set",
  "title": "Régler la caméra 2.5D",
  "description": "Régler la caméra 2.5D (crée un calque caméra si besoin) : position, zoom, focale, profondeur de champ, tremblement / Set camera",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip caméra"
    },
    "x": {
     "type": "number",
     "description": "X"
    },
    "y": {
     "type": "number",
     "description": "Y"
    },
    "z": {
     "type": "number",
     "description": "Z"
    },
    "rotation": {
     "type": "number",
     "description": "Rotation"
    },
    "zoom": {
     "type": "number",
     "description": "Zoom"
    },
    "focal": {
     "type": "number",
     "description": "Focale"
    },
    "dof": {
     "type": "object",
     "description": "Profondeur de champ {enabled, focus, aperture}",
     "properties": {}
    },
    "shake": {
     "type": "object",
     "description": "Tremblement {preset, amplitude, frequency, rotation}",
     "properties": {}
    },
    "orbit": {
     "type": "object",
     "description": "Orbite {enabled, radius, speed}",
     "properties": {}
    }
   },
   "required": []
  }
 },
 {
  "name": "camera_preset_move",
  "title": "Mouvement de caméra préréglé",
  "description": "Mouvement de caméra préréglé : dolly, pan, tilt, orbite, grue, zoom punch, tremblements (handheld, séisme) / Camera preset move",
  "inputSchema": {
   "type": "object",
   "properties": {
    "type": {
     "type": "string",
     "enum": [
      "dolly-in",
      "dolly-out",
      "pan-left",
      "pan-right",
      "tilt-up",
      "tilt-down",
      "crane-up",
      "orbit",
      "zoom-punch",
      "push-rotate",
      "handheld",
      "tremor",
      "earthquake"
     ],
     "description": "Mouvement"
    },
    "start": {
     "type": "number",
     "description": "Début (s, composition)"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)"
    },
    "intensity": {
     "type": "number",
     "description": "Intensité (1 = normal)"
    },
    "easing": {
     "type": "string",
     "description": "Easing : linear, hold, easeInSine, easeOutSine, easeInOutSine, easeInQuad, easeOutQuad, easeInOutQuad… | spring | cubic-bezier(x1,y1,x2,y2) | hold"
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "tracking_track_point",
  "title": "Suivi de point",
  "description": "Suivi de point (template matching) sur un clip vidéo ; 2 points = échelle + rotation / Track point [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip vidéo"
    },
    "x": {
     "type": "number",
     "description": "X du point (px, repère composition centré)"
    },
    "y": {
     "type": "number",
     "description": "Y du point"
    },
    "x2": {
     "type": "number",
     "description": "X du 2e point (optionnel)"
    },
    "y2": {
     "type": "number",
     "description": "Y du 2e point"
    },
    "size": {
     "type": "number",
     "description": "Taille du motif (px)"
    },
    "search": {
     "type": "number",
     "description": "Zone de recherche (px)"
    },
    "start": {
     "type": "number",
     "description": "Début (s, composition)"
    },
    "end": {
     "type": "number",
     "description": "Fin (s)"
    },
    "name": {
     "type": "string",
     "description": "Nom du suivi"
    }
   },
   "required": [
    "clipId",
    "x",
    "y"
   ]
  }
 },
 {
  "name": "tracking_apply",
  "title": "Appliquer un suivi à un calque",
  "description": "Appliquer un suivi à un calque (position, échelle, rotation) / Apply tracking",
  "inputSchema": {
   "type": "object",
   "properties": {
    "trackingId": {
     "type": "string",
     "description": "Suivi"
    },
    "targetClipId": {
     "type": "string",
     "description": "Clip cible"
    },
    "position": {
     "type": "boolean",
     "description": "Position (défaut oui)"
    },
    "scale": {
     "type": "boolean",
     "description": "Échelle"
    },
    "rotation": {
     "type": "boolean",
     "description": "Rotation"
    },
    "offsetX": {
     "type": "number",
     "description": "Décalage X"
    },
    "offsetY": {
     "type": "number",
     "description": "Décalage Y"
    }
   },
   "required": [
    "trackingId",
    "targetClipId"
   ]
  }
 },
 {
  "name": "tracking_stabilize",
  "title": "Stabilisation basique",
  "description": "Stabilisation basique : compense le mouvement suivi sur le clip vidéo lui-même / Stabilize",
  "inputSchema": {
   "type": "object",
   "properties": {
    "trackingId": {
     "type": "string",
     "description": "Suivi"
    },
    "zoom": {
     "type": "number",
     "description": "Zoom de compensation (ex. 1.1)"
    }
   },
   "required": [
    "trackingId"
   ]
  }
 },
 {
  "name": "tracking_list",
  "title": "Lister les données de suivi",
  "description": "Lister les données de suivi / List tracking data",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "control_add",
  "title": "Ajouter un contrôle",
  "description": "Ajouter un contrôle (curseur, couleur, case à cocher, angle) à un calque nul — accessible via control(\"Nom\") / Add control",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Calque nul"
    },
    "type": {
     "type": "string",
     "enum": [
      "slider",
      "color",
      "checkbox",
      "angle"
     ],
     "description": "Type"
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "value": {
     "description": "Valeur"
    },
    "min": {
     "type": "number",
     "description": "Min"
    },
    "max": {
     "type": "number",
     "description": "Max"
    }
   },
   "required": [
    "type",
    "name"
   ]
  }
 },
 {
  "name": "control_update",
  "title": "Modifier un contrôle",
  "description": "Modifier un contrôle / Update control",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Calque nul"
    },
    "controlId": {
     "type": "string",
     "description": "Contrôle"
    },
    "value": {
     "description": "Valeur"
    },
    "name": {
     "type": "string",
     "description": "Nom"
    },
    "min": {
     "type": "number",
     "description": "Min"
    },
    "max": {
     "type": "number",
     "description": "Max"
    }
   },
   "required": [
    "clipId",
    "controlId"
   ]
  }
 },
 {
  "name": "control_remove",
  "title": "Supprimer un contrôle",
  "description": "Supprimer un contrôle / Remove control",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Calque nul"
    },
    "controlId": {
     "type": "string",
     "description": "Contrôle"
    }
   },
   "required": [
    "clipId",
    "controlId"
   ]
  }
 },
 {
  "name": "transition_catalog",
  "title": "Catalogue des transitions",
  "description": "Catalogue des transitions (≥60) avec paramètres / Transitions catalog",
  "inputSchema": {
   "type": "object",
   "properties": {
    "group": {
     "type": "string",
     "enum": [
      "fondu",
      "mouvement",
      "zoom",
      "rotation",
      "3d",
      "volet",
      "stylise"
     ],
     "description": "Groupe"
    },
    "query": {
     "type": "string",
     "description": "Recherche"
    }
   },
   "required": []
  }
 },
 {
  "name": "transition_add",
  "title": "Ajouter une transition sur le bord d'entrée/sortie d'un clip, ou entre deux clips",
  "description": "Ajouter une transition sur le bord d'entrée/sortie d'un clip, ou entre deux clips (chevauchement) / Add transition",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "edge": {
     "type": "string",
     "enum": [
      "in",
      "out",
      "both"
     ],
     "description": "Bord"
    },
    "type": {
     "type": "string",
     "description": "Type (voir transition.catalog)"
    },
    "duration": {
     "type": "number",
     "description": "Durée (s)",
     "exclusiveMinimum": 0
    },
    "easing": {
     "type": "string",
     "description": "Easing"
    },
    "params": {
     "type": "object",
     "description": "Paramètres",
     "properties": {}
    },
    "betweenClipId": {
     "type": "string",
     "description": "Second clip : crée une transition A(sortie) → B(entrée)"
    },
    "overlap": {
     "type": "boolean",
     "description": "Faire chevaucher les clips de la durée de la transition (défaut : oui si betweenClipId)"
    }
   },
   "required": [
    "type"
   ]
  }
 },
 {
  "name": "transition_update",
  "title": "Modifier une transition",
  "description": "Modifier une transition (durée, easing, paramètres, type) / Update transition",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "edge": {
     "type": "string",
     "enum": [
      "in",
      "out"
     ],
     "description": "Bord"
    },
    "type": {
     "type": "string",
     "description": "Type"
    },
    "duration": {
     "type": "number",
     "description": "Durée"
    },
    "easing": {
     "type": "string",
     "description": "Easing"
    },
    "params": {
     "type": "object",
     "description": "Paramètres",
     "properties": {}
    }
   },
   "required": [
    "clipId",
    "edge"
   ]
  }
 },
 {
  "name": "transition_remove",
  "title": "Retirer une transition",
  "description": "Retirer une transition / Remove transition",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "edge": {
     "type": "string",
     "enum": [
      "in",
      "out",
      "both"
     ],
     "description": "Bord"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "timeline_set_zoom",
  "title": "Zoom horizontal de la timeline",
  "description": "Zoom horizontal de la timeline (pixels par seconde) / Timeline zoom",
  "inputSchema": {
   "type": "object",
   "properties": {
    "pxPerSecond": {
     "type": "number",
     "description": "Pixels par seconde",
     "minimum": 2,
     "maximum": 2000
    },
    "factor": {
     "type": "number",
     "description": "Facteur multiplicatif"
    }
   },
   "required": []
  }
 },
 {
  "name": "timeline_fit",
  "title": "Ajuster la timeline à la largeur disponible",
  "description": "Ajuster la timeline à la largeur disponible / Fit timeline",
  "inputSchema": {
   "type": "object",
   "properties": {
    "width": {
     "type": "number",
     "description": "Largeur disponible (px)"
    }
   },
   "required": []
  }
 },
 {
  "name": "timeline_scroll",
  "title": "Faire défiler la timeline",
  "description": "Faire défiler la timeline / Scroll timeline",
  "inputSchema": {
   "type": "object",
   "properties": {
    "seconds": {
     "type": "number",
     "description": "Position de début visible (s)"
    }
   },
   "required": [
    "seconds"
   ]
  }
 },
 {
  "name": "timeline_set_work_area",
  "title": "Zone de travail",
  "description": "Zone de travail (in/out) pour la lecture en boucle et l'export partiel / Set work area",
  "inputSchema": {
   "type": "object",
   "properties": {
    "in": {
     "type": "number",
     "description": "Début (s)",
     "minimum": 0
    },
    "out": {
     "type": "number",
     "description": "Fin (s)",
     "minimum": 0
    },
    "reset": {
     "type": "boolean",
     "description": "Réinitialiser à toute la durée"
    }
   },
   "required": []
  }
 },
 {
  "name": "marker_add",
  "title": "Ajouter un marqueur",
  "description": "Ajouter un marqueur (nom, couleur) / Add marker",
  "inputSchema": {
   "type": "object",
   "properties": {
    "t": {
     "type": "number",
     "description": "Instant (s, défaut : tête de lecture)",
     "minimum": 0
    },
    "label": {
     "type": "string",
     "description": "Nom"
    },
    "color": {
     "type": "string",
     "description": "Couleur"
    }
   },
   "required": []
  }
 },
 {
  "name": "marker_update",
  "title": "Modifier un marqueur",
  "description": "Modifier un marqueur / Update marker",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Marqueur"
    },
    "t": {
     "type": "number",
     "description": "Instant"
    },
    "label": {
     "type": "string",
     "description": "Nom"
    },
    "color": {
     "type": "string",
     "description": "Couleur"
    }
   },
   "required": [
    "id"
   ]
  }
 },
 {
  "name": "marker_remove",
  "title": "Supprimer un ou tous les marqueurs",
  "description": "Supprimer un ou tous les marqueurs / Remove marker",
  "inputSchema": {
   "type": "object",
   "properties": {
    "id": {
     "type": "string",
     "description": "Marqueur"
    },
    "all": {
     "type": "boolean",
     "description": "Tous"
    }
   },
   "required": []
  }
 },
 {
  "name": "marker_list",
  "title": "Lister les marqueurs",
  "description": "Lister les marqueurs / List markers",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "marker_goto",
  "title": "Aller au marqueur suivant / précédent",
  "description": "Aller au marqueur suivant / précédent / Go to marker",
  "inputSchema": {
   "type": "object",
   "properties": {
    "direction": {
     "type": "string",
     "enum": [
      "next",
      "prev"
     ],
     "description": "Direction"
    },
    "id": {
     "type": "string",
     "description": "Ou identifiant"
    }
   },
   "required": []
  }
 },
 {
  "name": "playback_play",
  "title": "Lecture",
  "description": "Lecture / Play",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "playback_pause",
  "title": "Pause",
  "description": "Pause / Pause",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "playback_toggle",
  "title": "Lecture / pause",
  "description": "Lecture / pause / Toggle playback",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "playback_seek",
  "title": "Positionner la tête de lecture",
  "description": "Positionner la tête de lecture (secondes, image, timecode ou décalage) / Seek",
  "inputSchema": {
   "type": "object",
   "properties": {
    "t": {
     "type": "number",
     "description": "Instant (s)"
    },
    "frame": {
     "type": "integer",
     "description": "Numéro d'image"
    },
    "timecode": {
     "type": "string",
     "description": "Timecode hh:mm:ss:ff"
    },
    "delta": {
     "type": "number",
     "description": "Décalage (s)"
    },
    "deltaFrames": {
     "type": "integer",
     "description": "Décalage en images"
    },
    "to": {
     "type": "string",
     "enum": [
      "start",
      "end",
      "in",
      "out"
     ],
     "description": "Position spéciale"
    }
   },
   "required": []
  }
 },
 {
  "name": "playback_shuttle",
  "title": "Lecture J/K/L",
  "description": "Lecture J/K/L : reculer, pause, avancer (vitesses cumulatives) / JKL shuttle",
  "inputSchema": {
   "type": "object",
   "properties": {
    "direction": {
     "type": "string",
     "enum": [
      "back",
      "stop",
      "forward"
     ],
     "description": "Direction"
    }
   },
   "required": [
    "direction"
   ]
  }
 },
 {
  "name": "playback_set_loop",
  "title": "Boucle de lecture",
  "description": "Boucle de lecture (sur la zone de travail) / Set loop",
  "inputSchema": {
   "type": "object",
   "properties": {
    "loop": {
     "type": "boolean",
     "description": "Boucle"
    }
   },
   "required": []
  }
 },
 {
  "name": "playback_set_rate",
  "title": "Vitesse de lecture",
  "description": "Vitesse de lecture / Playback rate",
  "inputSchema": {
   "type": "object",
   "properties": {
    "rate": {
     "type": "number",
     "description": "Vitesse (-8..8)",
     "minimum": -8,
     "maximum": 8
    }
   },
   "required": [
    "rate"
   ]
  }
 },
 {
  "name": "playback_get_state",
  "title": "État de la lecture",
  "description": "État de la lecture / Playback state",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "snap_set",
  "title": "Magnétisme",
  "description": "Magnétisme : activer et choisir les cibles (tête de lecture, clips, marqueurs, grille, bornes) / Snapping",
  "inputSchema": {
   "type": "object",
   "properties": {
    "enabled": {
     "type": "boolean",
     "description": "Activé"
    },
    "playhead": {
     "type": "boolean",
     "description": "Tête de lecture"
    },
    "clips": {
     "type": "boolean",
     "description": "Bords de clips"
    },
    "markers": {
     "type": "boolean",
     "description": "Marqueurs"
    },
    "grid": {
     "type": "boolean",
     "description": "Grille"
    },
    "bounds": {
     "type": "boolean",
     "description": "Début / fin"
    }
   },
   "required": []
  }
 },
 {
  "name": "view_set",
  "title": "Options du viewport",
  "description": "Options du viewport : zoom, guides, zones de sécurité, grille, règles, damier, mode propre, vue alpha, qualité, comparaison, isolation / Viewport options",
  "inputSchema": {
   "type": "object",
   "properties": {
    "zoom": {
     "description": "\"fit\" ou facteur (1 = 100 %)"
    },
    "guides": {
     "type": "boolean",
     "description": "Guides"
    },
    "safeZones": {
     "type": "boolean",
     "description": "Zones de sécurité"
    },
    "safeZoneType": {
     "type": "string",
     "enum": [
      "title-action",
      "16:9",
      "9:16",
      "1:1",
      "4:5"
     ],
     "description": "Type de zone"
    },
    "grid": {
     "type": "boolean",
     "description": "Grille"
    },
    "rulers": {
     "type": "boolean",
     "description": "Règles"
    },
    "checker": {
     "type": "boolean",
     "description": "Damier de transparence"
    },
    "clean": {
     "type": "boolean",
     "description": "Aperçu propre (sans gizmos)"
    },
    "view": {
     "type": "string",
     "enum": [
      "color",
      "alpha",
      "histogram",
      "waveform",
      "vectorscope"
     ],
     "description": "Vue"
    },
    "graphEditor": {
     "type": "boolean",
     "description": "Afficher l'éditeur de courbes de la timeline"
    },
    "graphProperty": {
     "description": "Propriété affichée dans l'éditeur de courbes : {clipId, path, mode: \"value\"|\"speed\"}"
    },
    "quality": {
     "type": "string",
     "enum": [
      "auto",
      "full",
      "half",
      "quarter"
     ],
     "description": "Qualité de preview"
    },
    "compare": {
     "description": "Comparaison avant/après : {clipId, effectId?, split} ou null"
    },
    "isolate": {
     "type": [
      "string",
      "null"
     ],
     "description": "Isoler un clip"
    },
    "panX": {
     "type": "number",
     "description": "Pan X"
    },
    "panY": {
     "type": "number",
     "description": "Pan Y"
    }
   },
   "required": []
  }
 },
 {
  "name": "view_fit",
  "title": "Ajuster le viewport à l'écran",
  "description": "Ajuster le viewport à l'écran / Fit viewport",
  "inputSchema": {
   "type": "object",
   "properties": {
    "zoom": {
     "type": "number",
     "description": "Facteur (1 = 100 %, absent = ajuster)"
    }
   },
   "required": []
  }
 },
 {
  "name": "view_fullscreen",
  "title": "Plein écran du viewport",
  "description": "Plein écran du viewport / Viewport fullscreen [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "enabled": {
     "type": "boolean",
     "description": "Activer"
    }
   },
   "required": []
  }
 },
 {
  "name": "tool_set",
  "title": "Outil actif",
  "description": "Outil actif : sélection (V), texte (T), rectangle (R), ellipse (E), plume (P), main (H) / Set tool",
  "inputSchema": {
   "type": "object",
   "properties": {
    "tool": {
     "type": "string",
     "enum": [
      "select",
      "text",
      "rect",
      "ellipse",
      "pen",
      "hand"
     ],
     "description": "Outil"
    }
   },
   "required": [
    "tool"
   ]
  }
 },
 {
  "name": "render_frame",
  "title": "Rendre l'image à l'instant t",
  "description": "Rendre l'image à l'instant t (PNG/JPEG base64) — pour « voir » le résultat / Render a frame (base64 image) [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "t": {
     "type": "number",
     "description": "Instant (s)",
     "minimum": 0
    },
    "format": {
     "type": "string",
     "enum": [
      "png",
      "jpeg",
      "webp"
     ],
     "description": "Format"
    },
    "width": {
     "type": "integer",
     "description": "Largeur de sortie (px)",
     "minimum": 16,
     "maximum": 7680
    },
    "quality": {
     "type": "number",
     "description": "Qualité JPEG 0-1"
    }
   },
   "required": []
  }
 },
 {
  "name": "render_contact_sheet",
  "title": "Planche contact",
  "description": "Planche contact : N images réparties sur la durée (ou une plage) en une seule image / Contact sheet of N frames [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "count": {
     "type": "integer",
     "description": "Nombre d'images",
     "minimum": 1,
     "maximum": 64
    },
    "columns": {
     "type": "integer",
     "description": "Colonnes",
     "minimum": 1,
     "maximum": 12
    },
    "start": {
     "type": "number",
     "description": "Début (s)"
    },
    "end": {
     "type": "number",
     "description": "Fin (s)"
    },
    "width": {
     "type": "integer",
     "description": "Largeur totale (px)",
     "minimum": 64,
     "maximum": 4096
    },
    "times": {
     "type": "array",
     "description": "Instants explicites",
     "items": {
      "type": "number"
     }
    },
    "format": {
     "type": "string",
     "enum": [
      "png",
      "jpeg"
     ],
     "description": "Format"
    }
   },
   "required": []
  }
 },
 {
  "name": "render_stats",
  "title": "Statistiques de rendu",
  "description": "Statistiques de rendu : fps, temps par image, qualité de preview, cache / Render stats [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "render_compare",
  "title": "Comparaison avant/après d'un effet",
  "description": "Comparaison avant/après d'un effet (ou de tous les effets d'un clip) à l'instant t : image côte à côte / Before/after comparison [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "clipId": {
     "type": "string",
     "description": "Clip"
    },
    "effectId": {
     "type": "string",
     "description": "Effet (défaut : tous)"
    },
    "t": {
     "type": "number",
     "description": "Instant"
    },
    "width": {
     "type": "integer",
     "description": "Largeur (px)"
    },
    "live": {
     "type": "boolean",
     "description": "Activer aussi la vue partagée dans le viewport"
    }
   },
   "required": [
    "clipId"
   ]
  }
 },
 {
  "name": "render_precache",
  "title": "Pré-calculer le rendu d'une plage",
  "description": "Pré-calculer le rendu d'une plage (barre de cache verte) pour une lecture fluide / Precache render [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "start": {
     "type": "number",
     "description": "Début"
    },
    "end": {
     "type": "number",
     "description": "Fin"
    }
   },
   "required": []
  }
 },
 {
  "name": "render_clear_cache",
  "title": "Vider le cache de rendu",
  "description": "Vider le cache de rendu / Clear render cache [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "history_undo",
  "title": "Annuler",
  "description": "Annuler / Undo",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "history_redo",
  "title": "Rétablir",
  "description": "Rétablir / Redo",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "history_list",
  "title": "Historique des actions",
  "description": "Historique des actions (annulables / rétablissables) / History list",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "history_jump",
  "title": "Revenir à un point de l'historique",
  "description": "Revenir à un point de l'historique (nombre d'annulations/rétablissements) / Jump in history",
  "inputSchema": {
   "type": "object",
   "properties": {
    "undoCount": {
     "type": "integer",
     "description": "Annulations à effectuer",
     "minimum": 0
    },
    "redoCount": {
     "type": "integer",
     "description": "Rétablissements à effectuer",
     "minimum": 0
    }
   },
   "required": []
  }
 },
 {
  "name": "history_batch_begin",
  "title": "Ouvrir une transaction",
  "description": "Ouvrir une transaction : les commandes suivantes forment un seul undo / Begin batch (single undo)",
  "inputSchema": {
   "type": "object",
   "properties": {
    "label": {
     "type": "string",
     "description": "Libellé"
    }
   },
   "required": []
  }
 },
 {
  "name": "history_batch_end",
  "title": "Fermer la transaction ouverte",
  "description": "Fermer la transaction ouverte / End batch",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "history_clear",
  "title": "Vider l'historique",
  "description": "Vider l'historique / Clear history",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "export_capabilities",
  "title": "Capacités d'export du navigateur",
  "description": "Capacités d'export du navigateur (codecs, WebCodecs, MediaRecorder, ffmpeg.wasm) / Export capabilities [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "export_start",
  "title": "Lancer l'export",
  "description": "Lancer l'export (MP4 H.264+AAC, WebM, GIF, séquence PNG, image) — le rendu se fait dans le navigateur, l'onglet doit rester ouvert / Start export (rendered in the browser tab) [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "format": {
     "type": "string",
     "enum": [
      "mp4",
      "webm",
      "gif",
      "png-sequence",
      "png",
      "jpg"
     ],
     "description": "Format"
    },
    "width": {
     "type": "integer",
     "description": "Largeur",
     "minimum": 16,
     "maximum": 7680
    },
    "height": {
     "type": "integer",
     "description": "Hauteur",
     "minimum": 16,
     "maximum": 7680
    },
    "fps": {
     "type": "number",
     "description": "FPS",
     "minimum": 1,
     "maximum": 120
    },
    "quality": {
     "type": "string",
     "enum": [
      "low",
      "medium",
      "high",
      "custom"
     ],
     "description": "Qualité"
    },
    "bitrate": {
     "type": "number",
     "description": "Débit vidéo (Mbps, qualité custom)",
     "minimum": 0.1,
     "maximum": 200
    },
    "range": {
     "type": "string",
     "enum": [
      "all",
      "workarea",
      "selection",
      "custom"
     ],
     "description": "Plage"
    },
    "start": {
     "type": "number",
     "description": "Début (plage custom)"
    },
    "end": {
     "type": "number",
     "description": "Fin (plage custom)"
    },
    "includeAudio": {
     "type": "boolean",
     "description": "Inclure l'audio"
    },
    "filename": {
     "type": "string",
     "description": "Nom du fichier"
    },
    "hardware": {
     "type": "string",
     "enum": [
      "prefer-hardware",
      "prefer-software",
      "no-preference"
     ],
     "description": "Accélération matérielle"
    },
    "motionBlur": {
     "type": "boolean",
     "description": "Flou de mouvement"
    },
    "motionBlurSamples": {
     "type": "integer",
     "description": "Échantillons de flou",
     "minimum": 2,
     "maximum": 16
    },
    "stream": {
     "type": "boolean",
     "description": "Écrire en streaming sur disque (sélecteur de fichier)"
    },
    "autoDownload": {
     "type": "boolean",
     "description": "Téléchargement automatique (défaut : oui)"
    },
    "t": {
     "type": "number",
     "description": "Instant (format image)"
    }
   },
   "required": []
  }
 },
 {
  "name": "export_status",
  "title": "Progression de l'export",
  "description": "Progression de l'export (progression, image courante, temps restant) / Export status [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "export_cancel",
  "title": "Annuler l'export en cours",
  "description": "Annuler l'export en cours / Cancel export [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "export_get_result",
  "title": "Résultat du dernier export",
  "description": "Résultat du dernier export (nom, taille, durée, lien blob, validation MP4) — option base64 / Get export result [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "base64": {
     "type": "boolean",
     "description": "Inclure le fichier en base64 (≤ 25 Mo)"
    }
   },
   "required": []
  }
 },
 {
  "name": "export_download",
  "title": "Télécharger à nouveau le dernier export",
  "description": "Télécharger à nouveau le dernier export / Download last export [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "export_download_link",
  "title": "Lien de téléchargement du dernier export",
  "description": "Lien de téléchargement du dernier export (URL blob locale à l'onglet) / Download link for last export [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "app_get_state",
  "title": "État de l'application",
  "description": "État de l'application (sélection, temps, outil, viewport, statut MCP…) / App state",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "app_get_capabilities",
  "title": "Capacités",
  "description": "Capacités : WebGL2, WebCodecs, codecs, OPFS, WebMCP, relais distant, environnement / Capabilities",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "app_set_theme_accent",
  "title": "Couleur d'accent de l'interface",
  "description": "Couleur d'accent de l'interface (défaut #24D26D) / Set accent color",
  "inputSchema": {
   "type": "object",
   "properties": {
    "color": {
     "type": "string",
     "description": "Couleur hex"
    }
   },
   "required": [
    "color"
   ]
  }
 },
 {
  "name": "app_set_lang",
  "title": "Langue de l'interface",
  "description": "Langue de l'interface (fr / en) / Set UI language",
  "inputSchema": {
   "type": "object",
   "properties": {
    "lang": {
     "type": "string",
     "enum": [
      "fr",
      "en"
     ],
     "description": "Langue"
    }
   },
   "required": [
    "lang"
   ]
  }
 },
 {
  "name": "app_help",
  "title": "Documentation des commandes",
  "description": "Documentation des commandes (toutes ou une seule) / Commands help",
  "inputSchema": {
   "type": "object",
   "properties": {
    "command": {
     "type": "string",
     "description": "Nom de commande"
    },
    "category": {
     "type": "string",
     "description": "Catégorie"
    }
   },
   "required": []
  }
 },
 {
  "name": "app_run_script",
  "title": "Exécuter un script de commandes enchaînées dans un sandbox",
  "description": "Exécuter un script de commandes enchaînées dans un sandbox (JSON [{name,args}] ou JS avec run(name,args)) / Run a command script in a sandbox",
  "inputSchema": {
   "type": "object",
   "properties": {
    "script": {
     "description": "Tableau [{name,args}] ou code JS (sandbox Worker, fonction run)"
    },
    "atomic": {
     "type": "boolean",
     "description": "Un seul undo pour tout le script (défaut : oui)"
    }
   },
   "required": [
    "script"
   ]
  }
 },
 {
  "name": "app_open_panel",
  "title": "Ouvrir un panneau ou une fenêtre de l'interface",
  "description": "Ouvrir un panneau ou une fenêtre de l'interface (export, palette, raccourcis, MCP, console, historique, assets, projets, paramètres, parité, aide) / Open UI panel [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "panel": {
     "type": "string",
     "enum": [
      "export",
      "palette",
      "shortcuts",
      "mcp",
      "console",
      "history",
      "assets",
      "projects",
      "settings",
      "parity",
      "help",
      "templates",
      "shader",
      "share",
      "controls",
      "scopes",
      "inspector",
      "library"
     ],
     "description": "Panneau"
    }
   },
   "required": [
    "panel"
   ]
  }
 },
 {
  "name": "app_toggle_panel",
  "title": "Replier / déplier un panneau",
  "description": "Replier / déplier un panneau (bibliothèque, inspecteur, timeline) / Toggle panel [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {
    "panel": {
     "type": "string",
     "enum": [
      "left",
      "right",
      "timeline"
     ],
     "description": "Panneau"
    }
   },
   "required": [
    "panel"
   ]
  }
 },
 {
  "name": "app_set_shortcut",
  "title": "Personnaliser un raccourci clavier",
  "description": "Personnaliser un raccourci clavier / Set shortcut",
  "inputSchema": {
   "type": "object",
   "properties": {
    "command": {
     "type": "string",
     "description": "Commande ou action"
    },
    "keys": {
     "type": "string",
     "description": "Touches (ex. Ctrl+Shift+K), vide = défaut"
    }
   },
   "required": [
    "command",
    "keys"
   ]
  }
 },
 {
  "name": "app_reset_shortcuts",
  "title": "Réinitialiser les raccourcis",
  "description": "Réinitialiser les raccourcis / Reset shortcuts",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "mcp_relay_connect",
  "title": "Relais MCP distant",
  "description": "Relais MCP distant : ouvrir une session (sessionId + code d'appairage) pour piloter cet onglet depuis un client MCP / Connect remote MCP relay [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "mcp_relay_disconnect",
  "title": "Relais MCP distant",
  "description": "Relais MCP distant : fermer la session / Disconnect remote MCP relay [nécessite un onglet Motion Studio ouvert / requires an open tab]",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "mcp_status",
  "title": "Statut MCP",
  "description": "Statut MCP : WebMCP, relais distant, session, outils exposés / MCP status",
  "inputSchema": {
   "type": "object",
   "properties": {},
   "required": []
  }
 },
 {
  "name": "app_log",
  "title": "Lire le journal",
  "description": "Lire le journal (console) de l'application / Read app log",
  "inputSchema": {
   "type": "object",
   "properties": {
    "level": {
     "type": "string",
     "enum": [
      "info",
      "warn",
      "error"
     ],
     "description": "Niveau"
    },
    "limit": {
     "type": "integer",
     "description": "Nombre",
     "minimum": 1,
     "maximum": 500
    }
   },
   "required": []
  }
 }
];
