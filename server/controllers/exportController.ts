import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { dbState } from '../config/db';
import { MaintenanceRecordModel, MaintenanceRecordStore } from '../models/MaintenanceRecord';
import { MonthlyExpenseModel, MonthlyExpenseStore } from '../models/MonthlyExpense';
import { FlatModel, FlatStore } from '../models/Flat';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDate(dateInput: any): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (_) {
    return '-';
  }
}

export const exportMonthExcel = async (req: Request, res: Response) => {
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

    // Fetch settings
    const settings = isMongo 
      ? await (ApartmentSettingsModel as any).findOne().lean() 
      : await SettingsStore.findOne(() => true);

    const apartmentTitle = (settings?.apartmentName || 'GREENVIEW HEIGHTS APARTMENTS').toUpperCase();
    const currency = settings?.currencySymbol || '₹';

    // Fetch flats
    const flats = isMongo ? await (FlatModel as any).find().lean() : await FlatStore.find();
    const flatMap = new Map(flats.map((f: any) => [String(f._id || f.id), f]));

    // Fetch current month maintenance records (sorted naturally by flatNumber)
    const maintenanceRecords = isMongo 
      ? await (MaintenanceRecordModel as any).find({ month }).lean() 
      : await MaintenanceRecordStore.find({ month });

    maintenanceRecords.sort((a: any, b: any) => 
      (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true })
    );

    // Fetch current month expenses (sorted earliest first)
    const expenses = isMongo 
      ? await (MonthlyExpenseModel as any).find({ month }).sort({ paymentDate: 1, createdAt: 1 }).lean() 
      : await MonthlyExpenseStore.find({ month });

    expenses.sort((a: any, b: any) => {
      const dateA = a.paymentDate || a.createdAt || '';
      const dateB = b.paymentDate || b.createdAt || '';
      return String(dateA).localeCompare(String(dateB));
    });

    // 1. Current Month Maintenance Financials
    let expectedMaintenance = 0;
    let collectedMaintenance = 0;
    let paidCount = 0;
    let pendingCount = 0;

    maintenanceRecords.forEach((r: any) => {
      const amt = Number(r.amount) || 0;
      expectedMaintenance += amt;
      if (r.status === 'Paid') {
        collectedMaintenance += amt;
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const pendingMaintenance = expectedMaintenance - collectedMaintenance;
    const totalExpenses = expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const currentMonthSavings = collectedMaintenance - totalExpenses;

    // 2. Cumulative Financials (All months <= current month)
    const allPriorPaidRecords = isMongo
      ? await (MaintenanceRecordModel as any).find({ month: { $lte: month }, status: 'Paid' }).lean()
      : await MaintenanceRecordStore.find((r: any) => r.month <= month && r.status === 'Paid');

    const allPriorExpenses = isMongo
      ? await (MonthlyExpenseModel as any).find({ month: { $lte: month } }).lean()
      : await MonthlyExpenseStore.find((e: any) => e.month <= month);

    const cumulativeCollected = allPriorPaidRecords.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    const cumulativeExpenses = allPriorExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const cumulativeSavings = cumulativeCollected - cumulativeExpenses;

    // Create a new Excel Workbook
    const wb = XLSX.utils.book_new();

    // =========================================================================
    // SHEET 1: "Maintenance Register"
    // =========================================================================
    const sheet1Title = [
      [apartmentTitle],
      [`MONTHLY MAINTENANCE REGISTER - ${monthYearDisplay.toUpperCase()}`],
      []
    ];

    const sheet1Headers = [
      'S.No',
      'Flat Number',
      'Owner Name',
      'Maintenance Amount',
      'Payment Status',
      'Payment Date'
    ];

    const sheet1Rows = maintenanceRecords.map((r: any, idx: number) => {
      const flat: any = flatMap.get(String(r.flatId)) || {};
      const flatNum = r.flatNumber || flat.flatNumber || '';
      const ownerName = r.residentName || flat.residentName || 'Resident';
      const amtStr = `${currency}${Number(r.amount || 1500).toLocaleString('en-IN')}`;
      const status = r.status || 'Pending';
      const paidDateStr = status === 'Paid' ? formatDate(r.paidDate || r.updatedAt) : '-';

      return [
        idx + 1,
        flatNum,
        ownerName,
        amtStr,
        status,
        paidDateStr
      ];
    });

    const sheet1Footer = [
      [],
      ['MAINTENANCE SUMMARY', '', '', '', '', ''],
      ['Total Flats:', maintenanceRecords.length, '', '', '', ''],
      ['Paid Flats:', paidCount, '', '', '', ''],
      ['Pending Flats:', pendingCount, '', '', '', ''],
      ['Expected Maintenance:', `${currency}${expectedMaintenance.toLocaleString('en-IN')}`, '', '', '', ''],
      ['Collected Maintenance:', `${currency}${collectedMaintenance.toLocaleString('en-IN')}`, '', '', '', ''],
      ['Pending Maintenance:', `${currency}${pendingMaintenance.toLocaleString('en-IN')}`, '', '', '', '']
    ];

    const sheet1AOA = [
      ...sheet1Title,
      sheet1Headers,
      ...sheet1Rows,
      ...sheet1Footer
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1AOA);
    ws1['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 16 }, // Flat Number
      { wch: 32 }, // Owner Name
      { wch: 22 }, // Maintenance Amount
      { wch: 18 }, // Payment Status
      { wch: 18 }  // Payment Date
    ];

    if (sheet1Rows.length > 0) {
      ws1['!autofilter'] = { ref: `A4:F${4 + sheet1Rows.length}` };
    }

    XLSX.utils.book_append_sheet(wb, ws1, 'Maintenance Register');

    // =========================================================================
    // SHEET 2: "Expense Register"
    // =========================================================================
    const sheet2Title = [
      [apartmentTitle],
      [`MONTHLY EXPENSE REGISTER - ${monthYearDisplay.toUpperCase()}`],
      []
    ];

    const sheet2Headers = [
      'S.No',
      'Date',
      'Expense Name',
      'Amount'
    ];

    const sheet2Rows = expenses.map((e: any, idx: number) => {
      const dateStr = formatDate(e.paymentDate || e.createdAt);
      const amtStr = `${currency}${Number(e.amount || 0).toLocaleString('en-IN')}`;
      return [
        idx + 1,
        dateStr,
        e.name,
        amtStr
      ];
    });

    const sheet2Footer = [
      [],
      ['TOTAL EXPENSES:', '', '', `${currency}${totalExpenses.toLocaleString('en-IN')}`]
    ];

    const sheet2AOA = [
      ...sheet2Title,
      sheet2Headers,
      ...sheet2Rows,
      ...sheet2Footer
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2AOA);
    ws2['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 18 }, // Date
      { wch: 42 }, // Expense Name
      { wch: 22 }  // Amount
    ];

    if (sheet2Rows.length > 0) {
      ws2['!autofilter'] = { ref: `A4:D${4 + sheet2Rows.length}` };
    }

    XLSX.utils.book_append_sheet(wb, ws2, 'Expense Register');

    // =========================================================================
    // SHEET 3: "Financial Summary"
    // =========================================================================
    const sheet3Data = [
      [apartmentTitle],
      [`FINANCIAL SUMMARY - ${monthYearDisplay.toUpperCase()}`],
      [],
      ['MONTHLY MAINTENANCE', ''],
      ['Expected Maintenance', `${currency}${expectedMaintenance.toLocaleString('en-IN')}`],
      ['Collected Maintenance', `${currency}${collectedMaintenance.toLocaleString('en-IN')}`],
      ['Pending Maintenance', `${currency}${pendingMaintenance.toLocaleString('en-IN')}`],
      ['Paid Flats', paidCount],
      ['Pending Flats', pendingCount],
      ['Total Flats', maintenanceRecords.length],
      [],
      ['MONTHLY EXPENSES', ''],
      ['Total Expenses', `${currency}${totalExpenses.toLocaleString('en-IN')}`],
      [],
      ['CURRENT MONTH FINANCIAL SUMMARY', ''],
      ['Collected Maintenance', `${currency}${collectedMaintenance.toLocaleString('en-IN')}`],
      ['Less: Total Expenses', `− ${currency}${totalExpenses.toLocaleString('en-IN')}`],
      ['CURRENT MONTH SAVINGS / REMAINING', `${currency}${currentMonthSavings.toLocaleString('en-IN')}`],
      [],
      ['CUMULATIVE FINANCIAL SUMMARY', ''],
      [`Total Maintenance Collected (Up to ${monthYearDisplay})`, `${currency}${cumulativeCollected.toLocaleString('en-IN')}`],
      [`Total Expenses (Up to ${monthYearDisplay})`, `${currency}${cumulativeExpenses.toLocaleString('en-IN')}`],
      [`TOTAL SAVINGS UP TO ${monthYearDisplay.toUpperCase()}`, `${currency}${cumulativeSavings.toLocaleString('en-IN')}`],
      [],
      ['Report Generated On:', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })]
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!cols'] = [
      { wch: 46 },
      { wch: 28 }
    ];

    XLSX.utils.book_append_sheet(wb, ws3, 'Financial Summary');

    // Generate workbook buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Apartment_Maintenance_Report_${monthName}_${yearStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error generating Excel report', error: err.message });
  }
};

