// Adaptateur B : WebMCP natif (navigator.modelContext) — chaque commande devient un outil MCP
import { toMcpContent } from './format.js';

export function installWebMCP(app) {
  const mc = navigator.modelContext;
  const bus = app.bus;
  if (!mc) { app.mcp.webmcpStatus = 'indisponible'; return { available: false, tools: [] }; }
  const log = [];
  app.mcp.webmcpLog = log;
  const tools = bus.registry.toMcpTools('both').map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    async execute(args) {
      const cmd = bus.registry.get(t.name);
      const started = Date.now();
      const res = await bus.run(cmd.name, args || {});
      log.push({ time: started, tool: t.name, args, ok: res.ok, error: res.error, ms: Date.now() - started });
      if (log.length > 200) log.shift();
      app.mcp.onLog?.();
      return toMcpContent(res);
    },
  }));
  let mode = 'registerTool';
  try {
    if (typeof mc.provideContext === 'function') { mc.provideContext({ tools }); mode = 'provideContext'; }
    else if (typeof mc.registerTool === 'function') for (const t of tools) mc.registerTool(t);
    else throw new Error('API modelContext non reconnue');
    app.mcp.webmcpStatus = 'actif';
  } catch (e) {
    app.mcp.webmcpStatus = 'erreur';
    app.log('error', `WebMCP : ${e.message}`);
  }
  bus.app.patch({ mcp: { ...bus.app.get().mcp, webmcp: app.mcp.webmcpStatus } });
  return { available: app.mcp.webmcpStatus === 'actif', tools, mode };
}
