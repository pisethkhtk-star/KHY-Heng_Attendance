import jwt from 'jsonwebtoken';
import prisma from '../utils/db.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const employee = await prisma.employee.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          staffId: true,
          nameEn: true,
          nameKh: true,
          email: true,
          role: true,
          departmentId: true,
          positionId: true,
          status: true
        }
      });

      if (!employee) {
        return res.status(401).json({ message: 'User not found in system' });
      }

      if (employee.status !== 'Active') {
        return res.status(403).json({ message: 'User account is not active' });
      }

      req.user = employee;
      next();
    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Role ${req.user.role} is not authorized for this resource.` });
    }
    next();
  };
};

export const checkPermission = (resource) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Admin has bypass access for all operations
    if (req.user.role === 'Admin') {
      return next();
    }

    try {
      const permission = await prisma.rolePermission.findUnique({
        where: {
          role_resource: {
            role: req.user.role,
            resource
          }
        }
      });

      if (!permission || !permission.canAccess) {
        return res.status(403).json({
          message: `Access denied. Your role (${req.user.role}) does not have permission to access ${resource}.`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error verifying permissions' });
    }
  };
};
