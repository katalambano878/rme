import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const groqKey = process.env.GROQ_API_KEY;

// Hard cap on uploaded audio size (bytes). Whisper API itself caps at 25 MB,
// but we don't need anything close to that for chat snippets — anything over a
// minute or two is almost certainly abuse.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(request: Request) {
  if (!groqKey) {
    return NextResponse.json({ error: 'Speech-to-text not configured' }, { status: 500 });
  }

  const clientIp = getClientIdentifier(request);
  const limit = checkRateLimit(`transcribe:${clientIp}`, RATE_LIMITS.transcribe);
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many transcription requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetIn) } },
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file too large (max 4 MB)' }, { status: 413 });
    }

    // Forward to Groq Whisper API
    const groqForm = new FormData();
    groqForm.append('file', audioFile, audioFile.name || 'audio.webm');
    groqForm.append('model', 'whisper-large-v3');
    groqForm.append('temperature', '0');
    groqForm.append('response_format', 'verbose_json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: groqForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Transcribe API] Groq error:', res.status, errText);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.text || '',
      language: data.language || 'en',
      duration: data.duration || 0,
    });
  } catch (err: any) {
    console.error('[Transcribe API] Error:', err);
    return NextResponse.json({ error: 'Transcription error' }, { status: 500 });
  }
}
