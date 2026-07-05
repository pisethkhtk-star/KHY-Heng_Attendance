import prisma from './db.js';

// Get local Cambodia (UTC+7) Date string and Time string
export const getLocalTimeDetails = (customTime, customDate) => {
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



// Convert "HH:mm" string to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Determine the action automatically based on current time and existing attendance
export const determineAutoAction = (employee, existingAttendance, timeString) => {
  const currentMinutes = timeToMinutes(timeString);
  const s1EndMinutes = timeToMinutes(employee.shift1End);
  const s2StartMinutes = timeToMinutes(employee.shift2Start);
  const s2EndMinutes = employee.shift2End ? timeToMinutes(employee.shift2End) : 1020;

  const checkin1 = existingAttendance?.checkin1;
  const checkout1 = existingAttendance?.checkout1;
  const checkin2 = existingAttendance?.checkin2;
  const checkout2 = existingAttendance?.checkout2;

  // If we already checked in today (either checkin1 or checkin2) and it is late in the day (e.g. past shift 2 end - 120 mins),
  // we should treat the scan as checkout_2 rather than starting a new checkin.
  const isLateDay = currentMinutes >= (s2EndMinutes - 120);
  if (isLateDay && (checkin1 || checkin2) && !checkout2) {
    if (!checkin2 || currentMinutes > timeToMinutes(checkin2)) {
      return 'checkout_2';
    }
  }

  // 1. If we already checked in 2 but haven't checked out 2 (enforce that current time is after checkin2)
  if (checkin2 && currentMinutes > timeToMinutes(checkin2) && !checkout2) {
    return 'checkout_2';
  }

  // 2. If we are in the Shift 2 window or have already finished Shift 1
  const isPastShift1 = currentMinutes >= s1EndMinutes;
  if (checkout1 || (isPastShift1 && !checkin1)) {
    if (!checkin2) {
      return 'checkin_2';
    }
  }

  // 3. If we checked in 1 but haven't checked out 1
  if (checkin1 && !checkout1) {
    const midpoint = s1EndMinutes + (s2StartMinutes - s1EndMinutes) / 2;
    if (currentMinutes < midpoint) {
      return 'checkout_1';
    } else {
      if (!checkin2) {
        return 'checkin_2';
      }
      return 'checkout_2';
    }
  }

  // 4. If we haven't checked in 1 and we are before shift 1 end
  if (!checkin1 && currentMinutes < s1EndMinutes) {
    return 'checkin_1';
  }

  // Fallbacks
  if (!checkin1) return 'checkin_1';
  if (checkin1 && currentMinutes <= timeToMinutes(checkin1)) return 'checkin_1';
  if (!checkout1) return 'checkout_1';
  if (checkout1 && currentMinutes <= timeToMinutes(checkout1)) return 'checkout_1';
  if (!checkin2) return 'checkin_2';
  if (checkin2 && currentMinutes <= timeToMinutes(checkin2)) return 'checkin_2';
  return 'checkout_2';
};

// Perform core attendance processing
export const processAttendanceScan = async ({ staffId, action: requestedAction, customTime, customDate, note }) => {
  // 1. Fetch employee
  const employee = await prisma.employee.findUnique({
    where: { staffId }
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const { dateObj, timeString } = getLocalTimeDetails(customTime, customDate);

  // 2. Fetch existing attendance
  let attendance = await prisma.attendance.findUnique({
    where: {
      staffId_attendanceDate: {
        staffId,
        attendanceDate: dateObj
      }
    }
  });

  // 3. Determine action
  const action = requestedAction || determineAutoAction(employee, attendance, timeString);

  // 4. Update fields
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
    attendance = await prisma.attendance.create({
      data: {
        staffId,
        attendanceDate: dateObj,
        ...updateData
      }
    });
  } else {
    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: updateData
    });
  }

  // 5. Recalculate late and early metrics
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

  if (c1 && c1 > s1Start) isLate = true;
  if (c2 && c2 > s2Start) isLate = true;
  if (o1 && o1 < s1End) isEarlyLeave = true;
  if (o2 && o2 < s2End) isEarlyLeave = true;

  const finalAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      isLate,
      isEarlyLeave
    },
    include: {
      employee: {
        select: {
          staffId: true,
          nameEn: true,
          nameKh: true,
          branch: true,
          department: { select: { nameEn: true, nameKh: true } }
        }
      }
    }
  });

  return {
    attendance: finalAttendance,
    action,
    timeString,
    dateString: dateObj.toISOString().split('T')[0]
  };
};
