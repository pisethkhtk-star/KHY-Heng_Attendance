import express from 'express';
import { login, getMe, loginWithQRCode } from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/login-qr', loginWithQRCode);
router.get('/me', protect, getMe);

export default router;
