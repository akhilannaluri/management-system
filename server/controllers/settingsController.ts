import { Request, Response } from 'express';
import { dbState } from '../config/db';

import {
  ApartmentSettingsModel,
  SettingsStore
} from '../models/ApartmentSettings';

import {
  FlatModel,
  FlatStore
} from '../models/Flat';

/**
 * Get active flats count.
 *
 * IMPORTANT:
 * The Flats collection is the source of truth
 * for the actual number of flats.
 *
 * Example:
 * 57 active flats
 * => actualFlatCount = 57
 */
async function getActiveFlatCount(): Promise<number> {
  const isMongo = dbState.isConnectedToMongo;

  if (isMongo) {
    return await (FlatModel as any).countDocuments({
      status: { $ne: 'Inactive' }
    });
  }

  const flats = await FlatStore.find(
    (flat: any) =>
      (flat.status || 'Active') !== 'Inactive'
  );

  return flats.length;
}

/**
 * DEFAULT SETTINGS
 */
function getDefaultSettings(
  actualFlatCount: number
) {
  return {
    apartmentName:
      'Greenview Heights Apartments',

    societyRegistrationNo:
      'REG/HYD/2021/57',

    address:
      'Plot 42-45, Phase 2, Madhapur, Hyderabad, 500081',

    /**
     * Always use the actual active flat count.
     */
    totalFlats:
      actualFlatCount,

    defaultMonthlyMaintenance:
      1500,

    contactPerson:
      'Ramesh Varma (Secretary)',

    contactPhone:
      '+91 98765 43210',

    contactEmail:
      'admin@greenviewheights.com',

    upiId:
      'greenview.society@upi',

    bankName:
      'HDFC Bank',

    accountNumber:
      '50200012345678',

    ifscCode:
      'HDFC0001234',

    currencySymbol:
      '₹'
  };
};

/**
 * GET SETTINGS
 */
export const getSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const isMongo =
      dbState.isConnectedToMongo;

    /**
     * Get actual active flats.
     */
    const actualFlatCount =
      await getActiveFlatCount();

    let settings: any = isMongo
      ? await ApartmentSettingsModel
          .findOne()
          .lean()
      : await SettingsStore.findOne(
          () => true
        );

    /**
     * If settings don't exist,
     * return default settings.
     */
    if (!settings) {
      settings =
        getDefaultSettings(
          actualFlatCount
        );
    } else {
      /**
       * IMPORTANT:
       *
       * Do NOT trust old settings.totalFlats
       * for the actual flat count.
       *
       * Always synchronize it with active flats.
       */
      settings = {
        ...settings,
        totalFlats:
          actualFlatCount
      };
    }

    return res.json({
      success: true,

      settings,

      /**
       * Useful for debugging.
       */
      actualFlatCount,

      dbType:
        dbState.dbType
    });
  } catch (err: any) {
    console.error(
      'Error fetching settings:',
      err
    );

    return res.status(500).json({
      success: false,

      message:
        'Error fetching settings',

      error:
        err.message
    });
  }
};

/**
 * UPDATE SETTINGS
 */
export const updateSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const isMongo =
      dbState.isConnectedToMongo;

    const {
      apartmentName,
      societyRegistrationNo,
      address,

      /**
       * totalFlats is intentionally NOT trusted.
       *
       * It is calculated from the Flats collection.
       */
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

    /**
     * Get actual number of active flats.
     */
    const actualFlatCount =
      await getActiveFlatCount();

    /**
     * Validate maintenance amount.
     */
    const maintenanceAmount =
      Number(
        defaultMonthlyMaintenance
      );

    if (
      Number.isNaN(
        maintenanceAmount
      ) ||
      maintenanceAmount < 0
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid default monthly maintenance amount'
      });
    }

    /**
     * Build settings payload.
     */
    const payload: any = {
      apartmentName:
        typeof apartmentName ===
        'string'
          ? apartmentName.trim()
          : '',

      societyRegistrationNo:
        typeof societyRegistrationNo ===
        'string'
          ? societyRegistrationNo.trim()
          : '',

      address:
        typeof address ===
        'string'
          ? address.trim()
          : '',

      /**
       * ALWAYS use active flats.
       */
      totalFlats:
        actualFlatCount,

      defaultMonthlyMaintenance:
        maintenanceAmount,

      contactPerson:
        typeof contactPerson ===
        'string'
          ? contactPerson.trim()
          : '',

      contactPhone:
        typeof contactPhone ===
        'string'
          ? contactPhone.trim()
          : '',

      contactEmail:
        typeof contactEmail ===
        'string'
          ? contactEmail.trim()
          : '',

      upiId:
        typeof upiId ===
        'string'
          ? upiId.trim()
          : '',

      bankName:
        typeof bankName ===
        'string'
          ? bankName.trim()
          : '',

      accountNumber:
        typeof accountNumber ===
        'string'
          ? accountNumber.trim()
          : '',

      ifscCode:
        typeof ifscCode ===
        'string'
          ? ifscCode.trim()
          : '',

      currencySymbol:
        typeof currencySymbol ===
        'string' &&
        currencySymbol.trim()
          ? currencySymbol.trim()
          : '₹'
    };

    let updated: any = null;

    /**
     * =====================================================
     * MONGODB
     * =====================================================
     */
    if (isMongo) {
      updated =
        await (
          ApartmentSettingsModel as any
        ).findOneAndUpdate(
          {},
          payload,
          {
            new: true,
            upsert: true
          }
        );
    }

    /**
     * =====================================================
     * LOCAL / FILE STORE
     * =====================================================
     */
    else {
      const existing =
        await SettingsStore.findOne(
          () => true
        );

      if (existing) {
        updated =
          await SettingsStore
            .findByIdAndUpdate(
              existing._id ||
                existing.id,
              payload
            );
      } else {
        updated =
          await SettingsStore.create(
            payload
          );
      }
    }

    /**
     * Return actual flat count as well.
     */
    return res.json({
      success: true,

      message:
        'Apartment settings updated successfully',

      settings: {
        ...(updated || payload),

        /**
         * Guarantee correct count in response.
         */
        totalFlats:
          actualFlatCount
      },

      actualFlatCount
    });
  } catch (err: any) {
    console.error(
      'Error updating settings:',
      err
    );

    return res.status(500).json({
      success: false,

      message:
        'Error updating settings',

      error:
        err.message
    });
  }
};