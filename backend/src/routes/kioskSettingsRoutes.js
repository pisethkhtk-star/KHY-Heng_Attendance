import express from 'express';
import {
  getKioskSettings,
  createKioskSetting,
  updateKioskSetting,
  deleteKioskSetting
} from '../controllers/kioskSettingsController.js';
import { getBranchQRCode } from '../controllers/qrController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

// Fetch settings list (any authenticated user can read, e.g. Kiosk page)
router.get('/', protect, getKioskSettings);

// Fetch branch QR code (requires authentication)
router.get('/:id/qrcode', protect, getBranchQRCode);

// Manage settings (Permission-guarded)
router.post('/', protect, checkPermission('kiosk_settings'), createKioskSetting);
router.put('/:id', protect, checkPermission('kiosk_settings'), updateKioskSetting);
router.delete('/:id', protect, checkPermission('kiosk_settings'), deleteKioskSetting);

export default router;
