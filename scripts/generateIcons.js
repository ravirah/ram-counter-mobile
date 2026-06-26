/**
 * Generate app icon, adaptive icon, and splash screen PNGs.
 *
 * Usage:
 *   npm install canvas --save-dev   (one-time)
 *   node scripts/generateIcons.js
 */
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Register Nirmala UI (Windows Devanagari font) so "राम" renders correctly
registerFont('C:/Windows/Fonts/Nirmala.ttc', { family: 'Nirmala' });

const SAFFRON = '#FF9933';
const WHITE = '#FFFFFF';
const FONT_FAMILY = 'Nirmala';
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// --- Helper ---
function drawRamText(ctx, text, fontSize, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// --- 1. icon.png (1024x1024) ---
function generateIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Saffron background with rounded feel (full square — stores will round it)
  ctx.fillStyle = SAFFRON;
  ctx.fillRect(0, 0, size, size);

  // Decorative circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  // "राम" text
  drawRamText(ctx, 'राम', 420, size / 2, size / 2 + 20, WHITE);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), buf);
  console.log('Created assets/icon.png');
}

// --- 2. adaptive-icon.png (1024x1024, safe zone centered) ---
function generateAdaptiveIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent bg — adaptive icon uses backgroundColor from app.json
  ctx.clearRect(0, 0, size, size);

  // Saffron fill (foreground layer, will be masked by Android)
  ctx.fillStyle = SAFFRON;
  ctx.fillRect(0, 0, size, size);

  // Decorative circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.30, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  // "राम" text — keep in the safe zone (inner 66%)
  drawRamText(ctx, 'राम', 340, size / 2, size / 2 + 16, WHITE);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), buf);
  console.log('Created assets/adaptive-icon.png');
}

// --- 3. splash.png (1284x2778 — iPhone 14 Pro Max ratio, works everywhere) ---
function generateSplash() {
  const width = 1284;
  const height = 2778;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Saffron background
  ctx.fillStyle = SAFFRON;
  ctx.fillRect(0, 0, width, height);

  // Decorative circles
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.38, 200, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width / 2, height * 0.38, 300, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // "राम" big text
  drawRamText(ctx, 'राम', 280, width / 2, height * 0.36, WHITE);

  // "Bank" subtitle
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold 80px "${FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Bank', width / 2, height * 0.36 + 200);

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `36px "${FONT_FAMILY}"`;
  ctx.fillText('Count your blessings', width / 2, height * 0.36 + 290);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), buf);
  console.log('Created assets/splash.png');
}

// --- Run all ---
generateIcon();
generateAdaptiveIcon();
generateSplash();
console.log('\nAll icons generated successfully!');
