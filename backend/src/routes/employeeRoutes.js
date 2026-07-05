import express from 'express';
import { getAll, getById, create, update, remove } from '../controllers/employeeController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('employees'), getAll);
router.get('/:id', protect, getById);
router.post('/', protect, checkPermission('employees'), create);
router.put('/:id', protect, checkPermission('employees'), update);
router.delete('/:id', protect, checkPermission('employees'), remove);

export default router;
