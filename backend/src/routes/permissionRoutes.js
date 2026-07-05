import express from 'express';
import { getPermissions, updatePermissions } from '../controllers/permissionController.js';
import { protect, checkRole } from '../middlewares/auth.js';

const router = express.Router();

// Only Admin can view/edit role permissions settings
router.get('/', protect, checkRole(['Admin']), getPermissions);
router.put('/', protect, checkRole(['Admin']), updatePermissions);

export default router;
