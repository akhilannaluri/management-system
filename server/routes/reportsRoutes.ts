import { Router } from 'express';
import { getMonthlyReport, getAnnualOverview } from '../controllers/reportsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/month/:month', requireAuth, getMonthlyReport);
router.get('/annual/:year', requireAuth, getAnnualOverview);

export default router;
