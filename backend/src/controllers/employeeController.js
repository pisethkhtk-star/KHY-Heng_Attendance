import bcrypt from 'bcryptjs';
import prisma from '../utils/db.js';

// Get all employees (with filters)
export const getAll = async (req, res) => {
  const { search, departmentId, branch, status } = req.query;

  try {
    const where = {};

    if (search) {
      where.OR = [
        { nameEn: { contains: search, mode: 'insensitive' } },
        { nameKh: { contains: search, mode: 'insensitive' } },
        { staffId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (branch) {
      where.branch = branch;
    }

    if (status) {
      where.status = status;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: { select: { nameEn: true, nameKh: true } },
        position: { select: { titleEn: true, titleKh: true } },
        faceData: { select: { photoUrl: true } },
      },
      orderBy: { staffId: 'asc' },
    });

    // Strip passwords before sending response
    const safeEmployees = employees.map(emp => {
      const { password, ...safeEmp } = emp;
      return safeEmp;
    });

    res.json(safeEmployees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error retrieving employees' });
  }
};

// Get employee by ID
export const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
        faceData: { select: { photoUrl: true } },
      },
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { password, ...safeEmployee } = employee;
    res.json(safeEmployee);
  } catch (error) {
    console.error('Get employee by ID error:', error);
    res.status(500).json({ message: 'Server error retrieving employee' });
  }
};

// Create employee
export const create = async (req, res) => {
  const {
    staffId,
    nameEn,
    nameKh,
    gender,
    positionId,
    departmentId,
    branch,
    joinDate,
    status,
    shift1Start,
    shift1End,
    shift2Start,
    shift2End,
    address,
    idCardPassport,
    email,
    password,
    role,
    facePhoto,
    faceDescriptor,
    profilePhoto,
  } = req.body;

  if (!staffId || !nameEn || !nameKh || !email || !password || !positionId || !departmentId || !address || !idCardPassport) {
    return res.status(400).json({ message: 'Required fields are missing' });
  }

  try {
    // Check unique email and staffId
    const existingStaff = await prisma.employee.findFirst({
      where: {
        OR: [{ staffId }, { email }],
      },
    });

    if (existingStaff) {
      if (existingStaff.staffId === staffId) {
        return res.status(400).json({ message: 'Staff ID already exists' });
      }
      if (existingStaff.email === email) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const employee = await prisma.employee.create({
      data: {
        staffId,
        nameEn,
        nameKh,
        gender,
        positionId,
        departmentId,
        branch,
        joinDate: new Date(joinDate),
        status: status || 'Active',
        shift1Start: shift1Start || '08:00',
        shift1End: shift1End || '12:00',
        shift2Start: shift2Start || '13:00',
        shift2End: shift2End || '17:00',
        address,
        idCardPassport,
        email,
        password: hashedPassword,
        role: role || 'Employee',
        photoUrl: profilePhoto || null,
      },
    });

    const { password: _, ...safeEmployee } = employee;
    
    if (faceDescriptor && facePhoto) {
      await prisma.employeeFaceData.create({
        data: {
          staffId: employee.staffId,
          faceDescriptor,
          photoUrl: facePhoto
        }
      });
    }

    res.status(201).json(safeEmployee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error creating employee' });
  }
};

// Update employee
export const update = async (req, res) => {
  const { id } = req.params;
  const {
    staffId,
    nameEn,
    nameKh,
    gender,
    positionId,
    departmentId,
    branch,
    joinDate,
    status,
    shift1Start,
    shift1End,
    shift2Start,
    shift2End,
    address,
    idCardPassport,
    email,
    password,
    role,
    facePhoto,
    faceDescriptor,
    profilePhoto,
  } = req.body;

  if (!staffId || !nameEn || !nameKh || !email || !positionId || !departmentId || !address || !idCardPassport) {
    return res.status(400).json({ message: 'Required fields are missing' });
  }

  try {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    });
    if (!existingEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check unique email and staffId for other employees
    if (staffId || email) {
      const conflict = await prisma.employee.findFirst({
        where: {
          NOT: { id },
          OR: [
            staffId ? { staffId } : null,
            email ? { email } : null,
          ].filter(Boolean),
        },
      });

      if (conflict) {
        if (conflict.staffId === staffId) {
          return res.status(400).json({ message: 'Staff ID already in use' });
        }
        if (conflict.email === email) {
          return res.status(400).json({ message: 'Email already in use' });
        }
      }
    }

    const updateData = {
      staffId,
      nameEn,
      nameKh,
      gender,
      positionId,
      departmentId,
      branch,
      status,
      shift1Start,
      shift1End,
      shift2Start,
      shift2End,
      address,
      idCardPassport,
      email,
      role,
    };

    if (profilePhoto !== undefined) {
      updateData.photoUrl = profilePhoto || null;
    }

    if (joinDate) {
      updateData.joinDate = new Date(joinDate);
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      updateData.password = bcrypt.hashSync(password, salt);
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: updateData,
    });

    const { password: _, ...safeEmployee } = updatedEmployee;

    if (faceDescriptor && facePhoto) {
      await prisma.employeeFaceData.deleteMany({
        where: { staffId: updatedEmployee.staffId }
      });
      await prisma.employeeFaceData.create({
        data: {
          staffId: updatedEmployee.staffId,
          faceDescriptor,
          photoUrl: facePhoto
        }
      });
    }

    res.json(safeEmployee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Server error updating employee' });
  }
};

// Delete employee
export const remove = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.employee.delete({
      where: { id },
    });
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error deleting employee' });
  }
};
