import { Router } from 'express';
import { getAllFlats, getFlatById, createFlat, updateFlat, deleteFlat, bulkImportFlats } from '../controllers/flatsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getAllFlats);
router.get('/:id', requireAuth, getFlatById);
router.post('/', requireAuth, createFlat);
router.post('/bulk-import', requireAuth, bulkImportFlats);
router.put('/:id', requireAuth, updateFlat);
router.delete('/:id', requireAuth, deleteFlat);

export default router;
