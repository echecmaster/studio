// Registre global : toutes les commandes de Motion Studio (source unique pour UI, palette, motionAPI, WebMCP, MCP distant)
import { Registry } from '../registry.js';
import project from './project.js';
import assets from './assets.js';
import tracks from './tracks.js';
import clips from './clips.js';
import effects from './effects.js';
import animation from './animation.js';
import timeline from './timeline.js';
import system from './system.js';

export function createRegistry() {
  return new Registry().register([...project, ...assets, ...tracks, ...clips, ...effects, ...animation, ...timeline, ...system]);
}

export const registry = createRegistry();
