import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = async name => (await readFile(new URL(name, root), 'utf8')).replace(/\r\n?/g, '\n');
const [shell, css, model, zip, app, icon] = await Promise.all(['app-shell.html','styles.css','model.mjs','zip.mjs','app.mjs','favicon.svg'].map(read));
const stripExports = source => source.replace(/^export /gm, '');
const script = `(()=>{\n'use strict';\n${stripExports(model)}\n${stripExports(zip)}\n${app.replace(/^import .*;\n/gm, '')}\n})();`.replace(/<\/script/gi,'<\\/script');
const hash = text => createHash('sha256').update(text).digest('base64');
const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = shell
  .replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/, (_, start, end) => start + policy + end)
  .replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(icon.trim())}">`)
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/\s*<script type="module" src="\.\/app\.mjs"><\/script>/, '')
  .replace('</body>', () => `<script>${script}</script>\n</body>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('index.html', root), html);
await writeFile(new URL('dist/index.html', root), html);
console.log(`Built self-contained preview and Vercel page: ${fileURLToPath(new URL('dist/index.html', root))}`);
