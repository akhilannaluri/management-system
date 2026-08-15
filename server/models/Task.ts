import mongoose, { Schema, Document } from 'mongoose';
import { FileStore } from '../config/db';

export interface ITask extends Document {
  title: string;
  estimatedAmount: number;
  actualAmount?: number;
  description: string;
  dueDate: string | Date;
  month?: string; // e.g. YYYY-MM
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedTo?: string;
  contactNumber?: string;
  completionDate?: string | Date | null;
  notes?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    estimatedAmount: { type: Number, required: true, default: 0 },
    actualAmount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true, default: Date.now },
    month: { type: String, default: '' }, // Optional associated month (YYYY-MM)
    status: { 
      type: String, 
      enum: ['Pending', 'In Progress', 'Completed'], 
      default: 'Pending',
      index: true 
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium'
    },
    assignedTo: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    completionDate: { type: Date, default: null },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const TaskModel = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export const TaskStore = new FileStore<any>('tasks');
