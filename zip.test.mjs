import test from 'node:test';
import assert from 'node:assert/strict';
import { makeZip } from './zip.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const zipDate = ((2026 - 1980) << 9) | (10 << 5) | 15;

test('stored ZIP headers, CRC, UTF-8 lengths, offsets and deterministic date', () => {
  const entries = [{ name: 'drawings/check.txt', content: '123456789' }, { name: '模型/図面.txt', content: 'Hello, Forma! 🏗️\n' }];
  const bytes = makeZip(entries);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual(bytes, makeZip(entries));
  const view = new DataView(bytes.buffer);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  const offsets = [];
  let cursor = 0;
  for (const entry of entries) {
    offsets.push(cursor);
    const path = encoder.encode(entry.name);
    const content = encoder.encode(entry.content);
    assert.equal(u32(cursor), 0x04034b50);
    assert.equal(u16(cursor + 4), 20);
    assert.equal(u16(cursor + 6), 0x0800);
    assert.equal(u16(cursor + 8), 0);
    assert.equal(u16(cursor + 10), 0);
    assert.equal(u16(cursor + 12), zipDate);
    assert.equal(u32(cursor + 18), content.length);
    assert.equal(u32(cursor + 22), content.length);
    assert.equal(u16(cursor + 26), path.length);
    assert.equal(u16(cursor + 28), 0);
    assert.equal(decoder.decode(bytes.subarray(cursor + 30, cursor + 30 + path.length)), entry.name);
    assert.deepEqual(bytes.subarray(cursor + 30 + path.length, cursor + 30 + path.length + content.length), content);
    cursor += 30 + path.length + content.length;
  }
  assert.equal(u32(14), 0xcbf43926);
  assert.equal(u32(offsets[1] + 14), 0x61f41e6a);
  const centralOffset = cursor;
  for (let i = 0; i < entries.length; i++) {
    const path = encoder.encode(entries[i].name);
    assert.equal(u32(cursor), 0x02014b50);
    assert.equal(u16(cursor + 8), 0x0800);
    assert.equal(u16(cursor + 14), zipDate);
    assert.equal(u32(cursor + 16), u32(offsets[i] + 14));
    assert.equal(u32(cursor + 42), offsets[i]);
    assert.equal(u16(cursor + 28), path.length);
    assert.equal(decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + path.length)), entries[i].name);
    cursor += 46 + path.length;
  }
  assert.equal(u32(cursor), 0x06054b50);
  assert.equal(u16(cursor + 8), 2);
  assert.equal(u16(cursor + 10), 2);
  assert.equal(u32(cursor + 12), cursor - centralOffset);
  assert.equal(u32(cursor + 16), centralOffset);
  assert.equal(u16(cursor + 20), 0);
  assert.equal(bytes.length, cursor + 22);
});

test('empty archive is valid and unsafe or duplicate paths are rejected', () => {
  const empty = makeZip([]);
  assert.equal(empty.length, 22);
  assert.equal(new DataView(empty.buffer).getUint32(0, true), 0x06054b50);
  for (const name of ['', '/root.txt', 'C:/file.txt', '../file.txt', 'a/../b', './file', 'a//b', 'a/', 'a\\b', 'a\u0000b', 'a\u007fb']) {
    assert.throws(() => makeZip([{ name, content: '' }]), /Unsafe/);
  }
  assert.throws(() => makeZip([{ name: 'a', content: '' }, { name: 'a', content: '' }]), /Duplicate/);
  assert.throws(() => makeZip([{ name: 'é', content: '' }, { name: 'e\u0301', content: '' }]), /Duplicate/);
  assert.throws(() => makeZip([{ name: 'a', content: 1 }]), /Unsafe/);
  assert.throws(() => makeZip(null), /count/);
  assert.throws(() => makeZip([{ name: 'x'.repeat(65536), content: '' }]), /large/);
});
