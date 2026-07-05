import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/db.js';
import { verifySecureToken } from './qrController.js';

// Login employee
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: {
        department: {
          select: { nameEn: true, nameKh: true }
        },
        position: {
          select: { titleEn: true, titleKh: true }
        }
      }
    });

    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (employee.status !== 'Active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact HR.' });
    }

    const isMatch = bcrypt.compareSync(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: employee.id, staffId: employee.staffId, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Don't send back password hash
    const { password: _, ...employeeData } = employee;

    // Fetch allowed resources for user role
    const permissions = await prisma.rolePermission.findMany({
      where: { role: employee.role, canAccess: true },
      select: { resource: true }
    });
    employeeData.permissions = permissions.map(p => p.resource);

    res.json({
      token,
      user: employeeData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get current profile
export const getMe = async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.id },
      include: {
        department: {
          select: { nameEn: true, nameKh: true }
        },
        position: {
          select: { titleEn: true, titleKh: true }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { password: _, ...employeeData } = employee;

    // Fetch allowed resources for user role
    const permissions = await prisma.rolePermission.findMany({
      where: { role: employee.role, canAccess: true },
      select: { resource: true }
    });
    employeeData.permissions = permissions.map(p => p.resource);

    res.json(employeeData);
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ message: 'Server error retrieving profile' });
  }
};

// Login employee via QR code
export const loginWithQRCode = async (req, res) => {
  const { qrToken } = req.body;

  if (!qrToken) {
    return res.status(400).json({ message: 'QR token is required' });
  }

  try {
    const staffId = verifySecureToken(qrToken);
    if (!staffId) {
      return res.status(400).json({ message: 'Invalid or expired QR code badge' });
    }

    const employee = await prisma.employee.findUnique({
      where: { staffId },
      include: {
        department: {
          select: { nameEn: true, nameKh: true }
        },
        position: {
          select: { titleEn: true, titleKh: true }
        }
      }
    });

    if (!employee) {
      return res.status(401).json({ message: 'Employee not found' });
    }

    if (employee.status !== 'Active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact HR.' });
    }

    const token = jwt.sign(
      { id: employee.id, staffId: employee.staffId, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...employeeData } = employee;

    const permissions = await prisma.rolePermission.findMany({
      where: { role: employee.role, canAccess: true },
      select: { resource: true }
    });
    employeeData.permissions = permissions.map(p => p.resource);

    res.json({
      token,
      user: employeeData
    });
  } catch (error) {
    console.error('QR Login error:', error);
    res.status(500).json({ message: 'Server error during QR login' });
  }
};
