import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { FlatModel, FlatStore } from '../models/Flat';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';


export const getAllFlats = async (req: Request, res: Response) => {
  try {
    const isMongo = dbState.isConnectedToMongo;
    const { block, search, occupancy, residentType, status } = req.query;

    let flats: any[] = [];

    if (isMongo) {
      const query: any = {};
      if (block) query.block = block;
      if (occupancy) query.occupancyStatus = occupancy;
      if (residentType) query.residentType = residentType;
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { flatNumber: { $regex: String(search), $options: 'i' } },
          { residentName: { $regex: String(search), $options: 'i' } },
          { phone: { $regex: String(search), $options: 'i' } }
        ];
      }
      flats = await FlatModel.find(query).sort({ flatNumber: 1 }).lean();
    } else {
      flats = await FlatStore.find((flat: any) => {
        if (block && flat.block !== block) return false;
        if (occupancy && flat.occupancyStatus !== occupancy) return false;
        if (residentType && flat.residentType !== residentType) return false;
        if (status && (flat.status || 'Active') !== status) return false;
        if (search) {
          const s = String(search).toLowerCase();
          const matchesFlat = (flat.flatNumber || '').toLowerCase().includes(s);
          const matchesName = (flat.residentName || '').toLowerCase().includes(s);
          const matchesPhone = (flat.phone || '').toLowerCase().includes(s);
          if (!matchesFlat && !matchesName && !matchesPhone) return false;
        }
        return true;
      });
    }

    // Sort flats naturally by flat number (e.g., 101, 102, 201...)
    flats.sort((a, b) => (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true }));

    return res.json({
      success: true,
      count: flats.length,
      flats
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching flats', error: err.message });
  }
};

export const getFlatById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    const flat = isMongo 
      ? await (FlatModel as any).findById(id).lean()
      : await FlatStore.findById(id);

    if (!flat) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }

    return res.json({ success: true, flat });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching flat', error: err.message });
  }
};

export const createFlat = async (req: Request, res: Response) => {
  try {
    const { flatNumber, residentName, customMaintenanceAmount, status, notes } = req.body;

    if (!flatNumber || !String(flatNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Flat Number is required.' });
    }

    if (!residentName || !String(residentName).trim()) {
      return res.status(400).json({ success: false, message: 'Resident Name is required.' });
    }

    const trimmedFlatNumber = String(flatNumber).trim();
    const trimmedResidentName = String(residentName).trim();
    const maintAmt = customMaintenanceAmount !== undefined && customMaintenanceAmount !== null && customMaintenanceAmount !== ''
      ? Number(customMaintenanceAmount)
      : null;

    if (maintAmt !== null && (isNaN(maintAmt) || maintAmt < 0)) {
      return res.status(400).json({ success: false, message: 'Maintenance Amount must be a valid positive number.' });
    }

    const isMongo = dbState.isConnectedToMongo;

    // Check for duplicate flat number (case-insensitive)
    const existing = isMongo
      ? await (FlatModel as any).findOne({ flatNumber: { $regex: `^${trimmedFlatNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } })
      : await FlatStore.findOne((f: any) => (f.flatNumber || '').trim().toLowerCase() === trimmedFlatNumber.toLowerCase());

    if (existing) {
      return res.status(400).json({ success: false, message: `Flat "${trimmedFlatNumber}" already exists.` });
    }

    const flatData = {
      flatNumber: trimmedFlatNumber,
      residentName: trimmedResidentName,
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      customMaintenanceAmount: maintAmt,
      block: '',
      floor: 1,
      residentType: 'Owner',
      phone: '',
      email: '',
      occupancyStatus: 'Occupied',
      notes: notes || ''
    };

    const newFlat = isMongo 
      ? await FlatModel.create(flatData)
      : await FlatStore.create(flatData);

    // Update totalFlats count in ApartmentSettings if needed
    try {
      const allCount = isMongo ? await (FlatModel as any).countDocuments() : await FlatStore.countDocuments();
      if (isMongo) {
        await (ApartmentSettingsModel as any).updateOne({}, { totalFlats: allCount });
      } else {
        const s = await SettingsStore.findOne(() => true);
        if (s) {
          await SettingsStore.findByIdAndUpdate(s._id || s.id, { totalFlats: allCount });
        }
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: `Flat ${newFlat.flatNumber} added successfully`,
      flat: newFlat
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error creating flat', error: err.message });
  }
};

export const updateFlat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    const { flatNumber, residentName, customMaintenanceAmount, status, notes } = req.body;

    if (!flatNumber || !String(flatNumber).trim()) {
      return res.status(400).json({ success: false, message: 'Flat Number is required.' });
    }

    if (!residentName || !String(residentName).trim()) {
      return res.status(400).json({ success: false, message: 'Resident Name is required.' });
    }

    const trimmedFlatNumber = String(flatNumber).trim();
    const trimmedResidentName = String(residentName).trim();
    const maintAmt = customMaintenanceAmount !== undefined && customMaintenanceAmount !== null && customMaintenanceAmount !== ''
      ? Number(customMaintenanceAmount)
      : null;

    if (maintAmt !== null && (isNaN(maintAmt) || maintAmt < 0)) {
      return res.status(400).json({ success: false, message: 'Maintenance Amount must be a valid positive number.' });
    }

    // Check if flat number is taken by another flat
    const duplicate = isMongo
      ? await (FlatModel as any).findOne({
          _id: { $ne: id },
          flatNumber: { $regex: `^${trimmedFlatNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
        })
      : await FlatStore.findOne((f: any) => String(f._id || f.id) !== String(id) && (f.flatNumber || '').trim().toLowerCase() === trimmedFlatNumber.toLowerCase());

    if (duplicate) {
      return res.status(400).json({ success: false, message: `Flat "${trimmedFlatNumber}" already belongs to another unit.` });
    }

    const updateData: any = {
      flatNumber: trimmedFlatNumber,
      residentName: trimmedResidentName,
      customMaintenanceAmount: maintAmt
    };

    if (status) {
      updateData.status = status === 'Inactive' ? 'Inactive' : 'Active';
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    let updatedFlat: any = null;

    if (isMongo) {
      updatedFlat = await (FlatModel as any).findByIdAndUpdate(id, updateData, { new: true });
    } else {
      updatedFlat = await FlatStore.findByIdAndUpdate(id, updateData);
    }

    if (!updatedFlat) {
      return res.status(404).json({ success: false, message: 'Flat not found' });
    }

    return res.json({
      success: true,
      message: `Flat ${updatedFlat.flatNumber} updated successfully`,
      flat: updatedFlat
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating flat', error: err.message });
  }
};

export const deleteFlat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isMongo = dbState.isConnectedToMongo;

    // Safety: Instead of destroying the ID, mark flat as Inactive or delete if explicitly requested
    if (isMongo) {
      const deleted = await (FlatModel as any).findByIdAndUpdate(id, { status: 'Inactive' }, { new: true });
      if (!deleted) return res.status(404).json({ success: false, message: 'Flat not found' });
    } else {
      const deleted = await FlatStore.findByIdAndUpdate(id, { status: 'Inactive' });
      if (!deleted) return res.status(404).json({ success: false, message: 'Flat not found' });
    }

    return res.json({ success: true, message: 'Flat marked as Inactive successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating flat status', error: err.message });
  }
};

/**
 * Bulk Import Flats from Excel / CSV
 * Handles validation, duplicate checks, batch upsert or replace, without deleting existing monthly payment records.
 */
export const bulkImportFlats = async (req: Request, res: Response) => {
  try {
    const { flats, mode } = req.body; // mode: 'replace_all' | 'upsert' (default: 'replace_all' or 'upsert')

    if (!Array.isArray(flats) || flats.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No flat data provided in the request.'
      });
    }

    const isMongo = dbState.isConnectedToMongo;
    const errors: string[] = [];
    const sanitizedFlats: any[] = [];
    const seenFlatNumbers = new Set<string>();

    for (let index = 0; index < flats.length; index++) {
      const rowNum = index + 1;
      const raw = flats[index];

      const flatNumber = raw.flatNumber !== undefined && raw.flatNumber !== null 
        ? String(raw.flatNumber).trim() 
        : '';
      const residentName = raw.residentName !== undefined && raw.residentName !== null 
        ? String(raw.residentName).trim() 
        : '';
      const amountRaw = raw.customMaintenanceAmount ?? raw.maintenanceAmount ?? raw.amount;

      if (!flatNumber) {
        errors.push(`Row ${rowNum}: Flat Number is missing.`);
        continue;
      }

      if (!residentName) {
        errors.push(`Row ${rowNum} (${flatNumber}): Resident Name is missing.`);
        continue;
      }

      const flatNumKey = flatNumber.toLowerCase();
      if (seenFlatNumbers.has(flatNumKey)) {
        errors.push(`Row ${rowNum}: Duplicate Flat Number "${flatNumber}" in import file.`);
        continue;
      }
      seenFlatNumbers.add(flatNumKey);

      let customMaint: number | null = null;
      if (amountRaw !== undefined && amountRaw !== null && String(amountRaw).trim() !== '') {
        const parsed = Number(String(amountRaw).replace(/[^0-9.-]+/g, ''));
        if (isNaN(parsed) || parsed < 0) {
          errors.push(`Row ${rowNum} (${flatNumber}): Maintenance Amount "${amountRaw}" is invalid.`);
          continue;
        }
        customMaint = parsed;
      }

      sanitizedFlats.push({
        flatNumber,
        residentName,
        customMaintenanceAmount: customMaint,
        status: raw.status === 'Inactive' ? 'Inactive' : 'Active',
        block: raw.block || '',
        floor: Number(raw.floor) || 1,
        residentType: raw.residentType === 'Tenant' ? 'Tenant' : 'Owner',
        phone: raw.phone || '',
        email: raw.email || '',
        occupancyStatus: raw.occupancyStatus === 'Vacant' ? 'Vacant' : 'Occupied',
        notes: raw.notes || ''
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Validation failed with ${errors.length} error(s). Please review and correct your file.`,
        errors
      });
    }

    // Fetch existing flats to preserve their stable _id / id whenever flatNumber matches
    const existingFlats = isMongo ? await FlatModel.find().lean() : await FlatStore.find();
    const existingMap = new Map<string, any>();
    existingFlats.forEach((f: any) => {
      existingMap.set((f.flatNumber || '').trim().toLowerCase(), f);
    });

    let insertedCount = 0;
    let updatedCount = 0;
if (mode === 'replace_all') {
  console.log('[Bulk Import] REPLACE_ALL mode');
  console.log('[Bulk Import] Existing flats:', existingFlats.length);
  console.log('[Bulk Import] Excel flats:', sanitizedFlats.length);

  const importedFlatNumbers = new Set(
    sanitizedFlats.map((f: any) =>
      f.flatNumber.trim().toLowerCase()
    )
  );

  // Update existing flats while preserving their IDs
  for (const flatData of sanitizedFlats) {
    const existing = existingMap.get(
      flatData.flatNumber.trim().toLowerCase()
    );

    if (existing) {
      const id = existing._id || existing.id;

      if (isMongo) {
        await FlatModel.findByIdAndUpdate(id, flatData);
      } else {
        await FlatStore.findByIdAndUpdate(id, flatData);
      }

      updatedCount++;
    } else {
      // Create genuinely new flats
      if (isMongo) {
        await FlatModel.create(flatData);
      } else {
        await FlatStore.create(flatData);
      }

      insertedCount++;
    }
  }

  // Remove flats that are not present in Excel
  for (const existing of existingFlats) {
    const flatNumber = (existing.flatNumber || '')
      .trim()
      .toLowerCase();

    if (!importedFlatNumbers.has(flatNumber)) {
      const id = existing._id || existing.id;

      if (id) {
        if (isMongo) {
          await FlatModel.findByIdAndDelete(id);
        } else {
          await FlatStore.findByIdAndDelete(id);
        }
      }
    }
  }

  console.log(
    `[Bulk Import] Updated ${updatedCount}, inserted ${insertedCount}`
  );

} else {
  // Upsert mode
  for (const flatData of sanitizedFlats) {
    const existing = existingMap.get(
      flatData.flatNumber.toLowerCase()
    );

    if (existing) {
      const id = existing._id || existing.id;

      if (isMongo) {
        await (FlatModel as any).findByIdAndUpdate(
          id,
          flatData
        );
      } else {
        await FlatStore.findByIdAndUpdate(
          id,
          flatData
        );
      }

      updatedCount++;
    } else {
      if (isMongo) {
        await FlatModel.create(flatData);
      } else {
        await FlatStore.create(flatData);
      }

      insertedCount++;
    }
  }
}
    // Update settings totalFlats count
    const totalCount = isMongo ? await (FlatModel as any).countDocuments() : await FlatStore.countDocuments();
    try {
      if (isMongo) {
        await (ApartmentSettingsModel as any).updateOne({}, { totalFlats: totalCount });
      } else {
        const s = await SettingsStore.findOne(() => true);
        if (s) {
          await SettingsStore.findByIdAndUpdate(s._id || s.id, { totalFlats: totalCount });
        }
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: `Successfully imported ${sanitizedFlats.length} flats (${insertedCount} new, ${updatedCount} updated).`,
      importedCount: sanitizedFlats.length,
      totalFlats: totalCount
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Error importing flats from file',
      error: err.message
    });
  }
};

