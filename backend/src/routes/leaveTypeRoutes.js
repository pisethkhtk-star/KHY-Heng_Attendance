import express from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
} from '../controllers/leaveTypeController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

// Get all leave types (any authenticated user can fetch)
router.get('/', protect, getLeaveTypes);

// Manage leave types (restricted by leave_types permission)
router.post('/', protect, checkPermission('leave_types'), createLeaveType);
router.put('/:id', protect, checkPermission('leave_types'), updateLeaveType);
router.delete('/:id', protect, checkPermission('leave_types'), deleteLeaveType);

export default router;
