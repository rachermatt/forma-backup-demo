// A small, browser-compatible ZIP writer using stored (uncompressed) entries.
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
const crc32 = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
};
const date = ((2026 - 1980) << 9) | (10 << 5) | 15;
const max32 = 0xffffffff;

export function makeZip(entries) {
  if (!Array.isArray(entries) || entries.length > 65535) throw new Error('Invalid ZIP entry count');
  const names = new Set();
  // Validate the entire input before constructing the archive.
  for (const entry of entries) {
    const name = entry?.name;
    if (typeof name !== 'string' || !name || name.startsWith('/') || /^[a-z]:/i.test(name)
      || /[\\\u0000-\u001f\u007f-\u009f]/.test(name)
      || name.split('/').some(part => !part || part === '.' || part === '..')
      || typeof entry.content !== 'string') throw new Error('Unsafe ZIP entry');
    const key = name.normalize('NFC');
    if (names.has(key)) throw new Error('Duplicate ZIP entry');
    names.add(key);
  }
  const files = entries.map(({ name, content }) => {
    const path = encoder.encode(name);
    const data = encoder.encode(content);
    if (path.length > 65535 || data.length > max32) throw new Error('ZIP entry is too large');
    return { path, data, crc: crc32(data), offset: 0 };
  });
  const localSize = files.reduce((size, f) => size + 30 + f.path.length + f.data.length, 0);
  const centralSize = files.reduce((size, f) => size + 46 + f.path.length, 0);
  if (localSize + centralSize + 22 > max32) throw new Error('ZIP64 is not supported');
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  let cursor = 0;
  const u16 = value => { view.setUint16(cursor, value, true); cursor += 2; };
  const u32 = value => { view.setUint32(cursor, value, true); cursor += 4; };
  const append = value => { bytes.set(value, cursor); cursor += value.length; };
  for (const file of files) {
    file.offset = cursor;
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(0); u16(date);
    u32(file.crc); u32(file.data.length); u32(file.data.length);
    u16(file.path.length); u16(0); append(file.path); append(file.data);
  }
  for (const file of files) {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(date);
    u32(file.crc); u32(file.data.length); u32(file.data.length);
    u16(file.path.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(file.offset);
    append(file.path);
  }
  u32(0x06054b50); u16(0); u16(0); u16(files.length); u16(files.length);
  u32(centralSize); u32(localSize); u16(0);
  return bytes;
}
