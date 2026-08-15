import { Router } from 'express';
import { loginAdmin, logoutAdmin, getSessionUser, updateAdminProfile } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);
router.get('/me', getSessionUser);
router.put('/profile', requireAuth, updateAdminProfile);

export default router;
