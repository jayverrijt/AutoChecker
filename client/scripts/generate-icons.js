import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_ICON = '/Users/jayv/.gemini/antigravity/brain/c273df9e-1124-4160-b001-7095acb3d706/vrijcheck_app_icon.png';
const RES_DIR = path.resolve(__dirname, '../android/app/src/main/res');
const PUBLIC_DIR = path.resolve(__dirname, '../public');

async function run() {
  console.log('Loading master icon:', MASTER_ICON);
  const image = sharp(MASTER_ICON);
  const metadata = await image.metadata();

  // 1. Get top-left pixel color for background
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const hexBg = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  console.log(`Detected background color: ${hexBg} (rgb: ${r}, ${g}, ${b})`);

  // Update ic_launcher_background.xml
  const bgXmlPath = path.join(RES_DIR, 'values/ic_launcher_background.xml');
  fs.writeFileSync(bgXmlPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${hexBg}</color>
</resources>
`);
  console.log('Updated ic_launcher_background.xml with:', hexBg);

  // Remove drawable-v24/ic_launcher_foreground.xml if it exists so mipmap is used
  const oldXmlForeground = path.join(RES_DIR, 'drawable-v24/ic_launcher_foreground.xml');
  if (fs.existsSync(oldXmlForeground)) {
    fs.unlinkSync(oldXmlForeground);
    console.log('Removed old default drawable-v24/ic_launcher_foreground.xml');
  }

  // 2. Generate Public Assets
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  await sharp(MASTER_ICON)
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon.png'));

  await sharp(MASTER_ICON)
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  console.log('Updated public/icon.png and public/favicon.png');

  // Densities definitions
  const densities = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const { name, iconSize, fgSize } of densities) {
    const dir = path.join(RES_DIR, name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // A. ic_launcher.png (standard square icon with rounded corners)
    await sharp(MASTER_ICON)
      .resize(iconSize, iconSize)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // B. ic_launcher_round.png (circular mask for round icon launchers)
    const circleSvg = Buffer.from(
      `<svg width="${iconSize}" height="${iconSize}"><circle cx="${iconSize/2}" cy="${iconSize/2}" r="${iconSize/2}" fill="#ffffff"/></svg>`
    );
    await sharp(MASTER_ICON)
      .resize(iconSize, iconSize)
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // C. ic_launcher_foreground.png for Adaptive Icons (108dp canvas with safe zone)
    // The avocado superhero is placed inside the 72dp safe zone (66% of canvas)
    const innerSize = Math.round(fgSize * 0.72);
    const innerBuffer = await sharp(MASTER_ICON)
      .resize(innerSize, innerSize, { fit: 'contain' })
      .png()
      .toBuffer();

    const padding = Math.round((fgSize - innerSize) / 2);

    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: innerBuffer,
        left: padding,
        top: padding
      }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${name} (${iconSize}x${iconSize}, fg: ${fgSize}x${fgSize})`);
  }

  console.log('All icons generated successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
