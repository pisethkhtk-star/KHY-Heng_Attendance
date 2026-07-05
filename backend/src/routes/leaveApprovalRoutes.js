import express from 'express';
import { getAllRules, createRule, deleteRule, updateRule } from '../controllers/leaveApprovalController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, checkPermission('leave_approvals'), getAllRules);
router.post('/', protect, checkPermission('leave_approvals'), createRule);
router.put('/:id', protect, checkPermission('edit_leave_approvals'), updateRule);
router.delete('/:id', protect, checkPermission('delete_leave_approvals'), deleteRule);

export default router;

