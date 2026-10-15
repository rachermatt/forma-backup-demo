import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.mjs', root))]);
const html = readFileSync(new URL('index.html', root), 'utf8');

test('double-click preview is self-contained and compiles without module imports', () => {
  assert.equal(readFileSync(new URL('dist/index.html', root), 'utf8'), html);
  assert.doesNotMatch(html, /<(script|link)\b[^>]*(src|href)="(?!data:)[^"]+"/i);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(scripts[0][1], /^\s*(import |export )/m);
  assert.doesNotThrow(() => new Script(scripts[0][1]));
  assert.ok(html.indexOf('<script>') > html.indexOf('id="file-dialog"'));
});

test('embedded styling and scripts exactly match the Content Security Policy hashes', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const source of [script, css]) {
    const hash = createHash('sha256').update(source).digest('base64');
    assert.ok(policy.includes(`'sha256-${hash}'`));
  }
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  assert.match(policy, /connect-src 'none'/);
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  assert.ok(!config.headers.some(route => route.headers.some(header => header.key.toLowerCase() === 'content-security-policy')));
});
