import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, '../../assets/fonts');

const pairs = [
  ['DejaVuSans.ttf', 'C:\\Windows\\Fonts\\arial.ttf'],
  ['DejaVuSans-Bold.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf']
];

fs.mkdirSync(fontsDir, { recursive: true });

for (const [targetName, fallbackPath] of pairs) {
  const targetPath = path.join(fontsDir, targetName);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 10000) {
    console.log(`OK: ${targetName}`);
    continue;
  }
  if (fs.existsSync(fallbackPath)) {
    fs.copyFileSync(fallbackPath, targetPath);
    console.log(`Copied ${fallbackPath} -> ${targetName}`);
    continue;
  }
  console.warn(`Missing font: place ${targetName} into ${fontsDir}`);
}
