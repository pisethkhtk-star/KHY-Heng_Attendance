import prisma from '../utils/db.js';

// Get all leave requests (with filters)
export const getAll = async (req, res) => {
  const { status, search, departmentId } = req.query;

  try {
    const where = {};

    if (status) {
      where.status = status; // Pending, Approved, Rejected
    }

    if (departmentId) {
      where.employee = { departmentId };
    }

    if (search) {
      where.OR = [
        { staffId: { contains: search, mode: 'insensitive' } },
        { employee: { nameEn: { contains: search, mode: 'insensitive' } } },
        { employee: { nameKh: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const leaves = await prisma.leave.findMany({
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
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    console.error('Get all leaves error:', error);
    res.status(500).json({ message: 'Server error retrieving leaves' });
  }
};

// Get leave history for a specific employee
export const getByEmployee = async (req, res) => {
  const { staffId } = req.params;

  try {
    const leaves = await prisma.leave.findMany({
      where: { staffId },
      include: {
        employee: {
          select: {
            nameEn: true,
            nameKh: true
          }
        }
      },
      orderBy: { leaveDate: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    console.error('Get employee leaves error:', error);
    res.status(500).json({ message: 'Server error retrieving employee leaves' });
  }
};

// Create leave request
export const create = async (req, res) => {
  const { staffId, leaveDate, startDate, endDate, durationType = 'Full Day', leaveType, amountDays, reason } = req.body;

  const resolvedStartDate = startDate || leaveDate;
  const resolvedEndDate = endDate || leaveDate;

  if (!staffId || !resolvedStartDate || !resolvedEndDate || !leaveType) {
    return res.status(400).json({ message: 'Required fields are missing' });
  }

  try {
    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { staffId }
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const start = new Date(resolvedStartDate);
    const end = new Date(resolvedEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date formats provided' });
    }
    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date' });
    }

    const dates = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let amountDaysPerDay = 1.0;
    if (durationType === 'Morning' || durationType === 'Afternoon') {
      amountDaysPerDay = 0.5;
    } else if (amountDays) {
      amountDaysPerDay = parseFloat(amountDays) / dates.length;
    }

    // Validate leave type and max days limit
    const typeInfo = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: leaveType },
          { nameEn: leaveType }
        ]
      }
    });

    if (typeInfo) {
      const targetYear = start.getFullYear();
      const yrStart = new Date(`${targetYear}-01-01`);
      const yrEnd = new Date(`${targetYear}-12-31`);

      // Sum all approved/pending leaves of this type (code or nameEn) in this year for this employee
      const existingLeaves = await prisma.leave.findMany({
        where: {
          staffId,
          leaveType: {
            in: [typeInfo.code, typeInfo.nameEn]
          },
          status: { in: ['Pending', 'Approved'] },
          leaveDate: {
            gte: yrStart,
            lte: yrEnd
          }
        }
      });

      const totalUsedDays = existingLeaves.reduce((sum, item) => sum + parseFloat(item.amountDays), 0);
      const requestedDays = dates.length * amountDaysPerDay;

      // Check if employee has custom limit override for this leave type code
      const customOverride = await prisma.employeeLeaveLimit.findUnique({
        where: {
          staffId_leaveCode: {
            staffId,
            leaveCode: typeInfo.code
          }
        }
      });

      const allowedLimit = customOverride ? customOverride.maxDays : typeInfo.maxDays;

      if (totalUsedDays + requestedDays > allowedLimit) {
        return res.status(400).json({
          message: `អ្នកបានស្នើច្បាប់ហួសការកំណត់! (Exceeded leave limit). You have used ${totalUsedDays} days out of ${allowedLimit} allowed days for '${typeInfo.nameKh || typeInfo.nameEn}' in ${targetYear}. You requested ${requestedDays} days.`
        });
      }
    }

    const createPromises = dates.map(date => {
      let finalReason = reason;
      if (durationType === 'Morning' || durationType === 'Afternoon') {
        finalReason = reason ? `${reason} (${durationType})` : `(${durationType})`;
      }

      return prisma.leave.create({
        data: {
          staffId,
          leaveDate: date,
          leaveType,
          amountDays: amountDaysPerDay,
          reason: finalReason,
          status: 'Pending'
        }
      });
    });

    const leavesCreated = await prisma.$transaction(createPromises);
    res.status(201).json(leavesCreated[0]);
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ message: 'Server error creating leave request' });
  }
};

// Approve or Reject leave request
export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, managerName } = req.body; // status must be 'Approved' or 'Rejected'

  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Valid status (Approved or Rejected) is required' });
  }

  try {
    const leave = await prisma.leave.findUnique({
      where: { id }
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const employee = await prisma.employee.findUnique({
      where: { staffId: leave.staffId }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee associated with leave not found' });
    }

    // Enforce designated approvers validation (Admins can bypass)
    if (req.user.role !== 'Admin') {
      const individualRules = await prisma.leaveApprovalRule.findMany({
        where: { scope: 'Employee', targetStaffId: leave.staffId }
      });

      const departmentRules = await prisma.leaveApprovalRule.findMany({
        where: { scope: 'Department', targetDeptId: employee.departmentId }
      });

      const allowedApprovers = [
        ...individualRules.map(r => r.approverId),
        ...departmentRules.map(r => r.approverId)
      ];

      if (allowedApprovers.length > 0 && !allowedApprovers.includes(req.user.staffId)) {
        return res.status(403).json({
          message: 'អ្នកមិនមានសិទ្ធិអនុម័តច្បាប់របស់បុគ្គលិកនេះទេ! (You are not the designated approver for this employee)'
        });
      }
    }

    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: {
        status,
        managerName: managerName || 'System Admin',
        approvedAt: new Date()
      },
      include: {
        employee: {
          select: { nameEn: true, nameKh: true }
        }
      }
    });

    // If approved, create a skeleton attendance record for the leave day so they aren't marked absent
    if (status === 'Approved') {
      const attendanceDate = leave.leaveDate;
      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          staffId_attendanceDate: {
            staffId: leave.staffId,
            attendanceDate
          }
        }
      });

      if (!existingAttendance) {
        // Log leave check-in simulation to prevent absent tags
        await prisma.attendance.create({
          data: {
            staffId: leave.staffId,
            attendanceDate,
            note: `Approved Leave: ${leave.leaveType}`
          }
        });
      }
    }

    res.json(updatedLeave);
  } catch (error) {
    console.error('Approve/Reject leave error:', error);
    res.status(500).json({ message: 'Server error processing leave request' });
  }
};
