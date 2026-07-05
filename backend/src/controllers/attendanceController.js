import prisma from '../utils/db.js';

// Get local Cambodia (UTC+7) Date string and Time string
const getLocalTimeDetails = (customTime, customDate) => {
  const now = new Date();
  const cambodiaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }));

  let dateString;
  if (customDate) {
    dateString = customDate; // Format: "YYYY-MM-DD"
  } else {
    const year = cambodiaTime.getFullYear();
    const month = String(cambodiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(cambodiaTime.getDate()).padStart(2, '0');
    dateString = `${year}-${month}-${day}`;
  }

  let timeString;
  if (customTime) {
    timeString = customTime; // Format: "HH:mm"
  } else {
    const hours = String(cambodiaTime.getHours()).padStart(2, '0');
    const minutes = String(cambodiaTime.getMinutes()).padStart(2, '0');
    timeString = `${hours}:${minutes}`;
  }

  return {
    dateObj: new Date(dateString),
    dateString,
    timeString
  };
};

// Check-in or Check-out Logging
export const logCheckInOut = async (req, res) => {
  const { staffId, action, customTime, customDate, note } = req.body;

  if (!staffId || !action) {
    return res.status(400).json({ message: 'Staff ID and Action are required' });
  }

  const validActions = ['checkin_1', 'checkout_1', 'checkin_2', 'checkout_2'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action. Must be checkin_1, checkout_1, checkin_2, or checkout_2' });
  }

  try {
    // 1. Get Employee to verify shifts
    const employee = await prisma.employee.findUnique({
      where: { staffId }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { dateObj, timeString } = getLocalTimeDetails(customTime, customDate);

    // 2. Find or Create today's attendance record
    let attendance = await prisma.attendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId,
          attendanceDate: dateObj
        }
      }
    });

    const updateData = {};
    if (note) updateData.note = note;

    if (action === 'checkin_1') {
      updateData.checkin1 = timeString;
    } else if (action === 'checkout_1') {
      updateData.checkout1 = timeString;
    } else if (action === 'checkin_2') {
      updateData.checkin2 = timeString;
    } else if (action === 'checkout_2') {
      updateData.checkout2 = timeString;
    }

    if (!attendance) {
      // Create new record
      attendance = await prisma.attendance.create({
        data: {
          staffId,
          attendanceDate: dateObj,
          ...updateData
        }
      });
    } else {
      // Update existing record
      attendance = await prisma.attendance.update({
        where: {
          id: attendance.id
        },
        data: updateData
      });
    }

    // 3. Recalculate isLate and isEarlyLeave
    const c1 = attendance.checkin1 || updateData.checkin1;
    const c2 = attendance.checkin2 || updateData.checkin2;
    const o1 = attendance.checkout1 || updateData.checkout1;
    const o2 = attendance.checkout2 || updateData.checkout2;

    const s1Start = employee.shift1Start;
    const s1End = employee.shift1End;
    const s2Start = employee.shift2Start;
    const s2End = employee.shift2End;

    let isLate = false;
    let isEarlyLeave = false;

    // Check-in 1 late check
    if (c1 && c1 > s1Start) {
      isLate = true;
    }
    // Check-in 2 late check
    if (c2 && c2 > s2Start) {
      isLate = true;
    }
    // Check-out 1 early check
    if (o1 && o1 < s1End) {
      isEarlyLeave = true;
    }
    // Check-out 2 early check
    if (o2 && o2 < s2End) {
      isEarlyLeave = true;
    }

    // Save recalculated metrics
    const finalAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        isLate,
        isEarlyLeave
      },
      include: {
        employee: {
          select: {
            nameEn: true,
            nameKh: true,
            branch: true,
            department: { select: { nameEn: true, nameKh: true } }
          }
        }
      }
    });

    res.json({
      message: `Successfully logged ${action} at ${timeString}`,
      data: finalAttendance
    });
  } catch (error) {
    console.error('Log Check-in/out error:', error);
    res.status(500).json({ message: 'Server error logging attendance' });
  }
};

// Get today's attendance summary (for Admin/HR Dashboard)
export const getTodayAttendance = async (req, res) => {
  const { departmentId, branch } = req.query;
  const { dateObj } = getLocalTimeDetails();

  try {
    const where = {
      attendanceDate: dateObj
    };

    if (departmentId || branch) {
      where.employee = {};
      if (departmentId) where.employee.departmentId = departmentId;
      if (branch) where.employee.branch = branch;
    }

    const logs = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            gender: true,
            branch: true,
            shift1Start: true,
            shift1End: true,
            shift2Start: true,
            shift2End: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Server error retrieving today attendance' });
  }
};

// Get attendance history (for reports & user logging history)
export const getHistory = async (req, res) => {
  const { staffId, startDate, endDate, departmentId, branch } = req.query;

  try {
    const where = {};

    if (staffId) {
      where.staffId = staffId;
    }

    if (departmentId || branch) {
      where.employee = where.employee || {};
      if (departmentId) where.employee.departmentId = departmentId;
      if (branch) where.employee.branch = branch;
    }

    if (startDate || endDate) {
      where.attendanceDate = {};
      if (startDate) {
        where.attendanceDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.attendanceDate.lte = new Date(endDate);
      }
    }

    const history = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            gender: true,
            branch: true,
            shift1Start: true,
            shift1End: true,
            shift2Start: true,
            shift2End: true,
            department: { select: { nameEn: true, nameKh: true } },
            position: { select: { titleEn: true, titleKh: true } }
          }
        }
      },
      orderBy: [
        { attendanceDate: 'desc' },
        { staffId: 'asc' }
      ]
    });

    res.json(history);
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ message: 'Server error retrieving attendance history' });
  }
};

// Get stats summary (Total present, late, early leave, on leave) for Dashboard
export const getStatsSummary = async (req, res) => {
  const { dateObj } = getLocalTimeDetails();

  try {
    // Total employees count
    const totalEmployees = await prisma.employee.count({
      where: { status: 'Active' }
    });

    // Attendance logs for today
    const todayLogs = await prisma.attendance.findMany({
      where: { attendanceDate: dateObj }
    });

    const presentCount = todayLogs.length;
    const lateCount = todayLogs.filter(log => log.isLate).length;
    const earlyLeaveCount = todayLogs.filter(log => log.isEarlyLeave).length;

    // Active approved leaves today
    const leavesToday = await prisma.leave.count({
      where: {
        leaveDate: dateObj,
        status: 'Approved'
      }
    });

    res.json({
      totalEmployees,
      presentToday: presentCount,
      lateToday: lateCount,
      earlyLeaveToday: earlyLeaveCount,
      onLeaveToday: leavesToday
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Server error retrieving attendance stats' });
  }
};

// PUT /api/attendances/:id
export const updateAttendance = async (req, res) => {
  const { id } = req.params;
  const { checkin1, checkout1, checkin2, checkout2, note } = req.body;

  try {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        checkin1: checkin1 || null,
        checkout1: checkout1 || null,
        checkin2: checkin2 || null,
        checkout2: checkout2 || null,
        note: note || null
      }
    });

    const c1 = updated.checkin1;
    const c2 = updated.checkin2;
    const o1 = updated.checkout1;
    const o2 = updated.checkout2;

    const emp = attendance.employee;
    let isLate = false;
    let isEarlyLeave = false;

    if (c1 && c1 > emp.shift1Start) isLate = true;
    if (c2 && c2 > emp.shift2Start) isLate = true;
    if (o1 && o1 < emp.shift1End) isEarlyLeave = true;
    if (o2 && o2 < emp.shift2End) isEarlyLeave = true;

    const finalAttendance = await prisma.attendance.update({
      where: { id },
      data: { isLate, isEarlyLeave },
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            department: { select: { nameEn: true, nameKh: true } }
          }
        }
      }
    });

    res.json({
      message: 'Attendance record updated successfully',
      data: finalAttendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Server error updating attendance record' });
  }
};

// POST /api/attendances
export const createAttendance = async (req, res) => {
  const { staffId, attendanceDate, checkin1, checkout1, checkin2, checkout2, note } = req.body;

  if (!staffId || !attendanceDate) {
    return res.status(400).json({ message: 'Staff ID and Attendance Date are required' });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { staffId }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const dateObj = new Date(attendanceDate);

    // Check existing
    const existing = await prisma.attendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId,
          attendanceDate: dateObj
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Attendance record already exists for this date. Please edit instead.' });
    }

    const created = await prisma.attendance.create({
      data: {
        staffId,
        attendanceDate: dateObj,
        checkin1: checkin1 || null,
        checkout1: checkout1 || null,
        checkin2: checkin2 || null,
        checkout2: checkout2 || null,
        note: note || null
      }
    });

    const c1 = created.checkin1;
    const c2 = created.checkin2;
    const o1 = created.checkout1;
    const o2 = created.checkout2;

    let isLate = false;
    let isEarlyLeave = false;

    if (c1 && c1 > employee.shift1Start) isLate = true;
    if (c2 && c2 > employee.shift2Start) isLate = true;
    if (o1 && o1 < employee.shift1End) isEarlyLeave = true;
    if (o2 && o2 < employee.shift2End) isEarlyLeave = true;

    const finalAttendance = await prisma.attendance.update({
      where: { id: created.id },
      data: { isLate, isEarlyLeave },
      include: {
        employee: {
          select: {
            staffId: true,
            nameEn: true,
            nameKh: true,
            department: { select: { nameEn: true, nameKh: true } }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Attendance record created successfully',
      data: finalAttendance
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({ message: 'Server error creating attendance record' });
  }
};

// DELETE /api/attendances/:id
export const deleteAttendance = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.attendance.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await prisma.attendance.delete({
      where: { id }
    });

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Server error deleting attendance record' });
  }
};
