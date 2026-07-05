import express from 'express';
import { logCheckInOut, getTodayAttendance, getHistory, getStatsSummary, updateAttendance, createAttendance, deleteAttendance } from '../controllers/attendanceController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.post('/log', protect, logCheckInOut);
router.get('/today', protect, checkPermission('attendance'), getTodayAttendance);
router.get('/stats', protect, checkPermission('attendance'), getStatsSummary);
router.post('/', protect, checkPermission('add_attendance'), createAttendance);
router.put('/:id', protect, checkPermission('edit_attendance'), updateAttendance);
router.delete('/:id', protect, checkPermission('delete_attendance'), deleteAttendance);

router.get('/history', protect, (req, res, next) => {
  // Security: Normal employees can only fetch their own attendance records
  if (req.user.role === 'Employee') {
    req.query.staffId = req.user.staffId;
  }
  next();
}, getHistory);

export default router;
