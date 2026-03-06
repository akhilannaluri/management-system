export interface Student {
  id: string;
  name: string;
  timestamp: string;
}

export interface Session {
  id: string;
  createdAt: string;
  active: boolean;
  students: Student[];
}

// In-memory data store for the prototype
class Store {
  sessions: Map<string, Session> = new Map();

  createSession(): Session {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const session: Session = {
      id,
      createdAt: new Date().toISOString(),
      active: true,
      students: []
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  stopSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.active = false;
    }
    return session;
  }

  addStudent(sessionId: string, studentId: string, name: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) return false;
    
    // Prevent duplicate check-ins
    if (session.students.find(s => s.id === studentId)) return true;

    session.students.push({
      id: studentId,
      name,
      timestamp: new Date().toISOString()
    });
    return true;
  }
}

// Singleton instance
export const db = new Store();
