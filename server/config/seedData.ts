import bcrypt from 'bcryptjs';
import { dbState } from './db';
import { AdminModel, AdminStore } from '../models/Admin';
import { FlatModel, FlatStore } from '../models/Flat';
import { ExpenseTemplateModel, ExpenseTemplateStore } from '../models/ExpenseTemplate';
import { MonthlyExpenseModel, MonthlyExpenseStore } from '../models/MonthlyExpense';
import { MaintenanceRecordModel, MaintenanceRecordStore } from '../models/MaintenanceRecord';
import { TaskModel, TaskStore } from '../models/Task';
import { ApartmentSettingsModel, SettingsStore } from '../models/ApartmentSettings';

const RESIDENT_NAMES = [
  'Ravi Sharma', 'Suresh Kumar', 'Anand Kulkarni', 'Priya Venkatesh', 'Deepak Mehta',
  'Sunita Rao', 'Rajesh Gupta', 'Kavita Reddy', 'Manoj Joshi', 'Vikram Singh',
  'Pooja Nair', 'Arun Patel', 'Shweta Deshmukh', 'Amitabh Roy', 'Neha Agarwal',
  'Karthik Subramanian', 'Meera Iyer', 'Naveen Choudhary', 'Swati Bhatia', 'Rohan Verma',
  'Divya Menon', 'Harish Chandra', 'Ananya Sengupta', 'Siddharth Saxena', 'Ritu Kapoor',
  'Ajay Nambiar', 'Geeta Sundaram', 'Pankaj Mishra', 'Sneha Hegde', 'Tarun Jain',
  'Vandana Pillai', 'Gaurav Das', 'Smita Prabhakar', 'Nitin Kaushik', 'Rashmi Kulkarni',
  'Santosh Patil', 'Bhavna Trivedi', 'Kishore Murthy', 'Archana Bannerjee', 'Prashant Bhat',
  'Aparna Namboodiri', 'Vivek Singhal', 'Preeti Mahajan', 'Maheshwar Rao', 'Pallavi Sen',
  'Alok Bhargava', 'Sunil Narang', 'Radhika Shenoy', 'Hemant Goswami', 'Shalini Varma',
  'Vinay Venkatesan', 'Rupa Chakraborty', 'Mohan Lal', 'Shilpa Shetty', 'Gopal Krishnan',
  'Shashi Tharoor', 'Vikas Oberoi'
];

export async function seedInitialData(): Promise<void> {
  try {
    const isMongo = dbState.isConnectedToMongo;
    
  // 1. Seed Admin
const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
const defaultPassword = process.env.ADMIN_PASSWORD;

if (!defaultPassword) {
  console.warn('[Seed] ADMIN_PASSWORD is not configured. Admin seeding skipped.');
} else if (isMongo) {
  const existingAdmin = await (AdminModel as any).findOne({
    username: defaultUsername
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await (AdminModel as any).create({
      username: defaultUsername,
      password: hashedPassword,
      name: 'Apartment Administrator',
      email: 'admin@greenviewheights.com',
      phone: '+91 98765 43210',
      role: 'admin'
    });

    console.log(`[Seed] Created admin account: ${defaultUsername}`);
  } else {
     const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  await (AdminModel as any).updateOne(
    { _id: existingAdmin._id },
    { $set: { password: hashedPassword } }
  );

  console.log(`[Seed] Admin password updated from environment variable`);
  }

} else {
  const existingAdmin = await AdminStore.findOne({
    username: defaultUsername
  });

 if (isMongo) {
  const existingAdmin = await (AdminModel as any).findOne({
    username: defaultUsername
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await (AdminModel as any).create({
      username: defaultUsername,
      password: hashedPassword,
      name: 'Apartment Administrator',
      email: 'admin@greenviewheights.com',
      phone: '+91 98765 43210',
      role: 'admin'
    });

    console.log(`[Seed] Created admin account: ${defaultUsername}`);
  } else {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await (AdminModel as any).updateOne(
      { _id: existingAdmin._id },
      { $set: { password: hashedPassword } }
    );

    console.log(`[Seed] Admin password synchronized from environment`);
  }
}
}

    // 2. Seed Apartment Settings
    const defaultSettings = {
      apartmentName: 'Greenview Heights Apartments',
      societyRegistrationNo: 'REG/HYD/2021/57',
      address: 'Plot 42-45, Phase 2, Silicon Valley Colony, Madhapur, Hyderabad, Telangana - 500081',
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

    if (isMongo) {
      const count = await ApartmentSettingsModel.countDocuments();
      if (count === 0) {
        await ApartmentSettingsModel.create(defaultSettings);
      }
    } else {
      const count = await SettingsStore.countDocuments();
      if (count === 0) {
        await SettingsStore.create(defaultSettings);
      }
    }

    // 3. Seed 57 Flats (Generic Demo Placeholders for 57 flats)
    const flatsCount = isMongo ? await FlatModel.countDocuments() : await FlatStore.countDocuments();
    let seededFlats: any[] = [];
    
    if (flatsCount === 0) {
      const flatsToCreate: any[] = [];
      let totalCreated = 0;
      
      // Seed 57 generic demo flats (12 per floor on floors 1-4, 9 on floor 5)
      for (let floor = 1; floor <= 5 && totalCreated < 57; floor++) {
        const unitsOnFloor = floor <= 4 ? 12 : 9;
        for (let unit = 1; unit <= unitsOnFloor && totalCreated < 57; unit++) {
          const unitNumberStr = unit < 10 ? `0${unit}` : `${unit}`;
          const flatNumber = `Flat ${floor}${unitNumberStr}`;
          const isTenant = totalCreated % 4 === 0;
          
          flatsToCreate.push({
            flatNumber,
            block: '', // Generic, customizable
            floor,
            residentName: `Demo Resident ${floor}${unitNumberStr}`,
            residentType: isTenant ? 'Tenant' : 'Owner',
            phone: '',
            email: '',
            occupancyStatus: 'Occupied',
            customMaintenanceAmount: null,
            notes: 'Demo placeholder flat'
          });
          totalCreated++;
        }
      }

      if (isMongo) {
        seededFlats = await FlatModel.insertMany(flatsToCreate);
      } else {
        seededFlats = await FlatStore.insertMany(flatsToCreate);
      }
      console.log(`[Seed] Seeded ${seededFlats.length} generic demo flats`);
    } else {
      seededFlats = isMongo ? await FlatModel.find().lean() : await FlatStore.find();
    }

    // 4. Seed Expense Templates
    const templateCount = isMongo ? await ExpenseTemplateModel.countDocuments() : await ExpenseTemplateStore.countDocuments();
    if (templateCount === 0) {
      const defaultTemplates = [
        {
          name: 'Watchman Salary',
          defaultAmount: 15000,
          category: 'Salary',
          description: 'Monthly salary for day & night security watchmen',
          isActive: true,
          orderIndex: 1
        },
        {
          name: 'Sweeper Salary',
          defaultAmount: 8000,
          category: 'Salary',
          description: 'Daily cleaning of corridors, parking and common areas',
          isActive: true,
          orderIndex: 2
        },
        {
          name: 'Lift Maintenance',
          defaultAmount: 5000,
          category: 'Maintenance',
          description: 'Monthly Johnson Lifts AMC routine servicing & inspection',
          isActive: true,
          orderIndex: 3
        },
        {
          name: 'Generator Maintenance',
          defaultAmount: 3000,
          category: 'Maintenance',
          description: 'Diesel generator routine check, filter inspection & fuel top-up',
          isActive: true,
          orderIndex: 4
        },
        {
          name: 'Common Area Electricity',
          defaultAmount: 4500,
          category: 'Utilities',
          description: 'TSSPDCL monthly meter bill for compound, lifts & pump lighting',
          isActive: true,
          orderIndex: 5
        },
        {
          name: 'Water Tank Cleaning & Motor Care',
          defaultAmount: 2500,
          category: 'Maintenance',
          description: 'Periodic overhead & sump water tank purification & motor grease check',
          isActive: true,
          orderIndex: 6
        },
        {
          name: 'Garbage Collection Charges',
          defaultAmount: 1800,
          category: 'Cleaning',
          description: 'Municipal GHMC door-to-door waste collection fee',
          isActive: true,
          orderIndex: 7
        }
      ];

      if (isMongo) {
        await (ExpenseTemplateModel as any).insertMany(defaultTemplates);
      } else {
        await ExpenseTemplateStore.insertMany(defaultTemplates);
      }
      console.log(`[Seed] Seeded ${defaultTemplates.length} default recurring expense templates`);
    }

    // 5. Seed Maintenance Records for current & previous month if none exist
    const recordsCount = isMongo ? await MaintenanceRecordModel.countDocuments() : await MaintenanceRecordStore.countDocuments();
    if (recordsCount === 0 && seededFlats.length > 0) {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const maintenanceRecords: any[] = [];
      
      // Current Month records: ~38 flats paid, 19 pending
      seededFlats.forEach((flat: any, idx: number) => {
        const isPaid = idx < 38;
        const flatId = flat._id || flat.id;
        const paidDay = 1 + (idx % 12);
        maintenanceRecords.push({
          month: currentMonth,
          flatId,
          flatNumber: flat.flatNumber,
          residentName: flat.residentName,
          amount: 1500,
          status: isPaid ? 'Paid' : 'Pending',
          paidDate: isPaid ? new Date(now.getFullYear(), now.getMonth(), paidDay) : null,
          paymentMode: isPaid ? (idx % 3 === 0 ? 'UPI' : idx % 3 === 1 ? 'Bank Transfer' : 'Cash') : '',
          receiptNumber: isPaid ? `REC-${currentMonth}-${flat.flatNumber.replace('-', '')}` : '',
          remarks: isPaid ? 'Received on time' : 'Pending payment reminder'
        });
      });

      // Previous Month records: 54 flats paid, 3 pending
      seededFlats.forEach((flat: any, idx: number) => {
        const isPaid = idx < 54;
        const flatId = flat._id || flat.id;
        maintenanceRecords.push({
          month: prevMonth,
          flatId,
          flatNumber: flat.flatNumber,
          residentName: flat.residentName,
          amount: 1500,
          status: isPaid ? 'Paid' : 'Pending',
          paidDate: isPaid ? new Date(prevDate.getFullYear(), prevDate.getMonth(), 5 + (idx % 10)) : null,
          paymentMode: isPaid ? (idx % 2 === 0 ? 'UPI' : 'Bank Transfer') : '',
          receiptNumber: isPaid ? `REC-${prevMonth}-${flat.flatNumber.replace('-', '')}` : '',
          remarks: isPaid ? 'Cleared' : 'Follow up required'
        });
      });

      if (isMongo) {
        await MaintenanceRecordModel.insertMany(maintenanceRecords);
      } else {
        await MaintenanceRecordStore.insertMany(maintenanceRecords);
      }
      console.log(`[Seed] Seeded maintenance records for ${currentMonth} and ${prevMonth}`);

      // Also seed monthly expenses for current month
      const templates = isMongo ? await ExpenseTemplateModel.find().lean() : await ExpenseTemplateStore.find();
      const currentExpenses: any[] = templates.map((t: any) => ({
        month: currentMonth,
        expenseType: 'Recurring',
        templateId: t._id || t.id,
        name: t.name,
        amount: t.defaultAmount,
        category: t.category,
        paymentDate: new Date(now.getFullYear(), now.getMonth(), 5),
        paidTo: t.name.includes('Salary') ? 'Staff Accounts' : 'Service Agency',
        paymentMode: 'Bank Transfer',
        invoiceOrReceiptNo: `EXP-${currentMonth}-${Math.floor(100 + Math.random() * 900)}`,
        notes: t.description,
        isPaid: true
      }));

      // Add a one-time expense for this month
      currentExpenses.push({
        month: currentMonth,
        expenseType: 'One-Time',
        templateId: null,
        name: 'Compound Wall Spotlight Replacement',
        amount: 2200,
        category: 'Repairs',
        paymentDate: new Date(now.getFullYear(), now.getMonth(), 8),
        paidTo: 'Balaji Electricals',
        paymentMode: 'UPI',
        invoiceOrReceiptNo: `INV-ELEC-${Math.floor(1000 + Math.random() * 9000)}`,
        notes: 'Replaced 2 damaged weatherproof floodlights in parking lot',
        isPaid: true
      });

      if (isMongo) {
        await MonthlyExpenseModel.insertMany(currentExpenses);
      } else {
        await MonthlyExpenseStore.insertMany(currentExpenses);
      }
    }

    // 6. Seed Tasks
    const taskCount = isMongo ? await TaskModel.countDocuments() : await TaskStore.countDocuments();
    if (taskCount === 0) {
      const now = new Date();
      const defaultTasks = [
        {
          title: 'Lift AMC servicing & safety certification',
          estimatedAmount: 5000,
          actualAmount: 5000,
          description: 'Quarterly safety brake & cable inspection by Otis technician team',
          dueDate: new Date(now.getFullYear(), now.getMonth(), 20),
          status: 'In Progress',
          priority: 'High',
          assignedTo: 'Otis Elevators Pvt Ltd',
          contactNumber: '+91 99887 76655',
          notes: 'Technician scheduled for visit this Saturday 10:00 AM'
        },
        {
          title: 'Generator diesel top-up & battery check',
          estimatedAmount: 4500,
          actualAmount: 4200,
          description: 'Refill 40 Liters diesel and test automatic phase changeover switch',
          dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
          status: 'Completed',
          priority: 'Medium',
          assignedTo: 'Kirloskar Power Systems',
          contactNumber: '+91 98451 23456',
          completionDate: new Date(now.getFullYear(), now.getMonth(), 12),
          notes: 'Completed successfully. Generator tested under 80% load'
        },
        {
          title: 'Underground water pump sensory relay replacement',
          estimatedAmount: 3200,
          actualAmount: 0,
          description: 'Float switch sensor is occasionally tripping; replace with new Schneider relay',
          dueDate: new Date(now.getFullYear(), now.getMonth(), 25),
          status: 'Pending',
          priority: 'High',
          assignedTo: 'Sri Balaji Plumbing & Pumps',
          contactNumber: '+91 97001 12233',
          notes: 'Quotation approved by management committee'
        },
        {
          title: 'Common area stairwell & lobby touch-up painting',
          estimatedAmount: 18000,
          actualAmount: 0,
          description: 'Wall scuff removal and Asian Paints premium emulsion coating on 1st-5th floors',
          dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 10),
          status: 'Pending',
          priority: 'Low',
          assignedTo: 'Classic Painters',
          contactNumber: '+91 98112 33445',
          notes: 'Slated for next month pre-festival clean up'
        }
      ];

      if (isMongo) {
        await (TaskModel as any).insertMany(defaultTasks);
      } else {
        await TaskStore.insertMany(defaultTasks);
      }
      console.log(`[Seed] Seeded ${defaultTasks.length} tasks`);
    }

  } catch (err: any) {
    console.error('[Seed] Error during seeding:', err);
  }
}
