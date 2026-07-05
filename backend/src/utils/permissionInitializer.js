import prisma from './db.js';

export const initializePermissions = async () => {
  try {
    console.log('Initializing role permissions...');

    // Clean up old 'kiosk' resource permission if it exists
    await prisma.rolePermission.deleteMany({
      where: { resource: 'kiosk' }
    });

    const defaultPermissions = [
      // Admin permissions
      { role: 'Admin', resource: 'departments', canAccess: true },
      { role: 'Admin', resource: 'positions', canAccess: true },
      { role: 'Admin', resource: 'employees', canAccess: true },
      { role: 'Admin', resource: 'attendance', canAccess: true },
      { role: 'Admin', resource: 'add_attendance', canAccess: true },
      { role: 'Admin', resource: 'edit_attendance', canAccess: true },
      { role: 'Admin', resource: 'delete_attendance', canAccess: true },
      { role: 'Admin', resource: 'leaves', canAccess: true },
      { role: 'Admin', resource: 'reports', canAccess: true },
      { role: 'Admin', resource: 'facescan', canAccess: true },
      { role: 'Admin', resource: 'qrscan', canAccess: true },
      { role: 'Admin', resource: 'kiosk_settings', canAccess: true },
      { role: 'Admin', resource: 'leave_types', canAccess: true },
      { role: 'Admin', resource: 'leave_allowances', canAccess: true },
      { role: 'Admin', resource: 'leave_approvals', canAccess: true },
      { role: 'Admin', resource: 'permissions', canAccess: true },
      { role: 'Admin', resource: 'work_hours', canAccess: true },
      { role: 'Admin', resource: 'scan_behalf_face', canAccess: true },
      { role: 'Admin', resource: 'scan_behalf_qr', canAccess: true },
      { role: 'Admin', resource: 'leave_approvals', canAccess: true },
      { role: 'Admin', resource: 'edit_leave_approvals', canAccess: true },
      { role: 'Admin', resource: 'delete_leave_approvals', canAccess: true },

      // HR permissions
      { role: 'HR', resource: 'departments', canAccess: true },
      { role: 'HR', resource: 'positions', canAccess: true },
      { role: 'HR', resource: 'employees', canAccess: true },
      { role: 'HR', resource: 'attendance', canAccess: true },
      { role: 'HR', resource: 'add_attendance', canAccess: true },
      { role: 'HR', resource: 'edit_attendance', canAccess: true },
      { role: 'HR', resource: 'delete_attendance', canAccess: true },
      { role: 'HR', resource: 'leaves', canAccess: true },
      { role: 'HR', resource: 'reports', canAccess: true },
      { role: 'HR', resource: 'facescan', canAccess: true },
      { role: 'HR', resource: 'qrscan', canAccess: true },
      { role: 'HR', resource: 'kiosk_settings', canAccess: false },
      { role: 'HR', resource: 'leave_types', canAccess: true },
      { role: 'HR', resource: 'leave_allowances', canAccess: true },
      { role: 'HR', resource: 'leave_approvals', canAccess: true },
      { role: 'HR', resource: 'permissions', canAccess: false },
      { role: 'HR', resource: 'work_hours', canAccess: true },
      { role: 'HR', resource: 'scan_behalf_face', canAccess: true },
      { role: 'HR', resource: 'scan_behalf_qr', canAccess: true },
      { role: 'HR', resource: 'leave_approvals', canAccess: true },
      { role: 'HR', resource: 'edit_leave_approvals', canAccess: true },
      { role: 'HR', resource: 'delete_leave_approvals', canAccess: true },

      // Manager permissions
      { role: 'Manager', resource: 'departments', canAccess: false },
      { role: 'Manager', resource: 'positions', canAccess: false },
      { role: 'Manager', resource: 'employees', canAccess: true },
      { role: 'Manager', resource: 'attendance', canAccess: true },
      { role: 'Manager', resource: 'add_attendance', canAccess: false },
      { role: 'Manager', resource: 'edit_attendance', canAccess: false },
      { role: 'Manager', resource: 'delete_attendance', canAccess: false },
      { role: 'Manager', resource: 'leaves', canAccess: true },
      { role: 'Manager', resource: 'reports', canAccess: true },
      { role: 'Manager', resource: 'facescan', canAccess: true },
      { role: 'Manager', resource: 'qrscan', canAccess: true },
      { role: 'Manager', resource: 'kiosk_settings', canAccess: false },
      { role: 'Manager', resource: 'leave_types', canAccess: false },
      { role: 'Manager', resource: 'leave_allowances', canAccess: false },
      { role: 'Manager', resource: 'leave_approvals', canAccess: false },
      { role: 'Manager', resource: 'permissions', canAccess: false },
      { role: 'Manager', resource: 'work_hours', canAccess: false },
      { role: 'Manager', resource: 'scan_behalf_face', canAccess: false },
      { role: 'Manager', resource: 'scan_behalf_qr', canAccess: false },
      { role: 'Manager', resource: 'leave_approvals', canAccess: false },
      { role: 'Manager', resource: 'edit_leave_approvals', canAccess: false },
      { role: 'Manager', resource: 'delete_leave_approvals', canAccess: false },

      // Employee permissions
      { role: 'Employee', resource: 'departments', canAccess: false },
      { role: 'Employee', resource: 'positions', canAccess: false },
      { role: 'Employee', resource: 'employees', canAccess: false },
      { role: 'Employee', resource: 'attendance', canAccess: true },
      { role: 'Employee', resource: 'add_attendance', canAccess: false },
      { role: 'Employee', resource: 'edit_attendance', canAccess: false },
      { role: 'Employee', resource: 'delete_attendance', canAccess: false },
      { role: 'Employee', resource: 'leaves', canAccess: true },
      { role: 'Employee', resource: 'reports', canAccess: false },
      { role: 'Employee', resource: 'facescan', canAccess: false },
      { role: 'Employee', resource: 'qrscan', canAccess: false },
      { role: 'Employee', resource: 'kiosk_settings', canAccess: false },
      { role: 'Employee', resource: 'leave_types', canAccess: false },
      { role: 'Employee', resource: 'leave_allowances', canAccess: false },
      { role: 'Employee', resource: 'leave_approvals', canAccess: false },
      { role: 'Employee', resource: 'permissions', canAccess: false },
      { role: 'Employee', resource: 'work_hours', canAccess: false },
      { role: 'Employee', resource: 'scan_behalf_face', canAccess: false },
      { role: 'Employee', resource: 'scan_behalf_qr', canAccess: false },
      { role: 'Employee', resource: 'leave_approvals', canAccess: false },
      { role: 'Employee', resource: 'edit_leave_approvals', canAccess: false },
      { role: 'Employee', resource: 'delete_leave_approvals', canAccess: false },
    ];

    for (const p of defaultPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          role_resource: {
            role: p.role,
            resource: p.resource
          }
        },
        update: {}, // Keep existing settings intact if they already exist
        create: p
      });
    }

    // Seed default Kiosk Setting if none exists
    const kioskSettingsCount = await prisma.kioskSetting.count();
    if (kioskSettingsCount === 0) {
      console.log('Seeding default Kiosk Geofence Setting...');
      await prisma.kioskSetting.create({
        data: {
          latitude: 11.5564,
          longitude: 104.9282,
          radius: 100.0 // Default 100 meters
        }
      });
    }

    // Seed default Leave Types if none exists
    const leaveTypesCount = await prisma.leaveType.count();
    if (leaveTypesCount === 0) {
      console.log('Seeding default Leave Types...');
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
    }

    console.log('Role permissions initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize role permissions:', error);
  }
};
