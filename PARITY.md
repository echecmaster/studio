# Parité UI ⇄ MCP — Motion Studio

> Généré automatiquement par `npm run build:parity` (scripts/build-parity.mjs) et vérifié par `tests/parity.test.mjs`.

**Principe :** l'interface, les raccourcis, la palette de commandes, `window.motionAPI`, WebMCP et le serveur MCP Netlify appellent **exactement les mêmes commandes** du registre (`js/core/commands`). Aucune action n'existe uniquement dans l'interface : chaque bouton porte un attribut `data-cmd` / appelle `bus.run(…)`, et l'UI n'écrit jamais directement dans le store du projet.

| Indicateur | Valeur |
|---|---|
| Commandes / outils MCP | 190 |
| Commandes déclenchables depuis l'UI (boutons, menus, champs) | 147 (+ toutes via la palette Ctrl+K) |
| Points d'appel de commandes dans l'UI | 543 |
| Actions clavier / palette | 54 |
| Références UI inconnues | 0 |
| Mutations directes du projet par l'UI | 0 |

## Actions de l'interface (raccourcis & palette) → commandes

| Action UI | Raccourci | Commande MCP | Outil MCP |
|---|---|---|---|
| Lecture / pause | `Space` | `playback.toggle` | `playback_toggle` |
| Reculer (J) | `J` | `playback.shuttle` | `playback_shuttle` |
| Pause / keyframe (K) | `K` | `playback.shuttle` | `playback_shuttle` |
| Avancer (L) | `L` | `playback.shuttle` | `playback_shuttle` |
| Image précédente | `ArrowLeft` | `playback.seek` | `playback_seek` |
| Image suivante | `ArrowRight` | `playback.seek` | `playback_seek` |
| −10 images | `Shift+ArrowLeft` | `playback.seek` | `playback_seek` |
| +10 images | `Shift+ArrowRight` | `playback.seek` | `playback_seek` |
| Aller au début | `Home` | `playback.seek` | `playback_seek` |
| Aller à la fin | `End` | `playback.seek` | `playback_seek` |
| Couper à la tête de lecture | `S` | `clip.split` | `clip_split` |
| Supprimer | `Delete` | `clip.remove` | `clip_remove` |
| Supprimer avec propagation | `Shift+Delete` | `clip.ripple_delete` | `clip_ripple_delete` |
| Dupliquer | `Ctrl+D` | `clip.duplicate` | `clip_duplicate` |
| Copier | `Ctrl+C` | `clip.copy` | `clip_copy` |
| Coller | `Ctrl+V` | `clip.paste` | `clip_paste` |
| Couper (presse-papiers) | `Ctrl+X` | `clip.cut` | `clip_cut` |
| Annuler | `Ctrl+Z` | `history.undo` | `history_undo` |
| Rétablir | `Ctrl+Shift+Z` | `history.redo` | `history_redo` |
| Palette de commandes | `Ctrl+K` | `app.open_panel` | `app_open_panel` |
| Enregistrer | `Ctrl+S` | `project.save` | `project_save` |
| Exporter | `Ctrl+E` | `app.open_panel` | `app_open_panel` |
| Ajouter un marqueur | `M` | `marker.add` | `marker_add` |
| Marqueur suivant | `Shift+M` | `marker.goto` | `marker_goto` |
| Début de zone de travail | `I` | `timeline.set_work_area` | `timeline_set_work_area` |
| Fin de zone de travail | `O` | `timeline.set_work_area` | `timeline_set_work_area` |
| Zoom timeline + | `+` | `timeline.set_zoom` | `timeline_set_zoom` |
| Zoom timeline − | `-` | `timeline.set_zoom` | `timeline_set_zoom` |
| Ajuster la timeline | `\` | `timeline.fit` | `timeline_fit` |
| Outil sélection | `V` | `tool.set` | `tool_set` |
| Outil texte | `T` | `tool.set` | `tool_set` |
| Outil rectangle | `R` | `tool.set` | `tool_set` |
| Outil ellipse | `E` | `tool.set` | `tool_set` |
| Outil plume | `P` | `tool.set` | `tool_set` |
| Outil main | `H` | `tool.set` | `tool_set` |
| Ajouter une keyframe (position) | `Alt+K` | `keyframe.add` | `keyframe_add` |
| Easing doux sur les keyframes | `F9` | `keyframe.set_easing` | `keyframe_set_easing` |
| Grouper | `Ctrl+G` | `clip.group` | `clip_group` |
| Dégrouper | `Ctrl+Shift+G` | `clip.ungroup` | `clip_ungroup` |
| Précomposer | `Ctrl+Shift+C` | `clip.precompose` | `clip_precompose` |
| Tout sélectionner | `Ctrl+A` | `clip.select` | `clip_select` |
| Désélectionner | `Escape` | `clip.select` | `clip_select` |
| Ajuster le viewport | `F` | `view.fit` | `view_fit` |
| Boucle de lecture | `Ctrl+L` | `playback.set_loop` | `playback_set_loop` |
| Décaler à gauche | `Alt+ArrowLeft` | `clip.nudge` | `clip_nudge` |
| Décaler à droite | `Alt+ArrowRight` | `clip.nudge` | `clip_nudge` |
| Décaler vers le haut | `Alt+ArrowUp` | `clip.nudge` | `clip_nudge` |
| Décaler vers le bas | `Alt+ArrowDown` | `clip.nudge` | `clip_nudge` |
| Plein écran du viewport | `Ctrl+Shift+F` | `view.fullscreen` | `view_fullscreen` |
| Replier la bibliothèque | `Ctrl+1` | `app.toggle_panel` | `app_toggle_panel` |
| Replier l'inspecteur | `Ctrl+2` | `app.toggle_panel` | `app_toggle_panel` |
| Replier la timeline | `Ctrl+3` | `app.toggle_panel` | `app_toggle_panel` |
| Raccourcis clavier | `Ctrl+/` | `app.open_panel` | `app_open_panel` |
| Aide | `F1` | `app.open_panel` | `app_open_panel` |

## Toutes les commandes et leurs points d'entrée dans l'UI

| Commande | Outil MCP | Environnement | Accès UI |
|---|---|---|---|
| `project.new` — Nouveau projet | `project_new` | partout (serveur + onglet) | 3 point(s) : Nouveau |
| `project.open` — Ouvrir un projet enregistré localement | `project_open` | onglet | 2 point(s) |
| `project.save` — Enregistrer le projet | `project_save` | onglet | 6 point(s) : Enregistrer · Enregistrer · Enregistrer · `Ctrl+S` |
| `project.duplicate` — Dupliquer le projet courant | `project_duplicate` | partout (serveur + onglet) | 2 point(s) : Dupliquer · Dupliquer |
| `project.rename` — Renommer le projet | `project_rename` | partout (serveur + onglet) | 2 point(s) |
| `project.set_format` — Format du projet | `project_set_format` | partout (serveur + onglet) | 3 point(s) : Préset de format · Format de la composition (cliquer pour modifier) |
| `project.set_motion_blur` — Flou de mouvement réel à l'export | `project_set_motion_blur` | partout (serveur + onglet) | 3 point(s) : Flou de mouvement à l\ · Échantillons de flou · Obturateur (°) |
| `project.import_json` — Importer un projet complet depuis du JSON | `project_import_json` | partout (serveur + onglet) | 4 point(s) : Importer… |
| `project.export_json` — Exporter le projet en JSON | `project_export_json` | partout (serveur + onglet) | 6 point(s) : Exporter JSON · Exporter JSON · JSON + médias · JSON + médias |
| `project.list` — Lister les projets enregistrés localement | `project_list` | onglet | 1 point(s) |
| `project.delete` — Supprimer un projet enregistré | `project_delete` | onglet | 2 point(s) : Supprimer ce projet · Supprimer ce projet |
| `project.validate` — Valider le projet contre le JSON Schema | `project_validate` | partout (serveur + onglet) | palette Ctrl+K |
| `project.schema` — Obtenir le JSON Schema du projet | `project_schema` | partout (serveur + onglet) | palette Ctrl+K |
| `project.diff` — Différences JSON entre deux projets | `project_diff` | partout (serveur + onglet) | palette Ctrl+K |
| `project.describe` — Décrire la scène en texte à l'instant t | `project_describe` | partout (serveur + onglet) | 2 point(s) : Analyser le projet (lint) · Analyser le projet (lint) |
| `project.lint` — Analyser le projet | `project_lint` | partout (serveur + onglet) | 2 point(s) : Analyser le projet (lint) |
| `project.get` — Obtenir le JSON complet du projet courant | `project_get` | partout (serveur + onglet) | palette Ctrl+K |
| `project.save_shared` — Partager | `project_save_shared` | partout (serveur + onglet) | 2 point(s) |
| `project.load_shared` — Charger un projet partagé | `project_load_shared` | partout (serveur + onglet) | 1 point(s) |
| `template.list` — Lister les templates de projet | `template_list` | partout (serveur + onglet) | palette Ctrl+K |
| `template.apply` — Appliquer un template | `template_apply` | partout (serveur + onglet) | 4 point(s) |
| `asset.import_url` — Importer un média depuis une URL | `asset_import_url` | onglet | 2 point(s) : URL… · URL… |
| `asset.import_base64` — Importer un média encodé en base64 | `asset_import_base64` | onglet | palette Ctrl+K |
| `asset.import_file` — Importer un fichier choisi/déposé par l'utilisateur | `asset_import_file` | onglet | 4 point(s) : Importer… · Coller |
| `asset.import_text` — Importer un asset texte | `asset_import_text` | partout (serveur + onglet) | palette Ctrl+K |
| `asset.list` — Lister les assets du projet | `asset_list` | partout (serveur + onglet) | palette Ctrl+K |
| `asset.rename` — Renommer un asset | `asset_rename` | partout (serveur + onglet) | 2 point(s) : Renommer… · Renommer… |
| `asset.delete` — Supprimer un asset | `asset_delete` | partout (serveur + onglet) | 2 point(s) : Supprimer · Supprimer |
| `asset.replace` — Remplacer le média d'un asset sans casser les liens | `asset_replace` | partout (serveur + onglet) | 2 point(s) : Remplacer le média… |
| `asset.usage` — Voir quels clips utilisent un asset | `asset_usage` | partout (serveur + onglet) | 2 point(s) : Voir l\ · Voir l\ |
| `asset.generate_sfx` — Générer un bruitage synthétique | `asset_generate_sfx` | onglet | 2 point(s) |
| `asset.record_voice` — Enregistrer une voix off au micro | `asset_record_voice` | onglet | 2 point(s) : Voix off · Voix off |
| `font.list` — Lister les polices disponibles | `font_list` | partout (serveur + onglet) | palette Ctrl+K |
| `font.load_url` — Charger une police depuis une URL | `font_load_url` | onglet | 2 point(s) : Charger · Charger |
| `lut.import` — Importer une LUT 3D | `lut_import` | partout (serveur + onglet) | palette Ctrl+K |
| `track.add` — Ajouter une piste | `track_add` | partout (serveur + onglet) | 5 point(s) : Ajouter une piste · Ajouter une piste · Ajouter une piste |
| `track.remove` — Supprimer une piste et ses clips | `track_remove` | partout (serveur + onglet) | 2 point(s) : Supprimer la piste · Supprimer la piste |
| `track.rename` — Renommer une piste | `track_rename` | partout (serveur + onglet) | 3 point(s) : Renommer… · Renommer… |
| `track.reorder` — Déplacer une piste à un nouvel index | `track_reorder` | partout (serveur + onglet) | 1 point(s) |
| `track.set` — Propriétés de piste | `track_set` | partout (serveur + onglet) | 12 point(s) : Hauteur : petite · Hauteur : petite · Hauteur : normale · Hauteur : normale |
| `track.group` — Grouper des pistes | `track_group` | partout (serveur + onglet) | 2 point(s) : Grouper avec la piste suivante · Grouper avec la piste suivante |
| `track.ungroup` — Dégrouper des pistes | `track_ungroup` | partout (serveur + onglet) | 2 point(s) : Dégrouper · Dégrouper |
| `track.list` — Lister les pistes | `track_list` | partout (serveur + onglet) | palette Ctrl+K |
| `clip.add` — Ajouter un élément / clip sur la timeline | `clip_add` | partout (serveur + onglet) | 12 point(s) : Ajouter à la timeline · Ajouter à la timeline |
| `clip.remove` — Supprimer des clips | `clip_remove` | partout (serveur + onglet) | 7 point(s) : Supprimer · Dupliquer · Dupliquer · Supprimer · `Delete` |
| `clip.ripple_delete` — Suppression avec propagation | `clip_ripple_delete` | partout (serveur + onglet) | 3 point(s) : Supprimer avec propagation · Supprimer avec propagation · Supprimer avec propagation · `Shift+Delete` |
| `clip.update` — Mettre à jour un clip par fusion profonde d'un patch | `clip_update` | partout (serveur + onglet) | 1 point(s) |
| `clip.set` — Définir une propriété par chemin | `clip_set` | partout (serveur + onglet) | 6 point(s) : Shader prêt à l\ |
| `clip.move` — Déplacer des clips dans le temps et/ou vers une autre piste | `clip_move` | partout (serveur + onglet) | 2 point(s) : Début (s) |
| `clip.trim` — Rogner un clip par son bord d'entrée | `clip_trim` | partout (serveur + onglet) | 1 point(s) |
| `clip.set_duration` — Définir la durée d'un clip | `clip_set_duration` | partout (serveur + onglet) | 1 point(s) : Durée (s) |
| `clip.split` — Couper les clips à la tête de lecture | `clip_split` | partout (serveur + onglet) | 5 point(s) : Couper à la tête de lecture · Couper (S) · Couper (S) · Couper à la tête de lecture · `S` |
| `clip.duplicate` — Dupliquer des clips | `clip_duplicate` | partout (serveur + onglet) | 6 point(s) : Dupliquer · Dupliquer · Dupliquer · Dupliquer · `Ctrl+D` |
| `clip.copy` — Copier des clips dans le presse-papiers | `clip_copy` | partout (serveur + onglet) | 3 point(s) : Copier · Copier · Copier · `Ctrl+C` |
| `clip.cut` — Couper | `clip_cut` | partout (serveur + onglet) | 3 point(s) : Couper (presse-papiers) · Couper (presse-papiers) · Couper (presse-papiers) · `Ctrl+X` |
| `clip.paste` — Coller les clips du presse-papiers à la tête de lecture | `clip_paste` | partout (serveur + onglet) | 3 point(s) : Coller · Coller à la tête de lecture · Coller à la tête de lecture · `Ctrl+V` |
| `clip.set_speed` — Vitesse constante du clip | `clip_set_speed` | partout (serveur + onglet) | 3 point(s) : Vitesse · Vitesse… · Vitesse… |
| `clip.reverse` — Inverser la lecture du clip | `clip_reverse` | partout (serveur + onglet) | 3 point(s) : Lecture inversée |
| `clip.time_remap` — Time remap | `clip_time_remap` | partout (serveur + onglet) | 4 point(s) : Time remap · Time remap · Figer l\ · Figer l\ |
| `clip.set_blend_mode` — Mode de fusion du clip | `clip_set_blend_mode` | partout (serveur + onglet) | 4 point(s) : Mode de fusion · Mode de fusion · Mode de fusion… · Mode de fusion… |
| `clip.set_parent` — Parentage | `clip_set_parent` | partout (serveur + onglet) | 1 point(s) : Parent |
| `clip.precompose` — Précomposer des clips dans un groupe | `clip_precompose` | partout (serveur + onglet) | 5 point(s) : Précomposer · Précomposer · Précomposer · Précomposer · `Ctrl+Shift+C` |
| `clip.group` — Grouper des clips | `clip_group` | partout (serveur + onglet) | 1 point(s) : Grouper · `Ctrl+G` |
| `clip.ungroup` — Dégrouper / extraire le contenu d'une précomposition | `clip_ungroup` | partout (serveur + onglet) | 3 point(s) : Dégrouper · Dégrouper · Dégrouper · `Ctrl+Shift+G` |
| `clip.align` — Aligner des clips dans le cadre | `clip_align` | partout (serveur + onglet) | 5 point(s) : Réinitialiser · Réinitialiser · Réinitialiser |
| `clip.distribute` — Répartir des clips uniformément | `clip_distribute` | partout (serveur + onglet) | 6 point(s) : X · X · X · X |
| `clip.set_transform` — Transformation | `clip_set_transform` | partout (serveur + onglet) | 8 point(s) : Opacité (toutes) · Réinitialiser · Réinitialiser · Opacité |
| `clip.nudge` — Décaler la position de clips de quelques pixels | `clip_nudge` | partout (serveur + onglet) | 4 point(s) : Décaler à gauche · Décaler à droite · Décaler vers le haut · Décaler vers le bas · `Alt+ArrowLeft`, `Alt+ArrowRight`, `Alt+ArrowUp`, `Alt+ArrowDown` |
| `clip.set_text` — Modifier le texte | `clip_set_text` | partout (serveur + onglet) | 1 point(s) |
| `clip.set_style` — Fusionner un style dans les props | `clip_set_style` | partout (serveur + onglet) | 2 point(s) : Appliquer un preset · Changer de modèle |
| `clip.set_audio` — Audio du clip | `clip_set_audio` | partout (serveur + onglet) | palette Ctrl+K |
| `clip.select` — Sélectionner des clips | `clip_select` | partout (serveur + onglet) | 12 point(s) : Tout sélectionner · Désélectionner · Format de la composition (cliquer pour modifier) · `Ctrl+A`, `Escape` |
| `clip.list` — Lister les clips | `clip_list` | partout (serveur + onglet) | palette Ctrl+K |
| `clip.get` — Obtenir le JSON complet d'un clip | `clip_get` | partout (serveur + onglet) | palette Ctrl+K |
| `clip.lock` — Verrouiller / déverrouiller des clips | `clip_lock` | partout (serveur + onglet) | 4 point(s) |
| `clip.rename` — Renommer un clip | `clip_rename` | partout (serveur + onglet) | 1 point(s) |
| `clip.set_color` — Couleur d'étiquette d'un clip dans la timeline | `clip_set_color` | partout (serveur + onglet) | 2 point(s) : Couleur d\ · Couleur d\ |
| `clip.kinds` — Lister les types d'éléments et la bibliothèque | `clip_kinds` | partout (serveur + onglet) | palette Ctrl+K |
| `effect.catalog` — Catalogue des effets/filtres | `effect_catalog` | partout (serveur + onglet) | palette Ctrl+K |
| `effect.add` — Ajouter un effet à un clip | `effect_add` | partout (serveur + onglet) | 11 point(s) : Ajouter un effet · Ajouter un effet · Appliquer la LUT au clip sélectionné · Appliquer la LUT au clip sélectionné |
| `effect.remove` — Retirer un effet d'un clip | `effect_remove` | partout (serveur + onglet) | 2 point(s) : Retirer · Retirer |
| `effect.update` — Modifier les paramètres d'un effet | `effect_update` | partout (serveur + onglet) | 1 point(s) |
| `effect.reorder` — Réordonner un effet dans la pile | `effect_reorder` | partout (serveur + onglet) | 1 point(s) |
| `effect.toggle` — Activer / désactiver un effet | `effect_toggle` | partout (serveur + onglet) | 2 point(s) |
| `effect.duplicate` — Dupliquer un effet | `effect_duplicate` | partout (serveur + onglet) | 2 point(s) : Dupliquer · Dupliquer |
| `effect.copy_stack` — Copier la pile d'effets d'un clip | `effect_copy_stack` | partout (serveur + onglet) | 2 point(s) : Copier la pile · Copier la pile |
| `effect.paste_stack` — Coller une pile d'effets sur des clips | `effect_paste_stack` | partout (serveur + onglet) | 2 point(s) : Coller · Coller |
| `effect.list_presets` — Lister les presets d'effets | `effect_list_presets` | partout (serveur + onglet) | 1 point(s) : Exporter presets |
| `effect.apply_preset` — Appliquer un preset de pile d'effets | `effect_apply_preset` | partout (serveur + onglet) | 3 point(s) |
| `effect.save_preset` — Enregistrer la pile d'effets d'un clip comme preset nommé | `effect_save_preset` | partout (serveur + onglet) | 2 point(s) : Enregistrer comme preset · Enregistrer comme preset |
| `effect.import_preset` — Importer un preset d'effets | `effect_import_preset` | partout (serveur + onglet) | 2 point(s) : Importer preset… · Importer preset… |
| `effect.export_preset` — Exporter un preset d'effets en JSON | `effect_export_preset` | partout (serveur + onglet) | 2 point(s) : Exporter presets · Exporter presets |
| `effect.delete_preset` — Supprimer un preset utilisateur | `effect_delete_preset` | partout (serveur + onglet) | palette Ctrl+K |
| `shader.set_code` — Définir le code GLSL d'un clip shader ou d'un effet "Shader personnalisé" | `shader_set_code` | partout (serveur + onglet) | 4 point(s) : Shader prêt à l\ · Éditer le shader… |
| `shader.validate` — Compiler un shader GLSL et renvoyer les erreurs ligne par ligne | `shader_validate` | partout (serveur + onglet) | 1 point(s) |
| `mask.add` — Ajouter un masque | `mask_add` | partout (serveur + onglet) | 2 point(s) |
| `mask.update` — Modifier un masque | `mask_update` | partout (serveur + onglet) | 1 point(s) |
| `mask.remove` — Supprimer un masque | `mask_remove` | partout (serveur + onglet) | 2 point(s) : Supprimer le masque · Supprimer le masque |
| `matte.set` — Track matte | `matte_set` | partout (serveur + onglet) | 2 point(s) : Track matte (source) · Type de matte |
| `keyframe.add` — Ajouter une keyframe sur une propriété | `keyframe_add` | partout (serveur + onglet) | 10 point(s) : Ajouter une keyframe (position) · Keyframe : clic = ajouter/retirer à la tête de lecture · Alt+clic = supprimer toutes · clic droit = plus d\ · Ajouter une keyframe · Ajouter une keyframe · `Alt+K` |
| `keyframe.update` — Modifier une keyframe | `keyframe_update` | partout (serveur + onglet) | 2 point(s) : Déplacer keyframes |
| `keyframe.remove` — Supprimer des keyframes | `keyframe_remove` | partout (serveur + onglet) | 9 point(s) : Supprimer toutes les keyframes · Supprimer toutes les keyframes · Supprimer les keyframes · Supprimer les keyframes |
| `keyframe.move` — Déplacer des keyframes dans le temps | `keyframe_move` | partout (serveur + onglet) | palette Ctrl+K |
| `keyframe.set_easing` — Changer l'interpolation de keyframes | `keyframe_set_easing` | partout (serveur + onglet) | 8 point(s) : Easing doux sur les keyframes · Plus d\ · Plus d\ · Easing doux · `F9` |
| `keyframe.set_bezier` — Définir une courbe de Bézier personnalisée [x1,y1,x2,y2] sur des keyframes | `keyframe_set_bezier` | partout (serveur + onglet) | 5 point(s) : Annuler · Annuler · Courbe de Bézier… |
| `keyframe.list` — Lister les keyframes d'un clip | `keyframe_list` | partout (serveur + onglet) | palette Ctrl+K |
| `keyframe.select` — Sélectionner des keyframes | `keyframe_select` | partout (serveur + onglet) | 2 point(s) |
| `keyframe.copy` — Copier des keyframes | `keyframe_copy` | partout (serveur + onglet) | 2 point(s) : Copier · Copier |
| `keyframe.paste` — Coller des keyframes à la tête de lecture | `keyframe_paste` | partout (serveur + onglet) | 2 point(s) : Tout effacer · Tout effacer |
| `animation.list_presets` — Lister les presets d'animation | `animation_list_presets` | partout (serveur + onglet) | palette Ctrl+K |
| `animation.apply_preset` — Appliquer un preset d'animation | `animation_apply_preset` | partout (serveur + onglet) | 12 point(s) : Preset d\ · Preset de sortie · Emphase (à la tête de lecture) · Entrée : fondu |
| `animation.text_animator` — Animateur de texte par caractère / mot / ligne | `animation_text_animator` | partout (serveur + onglet) | 2 point(s) : Type |
| `animation.clear` — Supprimer toutes les animations | `animation_clear` | partout (serveur + onglet) | 2 point(s) : Tout effacer · Tout effacer |
| `expression.set` — Définir une expression JS sandboxée sur une propriété | `expression_set` | partout (serveur + onglet) | 8 point(s) : Pickwhip : lier à une autre propriété… · Annuler · Annuler · Annuler |
| `expression.clear` — Retirer une expression | `expression_clear` | partout (serveur + onglet) | 4 point(s) : Retirer l\ · Retirer l\ · Modifier · Modifier |
| `expression.list` — Lister les expressions d'un clip | `expression_list` | partout (serveur + onglet) | palette Ctrl+K |
| `audio.link_property` — Audio-réactivité | `audio_link_property` | partout (serveur + onglet) | 3 point(s) : Annuler · Annuler |
| `audio.unlink_property` — Retirer un lien audio-réactif | `audio_unlink_property` | partout (serveur + onglet) | 4 point(s) : Délier de l\ · Délier de l\ · Modifier · Modifier |
| `audio.detect_beats` — Détecter les beats d'un audio et créer des marqueurs | `audio_detect_beats` | onglet | 4 point(s) : Détecter les beats · Détecter les beats · Détecter les beats → marqueurs · Détecter les beats → marqueurs |
| `path.follow` — Faire suivre un tracé à un calque | `path_follow` | partout (serveur + onglet) | 2 point(s) : Suivre le tracé de… · Suivre le tracé de… |
| `path.morph` — Morphing de forme | `path_morph` | partout (serveur + onglet) | 2 point(s) : Morphing vers… · Morphing vers… |
| `camera.set` — Régler la caméra 2.5D | `camera_set` | partout (serveur + onglet) | palette Ctrl+K |
| `camera.preset_move` — Mouvement de caméra préréglé | `camera_preset_move` | partout (serveur + onglet) | 2 point(s) |
| `tracking.track_point` — Suivi de point | `tracking_track_point` | onglet | 2 point(s) : Suivre ce point · Suivre ce point |
| `tracking.apply` — Appliquer un suivi à un calque | `tracking_apply` | partout (serveur + onglet) | 2 point(s) : Appliquer · Appliquer |
| `tracking.stabilize` — Stabilisation basique | `tracking_stabilize` | partout (serveur + onglet) | 2 point(s) : Stabiliser · Stabiliser |
| `tracking.list` — Lister les données de suivi | `tracking_list` | partout (serveur + onglet) | palette Ctrl+K |
| `control.add` — Ajouter un contrôle | `control_add` | partout (serveur + onglet) | 6 point(s) : Créer un contrôleur · Créer un contrôleur |
| `control.update` — Modifier un contrôle | `control_update` | partout (serveur + onglet) | 2 point(s) |
| `control.remove` — Supprimer un contrôle | `control_remove` | partout (serveur + onglet) | 2 point(s) : Supprimer le contrôle · Supprimer le contrôle |
| `transition.catalog` — Catalogue des transitions | `transition_catalog` | partout (serveur + onglet) | palette Ctrl+K |
| `transition.add` — Ajouter une transition sur le bord d'entrée/sortie d'un clip, ou entre deux clips | `transition_add` | partout (serveur + onglet) | 11 point(s) : Précomposer · Précomposer · Transition d\ · Transition d\ |
| `transition.update` — Modifier une transition | `transition_update` | partout (serveur + onglet) | 7 point(s) : Durée (s) · Easing |
| `transition.remove` — Retirer une transition | `transition_remove` | partout (serveur + onglet) | 3 point(s) : Supprimer la transition · Supprimer la transition |
| `timeline.set_zoom` — Zoom horizontal de la timeline | `timeline_set_zoom` | partout (serveur + onglet) | 5 point(s) : Zoom timeline + · Zoom timeline − · `+`, `-` |
| `timeline.fit` — Ajuster la timeline à la largeur disponible | `timeline_fit` | partout (serveur + onglet) | 3 point(s) : Ajuster la timeline · Ajuster la timeline (\\) · Ajuster la timeline (\\) · `\` |
| `timeline.scroll` — Faire défiler la timeline | `timeline_scroll` | partout (serveur + onglet) | palette Ctrl+K |
| `timeline.set_work_area` — Zone de travail | `timeline_set_work_area` | partout (serveur + onglet) | 3 point(s) : Début de zone de travail · Fin de zone de travail · `I`, `O` |
| `marker.add` — Ajouter un marqueur | `marker_add` | partout (serveur + onglet) | 3 point(s) : Ajouter un marqueur · Marqueur (M) · Marqueur (M) · `M` |
| `marker.update` — Modifier un marqueur | `marker_update` | partout (serveur + onglet) | 4 point(s) : Supprimer le marqueur · Supprimer le marqueur |
| `marker.remove` — Supprimer un ou tous les marqueurs | `marker_remove` | partout (serveur + onglet) | 2 point(s) : Supprimer le marqueur · Supprimer le marqueur |
| `marker.list` — Lister les marqueurs | `marker_list` | partout (serveur + onglet) | palette Ctrl+K |
| `marker.goto` — Aller au marqueur suivant / précédent | `marker_goto` | partout (serveur + onglet) | 1 point(s) : Marqueur suivant · `Shift+M` |
| `playback.play` — Lecture | `playback_play` | partout (serveur + onglet) | palette Ctrl+K |
| `playback.pause` — Pause | `playback_pause` | partout (serveur + onglet) | 1 point(s) |
| `playback.toggle` — Lecture / pause | `playback_toggle` | partout (serveur + onglet) | 3 point(s) : Lecture / pause · `Space` |
| `playback.seek` — Positionner la tête de lecture | `playback_seek` | partout (serveur + onglet) | 21 point(s) : Image précédente · Image suivante · −10 images · +10 images · `ArrowLeft`, `ArrowRight`, `Shift+ArrowLeft`, `Shift+ArrowRight`, `Home`, `End` |
| `playback.shuttle` — Lecture J/K/L | `playback_shuttle` | partout (serveur + onglet) | 7 point(s) : Reculer (J) · Pause / keyframe (K) · Avancer (L) · Reculer (J) · `J`, `K`, `L` |
| `playback.set_loop` — Boucle de lecture | `playback_set_loop` | partout (serveur + onglet) | 3 point(s) : Boucle de lecture · `Ctrl+L` |
| `playback.set_rate` — Vitesse de lecture | `playback_set_rate` | partout (serveur + onglet) | 2 point(s) |
| `playback.get_state` — État de la lecture | `playback_get_state` | partout (serveur + onglet) | palette Ctrl+K |
| `snap.set` — Magnétisme | `snap_set` | partout (serveur + onglet) | 2 point(s) : Magnétisme (snap) · Magnétisme (snap) |
| `view.set` — Options du viewport | `view_set` | partout (serveur + onglet) | 27 point(s) : Ouvrir dans l\ · Ouvrir dans l\ · Éditeur de courbes · Éditeur de courbes |
| `view.fit` — Ajuster le viewport à l'écran | `view_fit` | partout (serveur + onglet) | 5 point(s) : Ajuster le viewport · Ajuster à l\ · Ajuster à l\ · `F` |
| `view.fullscreen` — Plein écran du viewport | `view_fullscreen` | onglet | 3 point(s) : Plein écran du viewport · Plein écran du viewport · Plein écran du viewport · `Ctrl+Shift+F` |
| `tool.set` — Outil actif | `tool_set` | partout (serveur + onglet) | 10 point(s) : Outil sélection · Outil texte · Outil rectangle · Outil ellipse · `V`, `T`, `R`, `E`, `P`, `H` |
| `render.frame` — Rendre l'image à l'instant t | `render_frame` | onglet | palette Ctrl+K |
| `render.contact_sheet` — Planche contact | `render_contact_sheet` | onglet | palette Ctrl+K |
| `render.stats` — Statistiques de rendu | `render_stats` | onglet | palette Ctrl+K |
| `render.compare` — Comparaison avant/après d'un effet | `render_compare` | onglet | palette Ctrl+K |
| `render.precache` — Pré-calculer le rendu d'une plage | `render_precache` | onglet | 2 point(s) : Pré-calculer la zone de travail (barre verte) · Pré-calculer la zone de travail (barre verte) |
| `render.clear_cache` — Vider le cache de rendu | `render_clear_cache` | onglet | palette Ctrl+K |
| `history.undo` — Annuler | `history_undo` | partout (serveur + onglet) | 5 point(s) : Annuler · Annuler · Annuler · `Ctrl+Z` |
| `history.redo` — Rétablir | `history_redo` | partout (serveur + onglet) | 5 point(s) : Rétablir · Annuler · Annuler · `Ctrl+Shift+Z` |
| `history.list` — Historique des actions | `history_list` | partout (serveur + onglet) | palette Ctrl+K |
| `history.jump` — Revenir à un point de l'historique | `history_jump` | partout (serveur + onglet) | 6 point(s) |
| `history.batch_begin` — Ouvrir une transaction | `history_batch_begin` | partout (serveur + onglet) | palette Ctrl+K |
| `history.batch_end` — Fermer la transaction ouverte | `history_batch_end` | partout (serveur + onglet) | palette Ctrl+K |
| `history.clear` — Vider l'historique | `history_clear` | partout (serveur + onglet) | 2 point(s) : Annuler · Annuler |
| `export.capabilities` — Capacités d'export du navigateur | `export_capabilities` | onglet | palette Ctrl+K |
| `export.start` — Lancer l'export | `export_start` | onglet | 3 point(s) : Annuler · Annuler · Exporter (Ctrl+E) |
| `export.status` — Progression de l'export | `export_status` | onglet | palette Ctrl+K |
| `export.cancel` — Annuler l'export en cours | `export_cancel` | onglet | 2 point(s) : Annuler l\ · Annuler l\ |
| `export.get_result` — Résultat du dernier export | `export_get_result` | onglet | palette Ctrl+K |
| `export.download` — Télécharger à nouveau le dernier export | `export_download` | onglet | 2 point(s) : Télécharger · Télécharger |
| `export.download_link` — Lien de téléchargement du dernier export | `export_download_link` | onglet | 1 point(s) : Télécharger |
| `app.get_state` — État de l'application | `app_get_state` | partout (serveur + onglet) | palette Ctrl+K |
| `app.get_capabilities` — Capacités | `app_get_capabilities` | partout (serveur + onglet) | palette Ctrl+K |
| `app.set_theme_accent` — Couleur d'accent de l'interface | `app_set_theme_accent` | partout (serveur + onglet) | 4 point(s) : Accent par défaut (#24D26D) · Accent par défaut (#24D26D) · Paramètres |
| `app.set_lang` — Langue de l'interface | `app_set_lang` | partout (serveur + onglet) | 1 point(s) |
| `app.help` — Documentation des commandes | `app_help` | partout (serveur + onglet) | 1 point(s) : Aide (F1) |
| `app.run_script` — Exécuter un script de commandes enchaînées dans un sandbox | `app_run_script` | partout (serveur + onglet) | 3 point(s) : Fermer · Fermer · Vider |
| `app.open_panel` — Ouvrir un panneau ou une fenêtre de l'interface | `app_open_panel` | onglet | 5 point(s) : Palette de commandes · Exporter · Raccourcis clavier · Aide · `Ctrl+K`, `Ctrl+E`, `Ctrl+/`, `F1` |
| `app.toggle_panel` — Replier / déplier un panneau | `app_toggle_panel` | onglet | 6 point(s) : Replier la bibliothèque · Replier l\ · Replier la timeline · Bibliothèque · `Ctrl+1`, `Ctrl+2`, `Ctrl+3` |
| `app.set_shortcut` — Personnaliser un raccourci clavier | `app_set_shortcut` | partout (serveur + onglet) | 2 point(s) |
| `app.reset_shortcuts` — Réinitialiser les raccourcis | `app_reset_shortcuts` | partout (serveur + onglet) | 2 point(s) : Réinitialiser · Réinitialiser |
| `mcp.relay_connect` — Relais MCP distant | `mcp_relay_connect` | onglet | 3 point(s) : Fermer la session · Fermer la session |
| `mcp.relay_disconnect` — Relais MCP distant | `mcp_relay_disconnect` | onglet | 2 point(s) : Fermer la session · Fermer la session |
| `mcp.status` — Statut MCP | `mcp_status` | partout (serveur + onglet) | palette Ctrl+K |
| `app.log` — Lire le journal | `app_log` | partout (serveur + onglet) | palette Ctrl+K |

## Outils MCP supplémentaires (serveur Netlify, sans navigateur)

`session_attach`, `session_status`, `session_get_result`, `project_create_from_template`, `project_apply_commands`, `project_validate_json`, `project_diff_json`, `catalog_search`, `catalog_describe`, `project_save_shared`, `project_load_shared`.
