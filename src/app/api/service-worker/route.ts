import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Explicit SW serve for Coolify/Next 16 when public/*.js is not routed. */
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'service-worker.js');
  try {
    const body = await readFile(filePath, 'utf8');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch {
    return new Response('// service worker missing\n', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }
}
