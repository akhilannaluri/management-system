import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export interface IDatabaseState {
  isConnectedToMongo: boolean;
  dbType: 'mongodb' | 'file-store';
}

export const dbState: IDatabaseState = {
  isConnectedToMongo: false,
  dbType: 'file-store'
};

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function connectDB(): Promise<void> {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apartment_mgmt';
  
  try {
    mongoose.set('strictQuery', false);
    // Attempt connection with short timeout so server starts immediately if MongoDB is not running locally
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    dbState.isConnectedToMongo = true;
    dbState.dbType = 'mongodb';
    console.log(`[Database] Successfully connected to MongoDB at ${mongoURI}`);
  } catch (err: any) {
    dbState.isConnectedToMongo = false;
    dbState.dbType = 'file-store';
    console.log(`[Database] MongoDB not reachable at ${mongoURI} (${err.message}). Using persistent JSON storage engine.`);
  }
}

/**
 * File Store helper for persisting data locally if external MongoDB daemon is not running
 */
export class FileStore<T extends { _id?: string; id?: string }> {
  private filePath: string;
  private memoryCache: T[] = [];

  constructor(collectionName: string) {
    this.filePath = path.join(DATA_DIR, `${collectionName}.json`);
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.memoryCache = JSON.parse(raw);
      } else {
        this.memoryCache = [];
        this.saveToFile();
      }
    } catch (e) {
      console.error(`Error reading ${this.filePath}:`, e);
      this.memoryCache = [];
    }
  }

  private saveToFile(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryCache, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error writing ${this.filePath}:`, e);
    }
  }

  async find(filter: Partial<T> | ((item: T) => boolean) = {}): Promise<T[]> {
    this.loadFromFile();
    if (typeof filter === 'function') {
      return this.memoryCache.filter(filter);
    }
    const keys = Object.keys(filter) as (keyof T)[];
    if (keys.length === 0) return [...this.memoryCache];
    return this.memoryCache.filter(item => {
      return keys.every(key => item[key] === filter[key]);
    });
  }

  async findOne(filter: Partial<T> | ((item: T) => boolean)): Promise<T | null> {
    const list = await this.find(filter);
    return list.length > 0 ? list[0] : null;
  }

  async findById(id: string): Promise<T | null> {
    this.loadFromFile();
    return this.memoryCache.find(item => (item._id === id || item.id === id)) || null;
  }

  async create(doc: T): Promise<T> {
    this.loadFromFile();
    const newDoc: any = {
      _id: doc._id || doc.id || 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc
    };
    this.memoryCache.push(newDoc);
    this.saveToFile();
    return newDoc;
  }

  async insertMany(docs: T[]): Promise<T[]> {
    this.loadFromFile();
    const created: T[] = [];
    for (const doc of docs) {
      const newDoc: any = {
        _id: doc._id || doc.id || 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...doc
      };
      this.memoryCache.push(newDoc);
      created.push(newDoc);
    }
    this.saveToFile();
    return created;
  }

  async findByIdAndUpdate(id: string, update: Partial<T>): Promise<T | null> {
    this.loadFromFile();
    const index = this.memoryCache.findIndex(item => (item._id === id || item.id === id));
    if (index === -1) return null;
    const updated = {
      ...this.memoryCache[index],
      ...update,
      updatedAt: new Date().toISOString()
    };
    this.memoryCache[index] = updated;
    this.saveToFile();
    return updated;
  }

  async findOneAndUpdate(filter: Partial<T>, update: Partial<T>, options: { upsert?: boolean } = {}): Promise<T | null> {
    this.loadFromFile();
    const existing = await this.findOne(filter);
    if (existing) {
      return this.findByIdAndUpdate(existing._id || (existing as any).id, update);
    } else if (options.upsert) {
      const created = await this.create({ ...(filter as any), ...update });
      return created;
    }
    return null;
  }

  async findByIdAndDelete(id: string): Promise<boolean> {
    this.loadFromFile();
    const initialLen = this.memoryCache.length;
    this.memoryCache = this.memoryCache.filter(item => item._id !== id && item.id !== id);
    if (this.memoryCache.length !== initialLen) {
      this.saveToFile();
      return true;
    }
    return false;
  }

  async deleteMany(filter: Partial<T>): Promise<number> {
    this.loadFromFile();
    const keys = Object.keys(filter) as (keyof T)[];
    const initialLen = this.memoryCache.length;
    this.memoryCache = this.memoryCache.filter(item => {
      return !keys.every(key => item[key] === filter[key]);
    });
    const deletedCount = initialLen - this.memoryCache.length;
    if (deletedCount > 0) {
      this.saveToFile();
    }
    return deletedCount;
  }

  async countDocuments(filter: Partial<T> = {}): Promise<number> {
    const list = await this.find(filter);
    return list.length;
  }
}
