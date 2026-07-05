import express from 'express';
import { getAttendanceLogs } from '../controllers/logController.js';

const router = express.Router();

router.get('/', getAttendanceLogs);

export default router;
