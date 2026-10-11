// Mise en forme des résultats de commandes en contenu MCP (texte + images)
export function toMcpContent(res) {
  if (!res.ok) return { isError: true, content: [{ type: 'text', text: `Erreur : ${res.error}` }] };
  const r = res.result;
  const content = [];
  const pushImage = (dataUrl) => {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    if (m) content.push({ type: 'image', data: m[2], mimeType: m[1] });
  };
  if (r && typeof r === 'object' && typeof r.dataUrl === 'string') {
    pushImage(r.dataUrl);
    const { dataUrl, ...rest } = r;
    content.push({ type: 'text', text: JSON.stringify(rest) });
  } else if (r && typeof r === 'object' && typeof r.base64 === 'string' && r.mime) {
    const { base64, ...rest } = r;
    content.push({ type: 'resource', resource: { uri: `motion://export/${rest.filename}`, mimeType: rest.mime, blob: base64 } }, { type: 'text', text: JSON.stringify(rest) });
  } else content.push({ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r ?? null, null, 0) });
  return { content };
}
