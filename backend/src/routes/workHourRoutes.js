import express from 'express';
import { getWorkHour, updateWorkHour } from '../controllers/workHourController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, getWorkHour);
router.post('/', protect, checkPermission('work_hours'), updateWorkHour);

export default router;
