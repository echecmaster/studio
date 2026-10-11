// Internationalisation (français par défaut, anglais prêt)
const DICT = {
  fr: {
    library: 'Bibliothèque', effects: 'Effets', transitions: 'Transitions', animations: 'Animations', media: 'Médias', templates: 'Templates', projects: 'Projets',
    inspector: 'Inspecteur', controls: 'Contrôles', history: 'Historique', mcp: 'MCP', console: 'Console', scopes: 'Scopes',
    export: 'EXPORTER MP4', undo: 'Annuler', redo: 'Rétablir', save: 'Enregistrer', share: 'Partager', palette: 'Palette de commandes',
    noSelection: 'Aucun calque sélectionné', selectHint: 'Sélectionnez un clip dans la timeline ou le viewport.', search: 'Rechercher…',
    play: 'Lecture', pause: 'Pause', loop: 'Boucle', mcpActive: 'Mode MCP : actif', mcpOff: 'Mode MCP : indisponible',
    desktopAdvice: 'Écran étroit : panneaux repliables. Pour l\'export lourd, un ordinateur de bureau est recommandé.',
  },
  en: {
    library: 'Library', effects: 'Effects', transitions: 'Transitions', animations: 'Animations', media: 'Media', templates: 'Templates', projects: 'Projects',
    inspector: 'Inspector', controls: 'Controls', history: 'History', mcp: 'MCP', console: 'Console', scopes: 'Scopes',
    export: 'EXPORT MP4', undo: 'Undo', redo: 'Redo', save: 'Save', share: 'Share', palette: 'Command palette',
    noSelection: 'No layer selected', selectHint: 'Select a clip in the timeline or viewport.', search: 'Search…',
    play: 'Play', pause: 'Pause', loop: 'Loop', mcpActive: 'MCP mode: active', mcpOff: 'MCP mode: unavailable',
    desktopAdvice: 'Narrow screen: collapsible panels. Heavy exports work best on desktop.',
  },
};
let lang = 'fr';
export const setLang = (l) => { lang = DICT[l] ? l : 'fr'; document.documentElement.lang = lang; };
export const t = (k) => DICT[lang][k] ?? DICT.fr[k] ?? k;
export const getLang = () => lang;
