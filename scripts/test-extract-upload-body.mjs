/**
 * Verifies multipart extraction against browser-style upload bodies.
 * Run: node scripts/test-extract-upload-body.mjs
 */
import { Buffer } from "node:buffer"
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"

// Transpile the real TS source with tsc so we test the shipped implementation.
const ts = (await import("typescript")).default
const sourcePath =
  process.env.EXTRACT_SRC || "src/lib/extract-upload-body.ts"
const tsSource = readFileSync(sourcePath, "utf8")
const { outputText: jsSource } = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const dir = mkdtempSync(join(tmpdir(), "extract-test-"))
const modPath = join(dir, "extract.mjs")
writeFileSync(modPath, jsSource)
const { extractUploadBody, isMultipartWrapper } = await import(
  `file://${modPath}`
)

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d494844520000000100000001080600000" +
    "01f15c4890000000a49444154789c6300010000050001" +
    "0d0a2db40000000049454e44ae426082",
  "hex",
)
// Image whose final byte is 0x0a to catch over-eager CRLF trimming.
const TRICKY = Buffer.concat([PNG, Buffer.from([0x0a])])

function buildMultipart(boundary, filename, fileBytes, fileType) {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="cacheControl"\r\n\r\n` +
      `3600\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name=""; filename="${filename}"\r\n` +
      `Content-Type: ${fileType}\r\n\r\n`,
    "latin1",
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "latin1")
  return Buffer.concat([head, fileBytes, tail])
}

let failures = 0
function check(name, actual, expected) {
  const ok = Buffer.isBuffer(actual)
    ? actual.equals(expected)
    : actual === expected
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  if (!ok) {
    failures++
    console.log(
      `      expected ${expected.length ?? expected} bytes, got ${actual.length ?? actual}`,
    )
  }
}

// 1. Real Supabase browser boundary (mixed case) — the reported bug.
const wk = "----WebKitFormBoundaryExixLZTNTJ7tKuo2"
check(
  "mixed-case WebKit boundary from header",
  extractUploadBody(
    buildMultipart(wk, "photo.png", PNG, "image/png"),
    `multipart/form-data; boundary=${wk}`,
  ),
  PNG,
)

// 2. Same body, but header omitted (boundary sniffed from bytes).
check(
  "boundary sniffed from body",
  extractUploadBody(buildMultipart(wk, "photo.png", PNG, "image/png"), null),
  PNG,
)

// 3. curl-style long dashed boundary with mixed case.
const curlB = "------------------------aBcDeF1234567890"
check(
  "curl-style boundary",
  extractUploadBody(
    buildMultipart(curlB, "photo.png", PNG, "image/png"),
    `multipart/form-data; boundary=${curlB}`,
  ),
  PNG,
)

// 4. Quoted boundary value.
check(
  "quoted boundary",
  extractUploadBody(
    buildMultipart(wk, "photo.png", PNG, "image/png"),
    `multipart/form-data; boundary="${wk}"`,
  ),
  PNG,
)

// 5. Image data ending in 0x0a must survive intact.
check(
  "trailing newline byte preserved",
  extractUploadBody(
    buildMultipart(wk, "photo.png", TRICKY, "image/png"),
    `multipart/form-data; boundary=${wk}`,
  ),
  TRICKY,
)

// 6. Raw (non-multipart) bodies pass through untouched.
check(
  "raw png passthrough",
  extractUploadBody(PNG, "image/png"),
  PNG,
)

// 7. JPEG payload.
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 0x41),
  Buffer.from([0xff, 0xd9]),
])
check(
  "jpeg payload",
  extractUploadBody(
    buildMultipart(wk, "photo.jpeg", JPEG, "image/jpeg"),
    `multipart/form-data; boundary=${wk}`,
  ),
  JPEG,
)

// 8. Wrapper detection helpers.
check("isMultipartWrapper(multipart)", isMultipartWrapper(
  buildMultipart(wk, "p.png", PNG, "image/png"),
), true)
check("isMultipartWrapper(png)", isMultipartWrapper(PNG), false)

// 9. Extracted output must never still look like a wrapper.
check(
  "extracted is not a wrapper",
  isMultipartWrapper(
    extractUploadBody(
      buildMultipart(wk, "photo.png", PNG, "image/png"),
      `multipart/form-data; boundary=${wk}`,
    ),
  ),
  false,
)

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
