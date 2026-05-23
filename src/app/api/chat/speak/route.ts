import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const groqKey = process.env.GROQ_API_KEY;

const MAX_TEXT_LENGTH = 2000;

export async function POST(request: Request) {
  if (!groqKey) {
    return NextResponse.json({ error: 'Text-to-speech not configured' }, { status: 500 });
  }

  const clientIp = getClientIdentifier(request);
  const limit = checkRateLimit(`speak:${clientIp}`, RATE_LIMITS.speak);
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many speech requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetIn) } },
    );
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH * 4) {
      // Reject anything way too large up-front before doing any work
      return NextResponse.json({ error: 'Text too long' }, { status: 413 });
    }

    let cleaned = text
      .replace(/GH₵/g, 'Ghana Cedis ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '');

    const truncated = cleaned.length > MAX_TEXT_LENGTH ? cleaned.slice(0, MAX_TEXT_LENGTH) + '...' : cleaned;

    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        voice: 'autumn',
        response_format: 'wav',
        input: truncated,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Speak API] Groq error:', res.status, errText);
      return NextResponse.json({ error: 'Speech generation failed' }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('[Speak API] Error:', err);
    return NextResponse.json({ error: 'Speech generation error' }, { status: 500 });
  }
}
