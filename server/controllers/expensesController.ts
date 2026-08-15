import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { ExpenseTemplateModel, ExpenseTemplateStore } from '../models/ExpenseTemplate';
import { MonthlyExpenseModel, MonthlyExpenseStore } from '../models/MonthlyExpense';

// Helper to auto-sync templates into a month's expenses
async function ensureMonthTemplates(month: string) {
  const isMongo = dbState.isConnectedToMongo;
  
  const templates = isMongo 
    ? await (ExpenseTemplateModel as any).find({ isActive: true }).sort({ orderIndex: 1 }).lean()
    : await ExpenseTemplateStore.find((t: any) => t.isActive !== false);

  const existingMonthExpenses = isMongo
    ? await (MonthlyExpenseModel as any).find({ month, expenseType: 'Recurring' }).lean()
    : await MonthlyExpenseStore.find((e: any) => e.month === month && e.expenseType === 'Recurring');

  const existingTemplateIds = new Set(
    existingMonthExpenses
      .filter((e: any) => e.templateId)
      .map((e: any) => String(e.templateId))
  );

  const missingExpenses: any[] = [];

  for (const template of templates) {
    const templateId = String(template._id || template.id);
    if (!existingTemplateIds.has(templateId)) {
      missingExpenses.push({
        month,
        expenseType: 'Recurring',
        templateId: template._id || template.id,
        name: template.name,
        amount: template.defaultAmount,
        category: template.category || 'Maintenance',
        paymentDate: new Date(month + '-05'),
        paidTo: template.name.includes('Salary') ? 'Staff' : 'Service Agency',
        paymentMode: 'Bank Transfer',
        invoiceOrReceiptNo: '',
        notes: template.description || '',
        isPaid: true
      });
    }
  }

  if (missingExpenses.length > 0) {
    if (isMongo) {
      await (MonthlyExpenseModel as any).insertMany(missingExpenses);
    } else {
      await MonthlyExpenseStore.insertMany(missingExpenses);
    }
  }
}

// ----------------- TEMPLATE CONTROLLERS -----------------

export const getExpenseTemplates = async (req: Request, res: Response) => {
  try {
    const isMongo = dbState.isConnectedToMongo;
    let templates: any[] = [];

    if (isMongo) {
      templates = await (ExpenseTemplateModel as any).find().sort({ orderIndex: 1, createdAt: 1 }).lean();
    } else {
      templates = await ExpenseTemplateStore.find();
      templates.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
    }

    return res.json({ success: true, count: templates.length, templates });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching expense templates', error: err.message });
  }
};

export const createExpenseTemplate = async (req: Request, res: Response) => {
  try {
    const { name, defaultAmount, category, description, orderIndex } = req.body;

    if (!name || defaultAmount === undefined) {
      return res.status(400).json({ success: false, message: 'Template name and default amount are required' });
    }

    const isMongo = dbState.isConnectedToMongo;

    const templateData = {
      name: name.trim(),
      defaultAmount: Number(defaultAmount) || 0,
      category: category || 'Maintenance',
      description: description || '',
      isActive: true,
      orderIndex: Number(orderIndex) || 0
    };

    let newTemplate: any = null;
    if (isMongo) {
      newTemplate = await (ExpenseTemplateModel as any).create(templateData);
    } else {
      newTemplate = await ExpenseTemplateStore.create(templateData);
    }

    return res.status(201).json({
      success: true,
      message: 'Expense template created successfully',
      template: newTemplate
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error creating expense template', error: err.message });
  }
};

export const updateExpenseTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, defaultAmount, category, description, isActive, orderIndex } = req.body;
    const isMongo = dbState.isConnectedToMongo;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (defaultAmount !== undefined) updateData.defaultAmount = Number(defaultAmount);
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (orderIndex !== undefined) updateData.orderIndex = Number(orderIndex);

    let updated: any = null;
    if (isMongo) {
      updated = await (ExpenseTemplateModel as any).findByIdAndUpdate(id, updateData, { new: true });
    } else {
      updated = await ExpenseTemplateStore.findByIdAndUpdate(id, updateData);
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Expense template not found' });
    }

    return res.json({
      success: true,
      message: 'Expense template updated successfully',
      template: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating expense template', error: err.message });
  }
};

export const deleteExpenseTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    if (isMongo) {
      const deleted = await (ExpenseTemplateModel as any).findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Template not found' });
    } else {
      const deleted = await ExpenseTemplateStore.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.json({ success: true, message: 'Expense template deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error deleting template', error: err.message });
  }
};

// ----------------- MONTHLY EXPENSE CONTROLLERS -----------------

export const getMonthExpenses = async (req: Request, res: Response) => {
  try {
    const { month } = req.params;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Expected YYYY-MM' });
    }

    const isMongo = dbState.isConnectedToMongo;
    let expenses: any[] = [];

    if (isMongo) {
      expenses = await (MonthlyExpenseModel as any).find({ month }).sort({ paymentDate: -1, createdAt: -1 }).lean();
    } else {
      expenses = await MonthlyExpenseStore.find({ month });
      expenses.sort((a: any, b: any) => new Date(b.paymentDate || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.createdAt || 0).getTime());
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return res.json({
      success: true,
      month,
      summary: {
        totalExpenses,
        totalRecurring: 0,
        totalOneTime: totalExpenses,
        count: expenses.length,
        recurringCount: 0,
        oneTimeCount: expenses.length
      },
      recurringExpenses: [],
      oneTimeExpenses: expenses,
      allExpenses: expenses
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching monthly expenses', error: err.message });
  }
};

export const createMonthlyExpense = async (req: Request, res: Response) => {
  try {
    const { month, expenseType, templateId, name, amount, category, paymentDate, paidTo, paymentMode, invoiceOrReceiptNo, notes } = req.body;

    if (!month || !name || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Month, name and amount are required' });
    }

    const isMongo = dbState.isConnectedToMongo;

    const newExpenseData = {
      month,
      expenseType: expenseType || 'One-Time',
      templateId: templateId || null,
      name: name.trim(),
      amount: Number(amount) || 0,
      category: category || 'Maintenance',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paidTo: paidTo || '',
      paymentMode: paymentMode || 'Bank Transfer',
      invoiceOrReceiptNo: invoiceOrReceiptNo || '',
      notes: notes || '',
      isPaid: true
    };

    let created: any = null;
    if (isMongo) {
      created = await (MonthlyExpenseModel as any).create(newExpenseData);
    } else {
      created = await MonthlyExpenseStore.create(newExpenseData);
    }

    return res.status(201).json({
      success: true,
      message: 'Expense added successfully',
      expense: created
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error creating expense', error: err.message });
  }
};

export const updateMonthlyExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, amount, category, paymentDate, paidTo, paymentMode, invoiceOrReceiptNo, notes, isPaid } = req.body;
    const isMongo = dbState.isConnectedToMongo;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (amount !== undefined) updateData.amount = Number(amount);
    if (category !== undefined) updateData.category = category;
    if (paymentDate !== undefined) updateData.paymentDate = paymentDate ? new Date(paymentDate) : null;
    if (paidTo !== undefined) updateData.paidTo = paidTo;
    if (paymentMode !== undefined) updateData.paymentMode = paymentMode;
    if (invoiceOrReceiptNo !== undefined) updateData.invoiceOrReceiptNo = invoiceOrReceiptNo;
    if (notes !== undefined) updateData.notes = notes;
    if (isPaid !== undefined) updateData.isPaid = isPaid;

    let updated: any = null;
    if (isMongo) {
      updated = await (MonthlyExpenseModel as any).findByIdAndUpdate(id, updateData, { new: true });
    } else {
      updated = await MonthlyExpenseStore.findByIdAndUpdate(id, updateData);
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Expense record not found' });
    }

    return res.json({
      success: true,
      message: 'Expense updated successfully',
      expense: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating expense', error: err.message });
  }
};

export const deleteMonthlyExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    if (isMongo) {
      const deleted = await (MonthlyExpenseModel as any).findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Expense not found' });
    } else {
      const deleted = await MonthlyExpenseStore.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    return res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error deleting expense', error: err.message });
  }
};
