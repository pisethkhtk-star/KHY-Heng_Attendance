import express from 'express';
import { getAll, getByEmployee, create, updateStatus } from '../controllers/leaveController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, (req, res, next) => {
  // Security: Normal employees can only fetch their own leaves
  if (req.user.role === 'Employee') {
    req.query.search = req.user.staffId;
  }
  next();
}, getAll);

router.get('/employee/:staffId', protect, (req, res, next) => {
  if (req.user.role === 'Employee' && req.user.staffId !== req.params.staffId) {
    return res.status(403).json({ message: 'Access denied to other employee leaves' });
  }
  next();
}, getByEmployee);

router.post('/', protect, (req, res, next) => {
  // Security: Force employee staffId to their authenticated identity
  if (req.user.role === 'Employee') {
    req.body.staffId = req.user.staffId;
  }
  next();
}, create);

router.put('/:id/status', protect, checkPermission('leaves'), updateStatus);

export default router;
