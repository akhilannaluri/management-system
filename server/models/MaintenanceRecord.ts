import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface IMaintenanceRecord extends Document {
  month: string; // YYYY-MM
  flatId: string;
  flatNumber: string;
  residentName: string;
  amount: number;
  status: 'Paid' | 'Pending';
  paidDate?: string | Date | null;
  paymentMode?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other' | '';
  receiptNumber?: string;
  remarks?: string;
  updatedBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const MaintenanceRecordSchema: Schema = new Schema(
  {
    month: { type: String, required: true, index: true }, // Format: YYYY-MM
    flatId: { type: Schema.Types.ObjectId, ref: 'Flat', required: true },
    flatNumber: { type: String, required: true },
    residentName: { type: String, required: true },
    amount: { type: Number, required: true, default: 1500 },
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending', index: true },
    paidDate: { type: Date, default: null },
    paymentMode: { 
      type: String, 
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other', ''], 
      default: '' 
    },
    receiptNumber: { type: String, default: '' },
    remarks: { type: String, default: '' },
    updatedBy: { type: String, default: 'Admin' }
  },
  { timestamps: true }
);

// Compound unique index for month + flatId
MaintenanceRecordSchema.index({ month: 1, flatId: 1 }, { unique: true });

export const MaintenanceRecordModel = mongoose.models.MaintenanceRecord || mongoose.model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema);

export const MaintenanceRecordStore = new FileStore<any>('maintenance_records');
