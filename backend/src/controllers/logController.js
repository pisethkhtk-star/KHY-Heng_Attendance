import prisma from '../utils/db.js';

// GET /api/attendance-logs
export const getAttendanceLogs = async (req, res) => {
  const { staffId, method, startDate, endDate } = req.query;

  try {
    const whereClause = {};

    if (staffId) {
      whereClause.staffId = {
        contains: staffId,
        mode: 'insensitive'
      };
    }

    if (method) {
      whereClause.method = method;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Adjust to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const logs = await prisma.attendanceLog.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        employee: {
          select: {
            nameEn: true,
            nameKh: true,
            branch: true,
            department: {
              select: {
                nameEn: true,
                nameKh: true
              }
            }
          }
        }
      }
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Server error loading audit logs' });
  }
};
