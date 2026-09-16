// Minimal ZIP writer, store method only.
//
// The files bundled here are PNGs, which are already compressed, so deflating
// them again would cost CPU and save nothing. Store-only keeps this small
// enough to avoid adding a dependency for one download button.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// MS-DOS date/time: seconds have 2-second resolution, years start at 1980.
function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return {time, day};
}

function writer(length) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  return {
    bytes,
    u16(value) { view.setUint16(offset, value, true); offset += 2; },
    u32(value) { view.setUint32(offset, value >>> 0, true); offset += 4; },
    raw(source) { bytes.set(source, offset); offset += source.length; },
    get offset() { return offset; },
  };
}

/**
 * @param {Array<{name: string, bytes: Uint8Array}>} entries
 * @param {Date} [now] fixed timestamp, for deterministic output in tests
 * @returns {Blob}
 */
export function zip(entries, now = new Date()) {
  const {time, day} = dosStamp(now);
  const encoder = new TextEncoder();
  const prepared = entries.map(entry => {
    const name = encoder.encode(entry.name);
    return {name, bytes: entry.bytes, crc: crc32(entry.bytes)};
  });

  const localSize = prepared.reduce((total, item) => total + 30 + item.name.length + item.bytes.length, 0);
  const centralAllocation = prepared.reduce((total, item) => total + 46 + item.name.length, 0);
  const out = writer(localSize + centralAllocation + 22);

  const offsets = [];
  for (const item of prepared) {
    offsets.push(out.offset);
    out.u32(0x04034b50);
    out.u16(20); out.u16(0); out.u16(0);      // version, flags, method (0 = store)
    out.u16(time); out.u16(day);
    out.u32(item.crc);
    out.u32(item.bytes.length); out.u32(item.bytes.length);
    out.u16(item.name.length); out.u16(0);
    out.raw(item.name); out.raw(item.bytes);
  }

  const centralStart = out.offset;
  prepared.forEach((item, index) => {
    out.u32(0x02014b50);
    out.u16(20); out.u16(20); out.u16(0); out.u16(0);
    out.u16(time); out.u16(day);
    out.u32(item.crc);
    out.u32(item.bytes.length); out.u32(item.bytes.length);
    out.u16(item.name.length);
    out.u16(0); out.u16(0); out.u16(0); out.u16(0);
    out.u32(0);
    out.u32(offsets[index]);
    out.raw(item.name);
  });

  // Measured before the end record is written; out.offset would otherwise
  // include the end record's own bytes and the archive would not open.
  const centralSize = out.offset - centralStart;
  out.u32(0x06054b50);
  out.u16(0); out.u16(0);
  out.u16(prepared.length); out.u16(prepared.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0);

  return new Blob([out.bytes], {type: 'application/zip'});
}

/** Names that are safe inside a zip and on every desktop filesystem. */
export function safeEntryName(label, index, extension = 'png') {
  const slug = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'preview';
  return `${String(index + 1).padStart(2, '0')}-${slug}.${extension}`;
}
