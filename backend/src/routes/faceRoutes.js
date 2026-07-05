import express from 'express';
import { enrollFace, verifyAndCheckInFace } from '../controllers/faceController.js';

const router = express.Router();

router.post('/enroll', enrollFace);
router.post('/checkin', verifyAndCheckInFace);

export default router;
