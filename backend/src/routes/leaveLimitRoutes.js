import express from 'express';
import {
  getEmployeeLeaveLimits,
  upsertEmployeeLeaveLimit,
  deleteEmployeeLeaveLimits
} from '../controllers/leaveLimitController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

// Fetch summary dashboard (any authenticated user can read if they have permissions)
router.get('/', protect, getEmployeeLeaveLimits);

// Update/upsert custom employee limit override (restricted by leave_allowances permission)
router.post('/', protect, checkPermission('leave_allowances'), upsertEmployeeLeaveLimit);

// Delete ALL custom overrides for an employee (reset to global defaults)
router.delete('/:staffId', protect, checkPermission('leave_allowances'), deleteEmployeeLeaveLimits);

export default router;
