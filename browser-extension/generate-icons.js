// Run with: node generate-icons.js
// Uses sharp from the frontend node_modules (no install needed)
const sharp = require('../app/frontend/node_modules/sharp');
const path = require('path');

const sizes = [16, 48, 128];

function svg(size) {
  // Scale font size relative to icon size
  const bumpW = size * 0.28;
  const bumpX = (size - bumpW) / 2;
  const bumpH = size * 0.14;
  const bumpY = size * 0.10;
  const bumpR = size * 0.05;

  const bodyX = size * 0.06;
  const bodyY = size * 0.22;
  const bodyW = size * 0.88;
  const bodyH = size * 0.62;
  const bodyR = size * 0.10;

  const cx = size / 2;
  const cy = size * 0.55;
  const lensOuter = size * 0.24;
  const lensInner = size * 0.18;
  const fontSize = size * 0.22;
  const textY = cy + fontSize * 0.38;

  const flashCx = size * 0.78;
  const flashCy = size * 0.33;
  const flashR = size * 0.055;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#1e293b"/>
  <rect x="${bumpX}" y="${bumpY}" width="${bumpW}" height="${bumpH}" rx="${bumpR}" fill="#3b82f6"/>
  <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${bodyR}" fill="#3b82f6"/>
  <circle cx="${cx}" cy="${cy}" r="${lensOuter}" fill="#1e293b"/>
  <circle cx="${cx}" cy="${cy}" r="${lensInner}" fill="white"/>
  <text x="${cx}" y="${textY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="#1e293b">J</text>
  <circle cx="${flashCx}" cy="${flashCy}" r="${flashR}" fill="#1e293b" opacity="0.45"/>
</svg>`;
}

async function main() {
  for (const size of sizes) {
    const buf = Buffer.from(svg(size));
    const out = path.join(__dirname, `icon-${size}.png`);
    await sharp(buf).png().toFile(out);
    console.log(`Created icon-${size}.png (${size}×${size})`);
  }
}

main().catch(console.error);
