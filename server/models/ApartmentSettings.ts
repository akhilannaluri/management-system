import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface IApartmentSettings extends Document {
  apartmentName: string;
  societyRegistrationNo?: string;
  address: string;
  totalFlats: number;
  defaultMonthlyMaintenance: number;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currencySymbol: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const ApartmentSettingsSchema: Schema = new Schema(
  {
    apartmentName: { type: String, default: 'Greenview Heights Apartments' },
    societyRegistrationNo: { type: String, default: 'REG/APT/2021/57' },
    address: { type: String, default: 'Plot 42-45, Phase 2, Madhapur, Hyderabad, 500081' },
    totalFlats: { type: Number, default: 57 },
    defaultMonthlyMaintenance: { type: Number, default: 1500 },
    contactPerson: { type: String, default: 'Ramesh Varma (Secretary)' },
    contactPhone: { type: String, default: '+91 98765 43210' },
    contactEmail: { type: String, default: 'admin@greenviewheights.com' },
    upiId: { type: String, default: 'greenview.society@upi' },
    bankName: { type: String, default: 'HDFC Bank' },
    accountNumber: { type: String, default: '50200012345678' },
    ifscCode: { type: String, default: 'HDFC0001234' },
    currencySymbol: { type: String, default: '₹' }
  },
  { timestamps: true }
);

export const ApartmentSettingsModel = mongoose.models.ApartmentSettings || mongoose.model<IApartmentSettings>('ApartmentSettings', ApartmentSettingsSchema);

export const SettingsStore = new FileStore<any>('settings');
