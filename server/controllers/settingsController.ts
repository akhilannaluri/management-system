import { Request, Response } from 'express';
import { dbState } from '../config/db';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const isMongo = dbState.isConnectedToMongo;
    let settings = isMongo 
      ? await ApartmentSettingsModel.findOne().lean()
      : await SettingsStore.findOne(() => true);

    if (!settings) {
      settings = {
        apartmentName: 'Greenview Heights Apartments',
        societyRegistrationNo: 'REG/HYD/2021/57',
        address: 'Plot 42-45, Phase 2, Madhapur, Hyderabad, 500081',
        totalFlats: 57,
        defaultMonthlyMaintenance: 1500,
        contactPerson: 'Ramesh Varma (Secretary)',
        contactPhone: '+91 98765 43210',
        contactEmail: 'admin@greenviewheights.com',
        upiId: 'greenview.society@upi',
        bankName: 'HDFC Bank',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0001234',
        currencySymbol: '₹'
      };
    }

    return res.json({ success: true, settings, dbType: dbState.dbType });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error fetching settings', error: err.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const isMongo = dbState.isConnectedToMongo;
    const {
      apartmentName,
      societyRegistrationNo,
      address,
      totalFlats,
      defaultMonthlyMaintenance,
      contactPerson,
      contactPhone,
      contactEmail,
      upiId,
      bankName,
      accountNumber,
      ifscCode,
      currencySymbol
    } = req.body;

    const payload: any = {
      apartmentName: apartmentName?.trim(),
      societyRegistrationNo: societyRegistrationNo?.trim(),
      address: address?.trim(),
      totalFlats: Number(totalFlats) || 57,
      defaultMonthlyMaintenance: Number(defaultMonthlyMaintenance) || 1500,
      contactPerson: contactPerson?.trim(),
      contactPhone: contactPhone?.trim(),
      contactEmail: contactEmail?.trim(),
      upiId: upiId?.trim(),
      bankName: bankName?.trim(),
      accountNumber: accountNumber?.trim(),
      ifscCode: ifscCode?.trim(),
      currencySymbol: currencySymbol || '₹'
    };

    let updated: any = null;
    if (isMongo) {
      updated = await (ApartmentSettingsModel as any).findOneAndUpdate({}, payload, { new: true, upsert: true });
    } else {
      const existing = await SettingsStore.findOne(() => true);
      if (existing) {
        updated = await SettingsStore.findByIdAndUpdate(existing._id || existing.id, payload);
      } else {
        updated = await SettingsStore.create(payload);
      }
    }

    return res.json({
      success: true,
      message: 'Apartment settings updated successfully',
      settings: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Error updating settings', error: err.message });
  }
};
