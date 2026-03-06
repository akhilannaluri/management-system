import { NextResponse } from 'next/server';
import { db } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, studentId, name } = body;

    if (!sessionId || !studentId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const success = db.addStudent(sessionId, studentId, name);

    if (!success) {
      return NextResponse.json(
        { error: 'Session is invalid, inactive, or not found' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Check-in successful' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
