import { Request, Response } from 'express';
import * as XLSX from 'xlsx';

import { dbState } from '../config/db';

import {
  MaintenanceRecordModel,
  MaintenanceRecordStore
} from '../models/MaintenanceRecord';

import {
  MonthlyExpenseModel,
  MonthlyExpenseStore
} from '../models/MonthlyExpense';

import {
  FlatModel,
  FlatStore
} from '../models/Flat';

import {
  ApartmentSettingsModel,
  SettingsStore
} from '../models/ApartmentSettings';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatDate(dateInput: any): string {
  if (!dateInput) return '-';

  try {
    const d = new Date(dateInput);

    if (isNaN(d.getTime())) {
      return '-';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (_) {
    return '-';
  }
}

/**
 * Normalize flat number.
 *
 * 101       -> 101
 * Flat 101  -> 101
 * FLAT 101  -> 101
 */
function normalizeFlatNumber(value: any): string {
  return String(value || '')
    .trim()
    .replace(/^flat\s*/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Get active flats.
 *
 * Flats collection is the SOURCE OF TRUTH.
 *
 * If there are 57 active flats,
 * export will contain at most 57 maintenance rows.
 */
async function getActiveFlats(): Promise<any[]> {
  const isMongo = dbState.isConnectedToMongo;

  const rawFlats = isMongo
    ? await (FlatModel as any)
        .find({
          status: { $ne: 'Inactive' }
        })
        .lean()
    : await FlatStore.find(
        (flat: any) =>
          (flat.status || 'Active') !== 'Inactive'
      );

  /**
   * Remove duplicate flats.
   */
  const flatMap = new Map<string, any>();

  for (const flat of rawFlats) {
    const normalized = normalizeFlatNumber(
      flat.flatNumber
    );

    if (!normalized) {
      continue;
    }

    const existing = flatMap.get(normalized);

    if (!existing) {
      flatMap.set(normalized, flat);
      continue;
    }

    /**
     * Prefer:
     *
     * 101
     *
     * over:
     *
     * Flat 101
     */
    const existingNumber = String(
      existing.flatNumber || ''
    ).trim();

    const currentNumber = String(
      flat.flatNumber || ''
    ).trim();

    if (
      /^flat\s+/i.test(existingNumber) &&
      !/^flat\s+/i.test(currentNumber)
    ) {
      flatMap.set(normalized, flat);
    }
  }

  return Array.from(flatMap.values());
}

/**
 * Get current month maintenance records.
 */
async function getMonthMaintenanceRecords(
  month: string
): Promise<any[]> {
  const isMongo = dbState.isConnectedToMongo;

  if (isMongo) {
    return await (MaintenanceRecordModel as any)
      .find({ month })
      .lean();
  }

  return await MaintenanceRecordStore.find({
    month
  });
}

/**
 * Get current month expenses.
 */
async function getMonthExpenses(
  month: string
): Promise<any[]> {
  const isMongo = dbState.isConnectedToMongo;

  if (isMongo) {
    return await (MonthlyExpenseModel as any)
      .find({ month })
      .sort({
        paymentDate: 1,
        createdAt: 1
      })
      .lean();
  }

  const expenses =
    await MonthlyExpenseStore.find({
      month
    });

  expenses.sort((a: any, b: any) => {
    const dateA =
      a.paymentDate ||
      a.createdAt ||
      '';

    const dateB =
      b.paymentDate ||
      b.createdAt ||
      '';

    return String(dateA).localeCompare(
      String(dateB)
    );
  });

  return expenses;
}

/**
 * =========================================================
 * UNIQUE MAINTENANCE RECORDS
 * =========================================================
 *
 * Select exactly ONE record per flat.
 *
 * If database contains:
 *
 * Flat 101 - old
 * Flat 101 - old
 * Flat 101 - newest
 *
 * only newest record is used.
 */
function getUniqueMaintenanceRecords(
  records: any[]
): Map<string, any> {
  const recordMap = new Map<string, any>();

  for (const record of records) {
    const flatNumber = normalizeFlatNumber(
      record.flatNumber
    );

    if (!flatNumber) {
      continue;
    }

    const existing =
      recordMap.get(flatNumber);

    if (!existing) {
      recordMap.set(
        flatNumber,
        record
      );

      continue;
    }

    const existingTime =
      new Date(
        existing.updatedAt ||
          existing.createdAt ||
          0
      ).getTime();

    const recordTime =
      new Date(
        record.updatedAt ||
          record.createdAt ||
          0
      ).getTime();

    if (recordTime >= existingTime) {
      recordMap.set(
        flatNumber,
        record
      );
    }
  }

  return recordMap;
}

/**
 * =========================================================
 * BUILD MONTHLY MAINTENANCE EXPORT DATA
 * =========================================================
 *
 * IMPORTANT:
 *
 * Current active flats determine row count.
 *
 * Example:
 *
 * 57 active flats
 * 171 maintenance records in DB
 *
 * Excel => exactly 57 rows.
 */
async function buildMonthlyMaintenanceRecords(
  month: string
): Promise<any[]> {
  const flats =
    await getActiveFlats();

  const rawRecords =
    await getMonthMaintenanceRecords(
      month
    );

  const recordMap =
    getUniqueMaintenanceRecords(
      rawRecords
    );

  const maintenanceRecords: any[] =
    [];

  for (const flat of flats) {
    const normalizedFlatNumber =
      normalizeFlatNumber(
        flat.flatNumber
      );

    if (!normalizedFlatNumber) {
      continue;
    }

    const existingRecord =
      recordMap.get(
        normalizedFlatNumber
      );

    const flatId = String(
      flat._id ||
        flat.id ||
        ''
    );

    const flatAmount =
      flat.customMaintenanceAmount !==
        undefined &&
      flat.customMaintenanceAmount !==
        null
        ? Number(
            flat.customMaintenanceAmount
          )
        : 1500;

    if (existingRecord) {
      maintenanceRecords.push({
        ...existingRecord,

        flatId,

        flatNumber:
          flat.flatNumber,

        residentName:
          flat.residentName,

        amount:
          existingRecord.amount !==
            undefined &&
          existingRecord.amount !==
            null
            ? Number(
                existingRecord.amount
              )
            : flatAmount
      });
    } else {
      /**
       * No record yet.
       *
       * Treat as Pending.
       */
      maintenanceRecords.push({
        flatId,

        flatNumber:
          flat.flatNumber,

        residentName:
          flat.residentName,

        amount:
          flatAmount,

        status:
          'Pending',

        paidDate:
          null,

        paymentMode:
          '',

        receiptNumber:
          '',

        remarks:
          ''
      });
    }
  }

  /**
   * Natural flat-number sorting.
   */
  maintenanceRecords.sort(
    (a: any, b: any) =>
      String(
        a.flatNumber || ''
      ).localeCompare(
        String(
          b.flatNumber || ''
        ),
        undefined,
        {
          numeric: true
        }
      )
  );

  return maintenanceRecords;
}

/**
 * =========================================================
 * EXPORT MONTH EXCEL
 * =========================================================
 */
export const exportMonthExcel = async (
  req: Request,
  res: Response
) => {
  try {
    const { month } =
      req.params;

    if (
      !month ||
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid month format. Expected YYYY-MM'
      });
    }

    const [
      yearStr,
      monthNumStr
    ] = month.split('-');

    const monthIndex =
      parseInt(
        monthNumStr,
        10
      ) - 1;

    const monthName =
      MONTH_NAMES[
        monthIndex
      ] || month;

    const monthYearDisplay =
      `${monthName} ${yearStr}`;

    const isMongo =
      dbState.isConnectedToMongo;

    /**
     * =====================================================
     * SETTINGS
     * =====================================================
     */

    const settings =
      isMongo
        ? await (
            ApartmentSettingsModel as any
          )
            .findOne()
            .lean()
        : await SettingsStore.findOne(
            () => true
          );

    const apartmentTitle =
      (
        settings?.apartmentName ||
        'GREENVIEW HEIGHTS APARTMENTS'
      ).toUpperCase();

    const currency =
      settings?.currencySymbol ||
      '₹';

    /**
     * =====================================================
     * MAINTENANCE
     * =====================================================
     *
     * IMPORTANT:
     *
     * DO NOT directly export all DB maintenance records.
     *
     * Build records from active flats.
     *
     * This fixes:
     *
     * 57 flats
     * 171 DB records
     * Excel showing 171
     *
     * New result:
     *
     * 57 active flats
     * Excel showing 57
     */
    const maintenanceRecords =
      await buildMonthlyMaintenanceRecords(
        month
      );

    /**
     * =====================================================
     * EXPENSES
     * =====================================================
     */

    const expenses =
      await getMonthExpenses(
        month
      );

    /**
     * =====================================================
     * MONTHLY FINANCIALS
     * =====================================================
     */

    let expectedMaintenance = 0;
    let collectedMaintenance = 0;

    let paidCount = 0;
    let pendingCount = 0;

    for (
      const record of
        maintenanceRecords
    ) {
      const amount =
        Number(
          record.amount
        ) || 0;

      expectedMaintenance +=
        amount;

      if (
        record.status ===
        'Paid'
      ) {
        collectedMaintenance +=
          amount;

        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const pendingMaintenance =
      expectedMaintenance -
      collectedMaintenance;

    const collectionRate =
      expectedMaintenance > 0
        ? Number(
            (
              (
                collectedMaintenance /
                expectedMaintenance
              ) *
              100
            ).toFixed(1)
          )
        : 0;

    /**
     * =====================================================
     * EXPENSE TOTALS
     * =====================================================
     */

    let recurringExpensesTotal =
      0;

    let oneTimeExpensesTotal =
      0;

    const categoryTotals:
      Record<string, number> = {};

    for (
      const expense of
        expenses
    ) {
      const amount =
        Number(
          expense.amount
        ) || 0;

      if (
        expense.expenseType ===
        'Recurring'
      ) {
        recurringExpensesTotal +=
          amount;
      } else {
        oneTimeExpensesTotal +=
          amount;
      }

      const category =
        expense.category ||
        'Other';

      categoryTotals[
        category
      ] =
        (
          categoryTotals[
            category
          ] || 0
        ) + amount;
    }

    const totalExpenses =
      recurringExpensesTotal +
      oneTimeExpensesTotal;

    const currentMonthSavings =
      collectedMaintenance -
      totalExpenses;

    /**
     * =====================================================
     * CUMULATIVE MAINTENANCE
     * =====================================================
     *
     * One record per:
     *
     * month + flat
     *
     * is counted.
     */

    const allMaintenanceRecords =
      isMongo
        ? await (
            MaintenanceRecordModel as any
          )
            .find({
              month: {
                $lte: month
              }
            })
            .lean()
        : await MaintenanceRecordStore.find(
            (record: any) =>
              record.month <=
              month
          );

    const cumulativeRecordMap =
      new Map<string, any>();

    for (
      const record of
        allMaintenanceRecords
    ) {
      const flatNumber =
        normalizeFlatNumber(
          record.flatNumber
        );

      if (
        !flatNumber ||
        !record.month
      ) {
        continue;
      }

      const key =
        `${record.month}_${flatNumber}`;

      const existing =
        cumulativeRecordMap.get(
          key
        );

      if (!existing) {
        cumulativeRecordMap.set(
          key,
          record
        );

        continue;
      }

      const existingTime =
        new Date(
          existing.updatedAt ||
            existing.createdAt ||
            0
        ).getTime();

      const recordTime =
        new Date(
          record.updatedAt ||
            record.createdAt ||
            0
        ).getTime();

      if (
        recordTime >=
        existingTime
      ) {
        cumulativeRecordMap.set(
          key,
          record
        );
      }
    }

    /**
     * Only Paid records.
     */
    const uniquePaidRecords =
      Array.from(
        cumulativeRecordMap.values()
      ).filter(
        (record: any) =>
          record.status ===
          'Paid'
      );

    /**
     * =====================================================
     * CUMULATIVE EXPENSES
     * =====================================================
     */

    const allPriorExpenses =
      isMongo
        ? await (
            MonthlyExpenseModel as any
          )
            .find({
              month: {
                $lte: month
              }
            })
            .lean()
        : await MonthlyExpenseStore.find(
            (expense: any) =>
              expense.month <=
              month
          );

    const cumulativeCollected =
      uniquePaidRecords.reduce(
        (
          sum: number,
          record: any
        ) =>
          sum +
          (
            Number(
              record.amount
            ) || 0
          ),
        0
      );

    const cumulativeExpenses =
      allPriorExpenses.reduce(
        (
          sum: number,
          expense: any
        ) =>
          sum +
          (
            Number(
              expense.amount
            ) || 0
          ),
        0
      );

    const cumulativeSavings =
      cumulativeCollected -
      cumulativeExpenses;

    /**
     * =====================================================
     * CREATE WORKBOOK
     * =====================================================
     */

    const wb =
      XLSX.utils.book_new();

    /**
     * =====================================================
     * SHEET 1
     * MAINTENANCE REGISTER
     * =====================================================
     */

    const sheet1Title = [
      [apartmentTitle],

      [
        `MONTHLY MAINTENANCE REGISTER - ${monthYearDisplay.toUpperCase()}`
      ],

      []
    ];

    const sheet1Headers = [
      'S.No',
      'Flat Number',
      'Owner Name',
      'Maintenance Amount',
      'Payment Status',
      'Payment Date',
      'Payment Mode',
      'Receipt Number',
      'Remarks'
    ];

    const sheet1Rows =
      maintenanceRecords.map(
        (
          record: any,
          index: number
        ) => {
          const amount =
            Number(
              record.amount ||
                1500
            );

          const status =
            record.status ||
            'Pending';

          const paymentDate =
            status === 'Paid'
              ? formatDate(
                  record.paidDate ||
                    record.updatedAt
                )
              : '-';

          return [
            index + 1,

            record.flatNumber ||
              '',

            record.residentName ||
              'Resident',

            `${currency}${amount.toLocaleString(
              'en-IN'
            )}`,

            status,

            paymentDate,

            record.paymentMode ||
              '-',

            record.receiptNumber ||
              '-',

            record.remarks ||
              '-'
          ];
        }
      );

    const sheet1Footer = [
      [],

      [
        'MAINTENANCE SUMMARY',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],

      [
        'Total Flats:',
        maintenanceRecords.length
      ],

      [
        'Paid Flats:',
        paidCount
      ],

      [
        'Pending Flats:',
        pendingCount
      ],

      [
        'Collection Rate:',
        `${collectionRate}%`
      ],

      [
        'Expected Maintenance:',
        `${currency}${expectedMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Collected Maintenance:',
        `${currency}${collectedMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Pending Maintenance:',
        `${currency}${pendingMaintenance.toLocaleString(
          'en-IN'
        )}`
      ]
    ];

    const sheet1AOA = [
      ...sheet1Title,

      sheet1Headers,

      ...sheet1Rows,

      ...sheet1Footer
    ];

    const ws1 =
      XLSX.utils.aoa_to_sheet(
        sheet1AOA
      );

    ws1['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 32 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 35 }
    ];

    if (
      sheet1Rows.length >
      0
    ) {
      ws1['!autofilter'] = {
        ref: `A4:I${
          4 +
          sheet1Rows.length
        }`
      };
    }

    XLSX.utils.book_append_sheet(
      wb,
      ws1,
      'Maintenance Register'
    );

    /**
     * =====================================================
     * SHEET 2
     * EXPENSE REGISTER
     * =====================================================
     *
     * Includes additional details.
     */

    const sheet2Title = [
      [apartmentTitle],

      [
        `MONTHLY EXPENSE REGISTER - ${monthYearDisplay.toUpperCase()}`
      ],

      []
    ];

    const sheet2Headers = [
      'S.No',
      'Date',
      'Expense Name',
      'Category',
      'Expense Type',
      'Amount',
      'Payment Mode',
      'Description',
      'Remarks'
    ];

    const sheet2Rows =
      expenses.map(
        (
          expense: any,
          index: number
        ) => {
          const amount =
            Number(
              expense.amount
            ) || 0;

          return [
            index + 1,

            formatDate(
              expense.paymentDate ||
                expense.createdAt
            ),

            expense.name ||
              '-',

            expense.category ||
              'Other',

            expense.expenseType ||
              'One-Time',

            `${currency}${amount.toLocaleString(
              'en-IN'
            )}`,

            expense.paymentMode ||
              '-',

            expense.description ||
              expense.details ||
              '-',

            expense.remarks ||
              '-'
          ];
        }
      );

    const sheet2Footer = [
      [],

      [
        'EXPENSE SUMMARY',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],

      [
        'Recurring Expenses:',
        `${currency}${recurringExpensesTotal.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'One-Time Expenses:',
        `${currency}${oneTimeExpensesTotal.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Total Expenses:',
        `${currency}${totalExpenses.toLocaleString(
          'en-IN'
        )}`
      ],

      [],

      [
        'CATEGORY',
        'TOTAL'
      ],

      ...Object.entries(
        categoryTotals
      ).map(
        ([
          category,
          amount
        ]) => [
          category,
          `${currency}${Number(
            amount
          ).toLocaleString(
            'en-IN'
          )}`
        ]
      )
    ];

    const sheet2AOA = [
      ...sheet2Title,

      sheet2Headers,

      ...sheet2Rows,

      ...sheet2Footer
    ];

    const ws2 =
      XLSX.utils.aoa_to_sheet(
        sheet2AOA
      );

    ws2['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 35 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 45 },
      { wch: 35 }
    ];

    if (
      sheet2Rows.length >
      0
    ) {
      ws2['!autofilter'] = {
        ref: `A4:I${
          4 +
          sheet2Rows.length
        }`
      };
    }

    XLSX.utils.book_append_sheet(
      wb,
      ws2,
      'Expense Register'
    );

    /**
     * =====================================================
     * SHEET 3
     * FINANCIAL SUMMARY
     * =====================================================
     */

    const sheet3Data = [
      [apartmentTitle],

      [
        `FINANCIAL SUMMARY - ${monthYearDisplay.toUpperCase()}`
      ],

      [],

      [
        'MONTHLY MAINTENANCE',
        ''
      ],

      [
        'Total Flats',
        maintenanceRecords.length
      ],

      [
        'Expected Maintenance',
        `${currency}${expectedMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Collected Maintenance',
        `${currency}${collectedMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Pending Maintenance',
        `${currency}${pendingMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Paid Flats',
        paidCount
      ],

      [
        'Pending Flats',
        pendingCount
      ],

      [
        'Collection Rate',
        `${collectionRate}%`
      ],

      [],

      [
        'MONTHLY EXPENSES',
        ''
      ],

      [
        'Recurring Expenses',
        `${currency}${recurringExpensesTotal.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'One-Time Expenses',
        `${currency}${oneTimeExpensesTotal.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Total Expenses',
        `${currency}${totalExpenses.toLocaleString(
          'en-IN'
        )}`
      ],

      [],

      [
        'CURRENT MONTH FINANCIAL SUMMARY',
        ''
      ],

      [
        'Collected Maintenance',
        `${currency}${collectedMaintenance.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'Less: Total Expenses',
        `− ${currency}${totalExpenses.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        'CURRENT MONTH SAVINGS / REMAINING',
        `${currency}${currentMonthSavings.toLocaleString(
          'en-IN'
        )}`
      ],

      [],

      [
        'CUMULATIVE FINANCIAL SUMMARY',
        ''
      ],

      [
        `Total Maintenance Collected (Up to ${monthYearDisplay})`,
        `${currency}${cumulativeCollected.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        `Total Expenses (Up to ${monthYearDisplay})`,
        `${currency}${cumulativeExpenses.toLocaleString(
          'en-IN'
        )}`
      ],

      [
        `TOTAL SAVINGS UP TO ${monthYearDisplay.toUpperCase()}`,
        `${currency}${cumulativeSavings.toLocaleString(
          'en-IN'
        )}`
      ],

      [],

      [
        'Report Generated On:',
        new Date().toLocaleDateString(
          'en-IN',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }
        )
      ]
    ];

    const ws3 =
      XLSX.utils.aoa_to_sheet(
        sheet3Data
      );

    ws3['!cols'] = [
      { wch: 55 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(
      wb,
      ws3,
      'Financial Summary'
    );

    /**
     * =====================================================
     * SHEET 4
     * EXPENSE CATEGORY SUMMARY
     * =====================================================
     *
     * This gives admin a quick overview of
     * where the apartment money was spent.
     */

    const categoryRows =
      Object.entries(
        categoryTotals
      )
        .sort(
          (
            [, amountA],
            [, amountB]
          ) =>
            Number(
              amountB
            ) -
            Number(
              amountA
            )
        )
        .map(
          (
            [
              category,
              amount
            ],
            index
          ) => [
            index + 1,

            category,

            `${currency}${Number(
              amount
            ).toLocaleString(
              'en-IN'
            )}`,

            totalExpenses > 0
              ? `${(
                  (
                    Number(
                      amount
                    ) /
                    totalExpenses
                  ) *
                  100
                ).toFixed(1)}%`
              : '0%'
          ]
        );

    const sheet4Data = [
      [apartmentTitle],

      [
        `EXPENSE CATEGORY SUMMARY - ${monthYearDisplay.toUpperCase()}`
      ],

      [],

      [
        'S.No',
        'Category',
        'Amount',
        '% of Total Expenses'
      ],

      ...categoryRows,

      [],

      [
        '',
        'TOTAL EXPENSES',
        `${currency}${totalExpenses.toLocaleString(
          'en-IN'
        )}`,
        '100%'
      ]
    ];

    const ws4 =
      XLSX.utils.aoa_to_sheet(
        sheet4Data
      );

    ws4['!cols'] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 22 },
      { wch: 25 }
    ];

    if (
      categoryRows.length >
      0
    ) {
      ws4['!autofilter'] = {
        ref: `A4:D${
          4 +
          categoryRows.length
        }`
      };
    }

    XLSX.utils.book_append_sheet(
      wb,
      ws4,
      'Expense Summary'
    );

    /**
     * =====================================================
     * GENERATE EXCEL
     * =====================================================
     */

    const buffer =
      XLSX.write(
        wb,
        {
          type: 'buffer',
          bookType: 'xlsx'
        }
      );

    const filename =
      `Apartment_Maintenance_Report_${monthName}_${yearStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    return res.send(
      buffer
    );
  } catch (err: any) {
    console.error(
      'Error generating Excel report:',
      err
    );

    return res.status(500).json({
      success: false,

      message:
        'Error generating Excel report',

      error:
        err.message
    });
  }
};