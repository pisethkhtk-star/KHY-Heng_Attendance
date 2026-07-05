import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateQRCode, scanQRCode, scanBranchQRCode } from '../controllers/qrController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Define scan rate limit to prevent spamming/replay attacks
const scanLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds window
  max: 20, // limit each IP to 20 requests per windowMs
  message: { message: 'Too many scans from this device. Please wait a few seconds.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/generate/:staffId', generateQRCode);
router.post('/scan', scanLimiter, scanQRCode);
router.post('/scan-branch', protect, scanLimiter, scanBranchQRCode);

export default router;
