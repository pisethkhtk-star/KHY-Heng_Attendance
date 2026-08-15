import prisma from '../utils/db.js';

// Get all overtime requests (with filters)
export const getAll = async (req, res) => {
  const { status, search, departmentId, branch, startDate, endDate } = req.query;

  try {
    const where = {};

    // Role-based restrictions: Employees can only view their own overtime
    if (req.user.role === 'Employee') {
      where.staffId = req.user.staffId;
    }

    if (status) {
      where.status = status; // Pending, Approved, Rejected
    }

    if (departmentId) {
      where.employee = { ...where.employee, departmentId };
    }

    if (branch) {
      where.OR = [
        { branch: { contains: branch, mode: 'insensitive' } },
        { branchLocation: { name: { contains: branch, mode: 'insensitive' } } }
      ];
    }

    if (startDate && endDate) {
      where.fromDate = { gte: new Date(startDate) };
      where.toDate = { lte: new Date(endDate) };
    } else if (startDate) {
      where.fromDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.toDate = { lte: new Date(endDate) };
    }

    if (search) {
      where.OR = [
        { staffId: { contains: search, mode: 'insensitive' } },
        { employee: { nameEn: { contains: search, mode: 'insensitive' } } },
        { employee: { nameKh: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
        { managerName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const overtimes = await prisma.overtime.findMany({
      where,
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            branch: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        },
        manager: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true
          }
        },
        branchLocation: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    res.json(overtimes);
  } catch (error) {
    console.error('Get all overtimes error:', error);
    res.status(500).json({ message: 'Server error retrieving overtimes' });
  }
};

// Get overtime history for a specific employee
export const getByEmployee = async (req, res) => {
  const { staffId } = req.params;

  try {
    // Prevent non-admin/HR from viewing others' records
    if (req.user.role === 'Employee' && req.user.staffId !== staffId) {
      return res.status(403).json({ message: 'Unauthorized access to employee overtime history' });
    }

    const overtimes = await prisma.overtime.findMany({
      where: { staffId },
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            branch: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        },
        manager: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true
          }
        },
        branchLocation: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { fromDate: 'desc' }
    });

    res.json(overtimes);
  } catch (error) {
    console.error('Get employee overtimes error:', error);
    res.status(500).json({ message: 'Server error retrieving employee overtimes' });
  }
};

// Create overtime request
export const create = async (req, res) => {
  const {
    staffId,
    fromDate,
    toDate,
    startTime,
    endTime,
    amountDay,
    reason,
    branchId,
    branch
  } = req.body;

  // Determine target employee
  const resolvedStaffId = req.user.role === 'Employee' ? req.user.staffId : (staffId || req.user.staffId);
  const resolvedFromDate = fromDate;
  const resolvedToDate = toDate || fromDate;

  if (!resolvedStaffId || !resolvedFromDate || !startTime || !endTime) {
    return res.status(400).json({ message: 'Required fields are missing (staffId, fromDate, startTime, endTime)' });
  }

  try {
    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { staffId: resolvedStaffId }
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const start = new Date(resolvedFromDate);
    const end = new Date(resolvedToDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date formats provided' });
    }
    if (start > end) {
      return res.status(400).json({ message: 'From date must be before or equal to to date' });
    }

    // Determine branch information
    let resolvedBranchName = branch || employee.branch || '';
    let resolvedBranchId = branchId || null;

    if (!resolvedBranchId && resolvedBranchName) {
      const kiosk = await prisma.kioskSetting.findFirst({
        where: { name: { contains: resolvedBranchName, mode: 'insensitive' } }
      });
      if (kiosk) resolvedBranchId = kiosk.id;
    } else if (resolvedBranchId && !resolvedBranchName) {
      const kiosk = await prisma.kioskSetting.findUnique({
        where: { id: resolvedBranchId }
      });
      if (kiosk) resolvedBranchName = kiosk.name;
    }

    // Calculate Amount Day if not provided
    let resolvedAmountDay = amountDay !== undefined && amountDay !== null ? parseFloat(amountDay) : 0;
    if (!resolvedAmountDay || resolvedAmountDay <= 0) {
      // Calculate days difference
      const dayDiff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
      
      // Calculate hours from startTime (HH:mm) to endTime (HH:mm)
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let hours = (endH + endM / 60) - (startH + startM / 60);
      if (hours < 0) hours += 24; // overnight overtime

      // Convert to standard work day fraction (assuming 8h standard workday)
      const dayFraction = parseFloat((hours / 8).toFixed(2));
      resolvedAmountDay = parseFloat((dayDiff * (dayFraction > 0 ? dayFraction : 1.0)).toFixed(2));
    }

    const creatorName = req.user.nameEn || req.user.nameKh || req.user.staffId || 'Employee';

    const newOvertime = await prisma.overtime.create({
      data: {
        staffId: resolvedStaffId,
        fromDate: start,
        toDate: end,
        startTime,
        endTime,
        amountDay: resolvedAmountDay,
        reason: reason || '',
        branch: resolvedBranchName,
        branchId: resolvedBranchId,
        status: 'Pending',
        createdBy: creatorName,
        requestedAt: new Date()
      },
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            branch: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        },
        branchLocation: true
      }
    });

    res.status(201).json(newOvertime);
  } catch (error) {
    console.error('Create overtime error:', error);
    res.status(500).json({ message: 'Server error creating overtime request' });
  }
};

// Update overtime status (Approve / Reject)
export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comment, managerName } = req.body;

  if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value. Must be Pending, Approved, or Rejected' });
  }

  try {
    const existing = await prisma.overtime.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Overtime record not found' });
    }

    const reviewerStaffId = req.user.staffId;
    const reviewerName = managerName || req.user.nameEn || req.user.nameKh || reviewerStaffId;

    const updated = await prisma.overtime.update({
      where: { id },
      data: {
        status,
        comment: comment !== undefined ? comment : existing.comment,
        managerId: reviewerStaffId,
        managerName: reviewerName,
        approvedAt: status !== 'Pending' ? new Date() : null
      },
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            branch: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        },
        manager: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true
          }
        },
        branchLocation: true
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update overtime status error:', error);
    res.status(500).json({ message: 'Server error updating overtime status' });
  }
};

// Delete overtime
export const deleteOvertime = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.overtime.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Overtime request not found' });
    }

    // Role check: Employees can only delete their own Pending requests
    if (req.user.role === 'Employee') {
      if (existing.staffId !== req.user.staffId) {
        return res.status(403).json({ message: 'Unauthorized to delete this overtime request' });
      }
      if (existing.status !== 'Pending') {
        return res.status(400).json({ message: 'Cannot delete overtime that has already been approved or rejected' });
      }
    }

    await prisma.overtime.delete({
      where: { id }
    });

    res.json({ message: 'Overtime request deleted successfully' });
  } catch (error) {
    console.error('Delete overtime error:', error);
    res.status(500).json({ message: 'Server error deleting overtime request' });
  }
};
