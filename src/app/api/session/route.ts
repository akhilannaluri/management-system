import { NextResponse } from 'next/server';
import { db } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId } = body;

    if (action === 'create') {
      const session = db.createSession();
      return NextResponse.json(session);
    }

    if (action === 'stop' && sessionId) {
      const session = db.stopSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(session);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const session = db.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}
