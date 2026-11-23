import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createNotebookPng(width, height) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  // Colors
  const bgR = 15, bgG = 23, bgB = 42;          // #0f172a Slate 900
  const pageR = 250, pageG = 250, pageB = 250; // White paper
  const gridR = 186, gridG = 230, gridB = 253; // #bae6fd Light sky blue grid
  const marginR = 239, marginG = 68, marginB = 68; // #ef4444 Red margin line
  const spiralR = 148, spiralG = 163, spiralB = 184; // Spiral ring silver

  // Pad margins for notebook page
  const padX = Math.round(width * 0.16);
  const padY = Math.round(height * 0.12);
  const pageW = width - padX * 2;
  const pageH = height - padY * 2;
  const marginX = padX + Math.round(pageW * 0.22);
  const spiralX = padX + Math.round(pageW * 0.08);

  const cellSize = Math.max(4, Math.round(width / 24));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowSize);
    rawData[rowOffset] = 0; // Filter byte

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Inside notebook page?
      const inPage = x >= padX && x <= (padX + pageW) && y >= padY && y <= (padY + pageH);

      if (inPage) {
        // Red vertical margin line
        if (x === marginX || x === marginX + 1) {
          rawData[pixelOffset] = marginR;
          rawData[pixelOffset + 1] = marginG;
          rawData[pixelOffset + 2] = marginB;
          rawData[pixelOffset + 3] = 255;
          continue;
        }

        // Spiral binder holes
        if (Math.abs(x - spiralX) <= 2 && (y % Math.round(height / 7) <= 3)) {
          rawData[pixelOffset] = spiralR;
          rawData[pixelOffset + 1] = spiralG;
          rawData[pixelOffset + 2] = spiralB;
          rawData[pixelOffset + 3] = 255;
          continue;
        }

        // Math grid lines (every cellSize pixels)
        const isGridX = (x - padX) % cellSize === 0;
        const isGridY = (y - padY) % cellSize === 0;

        if (isGridX || isGridY) {
          rawData[pixelOffset] = gridR;
          rawData[pixelOffset + 1] = gridG;
          rawData[pixelOffset + 2] = gridB;
          rawData[pixelOffset + 3] = 255;
        } else {
          // White paper surface
          rawData[pixelOffset] = pageR;
          rawData[pixelOffset + 1] = pageG;
          rawData[pixelOffset + 2] = pageB;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Outer dark gradient background
        const grad = (y / height) * 20;
        rawData[pixelOffset] = Math.min(255, bgR + grad);
        rawData[pixelOffset + 1] = Math.min(255, bgG + grad);
        rawData[pixelOffset + 2] = Math.min(255, bgB + grad + 15);
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([lenBuf, typeAndData, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

const png192 = createNotebookPng(192, 192);
const png512 = createNotebookPng(512, 512);

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), png192);
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), png512);
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), png512);
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), png192);
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), png192);

console.log('Notebook graph paper PWA icons successfully generated in /public');
