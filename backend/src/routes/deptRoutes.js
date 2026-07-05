import express from 'express';
import { getAll, getById, create, update, remove } from '../controllers/deptController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('departments'), getAll);
router.get('/:id', protect, checkPermission('departments'), getById);
router.post('/', protect, checkPermission('departments'), create);
router.put('/:id', protect, checkPermission('departments'), update);
router.delete('/:id', protect, checkPermission('departments'), remove);

export default router;
