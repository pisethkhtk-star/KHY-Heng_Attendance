import express from 'express';
import { getAll, getByEmployee, create, updateStatus, deleteOvertime } from '../controllers/overtimeController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, (req, res, next) => {
  // Employees automatically view their own overtime in controller
  next();
}, getAll);

router.get('/employee/:staffId', protect, (req, res, next) => {
  if (req.user.role === 'Employee' && req.user.staffId !== req.params.staffId) {
    return res.status(403).json({ message: 'Access denied to other employee overtime' });
  }
  next();
}, getByEmployee);

router.post('/', protect, (req, res, next) => {
  if (req.user.role === 'Employee') {
    req.body.staffId = req.user.staffId;
  }
  next();
}, create);

router.put('/:id/status', protect, checkPermission('overtime'), updateStatus);
router.delete('/:id', protect, deleteOvertime);

export default router;
