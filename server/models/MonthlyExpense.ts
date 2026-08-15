import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface IMonthlyExpense extends Document {
  month: string; // YYYY-MM
  expenseType: 'Recurring' | 'One-Time';
  templateId?: string | null;
  name: string;
  amount: number;
  category: string;
  paymentDate?: string | Date | null;
  paidTo?: string;
  paymentMode?: string;
  invoiceOrReceiptNo?: string;
  notes?: string;
  isPaid?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const MonthlyExpenseSchema: Schema = new Schema(
  {
    month: { type: String, required: true, index: true },
    expenseType: { type: String, enum: ['Recurring', 'One-Time'], required: true, default: 'Recurring' },
    templateId: { type: Schema.Types.ObjectId, ref: 'ExpenseTemplate', default: null },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, default: 0 },
    category: { type: String, default: 'Maintenance' },
    paymentDate: { type: Date, default: Date.now },
    paidTo: { type: String, default: '' },
    paymentMode: { type: String, default: 'Bank Transfer' },
    invoiceOrReceiptNo: { type: String, default: '' },
    notes: { type: String, default: '' },
    isPaid: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const MonthlyExpenseModel = mongoose.models.MonthlyExpense || mongoose.model<IMonthlyExpense>('MonthlyExpense', MonthlyExpenseSchema);

export const MonthlyExpenseStore = new FileStore<any>('monthly_expenses');
