import { Router } from 'express';
import { getMonthMaintenance, updatePaymentStatus, batchUpdateStatus, batchSavePayments } from '../controllers/maintenanceController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/month/:month', requireAuth, getMonthMaintenance);
router.put('/record/:id', requireAuth, updatePaymentStatus);
router.post('/batch-update', requireAuth, batchUpdateStatus);
router.post('/batch-save', requireAuth, batchSavePayments);

export default router;
