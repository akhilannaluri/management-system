import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface IExpenseTemplate extends Document {
  name: string;
  defaultAmount: number;
  category: string;
  description?: string;
  isActive: boolean;
  orderIndex?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const ExpenseTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    defaultAmount: { type: Number, required: true, default: 0 },
    category: { 
      type: String, 
      enum: ['Salary', 'Maintenance', 'Utilities', 'Security', 'Cleaning', 'Repairs', 'Administration', 'Other'], 
      default: 'Maintenance' 
    },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    orderIndex: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const ExpenseTemplateModel = mongoose.models.ExpenseTemplate || mongoose.model<IExpenseTemplate>('ExpenseTemplate', ExpenseTemplateSchema);

export const ExpenseTemplateStore = new FileStore<any>('expense_templates');
