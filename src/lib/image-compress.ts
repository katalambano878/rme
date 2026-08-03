/** Pass-through image helper (no sharp dependency). */
export async function compressImageBuffer(
  input: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  return { buffer: input, contentType: contentType || "application/octet-stream" }
}
