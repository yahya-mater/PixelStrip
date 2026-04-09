// =============================================
// exporter.js — Export to PNG, JPG, ICO
// =============================================

import { getCanvas } from './canvas.js';
import { state } from './state.js';
import { showToast } from './ui.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PNG Export ───────────────────────────────

export function exportPNG() {
  const canvas = getCanvas();
  if (!canvas) { showToast('No image to export', 'error'); return; }

  canvas.toBlob(blob => {
    downloadBlob(blob, 'pixelstrip-export.png');
    showToast('PNG exported!', 'success');
  }, 'image/png');
}

// ── JPG Export ───────────────────────────────

export function exportJPG() {
  const canvas = getCanvas();
  if (!canvas) { showToast('No image to export', 'error'); return; }

  // JPG doesn't support transparency — composite over white bg
  const flat = document.createElement('canvas');
  flat.width  = canvas.width;
  flat.height = canvas.height;
  const fCtx  = flat.getContext('2d');
  fCtx.fillStyle = '#ffffff';
  fCtx.fillRect(0, 0, flat.width, flat.height);
  fCtx.drawImage(canvas, 0, 0);

  flat.toBlob(blob => {
    downloadBlob(blob, 'pixelstrip-export.jpg');
    showToast('JPG exported!', 'success');
  }, 'image/jpeg', state.jpgQuality);
}

// ── ICO Export ──────────────────────────────
// ICO format: 16×16, 32×32, 48×48 (Windows standard)

export function exportICO() {
  const canvas = getCanvas();
  if (!canvas) { showToast('No image to export', 'error'); return; }

  const sizes = [16, 32, 48, 64, 96, 128, 256];
  const pngBlobs = [];
  let pending = sizes.length;

  sizes.forEach(size => {
    const tmp = document.createElement('canvas');
    tmp.width  = size;
    tmp.height = size;
    tmp.getContext('2d').drawImage(canvas, 0, 0, size, size);
    tmp.toBlob(blob => {
      blob.arrayBuffer().then(buf => {
        pngBlobs.push({ size, buf });
        pending--;
        if (pending === 0) buildICO(pngBlobs);
      });
    }, 'image/png');
  });
}

function buildICO(entries) {
  // Sort: 16, 32, 48
  entries.sort((a, b) => a.size - b.size);
  const count = entries.length;

  // ICO header: 6 bytes
  // Each directory entry: 16 bytes
  // Then PNG data blobs concatenated

  const headerSize = 6 + count * 16;
  let totalSize = headerSize;
  entries.forEach(e => { totalSize += e.buf.byteLength; });

  const buffer = new ArrayBuffer(totalSize);
  const view   = new DataView(buffer);

  // ICONDIR header
  view.setUint16(0, 0, true);      // Reserved
  view.setUint16(2, 1, true);      // Type: 1 = ICO
  view.setUint16(4, count, true);  // Image count

  let imageOffset = headerSize;

  entries.forEach((entry, i) => {
    const { size, buf } = entry;
    const dirOffset = 6 + i * 16;

    // ICONDIRENTRY
    view.setUint8(dirOffset + 0, size === 256 ? 0 : size); // Width (0 = 256)
    view.setUint8(dirOffset + 1, size === 256 ? 0 : size); // Height
    view.setUint8(dirOffset + 2, 0);  // Color count (0 = no palette)
    view.setUint8(dirOffset + 3, 0);  // Reserved
    view.setUint16(dirOffset + 4, 1, true); // Color planes
    view.setUint16(dirOffset + 6, 32, true); // Bits per pixel
    view.setUint32(dirOffset + 8, buf.byteLength, true); // Data size
    view.setUint32(dirOffset + 12, imageOffset, true);   // Data offset

    // Copy PNG bytes
    const src  = new Uint8Array(buf);
    const dest = new Uint8Array(buffer, imageOffset, buf.byteLength);
    dest.set(src);

    imageOffset += buf.byteLength;
  });

  const blob = new Blob([buffer], { type: 'image/x-icon' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'pixelstrip-icon.ico';
  a.click();
  URL.revokeObjectURL(url);
  showToast('ICO exported (16/32/48/64/96/128/256px)!', 'success');
}