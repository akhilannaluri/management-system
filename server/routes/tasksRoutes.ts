import { Router } from 'express';
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask } from '../controllers/tasksController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, getAllTasks);
router.get('/:id', requireAuth, getTaskById);
router.post('/', requireAuth, createTask);
router.put('/:id', requireAuth, updateTask);
router.delete('/:id', requireAuth, deleteTask);

export default router;
