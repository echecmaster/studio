// Stacks d'effets nommés (presets intégrés). Les presets utilisateur sont stockés dans project.presets.
export const EFFECT_PRESETS = [
  { id: 'cinema-chaud', name: 'Cinéma chaud', effects: [{ type: 'lut', params: { look: 'Cinéma chaud', mix: 1 } }, { type: 'vignette', params: { amount: 0.4 } }, { type: 'filmGrain', params: { amount: 0.12 } }] },
  { id: 'cyberpunk', name: 'Cyberpunk', effects: [{ type: 'lut', params: { look: 'Cyberpunk', mix: 1 } }, { type: 'bloom', params: { threshold: 0.6, radius: 50, intensity: 1.1 } }, { type: 'chromaticAberration', params: { amount: 4 } }, { type: 'scanlines', params: { intensity: 0.15 } }] },
  { id: 'retro-vhs', name: 'Rétro VHS', effects: [{ type: 'vhs', params: { noise: 0.35, tracking: 0.35 } }, { type: 'crt', params: { curvature: 0.08, scanlines: 0.3 } }, { type: 'saturation', params: { amount: 0.85 } }] },
  { id: 'film-nb', name: 'Film noir & blanc', effects: [{ type: 'blackWhite', params: {} }, { type: 'contrast', params: { amount: 1.25 } }, { type: 'filmGrain', params: { amount: 0.3 } }, { type: 'dustScratches', params: { dust: 0.6, scratches: 0.4 } }, { type: 'vignette', params: { amount: 0.6 } }] },
  { id: 'reve', name: 'Rêve', effects: [{ type: 'glow', params: { threshold: 0.4, radius: 40, intensity: 1 } }, { type: 'saturation', params: { amount: 0.8 } }, { type: 'fade', params: { amount: 0.15, color: '#2a1f3a' } }] },
  { id: 'glitch', name: 'Glitch', effects: [{ type: 'rgbSplit', params: { amount: 14 } }, { type: 'glitchBlocks', params: { amount: 0.5 } }, { type: 'sliceShift', params: { amount: 0.04 } }] },
  { id: 'neon', name: 'Néon', effects: [{ type: 'neon', params: { color: '#24d26d' } }, { type: 'bloom', params: { threshold: 0.3, intensity: 1.4 } }] },
  { id: 'photo-vintage', name: 'Photo vintage', effects: [{ type: 'lut', params: { look: 'Vintage 70s' } }, { type: 'vignette', params: { amount: 0.5 } }, { type: 'paper', params: { amount: 0.3 } }, { type: 'filmGrain', params: { amount: 0.18 } }] },
  { id: 'hologramme', name: 'Sci-fi hologramme', effects: [{ type: 'hologram', params: {} }, { type: 'glow', params: { threshold: 0.2, intensity: 1.5 } }] },
  { id: 'bd', name: 'Bande dessinée', effects: [{ type: 'comic', params: {} }, { type: 'saturation', params: { amount: 1.4 } }] },
  { id: 'teal-orange', name: 'Teal & Orange', effects: [{ type: 'lut', params: { look: 'Teal & Orange' } }, { type: 'clarity', params: { amount: 0.3 } }] },
  { id: 'nuit', name: 'Vision nocturne', effects: [{ type: 'nightVision', params: {} }, { type: 'filmGrain', params: { amount: 0.25 } }] },
];
export const EFFECT_PRESET_MAP = Object.fromEntries(EFFECT_PRESETS.map((p) => [p.id, p]));
