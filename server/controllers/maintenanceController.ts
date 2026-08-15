import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { MaintenanceRecordModel, MaintenanceRecordStore } from '../models/MaintenanceRecord';
import { FlatModel, FlatStore } from '../models/Flat';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';

/**
 * Helper to ensure all flats have a record for the specified month
 */
async function ensureMonthRecords(month: string) {
  const isMongo = dbState.isConnectedToMongo;
  
  // Get all active flats
  const flats = isMongo 
    ? await (FlatModel as any).find({ status: { $ne: 'Inactive' } }).lean() 
    : await FlatStore.find((f: any) => (f.status || 'Active') !== 'Inactive');
  
  // Get default maintenance rate from settings
  let defaultAmount = 1500;
  if (isMongo) {
    const settings = await ApartmentSettingsModel.findOne().lean();
    if (settings && settings.defaultMonthlyMaintenance) {
      defaultAmount = settings.defaultMonthlyMaintenance;
    }
  } else {
    const settings = await SettingsStore.findOne(() => true);
    if (settings && settings.defaultMonthlyMaintenance) {
      defaultAmount = settings.defaultMonthlyMaintenance;
    }
  }

  // Get existing records for this month
  const existingRecords = isMongo 
    ? await (MaintenanceRecordModel as any).find({ month }).lean()
    : await MaintenanceRecordStore.find({ month });

  const existingMap = new Map();
  existingRecords.forEach((r: any) => {
    existingMap.set(String(r.flatId), r);
  });

  const missingRecords: any[] = [];
  for (const flat of flats) {
    const flatId = String(flat._id || flat.id);
    if (!existingMap.has(flatId)) {
      missingRecords.push({
        month,
        flatId: flat._id || flat.id,
        flatNumber: flat.flatNumber,
        residentName: flat.residentName,
        amount: flat.customMaintenanceAmount !== null && flat.customMaintenanceAmount !== undefined 
          ? flat.customMaintenanceAmount 
          : defaultAmount,
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

export const getMonthMaintenance = async (req: Request, res: Response) => {
  try {
    const { month } = req.params; // format: YYYY-MM
    const { status, search, block } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Expected YYYY-MM' });
    }

    // Auto-create any missing records for this month
    await ensureMonthRecords(month);

    const isMongo = dbState.isConnectedToMongo;
    let records: any[] = [];

    if (isMongo) {
      const query: any = { month };
      if (status && (status === 'Paid' || status === 'Pending')) {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { flatNumber: { $regex: String(search), $options: 'i' } },
          { residentName: { $regex: String(search), $options: 'i' } }
        ];
      }
      records = await MaintenanceRecordModel.find(query)
        .populate('flatId', 'block floor phone residentType occupancyStatus')
        .sort({ flatNumber: 1 })
        .lean();
    } else {
      const flats = await FlatStore.find();
      const flatMap = new Map(flats.map((f: any) => [String(f._id || f.id), f]));

      records = await MaintenanceRecordStore.find((r: any) => {
        if (r.month !== month) return false;
        if (status && r.status !== status) return false;
        if (search) {
          const s = String(search).toLowerCase();
          const matchFlat = (r.flatNumber || '').toLowerCase().includes(s);
          const matchName = (r.residentName || '').toLowerCase().includes(s);
          if (!matchFlat && !matchName) return false;
        }
        return true;
      });

      // Populate flat data and filter block if provided
      records = records.map((r: any) => {
        const flat = flatMap.get(String(r.flatId)) || {};
        return {
          ...r,
          flatId: flat
        };
      });

      if (block) {
        records = records.filter((r: any) => r.flatId?.block === block);
      }

      records.sort((a, b) => (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true }));
    }

    // Calculate all financial figures accurately from database records
    const allMonthRecords = isMongo 
      ? await (MaintenanceRecordModel as any).find({ month }).lean()
      : await MaintenanceRecordStore.find({ month });

    const totalFlats = allMonthRecords.length;
    let expectedMaintenance = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;

    for (const r of allMonthRecords) {
      const amt = Number(r.amount) || 0;
      expectedMaintenance += amt;
      if (r.status === 'Paid') {
        totalCollected += amt;
        paidCount++;
      } else {
        pendingCount++;
      }
    }

    const totalPending = expectedMaintenance - totalCollected;
    const collectionPercentage = expectedMaintenance > 0 
      ? Number(((totalCollected / expectedMaintenance) * 100).toFixed(1)) 
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
    return res.status(500).json({ success: false, message: 'Error fetching maintenance records', error: err.message });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, amount, paymentMode, paidDate, receiptNumber, remarks } = req.body;

    if (!status || !['Paid', 'Pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "Paid" or "Pending"' });
    }

    const isMongo = dbState.isConnectedToMongo;
    const updateData: any = {
      status,
      remarks: remarks !== undefined ? remarks : ''
    };

    if (amount !== undefined) {
      updateData.amount = Number(amount);
    }

    if (status === 'Paid') {
      updateData.paidDate = paidDate ? new Date(paidDate) : new Date();
      updateData.paymentMode = paymentMode || 'UPI';
      updateData.receiptNumber = receiptNumber || `REC-${Date.now().toString().slice(-6)}`;
    } else {
      updateData.paidDate = null;
      updateData.paymentMode = '';
      updateData.receiptNumber = '';
    }

    let updatedRecord: any = null;

    if (isMongo) {
      updatedRecord = await (MaintenanceRecordModel as any).findByIdAndUpdate(id, updateData, { new: true });
    } else {
      updatedRecord = await MaintenanceRecordStore.findByIdAndUpdate(id, updateData);
    }

    if (!updatedRecord) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }

    return res.json({
      success: true,
      message: `Flat ${updatedRecord.flatNumber} payment marked as ${status}`,
      record: updatedRecord
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating payment status', error: err.message });
  }
};

export const batchUpdateStatus = async (req: Request, res: Response) => {
  try {
    const { recordIds, status, paymentMode, remarks } = req.body;

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ success: false, message: 'recordIds array is required' });
    }

    if (!['Paid', 'Pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "Paid" or "Pending"' });
    }

    const isMongo = dbState.isConnectedToMongo;

    const updatePayload: any = {
      status,
      remarks: remarks || ''
    };

    if (status === 'Paid') {
      updatePayload.paidDate = new Date();
      updatePayload.paymentMode = paymentMode || 'UPI';
    } else {
      updatePayload.paidDate = null;
      updatePayload.paymentMode = '';
      updatePayload.receiptNumber = '';
    }

    if (isMongo) {
      await (MaintenanceRecordModel as any).updateMany(
        { _id: { $in: recordIds } },
        { $set: updatePayload }
      );
    } else {
      for (const id of recordIds) {
        await MaintenanceRecordStore.findByIdAndUpdate(id, {
          ...updatePayload,
          ...(status === 'Paid' ? { receiptNumber: `REC-${Date.now().toString().slice(-6)}` } : {})
        });
      }
    }

    return res.json({
      success: true,
      message: `Successfully updated ${recordIds.length} flats to ${status}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error in batch update', error: err.message });
  }
};

export const batchSavePayments = async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'updates array is required' });
    }

    const isMongo = dbState.isConnectedToMongo;
    let updatedCount = 0;

    for (const item of updates) {
      if (!item.id || !['Paid', 'Pending'].includes(item.status)) continue;

      const updateData: any = {
        status: item.status,
        paidDate: item.status === 'Paid' ? (item.paidDate ? new Date(item.paidDate) : new Date()) : null
      };

      if (isMongo) {
        await (MaintenanceRecordModel as any).findByIdAndUpdate(item.id, updateData);
      } else {
        await MaintenanceRecordStore.findByIdAndUpdate(item.id, updateData);
      }
      updatedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully updated ${updatedCount} payment records`,
      updatedCount
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error saving batch payments', error: err.message });
  }
};
