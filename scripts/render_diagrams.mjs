import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const diagramRoot = resolve(root, 'assets/diagrams');
const manifest = JSON.parse(await readFile(resolve(diagramRoot, 'manifest.json'), 'utf8'));
const selected = new Set(process.argv.slice(2));
const entries = selected.size ? manifest.filter(entry => selected.has(entry.name)) : manifest;
if (!entries.length) throw new Error('No matching diagrams');
if (entries.some(entry => entry.renderer === 'svg')) {
  execFileSync('python3', [resolve(root, 'scripts/render_readable_architecture.py')], { cwd: root, stdio: 'inherit' });
}
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><body style="margin:0;background:#F4F7F8"><main id="figure" style="display:inline-block;padding:24px"></main></body></html>');
      return;
    }
    const path = resolve(root, `.${pathname}`);
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.5 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const { default: mermaid } = await import('/node_modules/mermaid/dist/mermaid.esm.mjs');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      deterministicIds: true,
      fontFamily: 'Inter, "Noto Sans CJK SC", "PingFang SC", Arial, sans-serif',
      themeVariables: {
        background: '#F4F7F8', primaryColor: '#E7F2F0', primaryTextColor: '#101A20',
        primaryBorderColor: '#2D827B', secondaryColor: '#FFF0DD', tertiaryColor: '#F4F7F8',
        lineColor: '#2D827B', textColor: '#101A20', mainBkg: '#E7F2F0',
        clusterBkg: '#EDF2F5', clusterBorder: '#66837F', fontSize: '16px',
        actorBkg: '#E7F2F0', actorBorder: '#2D827B', actorTextColor: '#101A20',
        signalColor: '#101A20', signalTextColor: '#101A20',
        labelBoxBkgColor: '#FFF0DD', labelTextColor: '#101A20',
        edgeLabelBackground: '#F4F7F8', noteBkgColor: '#FFF0DD', noteTextColor: '#101A20',
      },
      flowchart: { htmlLabels: false, curve: 'linear', padding: 18, nodeSpacing: 36, rankSpacing: 48 },
      sequence: { useMaxWidth: false, wrap: true, actorMargin: 48, messageMargin: 36 },
    });
    window.renderDiagram = async (source, id, renderer) => {
      let svg = source;
      if (renderer !== 'svg') {
        await mermaid.parse(source);
        ({ svg } = await mermaid.render(id, source));
      }
      const container = document.querySelector('#figure');
      container.innerHTML = svg;
      const node = container.querySelector('svg');
      const [, , width, height] = node.getAttribute('viewBox').split(/\s+/).map(Number);
      node.style.maxWidth = 'none';
      node.style.width = `${Math.ceil(width)}px`;
      node.style.height = `${Math.ceil(height)}px`;
      node.style.background = '#F4F7F8';
      await document.fonts.ready;
      return { svg: node.outerHTML, width: Math.ceil(width), height: Math.ceil(height) };
    };
  });
  for (const entry of entries) {
    const source = await readFile(resolve(diagramRoot, entry.renderer === 'svg' ? entry.svg : entry.source), 'utf8');
    const result = await page.evaluate(({ source, id, renderer }) => window.renderDiagram(source, id, renderer), {
      source, id: `pamiya-${entry.name}-${entry.locale}`, renderer: entry.renderer,
    });
    if (entry.renderer !== 'svg') await writeFile(resolve(diagramRoot, entry.svg), `${result.svg}\n`);
    await page.locator('#figure').screenshot({ path: resolve(diagramRoot, entry.png) });
    console.log(`${entry.name} (${entry.locale}): ${result.width} × ${result.height}`);
  }
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
