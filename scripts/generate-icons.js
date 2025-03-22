import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 48, 128];
const sourceIcon = join(__dirname, "../public/logo.svg");

async function generateIcons() {
  for (const size of sizes) {
    await sharp(sourceIcon, { density: 300 }) // Higher density for better SVG rendering
      .resize(size, size)
      .png() // Convert SVG to PNG
      .toFile(join(__dirname, `../public/icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error);
