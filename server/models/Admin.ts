import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { dbState, FileStore } from '../config/db';

export interface IAdmin extends Document {
  username: string;
  password: string;
  email?: string;
  name: string;
  phone?: string;
  role: 'admin';
  createdAt?: string | Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export const AdminSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, default: '' },
    name: { type: String, default: 'Apartment Administrator' },
    phone: { type: String, default: '' },
    role: { type: String, default: 'admin' }
  },
  { timestamps: true }
);

AdminSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
  } catch (err: any) {
    throw err;
  }
});

AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const AdminModel = mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);

export const AdminStore = new FileStore<any>('admins');
