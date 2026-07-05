import express from 'express';
import { getAll, getById, create, update, remove } from '../controllers/posController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('positions'), getAll);
router.get('/:id', protect, checkPermission('positions'), getById);
router.post('/', protect, checkPermission('positions'), create);
router.put('/:id', protect, checkPermission('positions'), update);
router.delete('/:id', protect, checkPermission('positions'), remove);

export default router;
