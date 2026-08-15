import { Router } from 'express';
import { exportMonthExcel } from '../controllers/exportController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/month/:month', requireAuth, exportMonthExcel);

export default router;
