import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/authRoutes.js';
import deptRoutes from './src/routes/deptRoutes.js';
import posRoutes from './src/routes/posRoutes.js';
import employeeRoutes from './src/routes/employeeRoutes.js';
import attendanceRoutes from './src/routes/attendanceRoutes.js';
import leaveRoutes from './src/routes/leaveRoutes.js';
import faceRoutes from './src/routes/faceRoutes.js';
import qrRoutes from './src/routes/qrRoutes.js';
import logRoutes from './src/routes/logRoutes.js';
import permissionRoutes from './src/routes/permissionRoutes.js';
import kioskSettingsRoutes from './src/routes/kioskSettingsRoutes.js';
import leaveTypeRoutes from './src/routes/leaveTypeRoutes.js';
import leaveLimitRoutes from './src/routes/leaveLimitRoutes.js';
import workHourRoutes from './src/routes/workHourRoutes.js';
import leaveApprovalRoutes from './src/routes/leaveApprovalRoutes.js';
import { initializePermissions } from './src/utils/permissionInitializer.js';



const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors({
  origin: '*', // Allow all origins for simpler development/testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/positions', posRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/qrcode', qrRoutes);
app.use('/api/attendance-logs', logRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/kiosk-settings', kioskSettingsRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/employee-leave-limits', leaveLimitRoutes);
app.use('/api/company-work-hours', workHourRoutes);
app.use('/api/leave-approvals', leaveApprovalRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initializePermissions();
});
