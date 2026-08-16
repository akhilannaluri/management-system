import { Request, Response } from 'express';
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
  TaskModel,
  TaskStore
} from '../models/Task';

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

/**
 * Normalize a flat number.
 *
 * Examples:
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
 * Get all active flats.
 *
 * Flats collection is the SOURCE OF TRUTH.
 *
 * If database contains:
 *
 * 57 active flats
 * + old/deleted flats
 *
 * only the 57 active flats are considered.
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
        (f: any) =>
          (f.status || 'Active') !== 'Inactive'
      );

  /**
   * Remove duplicate flat numbers.
   *
   * Example:
   *
   * 101
   * Flat 101
   *
   * are treated as the same flat.
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
 * Get maintenance records for one month.
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
 * Get expenses for one month.
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
 * Select exactly ONE maintenance record per flat.
 *
 * If duplicates exist:
 *
 * Flat 101 - old record
 * Flat 101 - newer record
 * Flat 101 - newest record
 *
 * only the newest record is used.
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

    const existingTime = new Date(
      existing.updatedAt ||
        existing.createdAt ||
        0
    ).getTime();

    const recordTime = new Date(
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
 * BUILD MONTHLY MAINTENANCE RECORDS
 * =========================================================
 *
 * The active flats collection is the source of truth.
 *
 * Example:
 *
 * Active flats = 57
 *
 * Even if MaintenanceRecord collection contains:
 *
 * 171 records
 *
 * this function returns ONLY 57 rows.
 */
async function buildMonthlyMaintenanceRecords(
  month: string
): Promise<any[]> {
  const flats = await getActiveFlats();

  const rawRecords =
    await getMonthMaintenanceRecords(
      month
    );

  /**
   * Remove duplicate maintenance records
   * for the same flat.
   */
  const recordMap =
    getUniqueMaintenanceRecords(
      rawRecords
    );

  const maintenanceRecords: any[] = [];

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
      flat._id || flat.id
    );

    const flatAmount =
      flat.customMaintenanceAmount !==
        undefined &&
      flat.customMaintenanceAmount !==
        null &&
      flat.customMaintenanceAmount !== ''
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
       * No maintenance record exists yet.
       *
       * Treat it as Pending.
       */
      maintenanceRecords.push({
        flatId,

        flatNumber:
          flat.flatNumber,

        residentName:
          flat.residentName,

        amount:
          flatAmount,

        status: 'Pending',

        paidDate: null,

        paymentMode: '',

        receiptNumber: '',

        remarks: ''
      });
    }
  }

  /**
   * Sort naturally:
   *
   * 101
   * 102
   * 103
   * ...
   * 201
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
 * GET MONTHLY REPORT
 * =========================================================
 */
export const getMonthlyReport = async (
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
     * 1. MAINTENANCE
     * =====================================================
     *
     * Active flats are the source of truth.
     *
     * If there are 57 active flats:
     *
     * totalFlats = 57
     *
     * even if old maintenance records contain
     * 171 rows.
     */
    const maintenanceRecords =
      await buildMonthlyMaintenanceRecords(
        month
      );

    const totalFlats =
      maintenanceRecords.length;

    let expectedMaintenance = 0;
    let collectedMaintenance = 0;

    const paidFlats: any[] = [];
    const pendingFlats: any[] = [];

    for (
      const record of maintenanceRecords
    ) {
      const amount =
        Number(
          record.amount
        ) || 0;

      expectedMaintenance +=
        amount;

      if (
        record.status === 'Paid'
      ) {
        collectedMaintenance +=
          amount;

        paidFlats.push(
          record
        );
      } else {
        pendingFlats.push(
          record
        );
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
              ) * 100
            ).toFixed(1)
          )
        : 0;

    /**
     * =====================================================
     * 2. EXPENSES
     * =====================================================
     */
    const expenses =
      await getMonthExpenses(
        month
      );

    let recurringExpensesTotal = 0;
    let oneTimeExpensesTotal = 0;

    const categoryTotals:
      Record<string, number> = {};

    for (
      const expense of expenses
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

    const remainingBalance =
      collectedMaintenance -
      totalExpenses;

    /**
     * =====================================================
     * 3. CUMULATIVE SUMMARY
     * =====================================================
     *
     * IMPORTANT:
     *
     * For every month:
     *
     * YYYY-MM + flat number
     *
     * is treated as one maintenance record.
     *
     * This prevents:
     *
     * 57 flats × duplicate records
     *
     * from inflating cumulative collection.
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
              record.month <= month
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

      /**
       * Month + Flat is the unique key.
       *
       * Example:
       *
       * 2026-08_101
       */
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

      /**
       * Keep newest record.
       */
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
     * Only PAID records contribute
     * to cumulative collection.
     */
    const uniquePaidRecords =
      Array.from(
        cumulativeRecordMap.values()
      ).filter(
        (record: any) =>
          record.status === 'Paid'
      );

    /**
     * All expenses up to selected month.
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
              expense.month <= month
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
     * Months that actually contain
     * financial activity.
     */
    const monthsSet =
      new Set<string>();

    uniquePaidRecords.forEach(
      (record: any) => {
        if (record.month) {
          monthsSet.add(
            record.month
          );
        }
      }
    );

    allPriorExpenses.forEach(
      (expense: any) => {
        if (expense.month) {
          monthsSet.add(
            expense.month
          );
        }
      }
    );

    const monthsIncluded =
      Array.from(
        monthsSet
      ).sort();

    /**
     * =====================================================
     * 4. TASKS
     * =====================================================
     */
    const tasks = isMongo
      ? await (
          TaskModel as any
        )
          .find({
            $or: [
              {
                month
              },
              {
                dueDate: {
                  $gte: new Date(
                    `${month}-01`
                  ),
                  $lte: new Date(
                    `${month}-31`
                  )
                }
              }
            ]
          })
          .lean()
      : await TaskStore.find(
          (task: any) => {
            if (
              task.month === month
            ) {
              return true;
            }

            if (
              !task.dueDate
            ) {
              return false;
            }

            const due =
              new Date(
                task.dueDate
              );

            if (
              Number.isNaN(
                due.getTime()
              )
            ) {
              return false;
            }

            return (
              due
                .toISOString()
                .slice(0, 7) ===
              month
            );
          }
        );

    /**
     * =====================================================
     * 5. SETTINGS
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

    /**
     * =====================================================
     * RESPONSE
     * =====================================================
     */
    return res.json({
      success: true,

      month,

      monthDisplay:
        monthYearDisplay,

      settings:
        settings || {
          apartmentName:
            'Greenview Heights Apartments'
        },

      financialSummary: {
        totalFlats,

        expectedMaintenance,

        collectedMaintenance,

        pendingMaintenance,

        collectionRate,

        paidFlatsCount:
          paidFlats.length,

        pendingFlatsCount:
          pendingFlats.length,

        recurringExpensesTotal,

        oneTimeExpensesTotal,

        totalExpenses,

        remainingBalance
      },

      cumulativeSummary: {
        cutoffMonth:
          month,

        cutoffMonthDisplay:
          monthYearDisplay,

        monthsIncluded,

        totalCollected:
          cumulativeCollected,

        totalExpenses:
          cumulativeExpenses,

        cumulativeSavings
      },

      expensesBreakdown: {
        byCategory:
          categoryTotals,

        recurring:
          expenses.filter(
            (expense: any) =>
              expense.expenseType ===
              'Recurring'
          ),

        oneTime:
          expenses.filter(
            (expense: any) =>
              expense.expenseType ===
              'One-Time'
          )
      },

      expenses,

      paidFlats,

      pendingFlats,

      /**
       * Exactly one row per active flat.
       */
      allMaintenanceRecords:
        maintenanceRecords,

      tasks
    });
  } catch (err: any) {
    console.error(
      'Error generating monthly report:',
      err
    );

    return res.status(500).json({
      success: false,
      message:
        'Error generating report',
      error: err.message
    });
  }
};

/**
 * =========================================================
 * ANNUAL OVERVIEW
 * =========================================================
 *
 * Every month is calculated independently.
 *
 * Duplicate records for the same flat/month
 * are ignored.
 *
 * Current active flats remain the source of truth.
 */
export const getAnnualOverview = async (
  req: Request,
  res: Response
) => {
  try {
    const { year } =
      req.params;

    const isMongo =
      dbState.isConnectedToMongo;

    const currentYear =
      year ||
      String(
        new Date().getFullYear()
      );

    /**
     * Validate year.
     */
    if (
      !/^\d{4}$/.test(
        currentYear
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid year format. Expected YYYY'
      });
    }

    /**
     * 12 months.
     */
    const months =
      Array.from(
        {
          length: 12
        },
        (_, index) =>
          `${currentYear}-${String(
            index + 1
          ).padStart(2, '0')}`
      );

    const monthlyStats: any[] =
      [];

    /**
     * Current active flats.
     *
     * This is the SOURCE OF TRUTH.
     */
    const activeFlats =
      await getActiveFlats();

    /**
     * Map active flats by normalized
     * flat number.
     */
    const activeFlatMap =
      new Map<string, any>();

    for (
      const flat of activeFlats
    ) {
      const normalized =
        normalizeFlatNumber(
          flat.flatNumber
        );

      if (!normalized) {
        continue;
      }

      activeFlatMap.set(
        normalized,
        flat
      );
    }

    /**
     * Current active flat count.
     */
    const activeFlatCount =
      activeFlatMap.size;

    /**
     * Process every month.
     */
    for (
      const month of months
    ) {
      /**
       * Fetch raw maintenance records.
       */
      const rawRecords =
        isMongo
          ? await (
              MaintenanceRecordModel as any
            )
              .find({
                month
              })
              .lean()
          : await MaintenanceRecordStore.find(
              {
                month
              }
            );

      /**
       * Remove duplicates.
       *
       * One flat = one record.
       */
      const recordMap =
        getUniqueMaintenanceRecords(
          rawRecords
        );

      /**
       * Only records belonging to
       * current active flats are counted.
       */
      const records: any[] =
        [];

      for (
        const [
          flatNumber,
          record
        ] of recordMap.entries()
      ) {
        if (
          !activeFlatMap.has(
            flatNumber
          )
        ) {
          continue;
        }

        /**
         * Use the current flat's details.
         */
        const flat =
          activeFlatMap.get(
            flatNumber
          );

        const flatAmount =
          flat.customMaintenanceAmount !==
            undefined &&
          flat.customMaintenanceAmount !==
            null &&
          flat.customMaintenanceAmount !==
            ''
            ? Number(
                flat.customMaintenanceAmount
              )
            : 1500;

        records.push({
          ...record,

          flatNumber:
            flat.flatNumber,

          residentName:
            flat.residentName,

          amount:
            record.amount !==
              undefined &&
            record.amount !==
              null
              ? Number(
                  record.amount
                )
              : flatAmount
        });
      }

      /**
       * =====================================================
       * EXPECTED MAINTENANCE
       * =====================================================
       *
       * IMPORTANT:
       *
       * Expected maintenance is based on
       * active flats.
       *
       * If there are 57 active flats and
       * maintenance is ₹1,500 each:
       *
       * 57 × ₹1,500
       * =
       * ₹85,500
       *
       * Even if no maintenance records
       * have been created yet.
       *
       * If a flat has a custom maintenance
       * amount, that custom amount is used.
       */
      let expected = 0;

      for (
        const flat of activeFlats
      ) {
        const amount =
          flat.customMaintenanceAmount !==
            undefined &&
          flat.customMaintenanceAmount !==
            null &&
          flat.customMaintenanceAmount !==
            ''
            ? Number(
                flat.customMaintenanceAmount
              )
            : 1500;

        expected +=
          Number(amount) || 0;
      }

      /**
       * =====================================================
       * COLLECTED MAINTENANCE
       * =====================================================
       */
      const collected =
        records
          .filter(
            (record: any) =>
              record.status ===
              'Paid'
          )
          .reduce(
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

      /**
       * =====================================================
       * EXPENSES
       * =====================================================
       */
      const expenses =
        isMongo
          ? await (
              MonthlyExpenseModel as any
            )
              .find({
                month
              })
              .lean()
          : await MonthlyExpenseStore.find(
              {
                month
              }
            );

      const expenseTotal =
        expenses.reduce(
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

      /**
       * Paid flats count.
       */
      const paidCount =
        records.filter(
          (record: any) =>
            record.status ===
            'Paid'
        ).length;

      /**
       * Pending flats.
       *
       * Since active flats are the source
       * of truth, pending count should be:
       *
       * total active flats - paid flats
       */
      const pendingCount =
        Math.max(
          activeFlatCount -
            paidCount,
          0
        );

      /**
       * =====================================================
       * MONTHLY STATISTICS
       * =====================================================
       */
      monthlyStats.push({
        month,

        expected,

        collected,

        pending:
          expected -
          collected,

        expenses:
          expenseTotal,

        netBalance:
          collected -
          expenseTotal,

        paidCount,

        pendingCount,

        totalFlats:
          activeFlatCount
      });
    }

    /**
     * =====================================================
     * RESPONSE
     * =====================================================
     */
    return res.json({
      success: true,

      year: currentYear,

      totalFlats:
        activeFlatCount,

      monthlyStats
    });
  } catch (err: any) {
    console.error(
      'Error fetching annual overview:',
      err
    );

    return res.status(500).json({
      success: false,
      message:
        'Error fetching annual overview',
      error: err.message
    });
  }
};