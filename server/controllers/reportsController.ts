import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { MaintenanceRecordModel, MaintenanceRecordStore } from '../models/MaintenanceRecord';
import { MonthlyExpenseModel, MonthlyExpenseStore } from '../models/MonthlyExpense';
import { TaskModel, TaskStore } from '../models/Task';
import { FlatModel, FlatStore } from '../models/Flat';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const getMonthlyReport = async (req: Request, res: Response) => {
  try {
    const { month } = req.params;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Expected YYYY-MM' });
    }

    const [yearStr, monthNumStr] = month.split('-');
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    const monthName = MONTH_NAMES[monthIndex] || month;
    const monthYearDisplay = `${monthName} ${yearStr}`;

    const isMongo = dbState.isConnectedToMongo;

    // 1. Maintenance Records for current month
   // 1. Maintenance Records for current month
// Build the report from CURRENT FLATS so every flat appears exactly once.
// A maintenance record is used only when it belongs to the current flat.

const currentFlatsRaw = isMongo
  ? await (FlatModel as any).find({ status: { $ne: 'Inactive' } }).lean()
  : await FlatStore.find((f: any) => (f.status || 'Active') !== 'Inactive');

// Remove duplicate flats such as:
// 101
// Flat 101
// by treating them as the same flat number.
const flatMap = new Map<string, any>();

for (const flat of currentFlatsRaw) {
  const rawFlatNumber = String(flat.flatNumber || '').trim();

  // Normalize "Flat 101" -> "101"
  const normalizedFlatNumber = rawFlatNumber
    .replace(/^flat\s*/i, '')
    .trim()
    .toLowerCase();

  if (!normalizedFlatNumber) continue;

  const existing = flatMap.get(normalizedFlatNumber);

  if (!existing) {
    flatMap.set(normalizedFlatNumber, flat);
  } else {
    // Prefer the flat whose number does NOT contain "Flat "
    // e.g. prefer "101" over "Flat 101"
    const existingNumber = String(existing.flatNumber || '').trim();
    const currentNumber = rawFlatNumber;

    if (
      /^flat\s+/i.test(existingNumber) &&
      !/^flat\s+/i.test(currentNumber)
    ) {
      flatMap.set(normalizedFlatNumber, flat);
    }
  }
}

const currentFlats = Array.from(flatMap.values());

const monthRecords = isMongo
  ? await (MaintenanceRecordModel as any).find({ month }).lean()
  : await MaintenanceRecordStore.find({ month });

// Keep only ONE maintenance record per current flat.
const recordMap = new Map<string, any>();

for (const record of monthRecords) {
  const flatNumber = String(record.flatNumber || '')
    .replace(/^flat\s*/i, '')
    .trim()
    .toLowerCase();

  if (!flatNumber) continue;

  const existing = recordMap.get(flatNumber);

  if (!existing) {
    recordMap.set(flatNumber, record);
  } else {
    const existingTime = new Date(
      existing.updatedAt || existing.createdAt || 0
    ).getTime();

    const recordTime = new Date(
      record.updatedAt || record.createdAt || 0
    ).getTime();

    if (recordTime >= existingTime) {
      recordMap.set(flatNumber, record);
    }
  }
}

// Create exactly ONE report row for every CURRENT flat.
const maintenanceRecords = currentFlats.map((flat: any) => {
  const flatId = String(flat._id || flat.id);

const normalizedFlatNumber = String(flat.flatNumber || '')
  .replace(/^flat\s*/i, '')
  .trim()
  .toLowerCase();

const existingRecord = recordMap.get(normalizedFlatNumber);

  if (existingRecord) {
    return {
      ...existingRecord,
      flatId,
      flatNumber: flat.flatNumber,
      residentName: flat.residentName,
      amount:
        existingRecord.amount ??
        flat.customMaintenanceAmount ??
        1500
    };
  }

  // No payment record yet = Pending
  return {
    flatId,
    flatNumber: flat.flatNumber,
    residentName: flat.residentName,
    amount: flat.customMaintenanceAmount ?? 1500,
    status: 'Pending',
    paidDate: null,
    paymentMode: null,
    receiptNumber: null,
    remarks: null
  };
});

maintenanceRecords.sort((a: any, b: any) =>
  (a.flatNumber || '').localeCompare(
    b.flatNumber || '',
    undefined,
    { numeric: true }
  )
);

    const totalFlats = maintenanceRecords.length;
    let expectedMaintenance = 0;
    let collectedMaintenance = 0;
    const paidFlats: any[] = [];
    const pendingFlats: any[] = [];

    maintenanceRecords.forEach((r: any) => {
      const amt = Number(r.amount) || 0;
      expectedMaintenance += amt;
      if (r.status === 'Paid') {
        collectedMaintenance += amt;
        paidFlats.push(r);
      } else {
        pendingFlats.push(r);
      }
    });

    const pendingMaintenance = expectedMaintenance - collectedMaintenance;
    const collectionRate = expectedMaintenance > 0 
      ? Number(((collectedMaintenance / expectedMaintenance) * 100).toFixed(1)) 
      : 0;

    // 2. Expenses for current month (sorted earliest first)
    const expenses = isMongo 
      ? await (MonthlyExpenseModel as any).find({ month }).sort({ paymentDate: 1, createdAt: 1 }).lean()
      : await MonthlyExpenseStore.find({ month });

    expenses.sort((a: any, b: any) => {
      const dateA = a.paymentDate || a.createdAt || '';
      const dateB = b.paymentDate || b.createdAt || '';
      return String(dateA).localeCompare(String(dateB));
    });

    let recurringExpensesTotal = 0;
    let oneTimeExpensesTotal = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((e: any) => {
      const amt = Number(e.amount) || 0;
      if (e.expenseType === 'Recurring') {
        recurringExpensesTotal += amt;
      } else {
        oneTimeExpensesTotal += amt;
      }
      const cat = e.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    const totalExpenses = recurringExpensesTotal + oneTimeExpensesTotal;
    const remainingBalance = collectedMaintenance - totalExpenses;

    // 3. Cumulative Summary (All records <= current month)
    // 3. Cumulative Summary
// Calculate maintenance collection month-by-month using
// ONE record per flat per month to prevent duplicate records
// from inflating cumulative totals.

const allMaintenanceRecords = isMongo
  ? await (MaintenanceRecordModel as any)
      .find({ month: { $lte: month } })
      .lean()
  : await MaintenanceRecordStore.find((r: any) => r.month <= month);

const cumulativeRecordMap = new Map<string, any>();

for (const record of allMaintenanceRecords) {
  const flatNumber = String(record.flatNumber || '')
    .replace(/^flat\s*/i, '')
    .trim()
    .toLowerCase();

  if (!flatNumber || !record.month) continue;

  // One maintenance record per flat per month
  const key = `${record.month}_${flatNumber}`;

  const existing = cumulativeRecordMap.get(key);

  if (!existing) {
    cumulativeRecordMap.set(key, record);
  } else {
    const existingTime = new Date(
      existing.updatedAt || existing.createdAt || 0
    ).getTime();

    const recordTime = new Date(
      record.updatedAt || record.createdAt || 0
    ).getTime();

    if (recordTime >= existingTime) {
      cumulativeRecordMap.set(key, record);
    }
  }
}

const uniquePaidRecords = Array.from(cumulativeRecordMap.values())
  .filter((r: any) => r.status === 'Paid');

const allPriorExpenses = isMongo
  ? await (MonthlyExpenseModel as any)
      .find({ month: { $lte: month } })
      .lean()
  : await MonthlyExpenseStore.find((e: any) => e.month <= month);

const cumulativeCollected = uniquePaidRecords.reduce(
  (sum: number, r: any) => sum + (Number(r.amount) || 0),
  0
);

const cumulativeExpenses = allPriorExpenses.reduce(
  (sum: number, e: any) => sum + (Number(e.amount) || 0),
  0
);

const cumulativeSavings = cumulativeCollected - cumulativeExpenses;
const monthsSet = new Set<string>();

uniquePaidRecords.forEach((r: any) => {
  if (r.month) {
    monthsSet.add(r.month);
  }
});

allPriorExpenses.forEach((e: any) => {
  if (e.month) {
    monthsSet.add(e.month);
  }
});

const monthsIncluded = Array.from(monthsSet).sort();


    // 4. Tasks for the month
    const tasks = isMongo 
      ? await (TaskModel as any).find({
          $or: [
            { month },
            { dueDate: { $gte: new Date(month + '-01'), $lte: new Date(month + '-31') } }
          ]
        }).lean()
      : await TaskStore.find((t: any) => {
          if (t.month === month) return true;
          const due = new Date(t.dueDate).toISOString().slice(0, 7);
          return due === month;
        });

    // 5. Get Apartment Settings
    const settings = isMongo 
      ? await (ApartmentSettingsModel as any).findOne().lean()
      : await SettingsStore.findOne(() => true);

    return res.json({
      success: true,
      month,
      monthDisplay: monthYearDisplay,
      settings: settings || { apartmentName: 'Greenview Heights Apartments' },
      financialSummary: {
        totalFlats,
        expectedMaintenance,
        collectedMaintenance,
        pendingMaintenance,
        collectionRate,
        paidFlatsCount: paidFlats.length,
        pendingFlatsCount: pendingFlats.length,
        recurringExpensesTotal,
        oneTimeExpensesTotal,
        totalExpenses,
        remainingBalance
      },
      cumulativeSummary: {
        cutoffMonth: month,
        cutoffMonthDisplay: monthYearDisplay,
        monthsIncluded,
        totalCollected: cumulativeCollected,
        totalExpenses: cumulativeExpenses,
        cumulativeSavings
      },
      expensesBreakdown: {
        byCategory: categoryTotals,
        recurring: expenses.filter((e: any) => e.expenseType === 'Recurring'),
        oneTime: expenses.filter((e: any) => e.expenseType === 'One-Time')
      },
      expenses,
      paidFlats,
      pendingFlats,
      allMaintenanceRecords: maintenanceRecords,
      tasks
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error generating report', error: err.message });
  }
};

export const getAnnualOverview = async (req: Request, res: Response) => {
  try {
    const { year } = req.params;
    const isMongo = dbState.isConnectedToMongo;
    const currentYear = year || String(new Date().getFullYear());

    // Generate array of 12 months for this year
    const months = Array.from({ length: 12 }, (_, i) => `${currentYear}-${String(i + 1).padStart(2, '0')}`);
    const monthlyStats: any[] = [];

   for (const m of months) {
  const rawRecords = isMongo
    ? await (MaintenanceRecordModel as any).find({ month: m }).lean()
    : await MaintenanceRecordStore.find({ month: m });

  // Remove duplicate maintenance records for the same flat.
  const recordMap = new Map<string, any>();

  for (const record of rawRecords) {
    const flatNumber = String(record.flatNumber || '')
      .replace(/^flat\s*/i, '')
      .trim()
      .toLowerCase();

    if (!flatNumber) continue;

    const existing = recordMap.get(flatNumber);

    if (!existing) {
      recordMap.set(flatNumber, record);
    } else {
      const existingTime = new Date(
        existing.updatedAt || existing.createdAt || 0
      ).getTime();

      const recordTime = new Date(
        record.updatedAt || record.createdAt || 0
      ).getTime();

      if (recordTime >= existingTime) {
        recordMap.set(flatNumber, record);
      }
    }
  }

  const records = Array.from(recordMap.values());

  const expenses = isMongo
    ? await (MonthlyExpenseModel as any).find({ month: m }).lean()
    : await MonthlyExpenseStore.find({ month: m });

  const expected = records.reduce(
    (s: number, r: any) => s + (Number(r.amount) || 0),
    0
  );

  const collected = records
    .filter((r: any) => r.status === 'Paid')
    .reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );

  const expenseTotal = expenses.reduce(
    (s: number, e: any) => s + (Number(e.amount) || 0),
    0
  );

  monthlyStats.push({
    month: m,
    expected,
    collected,
    pending: expected - collected,
    expenses: expenseTotal,
    netBalance: collected - expenseTotal,
    paidCount: records.filter((r: any) => r.status === 'Paid').length,
    totalFlats: records.length
  });
}

    return res.json({
      success: true,
      year: currentYear,
      monthlyStats
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching annual overview', error: err.message });
  }
};
