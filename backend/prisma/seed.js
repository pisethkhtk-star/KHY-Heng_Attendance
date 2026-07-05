import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing database records (order of dependency)
  await prisma.leave.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.department.deleteMany({});

  // 2. Create Departments
  const deptIT = await prisma.department.create({
    data: {
      nameEn: 'Information Technology',
      nameKh: 'បច្ចេកវិទ្យាព័ត៌មាន',
      description: 'Handles software development, infrastructure, and IT support',
    },
  });

  const deptHR = await prisma.department.create({
    data: {
      nameEn: 'Human Resources',
      nameKh: 'ធនធានមនុស្ស',
      description: 'Manages recruitment, staff relations, payroll, and benefits',
    },
  });

  // 3. Create Positions
  const posDev = await prisma.position.create({
    data: {
      titleEn: 'Software Developer',
      titleKh: 'អ្នកអភិវឌ្ឍន៍កម្មវិធី',
      departmentId: deptIT.id,
    },
  });

  const posITManager = await prisma.position.create({
    data: {
      titleEn: 'IT Manager',
      titleKh: 'ប្រធានផ្នែកបច្ចេកវិទ្យាព័ត៌មាន',
      departmentId: deptIT.id,
    },
  });

  const posHRSpecialist = await prisma.position.create({
    data: {
      titleEn: 'HR Specialist',
      titleKh: 'អ្នកឯកទេសធនធានមនុស្ស',
      departmentId: deptHR.id,
    },
  });

  const posHRManager = await prisma.position.create({
    data: {
      titleEn: 'HR Manager',
      titleKh: 'ប្រធានគ្រប់គ្រងធនធានមនុស្ស',
      departmentId: deptHR.id,
    },
  });

  // 4. Hash passwords for users
  const salt = bcrypt.genSaltSync(10);
  const adminPassword = bcrypt.hashSync('admin123', salt);
  const hrPassword = bcrypt.hashSync('hr123', salt);
  const managerPassword = bcrypt.hashSync('manager123', salt);
  const empPassword = bcrypt.hashSync('emp123', salt);

  // 5. Create Employees
  const empAdmin = await prisma.employee.create({
    data: {
      staffId: 'EMP-001',
      nameEn: 'Sok Mean',
      nameKh: 'សុខ មាន',
      gender: 'Male',
      positionId: posITManager.id,
      departmentId: deptIT.id,
      branch: 'Phnom Penh HQ',
      joinDate: new Date('2024-01-15'),
      status: 'Active',
      shift1Start: '08:00',
      shift1End: '12:00',
      shift2Start: '13:00',
      shift2End: '17:00',
      email: 'admin@attendance.com',
      password: adminPassword,
      role: 'Admin',
    },
  });

  const empHR = await prisma.employee.create({
    data: {
      staffId: 'EMP-002',
      nameEn: 'Keo Sophea',
      nameKh: 'កែវ សុភា',
      gender: 'Female',
      positionId: posHRManager.id,
      departmentId: deptHR.id,
      branch: 'Phnom Penh HQ',
      joinDate: new Date('2024-03-10'),
      status: 'Active',
      shift1Start: '08:00',
      shift1End: '12:00',
      shift2Start: '13:00',
      shift2End: '17:00',
      email: 'hr@attendance.com',
      password: hrPassword,
      role: 'HR',
    },
  });

  const empManager = await prisma.employee.create({
    data: {
      staffId: 'EMP-003',
      nameEn: 'Chan Dara',
      nameKh: 'ចាន់ ដារ៉ា',
      gender: 'Male',
      positionId: posITManager.id,
      departmentId: deptIT.id,
      branch: 'Phnom Penh HQ',
      joinDate: new Date('2023-11-01'),
      status: 'Active',
      shift1Start: '08:00',
      shift1End: '12:00',
      shift2Start: '13:00',
      shift2End: '17:00',
      email: 'manager@attendance.com',
      password: managerPassword,
      role: 'Manager',
    },
  });

  const empDev1 = await prisma.employee.create({
    data: {
      staffId: 'EMP-004',
      nameEn: 'Nguon Rath',
      nameKh: 'ងួន រ័ត្ន',
      gender: 'Male',
      positionId: posDev.id,
      departmentId: deptIT.id,
      branch: 'Phnom Penh HQ',
      joinDate: new Date('2025-02-20'),
      status: 'Active',
      shift1Start: '08:00',
      shift1End: '12:00',
      shift2Start: '13:00',
      shift2End: '17:00',
      email: 'rath@attendance.com',
      password: empPassword,
      role: 'Employee',
    },
  });

  const empDev2 = await prisma.employee.create({
    data: {
      staffId: 'EMP-005',
      nameEn: 'Phan Sreypov',
      nameKh: 'ផាន់ ស្រីពៅ',
      gender: 'Female',
      positionId: posDev.id,
      departmentId: deptIT.id,
      branch: 'Siem Reap Branch',
      joinDate: new Date('2025-05-01'),
      status: 'Active',
      shift1Start: '08:30',
      shift1End: '12:30',
      shift2Start: '13:30',
      shift2End: '17:30',
      email: 'sreypov@attendance.com',
      password: empPassword,
      role: 'Employee',
    },
  });

  console.log('Employees seeded.');

  // 6. Seed Attendances (last 5 days)
  const staffIds = ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005'];
  const dates = [];
  const today = new Date();
  for (let i = 5; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Pre-configured shift behavior for different employees on different days
  // Day 0: all standard check-ins (on time)
  // Day 1: some late
  // Day 2: some early leave
  // Day 3: on time
  // Day 4: late and early leave
  const attendanceLogs = [];

  for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
    const dateStr = dates[dayIdx];
    const dateObj = new Date(dateStr);

    for (const staffId of staffIds) {
      // Find shift configurations
      let s1Start = '08:00', s1End = '12:00', s2Start = '13:00', s2End = '17:00';
      if (staffId === 'EMP-005') {
        s1Start = '08:30'; s1End = '12:30'; s2Start = '13:30'; s2End = '17:30';
      }

      let checkin1 = s1Start;
      let checkout1 = s1End;
      let checkin2 = s2Start;
      let checkout2 = s2End;

      let isLate = false;
      let isEarlyLeave = false;

      // Introduce variations based on day and staff id
      if (dayIdx === 1 && staffId === 'EMP-004') {
        checkin1 = '08:15'; // Late by 15 mins
        isLate = true;
      }
      if (dayIdx === 2 && staffId === 'EMP-002') {
        checkout2 = '16:45'; // Early leave by 15 mins
        isEarlyLeave = true;
      }
      if (dayIdx === 4) {
        if (staffId === 'EMP-004') {
          checkin2 = '13:10'; // Late check-in 2
          isLate = true;
        }
        if (staffId === 'EMP-005') {
          checkout1 = '12:15'; // Early leave check-out 1 (ends at 12:30)
          isEarlyLeave = true;
        }
      }

      attendanceLogs.push({
        staffId,
        attendanceDate: dateObj,
        checkin1,
        checkout1,
        checkin2,
        checkout2,
        isLate,
        isEarlyLeave,
        note: (isLate || isEarlyLeave) ? 'Delayed / Early exit simulation' : 'Regular day',
      });
    }
  }

  for (const log of attendanceLogs) {
    await prisma.attendance.create({
      data: log,
    });
  }
  console.log('Attendances seeded.');

  // 7. Seed Leave Types
  console.log('Seeding Leave Types...');
  await prisma.leaveType.createMany({
    data: [
      {
        code: 'AL',
        nameEn: 'Annual Leave',
        nameKh: 'ច្បាប់សម្រាកប្រចាំឆ្នាំ',
        maxDays: 18.0,
        description: 'Standard paid annual leave allowance'
      },
      {
        code: 'SL',
        nameEn: 'Sick Leave',
        nameKh: 'ច្បាប់ឈឺ',
        maxDays: 12.0,
        description: 'Paid leave for medical or health issues'
      },
      {
        code: 'PL',
        nameEn: 'Personal Leave',
        nameKh: 'ច្បាប់ផ្ទាល់ខ្លួន',
        maxDays: 7.0,
        description: 'Leave for private/personal business'
      }
    ]
  });

  // 8. Seed Leaves (some requests)
  await prisma.leave.create({
    data: {
      staffId: 'EMP-004',
      leaveDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      leaveType: 'SL',
      amountDays: 1.0,
      reason: 'Fever and cold',
      status: 'Approved',
      managerName: 'Chan Dara',
      approvedAt: new Date(),
    },
  });

  await prisma.leave.create({
    data: {
      staffId: 'EMP-005',
      leaveDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      leaveType: 'AL',
      amountDays: 2.0,
      reason: 'Family trip to Siem Reap temples',
      status: 'Pending',
    },
  });

  console.log('Leaves seeded.');
  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
