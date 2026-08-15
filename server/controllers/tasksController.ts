import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { TaskModel, TaskStore } from '../models/Task';

export const getAllTasks = async (req: Request, res: Response) => {
  try {
    const { status, priority, search } = req.query;
    const isMongo = dbState.isConnectedToMongo;
    let tasks: any[] = [];

    if (isMongo) {
      const query: any = {};
      if (status && ['Pending', 'In Progress', 'Completed'].includes(String(status))) {
        query.status = status;
      }
      if (priority && ['Low', 'Medium', 'High', 'Urgent'].includes(String(priority))) {
        query.priority = priority;
      }
      if (search) {
        query.$or = [
          { title: { $regex: String(search), $options: 'i' } },
          { description: { $regex: String(search), $options: 'i' } },
          { assignedTo: { $regex: String(search), $options: 'i' } }
        ];
      }
      tasks = await (TaskModel as any).find(query).sort({ dueDate: 1, createdAt: -1 }).lean();
    } else {
      tasks = await TaskStore.find((t: any) => {
        if (status && t.status !== status) return false;
        if (priority && t.priority !== priority) return false;
        if (search) {
          const s = String(search).toLowerCase();
          const matchTitle = (t.title || '').toLowerCase().includes(s);
          const matchDesc = (t.description || '').toLowerCase().includes(s);
          const matchAssignee = (t.assignedTo || '').toLowerCase().includes(s);
          if (!matchTitle && !matchDesc && !matchAssignee) return false;
        }
        return true;
      });
      tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }

    const pendingCount = tasks.filter(t => t.status === 'Pending').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const completedCount = tasks.filter(t => t.status === 'Completed').length;
    const totalEstimatedCost = tasks.reduce((sum, t) => sum + (Number(t.estimatedAmount) || 0), 0);

    return res.json({
      success: true,
      summary: {
        total: tasks.length,
        pendingCount,
        inProgressCount,
        completedCount,
        totalEstimatedCost
      },
      count: tasks.length,
      tasks
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching tasks', error: err.message });
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    const task = isMongo ? await (TaskModel as any).findById(id).lean() : await TaskStore.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    return res.json({ success: true, task });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching task', error: err.message });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, estimatedAmount, actualAmount, description, dueDate, month, status, priority, assignedTo, contactNumber, notes } = req.body;

    if (!title || estimatedAmount === undefined || !dueDate) {
      return res.status(400).json({ success: false, message: 'Title, estimated amount and due date are required.' });
    }

    const isMongo = dbState.isConnectedToMongo;

    const taskData = {
      title: title.trim(),
      estimatedAmount: Number(estimatedAmount) || 0,
      actualAmount: actualAmount ? Number(actualAmount) : 0,
      description: description || '',
      dueDate: new Date(dueDate),
      month: month || '',
      status: status || 'Pending',
      priority: priority || 'Medium',
      assignedTo: assignedTo || '',
      contactNumber: contactNumber || '',
      notes: notes || ''
    };

    let newTask: any = null;
    if (isMongo) {
      newTask = await (TaskModel as any).create(taskData);
    } else {
      newTask = await TaskStore.create(taskData);
    }

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: newTask
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error creating task', error: err.message });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, estimatedAmount, actualAmount, description, dueDate, month, status, priority, assignedTo, contactNumber, notes, completionDate } = req.body;
    const isMongo = dbState.isConnectedToMongo;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (estimatedAmount !== undefined) updateData.estimatedAmount = Number(estimatedAmount);
    if (actualAmount !== undefined) updateData.actualAmount = Number(actualAmount);
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (month !== undefined) updateData.month = month;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'Completed' && !completionDate) {
        updateData.completionDate = new Date();
      } else if (status !== 'Completed') {
        updateData.completionDate = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    if (notes !== undefined) updateData.notes = notes;
    if (completionDate !== undefined) updateData.completionDate = completionDate ? new Date(completionDate) : null;

    let updated: any = null;
    if (isMongo) {
      updated = await (TaskModel as any).findByIdAndUpdate(id, updateData, { new: true });
    } else {
      updated = await TaskStore.findByIdAndUpdate(id, updateData);
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    return res.json({
      success: true,
      message: 'Task updated successfully',
      task: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating task', error: err.message });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    if (isMongo) {
      const deleted = await (TaskModel as any).findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Task not found' });
    } else {
      const deleted = await TaskStore.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Task not found' });
    }

    return res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error deleting task', error: err.message });
  }
};
