import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface IFlat extends Document {
  flatNumber: string;
  block?: string;
  floor?: number;
  residentName: string;
  residentType?: 'Owner' | 'Tenant';
  phone?: string;
  email?: string;
  occupancyStatus?: 'Occupied' | 'Vacant';
  status?: 'Active' | 'Inactive';
  customMaintenanceAmount?: number | null;
  notes?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const FlatSchema: Schema = new Schema(
  {
    flatNumber: { type: String, required: true, unique: true, trim: true, index: true },
    block: { type: String, default: '', trim: true },
    floor: { type: Number, default: 1 },
    residentName: { type: String, required: true, trim: true },
    residentType: { type: String, enum: ['Owner', 'Tenant'], default: 'Owner' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    occupancyStatus: { type: String, enum: ['Occupied', 'Vacant'], default: 'Occupied' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    customMaintenanceAmount: { type: Number, default: null },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const FlatModel = mongoose.models.Flat || mongoose.model<IFlat>('Flat', FlatSchema);

export const FlatStore = new FileStore<any>('flats');
