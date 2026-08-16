import { Request, Response } from 'express';
import { dbState } from '../config/db';
import {
  MaintenanceRecordModel,
  MaintenanceRecordStore
} from '../models/MaintenanceRecord';
import { FlatModel, FlatStore } from '../models/Flat';
import {
  ApartmentSettingsModel,
  SettingsStore
} from '../models/ApartmentSettings';

/**
 * Get all active flats.
 * Flats collection is the SOURCE OF TRUTH for the number of flats.
 */
async function getActiveFlats(): Promise<any[]> {
  const isMongo = dbState.isConnectedToMongo;

  if (isMongo) {
    return await (FlatModel as any)
      .find({ status: { $ne: 'Inactive' } })
      .lean();
  }

  return await FlatStore.find(
    (f: any) => (f.status || 'Active') !== 'Inactive'
  );
}

/**
 * Get the default monthly maintenance amount.
 */
async function getDefaultMaintenanceAmount(): Promise<number> {
  const isMongo = dbState.isConnectedToMongo;

  let defaultAmount = 1500;

  if (isMongo) {
    const settings = await ApartmentSettingsModel.findOne().lean();

    if (
      settings &&
      settings.defaultMonthlyMaintenance !== undefined &&
      settings.defaultMonthlyMaintenance !== null
    ) {
      defaultAmount = Number(settings.defaultMonthlyMaintenance) || 1500;
    }
  } else {
    const settings = await SettingsStore.findOne(() => true);

    if (
      settings &&
      settings.defaultMonthlyMaintenance !== undefined &&
      settings.defaultMonthlyMaintenance !== null
    ) {
      defaultAmount = Number(settings.defaultMonthlyMaintenance) || 1500;
    }
  }

  return defaultAmount;
}

/**
 * Get all maintenance records for a month.
 */
async function getMonthRecords(month: string): Promise<any[]> {
  const isMongo = dbState.isConnectedToMongo;

  if (isMongo) {
    return await (MaintenanceRecordModel as any)
      .find({ month })
      .lean();
  }

  return await MaintenanceRecordStore.find({ month });
}

/**
 * Convert flatId to a reliable string.
 */
function getFlatId(record: any): string {
  if (!record) return '';

  if (
    typeof record.flatId === 'object' &&
    record.flatId &&
    record.flatId._id
  ) {
    return String(record.flatId._id);
  }

  return String(record.flatId || '');
}

/**
 * Create exactly ONE maintenance record for every active flat.
 *
 * IMPORTANT:
 * The Flat collection is the source of truth.
 *
 * If duplicate maintenance records already exist for the same flat/month,
 * only the latest one is used.
 *
 * Missing records are automatically created.
 */
async function ensureMonthRecords(month: string) {
  const isMongo = dbState.isConnectedToMongo;

  const flats = await getActiveFlats();
  const defaultAmount = await getDefaultMaintenanceAmount();
  const existingRecords = await getMonthRecords(month);

  /**
   * Keep only one record per flatId.
   * If duplicates exist, keep the latest updated record.
   */
  const existingMap = new Map<string, any>();

  for (const record of existingRecords) {
    const flatId = getFlatId(record);

    if (!flatId) continue;

    const existing = existingMap.get(flatId);

    if (!existing) {
      existingMap.set(flatId, record);
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
      existingMap.set(flatId, record);
    }
  }

  const missingRecords: any[] = [];

  for (const flat of flats) {
    const flatId = String(flat._id || flat.id);

    if (!flatId) continue;

    if (!existingMap.has(flatId)) {
      const amount =
        flat.customMaintenanceAmount !== null &&
        flat.customMaintenanceAmount !== undefined
          ? Number(flat.customMaintenanceAmount)
          : defaultAmount;

      missingRecords.push({
        month,
        flatId: flat._id || flat.id,
        flatNumber: flat.flatNumber,
        residentName: flat.residentName,
        amount: Number(amount) || defaultAmount,
        status: 'Pending',
        paidDate: null,
        paymentMode: '',
        receiptNumber: '',
        remarks: ''
      });
    }
  }

  if (missingRecords.length > 0) {
    if (isMongo) {
      await MaintenanceRecordModel.insertMany(missingRecords);
    } else {
      await MaintenanceRecordStore.insertMany(missingRecords);
    }
  }
}

/**
 * Build EXACTLY ONE maintenance record per active flat.
 *
 * This is the most important helper in this controller.
 *
 * Example:
 * 57 flats + 171 old maintenance records
 * =>
 * exactly 57 records are returned.
 */
async function buildUniqueMonthRecords(month: string): Promise<any[]> {
  const flats = await getActiveFlats();
  const rawRecords = await getMonthRecords(month);

  const recordMap = new Map<string, any>();

  /**
   * First map records by flatId.
   */
  for (const record of rawRecords) {
    const flatId = getFlatId(record);

    if (!flatId) continue;

    const existing = recordMap.get(flatId);

    if (!existing) {
      recordMap.set(flatId, record);
      continue;
    }

    /**
     * If duplicates exist, keep the newest record.
     */
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
      recordMap.set(flatId, record);
    }
  }

  /**
   * Build records from CURRENT ACTIVE FLATS.
   *
   * Therefore:
   *
   * 57 active flats => maximum 57 maintenance rows.
   */
  const uniqueRecords: any[] = [];

  for (const flat of flats) {
    const flatId = String(flat._id || flat.id);

    const existingRecord = recordMap.get(flatId);

    if (existingRecord) {
      uniqueRecords.push({
        ...existingRecord,
        flatId,
        flatNumber: flat.flatNumber,
        residentName: flat.residentName,
        amount:
          existingRecord.amount !== undefined &&
          existingRecord.amount !== null
            ? Number(existingRecord.amount)
            : flat.customMaintenanceAmount !== null &&
              flat.customMaintenanceAmount !== undefined
              ? Number(flat.customMaintenanceAmount)
              : 1500
      });
    } else {
      uniqueRecords.push({
        flatId,
        flatNumber: flat.flatNumber,
        residentName: flat.residentName,
        amount:
          flat.customMaintenanceAmount !== null &&
          flat.customMaintenanceAmount !== undefined
            ? Number(flat.customMaintenanceAmount)
            : 1500,
        status: 'Pending',
        paidDate: null,
        paymentMode: '',
        receiptNumber: '',
        remarks: ''
      });
    }
  }

  uniqueRecords.sort((a: any, b: any) =>
    String(a.flatNumber || '').localeCompare(
      String(b.flatNumber || ''),
      undefined,
      { numeric: true }
    )
  );

  return uniqueRecords;
}

/**
 * GET MONTHLY MAINTENANCE
 */
export const getMonthMaintenance = async (
  req: Request,
  res: Response
) => {
  try {
    const { month } = req.params;
    const { status, search, block } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Expected YYYY-MM'
      });
    }

    /**
     * Ensure every active flat has a record.
     */
    await ensureMonthRecords(month);

    /**
     * Build exactly one record per active flat.
     */
    let allRecords = await buildUniqueMonthRecords(month);

    /**
     * Attach extra flat information.
     */
    const flats = await getActiveFlats();

    const flatMap = new Map<string, any>();

    flats.forEach((flat: any) => {
      flatMap.set(String(flat._id || flat.id), flat);
    });

    allRecords = allRecords.map((record: any) => {
      const flat = flatMap.get(String(record.flatId));

      return {
        ...record,
        flatId: flat || record.flatId
      };
    });

    /**
     * Apply filters AFTER building the unique 57-flat dataset.
     */
    let records = allRecords;

    if (status === 'Paid' || status === 'Pending') {
      records = records.filter(
        (record: any) => record.status === status
      );
    }

    if (search) {
      const searchText = String(search).toLowerCase();

      records = records.filter((record: any) => {
        const flatNumber = String(
          record.flatNumber || ''
        ).toLowerCase();

        const residentName = String(
          record.residentName || ''
        ).toLowerCase();

        return (
          flatNumber.includes(searchText) ||
          residentName.includes(searchText)
        );
      });
    }

    if (block) {
      records = records.filter(
        (record: any) =>
          record.flatId?.block === String(block)
      );
    }

    /**
     * FINANCIAL SUMMARY
     *
     * IMPORTANT:
     * Use the unique allRecords array, NOT the filtered records.
     *
     * This prevents search/status/block filters from changing
     * dashboard totals.
     */
    const totalFlats = allRecords.length;

    let expectedMaintenance = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const record of allRecords) {
      const amount = Number(record.amount) || 0;

      expectedMaintenance += amount;

      if (record.status === 'Paid') {
        totalCollected += amount;
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const totalPending =
      expectedMaintenance - totalCollected;

    const collectionPercentage =
      expectedMaintenance > 0
        ? Number(
            (
              (totalCollected / expectedMaintenance) *
              100
            ).toFixed(1)
          )
        : 0;

    return res.json({
      success: true,
      month,

      summary: {
        totalFlats,
        expectedMaintenance,
        totalCollected,
        totalPending,
        paidCount,
        pendingCount,
        collectionPercentage
      },

      count: records.length,
      records
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching maintenance records',
      error: err.message
    });
  }
};

/**
 * UPDATE SINGLE PAYMENT STATUS
 */
export const updatePaymentStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      status,
      amount,
      paymentMode,
      paidDate,
      receiptNumber,
      remarks
    } = req.body;

    if (
      !status ||
      !['Paid', 'Pending'].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "Paid" or "Pending"'
      });
    }

    const isMongo = dbState.isConnectedToMongo;

    const updateData: any = {
      status,
      remarks:
        remarks !== undefined
          ? remarks
          : ''
    };

    if (amount !== undefined) {
      const numericAmount = Number(amount);

      if (
        Number.isNaN(numericAmount) ||
        numericAmount < 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid maintenance amount'
        });
      }

      updateData.amount = numericAmount;
    }

    if (status === 'Paid') {
      updateData.paidDate = paidDate
        ? new Date(paidDate)
        : new Date();

      updateData.paymentMode =
        paymentMode || 'UPI';

      updateData.receiptNumber =
        receiptNumber ||
        `REC-${Date.now().toString().slice(-6)}`;
    } else {
      updateData.paidDate = null;
      updateData.paymentMode = '';
      updateData.receiptNumber = '';
    }

    let updatedRecord: any = null;

    if (isMongo) {
      updatedRecord =
        await (MaintenanceRecordModel as any)
          .findByIdAndUpdate(
            id,
            updateData,
            { new: true }
          );
    } else {
      updatedRecord =
        await MaintenanceRecordStore.findByIdAndUpdate(
          id,
          updateData
        );
    }

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    return res.json({
      success: true,
      message:
        `Flat ${updatedRecord.flatNumber} payment marked as ${status}`,
      record: updatedRecord
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: err.message
    });
  }
};

/**
 * BATCH UPDATE PAYMENT STATUS
 */
export const batchUpdateStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      recordIds,
      status,
      paymentMode,
      remarks
    } = req.body;

    if (
      !Array.isArray(recordIds) ||
      recordIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'recordIds array is required'
      });
    }

    if (
      !['Paid', 'Pending'].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "Paid" or "Pending"'
      });
    }

    const isMongo = dbState.isConnectedToMongo;

    const updatePayload: any = {
      status,
      remarks: remarks || ''
    };

    if (status === 'Paid') {
      updatePayload.paidDate = new Date();
      updatePayload.paymentMode =
        paymentMode || 'UPI';
    } else {
      updatePayload.paidDate = null;
      updatePayload.paymentMode = '';
      updatePayload.receiptNumber = '';
    }

    if (isMongo) {
      await (MaintenanceRecordModel as any)
        .updateMany(
          {
            _id: {
              $in: recordIds
            }
          },
          {
            $set: updatePayload
          }
        );
    } else {
      for (const id of recordIds) {
        await MaintenanceRecordStore.findByIdAndUpdate(
          id,
          {
            ...updatePayload,
            ...(status === 'Paid'
              ? {
                  receiptNumber:
                    `REC-${Date.now().toString().slice(-6)}`
                }
              : {})
          }
        );
      }
    }

    return res.json({
      success: true,
      message:
        `Successfully updated ${recordIds.length} flats to ${status}`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error in batch update',
      error: err.message
    });
  }
};

/**
 * BATCH SAVE PAYMENTS
 */
export const batchSavePayments = async (
  req: Request,
  res: Response
) => {
  try {
    const { updates } = req.body;

    if (
      !Array.isArray(updates) ||
      updates.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'updates array is required'
      });
    }

    const isMongo = dbState.isConnectedToMongo;

    let updatedCount = 0;

    for (const item of updates) {
      if (
        !item.id ||
        !['Paid', 'Pending'].includes(item.status)
      ) {
        continue;
      }

      const updateData: any = {
        status: item.status,
        paidDate:
          item.status === 'Paid'
            ? item.paidDate
              ? new Date(item.paidDate)
              : new Date()
            : null
      };

      if (item.status === 'Paid') {
        updateData.paymentMode =
          item.paymentMode || 'UPI';

        updateData.receiptNumber =
          item.receiptNumber ||
          `REC-${Date.now().toString().slice(-6)}`;
      } else {
        updateData.paymentMode = '';
        updateData.receiptNumber = '';
      }

      if (item.remarks !== undefined) {
        updateData.remarks = item.remarks;
      }

      if (item.amount !== undefined) {
        const numericAmount = Number(item.amount);

        if (
          !Number.isNaN(numericAmount) &&
          numericAmount >= 0
        ) {
          updateData.amount = numericAmount;
        }
      }

      if (isMongo) {
        await (MaintenanceRecordModel as any)
          .findByIdAndUpdate(
            item.id,
            updateData
          );
      } else {
        await MaintenanceRecordStore.findByIdAndUpdate(
          item.id,
          updateData
        );
      }

      updatedCount++;
    }

    return res.json({
      success: true,
      message:
        `Successfully updated ${updatedCount} payment records`,
      updatedCount
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error saving batch payments',
      error: err.message
    });
  }
};