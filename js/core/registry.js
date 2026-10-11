// Registre unique des commandes : source de la palette, des outils MCP, de la doc et des tests.

export const toToolName = (name) => name.replace(/\./g, '_');
export const fromToolName = (tool) => tool.replace(/_/, '.'); // le 1er "_" sépare domaine et action

export class Registry {
  constructor() { this.defs = new Map(); }

  register(defs) {
    for (const d of [].concat(defs)) {
      if (!d.name || typeof d.run !== 'function') throw new Error(`Commande invalide : ${d?.name}`);
      if (this.defs.has(d.name)) throw new Error(`Commande dupliquée : ${d.name}`);
      this.defs.set(d.name, {
        category: d.name.split('.')[0],
        args: { type: 'object', properties: {} },
        env: 'any',
        mutates: false,
        ...d,
      });
    }
    return this;
  }

  get(name) { return this.defs.get(name) || this.defs.get(fromToolName(name)) || this._byTool(name); }
  _byTool(tool) { for (const d of this.defs.values()) if (toToolName(d.name) === tool) return d; return undefined; }
  has(name) { return !!this.get(name); }

  list({ query, category, env } = {}) {
    const q = (query || '').toLowerCase();
    return [...this.defs.values()]
      .filter((d) => !category || d.category === category)
      .filter((d) => !env || d.env === 'any' || d.env === env)
      .filter((d) => !q || d.name.includes(q) || (d.title?.fr || '').toLowerCase().includes(q) || (d.description?.fr || '').toLowerCase().includes(q))
      .map((d) => ({
        name: d.name,
        tool: toToolName(d.name),
        category: d.category,
        title: d.title,
        description: d.description,
        inputSchema: d.args,
        env: d.env,
        mutates: d.mutates,
        shortcut: d.shortcut || null,
      }));
  }

  toMcpTools(lang = 'both') {
    return this.list().map((c) => ({
      name: c.tool,
      title: c.title?.fr || c.name,
      description: lang === 'both'
        ? `${c.description?.fr || c.title?.fr || c.name} / ${c.description?.en || c.title?.en || ''}${c.env === 'browser' ? ' [nécessite un onglet Motion Studio ouvert / requires an open tab]' : ''}`
        : (c.description?.[lang] || c.name),
      inputSchema: c.inputSchema,
    }));
  }
}
