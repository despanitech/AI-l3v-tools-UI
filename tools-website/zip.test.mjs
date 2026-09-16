import assert from 'node:assert/strict';
import test from 'node:test';
import {zip, safeEntryName} from './src/lib/zip.mjs';

const STAMP = new Date(2026, 8, 16, 10, 30, 0);
const bytesOf = async blob => new Uint8Array(await blob.arrayBuffer());
const u16 = (view, at) => view.getUint16(at, true);
const u32 = (view, at) => view.getUint32(at, true);

function endRecord(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = bytes.length - 22;
  assert.equal(u32(view, at), 0x06054b50, 'end-of-central-directory signature');
  return {at, entries: u16(view, at + 10), size: u32(view, at + 12), offset: u32(view, at + 16)};
}

test('the central directory is located exactly where the end record claims', async () => {
  // Regression: the size was once measured after the end record had already
  // been written, so it was 12 bytes too large and no reader could open it.
  const bytes = await bytesOf(zip([
    {name: 'a.png', bytes: new Uint8Array([1, 2, 3])},
    {name: 'b.png', bytes: new Uint8Array([4, 5])},
  ], STAMP));
  const end = endRecord(bytes);
  assert.equal(end.offset + end.size, end.at, 'central directory must end where the end record begins');
  const view = new DataView(bytes.buffer);
  assert.equal(u32(view, end.offset), 0x02014b50, 'central directory header signature');
});

test('every entry is recorded once in both the local headers and the directory', async () => {
  const entries = [
    {name: '01-tattoo.png', bytes: new Uint8Array(40)},
    {name: '02-tote.png', bytes: new Uint8Array(7)},
    {name: '03-cap.png', bytes: new Uint8Array(0)},
  ];
  const bytes = await bytesOf(zip(entries, STAMP));
  const end = endRecord(bytes);
  assert.equal(end.entries, entries.length);
  const view = new DataView(bytes.buffer);
  assert.equal(u32(view, 0), 0x04034b50, 'first local file header signature');
  let seen = 0, cursor = end.offset;
  while (seen < end.entries) {
    assert.equal(u32(view, cursor), 0x02014b50);
    const nameLength = u16(view, cursor + 28);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    assert.equal(name, entries[seen].name);
    // Stored, not deflated: both size fields match the input length.
    assert.equal(u32(view, cursor + 20), entries[seen].bytes.length);
    assert.equal(u32(view, cursor + 24), entries[seen].bytes.length);
    cursor += 46 + nameLength + u16(view, cursor + 30) + u16(view, cursor + 32);
    seen++;
  }
  assert.equal(cursor, end.at, 'directory consumed exactly');
});

test('stored entries declare no compression', async () => {
  const bytes = await bytesOf(zip([{name: 'a.png', bytes: new Uint8Array([9, 9, 9])}], STAMP));
  const view = new DataView(bytes.buffer);
  assert.equal(u16(view, 8), 0, 'local header compression method');
});

test('a known payload produces the documented CRC', async () => {
  // CRC-32 of "123456789" is the standard check value for this polynomial.
  const bytes = await bytesOf(zip([
    {name: 'check.bin', bytes: new TextEncoder().encode('123456789')},
  ], STAMP));
  const view = new DataView(bytes.buffer);
  assert.equal(u32(view, 14), 0xcbf43926);
});

test('an empty archive is still a valid archive', async () => {
  const bytes = await bytesOf(zip([], STAMP));
  assert.equal(bytes.length, 22);
  const end = endRecord(bytes);
  assert.equal(end.entries, 0);
  assert.equal(end.size, 0);
});

test('entry names are made safe for any filesystem', () => {
  assert.equal(safeEntryName('Upper-arm tattoo', 0), '01-upper-arm-tattoo.png');
  assert.equal(safeEntryName('Canvas tote!! (large)', 1), '02-canvas-tote-large.png');
  assert.equal(safeEntryName('', 2), '03-preview.png');
  assert.equal(safeEntryName(null, 9), '10-preview.png');
  assert.equal(safeEntryName('../../etc/passwd', 0), '01-etc-passwd.png', 'no path traversal survives');
  assert.ok(!safeEntryName('a'.repeat(200), 0).includes('/'));
});
