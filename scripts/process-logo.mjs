import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

const source =
  "C:/Users/hp/.cursor/projects/c-Users-hp-OneDrive-Desktop-websites-trust-ecom/assets/trustlink-mall-logo.png"

const output = path.join(root, "public", "brand", "trustlink-mall-logo.png")

function isBackground(r, g, b) {
  if (r >= 248 && g >= 248 && b >= 248) return true

  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
  if (maxDiff <= 12 && r >= 165 && g >= 165 && b >= 165) return true

  return false
}

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  if (isBackground(r, g, b)) {
    data[i + 3] = 0
  }
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 10 })
  .resize({ width: 420, withoutEnlargement: true })
  .extend({
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile(output)

console.log(`Saved ${output}`)
