import prisma from '../utils/db.js';

// GET /api/employee-leave-limits
export const getEmployeeLeaveLimits = async (req, res) => {
  try {
    let targetStaffId = req.query.staffId;
    if (req.user.role === 'Employee') {
      targetStaffId = req.user.staffId;
    }

    const whereClause = { status: 'Active' };
    if (targetStaffId) {
      whereClause.staffId = targetStaffId;
    }

    // 1. Fetch active employees
    const employees = await prisma.employee.findMany({
      where: whereClause,
      select: {
        staffId: true,
        nameEn: true,
        nameKh: true,
        department: { select: { nameEn: true, nameKh: true } },
        position: { select: { titleEn: true, titleKh: true } }
      },
      orderBy: { staffId: 'asc' }
    });

    // 2. Fetch all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { code: 'asc' }
    });

    // 3. Fetch all custom overrides
    const customLimits = await prisma.employeeLeaveLimit.findMany();

    // 4. Fetch approved/pending leaves for current year
    const currentYear = new Date().getFullYear();
    const startDate = new Date(`${currentYear}-01-01`);
    const endDate = new Date(`${currentYear}-12-31`);

    const leaves = await prisma.leave.findMany({
      where: {
        status: { in: ['Pending', 'Approved'] },
        leaveDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        staffId: true,
        leaveType: true,
        amountDays: true
      }
    });

    // 5. Aggregate balances in memory
    const reportData = employees.map(emp => {
      const allowances = leaveTypes.map(type => {
        // Override
        const custom = customLimits.find(
          c => c.staffId === emp.staffId && c.leaveCode === type.code
        );
        const maxDays = custom ? custom.maxDays : type.maxDays;

        // Used days
        const usedLeaves = leaves.filter(
          l => l.staffId === emp.staffId && (l.leaveType === type.code || l.leaveType === type.nameEn)
        );
        const usedDays = usedLeaves.reduce((sum, item) => sum + parseFloat(item.amountDays), 0);

        return {
          id: type.id,
          code: type.code,
          nameEn: type.nameEn,
          nameKh: type.nameKh,
          maxDays,
          usedDays,
          hasOverride: !!custom
        };
      });

      return {
        staffId: emp.staffId,
        nameEn: emp.nameEn,
        nameKh: emp.nameKh,
        department: emp.department,
        position: emp.position,
        allowances
      };
    });

    res.json(reportData);
  } catch (error) {
    console.error('Error loading employee leave limits:', error);
    res.status(500).json({ message: 'Server error loading employee leave limits' });
  }
};

// POST /api/employee-leave-limits
export const upsertEmployeeLeaveLimit = async (req, res) => {
  const { staffId, leaveCode, maxDays } = req.body;

  if (!staffId || !leaveCode) {
    return res.status(400).json({ message: 'staffId and leaveCode are required' });
  }

  try {
    if (maxDays === null || maxDays === undefined || maxDays === '') {
      // If maxDays is null or empty, it means reset to default (delete override)
      try {
        await prisma.employeeLeaveLimit.delete({
          where: {
            staffId_leaveCode: {
              staffId,
              leaveCode
            }
          }
        });
      } catch (err) {
        // Ignore if override wasn't there
      }
      return res.json({ message: 'Reset to default successfully' });
    }

    const override = await prisma.employeeLeaveLimit.upsert({
      where: {
        staffId_leaveCode: {
          staffId,
          leaveCode
        }
      },
      update: {
        maxDays: parseFloat(maxDays)
      },
      create: {
        staffId,
        leaveCode,
        maxDays: parseFloat(maxDays)
      }
    });

    res.json({ message: 'Custom limit updated successfully', data: override });
  } catch (error) {
    console.error('Error saving employee custom limit:', error);
    res.status(500).json({ message: 'Server error saving custom limit' });
  }
};

// DELETE /api/employee-leave-limits/:staffId
// Delete ALL custom leave limit overrides for an employee (reset all to global defaults)
export const deleteEmployeeLeaveLimits = async (req, res) => {
  const { staffId } = req.params;

  if (!staffId) {
    return res.status(400).json({ message: 'staffId is required' });
  }

  try {
    const deleted = await prisma.employeeLeaveLimit.deleteMany({
      where: { staffId }
    });

    res.json({
      message: `All custom leave limits for ${staffId} have been reset to global defaults.`,
      deletedCount: deleted.count
    });
  } catch (error) {
    console.error('Error deleting employee leave limits:', error);
    res.status(500).json({ message: 'Server error deleting custom leave limits' });
  }
};
