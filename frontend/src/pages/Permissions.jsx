import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const Permissions = () => {
  const { language, t } = useLanguage();
  
  // Tab State: 'roles' | 'employees'
  const [activeTab, setActiveTab] = useState('roles');

  // Role Permissions State
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Employee Permissions State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empPermissionsLoading, setEmpPermissionsLoading] = useState(false);
  const [empEffectivePerms, setEmpEffectivePerms] = useState([]);
  const [empHasCustom, setEmpHasCustom] = useState(false);
  const [empRolePerms, setEmpRolePerms] = useState([]);
  const [canLoginWeb, setCanLoginWeb] = useState(false);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empFilterQuery, setEmpFilterQuery] = useState('');
  const empDropdownRef = useRef(null);

  const roles = [
    { key: 'Admin', label: 'Admin 👑' },
    { key: 'HR', label: 'HR 💼' },
    { key: 'Manager', label: 'Manager 👔' },
    { key: 'Employee', label: 'Employee 👤' }
  ];

  // Bilingual Structured Categorization of All Permissions
  const resourceCategories = [
    {
      key: 'org_group',
      labelEn: 'Organization & Employees',
      labelKh: 'រចនាសម្ព័ន្ធ & គ្រប់គ្រងបុគ្គលិក',
      children: [
        {
          key: 'departments',
          labelEn: 'Departments Management',
          labelKh: 'គ្រប់គ្រងដេប៉ាតឺម៉ង់',
          descEn: 'View and manage corporate departments',
          descKh: 'មើល និងគ្រប់គ្រងដេប៉ាតឺម៉ង់ក្រុមហ៊ុន'
        },
        {
          key: 'positions',
          labelEn: 'Positions Management',
          labelKh: 'គ្រប់គ្រងតួនាទី',
          descEn: 'View and manage job positions',
          descKh: 'មើល និងគ្រប់គ្រងតួនាទីការងារ'
        },
        {
          key: 'employees',
          labelEn: 'View Employee Directory',
          labelKh: 'មើលបញ្ជីបុគ្គលិក',
          descEn: 'View active and resigned employees',
          descKh: 'មើលបញ្ជីបុគ្គលិកកំពុងធ្វើការ និងឈប់'
        },
        {
          key: 'add_employee',
          labelEn: 'Add New Employee',
          labelKh: 'បន្ថែមបុគ្គលិកថ្មី',
          descEn: 'Register new employee with face data',
          descKh: 'ចុះឈ្មោះបុគ្គលិកថ្មី និងទិន្នន័យស្កេនមុខ'
        },
        {
          key: 'edit_employee',
          labelEn: 'Edit Employee',
          labelKh: 'កែប្រែព័ត៌មានបុគ្គលិក',
          descEn: 'Update employee profile & settings',
          descKh: 'កែប្រែព័ត៌មានផ្ទាល់ខ្លួន និងការកំណត់បុគ្គលិក'
        },
        {
          key: 'delete_employee',
          labelEn: 'Delete Employee',
          labelKh: 'លុបបុគ្គលិក',
          descEn: 'Remove employee profile from system',
          descKh: 'លុបគណនីបុគ្គលិកចេញពីប្រព័ន្ធ'
        },
        {
          key: 'work_hours',
          labelEn: 'Company Work Hours',
          labelKh: 'កំណត់ម៉ោងការងារក្រុមហ៊ុន',
          descEn: 'Set daily shift schedules & working hours',
          descKh: 'កំណត់វេនការងារ និងម៉ោងធ្វើការប្រចាំថ្ងៃ'
        }
      ]
    },
    {
      key: 'attendance_group',
      labelEn: 'Attendance Management',
      labelKh: 'គ្រប់គ្រងវត្តមាន',
      children: [
        {
          key: 'attendance',
          labelEn: 'All Attendance Logs',
          labelKh: 'កំណត់ត្រាវត្តមានទាំងអស់',
          descEn: 'View comprehensive check-in logs',
          descKh: 'មើលកំណត់ត្រាវត្តមានទូទៅទាំងអស់'
        },
        {
          key: 'attendance_early_in',
          labelEn: 'Early-In Logs',
          labelKh: 'កំណត់ត្រាមកមុនម៉ោង (Early In)',
          descEn: 'View early morning check-ins',
          descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកមកមុនម៉ោង'
        },
        {
          key: 'attendance_late',
          labelEn: 'Late Arrival Logs',
          labelKh: 'កំណត់ត្រាមកយឺត (Late)',
          descEn: 'View late arrival records & penalty',
          descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកមកយឺត'
        },
        {
          key: 'attendance_early_out',
          labelEn: 'Early-Out Logs',
          labelKh: 'កំណត់ត្រាចេញមុនម៉ោង (Early Out)',
          descEn: 'View early checkout departures',
          descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកចេញមុនម៉ោង'
        },
        {
          key: 'add_attendance',
          labelEn: 'Add Manual Attendance',
          labelKh: 'បន្ថែមវត្តមានដោយផ្ទាល់',
          descEn: 'Manually insert missed attendance log',
          descKh: 'បញ្ចូលវត្តមានដែលខកខានដោយផ្ទាល់'
        },
        {
          key: 'edit_attendance',
          labelEn: 'Edit Attendance Log',
          labelKh: 'កែប្រែកំណត់ត្រាវត្តមាន',
          descEn: 'Modify check-in / check-out timestamps',
          descKh: 'កែប្រែម៉ោង Check-in ឬ Check-out'
        },
        {
          key: 'delete_attendance',
          labelEn: 'Delete Attendance Log',
          labelKh: 'លុបកំណត់ត្រាវត្តមាន',
          descEn: 'Remove attendance record',
          descKh: 'លុបកំណត់ត្រាវត្តមានដែលខុស'
        }
      ]
    },
    {
      key: 'overtime_group',
      labelEn: 'Overtime Management',
      labelKh: 'គ្រប់គ្រងការថែមម៉ោង (OT)',
      children: [
        {
          key: 'overtime',
          labelEn: 'View & Request Overtime',
          labelKh: 'មើល និងស្នើសុំថែមម៉ោង',
          descEn: 'Submit and view overtime requests',
          descKh: 'ស្នើសុំថែមម៉ោង និងមើលប្រវត្តិថែមម៉ោង'
        },
        {
          key: 'approve_overtime',
          labelEn: 'Approve / Reject Overtime',
          labelKh: 'អនុម័ត ឬបដិសេធថែមម៉ោង',
          descEn: 'Review and approve team overtime requests',
          descKh: 'ពិនិត្យ និងអនុម័តសំណើថែមម៉ោង'
        },
        {
          key: 'delete_overtime',
          labelEn: 'Delete Overtime Request',
          labelKh: 'លុបសំណើថែមម៉ោង',
          descEn: 'Remove pending overtime requests',
          descKh: 'លុបសំណើថែមម៉ោងដែលមិនត្រឹមត្រូវ'
        }
      ]
    },
    {
      key: 'leaves_group',
      labelEn: 'Leaves & Approvals Management',
      labelKh: 'គ្រប់គ្រងការសុំច្បាប់ & អនុម័ត',
      children: [
        {
          key: 'leaves',
          labelEn: 'View & Request Leaves',
          labelKh: 'មើល និងស្នើសុំច្បាប់',
          descEn: 'Submit leave request and view history',
          descKh: 'ស្នើសុំច្បាប់ឈប់សម្រាក និងមើលប្រវត្តិ'
        },
        {
          key: 'approve_leaves',
          labelEn: 'Approve / Reject Leaves',
          labelKh: 'អនុម័ត ឬបដិសេធច្បាប់',
          descEn: 'Process leave requests by line manager',
          descKh: 'ពិនិត្យ និងអនុម័តពាក្យសុំច្បាប់ឈប់សម្រាក'
        },
        {
          key: 'leave_types',
          labelEn: 'Leave Types Configuration',
          labelKh: 'កំណត់ប្រភេទច្បាប់',
          descEn: 'Manage annual, sick, special leave types',
          descKh: 'កំណត់ប្រភេទច្បាប់ប្រចាំឆ្នាំ ឈឺ ពិសេស'
        },
        {
          key: 'leave_allowances',
          labelEn: 'Leave Allowances Configuration',
          labelKh: 'កំណត់ចំនួនច្បាប់បុគ្គលិក',
          descEn: 'Set annual leave quota per employee',
          descKh: 'កំណត់ចំនួនថ្ងៃច្បាប់ប្រចាំឆ្នាំសម្រាប់បុគ្គលិក'
        },
        {
          key: 'leave_approvals',
          labelEn: 'Approval Workflows',
          labelKh: 'គ្រប់គ្រងអ្នកអនុម័តច្បាប់',
          descEn: 'Assign manager approval matrix',
          descKh: 'ចាត់តាំងរចនាសម្ព័ន្ធអ្នកអនុម័តច្បាប់'
        },
        {
          key: 'edit_leave_approvals',
          labelEn: 'Edit Approvals',
          labelKh: 'កែប្រែអ្នកអនុម័ត',
          descEn: 'Modify approval hierarchy',
          descKh: 'កែប្រែថ្នាក់អ្នកអនុម័ត'
        },
        {
          key: 'delete_leave_approvals',
          labelEn: 'Delete Approvals',
          labelKh: 'លុបអ្នកអនុម័ត',
          descEn: 'Remove approval configuration',
          descKh: 'លុបអ្នកអនុម័តចេញពីរចនាសម្ព័ន្ធ'
        }
      ]
    },
    {
      key: 'kiosk_group',
      labelEn: 'Kiosk, Facescan & Geofencing',
      labelKh: 'ម៉ាស៊ីនស្កេន, Facescan & ទីតាំង',
      children: [
        {
          key: 'facescan',
          labelEn: 'Facescan Kiosk Mode',
          labelKh: 'ម៉ាស៊ីនស្កេនផ្ទៃមុខ (Face Recognition)',
          descEn: 'Face recognition check-in terminal',
          descKh: 'ម៉ាស៊ីនស្កេនមុខស្វ័យប្រវត្តិកំណត់វត្តមាន'
        },
        {
          key: 'qrscan',
          labelEn: 'QRscan Kiosk Mode',
          labelKh: 'ម៉ាស៊ីនស្កេន QR Code',
          descEn: 'QR code scanning terminal',
          descKh: 'ម៉ាស៊ីនស្កេន QR Code សម្រាប់បុគ្គលិក'
        },
        {
          key: 'kiosk_settings',
          labelEn: 'Branch & GPS Geofencing',
          labelKh: 'កំណត់ទីតាំង និងសាខា',
          descEn: 'Manage company branches & GPS radius',
          descKh: 'កំណត់ទីតាំង GPS សាខា និងកាំស្កេន'
        },
        {
          key: 'scan_behalf_face',
          labelEn: 'Scan Face on Behalf',
          labelKh: 'ស្កេនផ្ទៃមុខជំនួសអ្នកដទៃ',
          descEn: 'Admin scan face for other staff',
          descKh: 'សិទ្ធិស្កេនមុខជំនួសបុគ្គលិកផ្សេងទៀត'
        },
        {
          key: 'scan_behalf_qr',
          labelEn: 'Scan QR on Behalf',
          labelKh: 'ស្កេន QR ជំនួសអ្នកដទៃ',
          descEn: 'Admin scan QR for other staff',
          descKh: 'សិទ្ធិស្កេន QR ជំនួសបុគ្គលិកផ្សេងទៀត'
        }
      ]
    },
    {
      key: 'system_group',
      labelEn: 'Reports & System Settings',
      labelKh: 'របាយការណ៍ & កំណត់ប្រព័ន្ធ',
      children: [
        {
          key: 'reports',
          labelEn: 'View Reports & Analytics',
          labelKh: 'មើលរបាយការណ៍ និងស្ថិតិ',
          descEn: 'Generate monthly attendance reports',
          descKh: 'ទាញយក និងមើលរបាយការណ៍វត្តមានប្រចាំខែ'
        },
        {
          key: 'telegram_settings',
          labelEn: 'Telegram Notifications',
          labelKh: 'កំណត់ Telegram Group Alerts',
          descEn: 'Configure instant alert bot & channels',
          descKh: 'កំណត់ Telegram Bot និងក្រុមទទួលសារដំណឹង'
        },
        {
          key: 'permissions',
          labelEn: 'Role Permissions Configuration',
          labelKh: 'កំណត់សិទ្ធិប្រព័ន្ធ (Role Permissions)',
          descEn: 'Manage access rights for system roles',
          descKh: 'គ្រប់គ្រងសិទ្ធិប្រើប្រាស់តាមតួនាទី'
        }
      ]
    }
  ];

  const allGroupKeys = resourceCategories.map(c => c.key);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const init = {};
    allGroupKeys.forEach(k => { init[k] = true; });
    return init;
  });

  const isAllExpanded = allGroupKeys.every(k => expandedGroups[k]);

  const toggleExpandAll = () => {
    const nextState = !isAllExpanded;
    const newExpanded = {};
    allGroupKeys.forEach(k => {
      newExpanded[k] = nextState;
    });
    setExpandedGroups(newExpanded);
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const playSound = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.16);
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Initial Fetch: Role Permissions & Employees
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [permRes, empRes] = await Promise.all([
        api.get('/permissions'),
        api.get('/employees').catch(() => ({ data: [] }))
      ]);
      setPermissions(permRes.data || []);
      setEmployees(empRes.data || []);
    } catch (error) {
      console.error('Error fetching initial permissions data:', error);
      setErrorMsg(language === 'kh' ? 'មិនអាចទាញយកទិន្នន័យសិទ្ធិបានទេ' : 'Failed to load role permissions from server.');
    } finally {
      setLoading(false);
    }
  };

  // Close employee dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch individual employee permissions when employee is chosen
  const selectEmployee = async (emp) => {
    setSelectedEmployee(emp);
    setEmpDropdownOpen(false);
    setEmpFilterQuery('');
    setSuccessMsg('');
    setErrorMsg('');

    // Pre-populate with base role permissions as immediate fallback
    const roleBasePerms = permissions
      .filter(p => p.role === emp.role && Boolean(p.canAccess))
      .map(p => p.resource);
    setEmpRolePerms(roleBasePerms);
    setEmpEffectivePerms(roleBasePerms);
    setEmpHasCustom(false);
    setCanLoginWeb(emp.role === 'Admin' || Boolean(emp.canLoginWeb));

    try {
      setEmpPermissionsLoading(true);
      const res = await api.get(`/permissions/employee/${emp.id}`);
      if (res && res.data) {
        const data = res.data;
        setEmpEffectivePerms(data.effectivePermissions || roleBasePerms);
        setEmpHasCustom(Boolean(data.hasCustom));
        setEmpRolePerms(data.rolePermissions || roleBasePerms);
        if (data.canLoginWeb !== undefined) {
          setCanLoginWeb(Boolean(data.canLoginWeb));
        }
      }
    } catch (err) {
      console.warn('Could not fetch custom permissions from backend, falling back to role defaults:', err);
      // Fallback already set above smoothly
    } finally {
      setEmpPermissionsLoading(false);
    }
  };

  const handleToggleWebLogin = async () => {
    if (!selectedEmployee) return;
    const nextVal = !canLoginWeb;
    setCanLoginWeb(nextVal);

    try {
      await api.put(`/permissions/employee/${selectedEmployee.id}/toggle-web-login`, {
        canLoginWeb: nextVal
      });
      setSuccessMsg(
        nextVal
          ? (language === 'kh'
              ? `បានបើកសិទ្ធិ Login ចូល Website សម្រាប់ ${selectedEmployee.nameEn || selectedEmployee.nameKh}!`
              : `Web login access ENABLED for ${selectedEmployee.nameEn || selectedEmployee.nameKh}!`)
          : (language === 'kh'
              ? `បានបិទសិទ្ធិ Login ចូល Website សម្រាប់ ${selectedEmployee.nameEn || selectedEmployee.nameKh} (Mobile App អាច Login ធម្មតា)!`
              : `Web login access DISABLED for ${selectedEmployee.nameEn || selectedEmployee.nameKh} (Mobile app unaffected)!`)
      );
      playSound('success');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error toggling web login:', err);
      setCanLoginWeb(!nextVal); // Revert on failure
      setErrorMsg(language === 'kh' ? 'មិនអាចផ្លាស់ប្តូរសិទ្ធិ Login Website បានទេ' : 'Failed to update web login permission.');
      playSound('error');
    }
  };

  const getPermissionVal = (role, resource) => {
    if (role === 'Admin') return true;
    const item = permissions.find(p => p.role === role && p.resource === resource);
    return item ? item.canAccess : false;
  };

  const handleCheckboxChange = (role, resource) => {
    if (role === 'Admin') return;

    setPermissions(prev => {
      const exists = prev.some(p => p.role === role && p.resource === resource);
      if (exists) {
        return prev.map(p => {
          if (p.role === role && p.resource === resource) {
            return { ...p, canAccess: !p.canAccess };
          }
          return p;
        });
      } else {
        return [...prev, { role, resource, canAccess: true }];
      }
    });
  };

  const handleGroupCheckboxChange = (role, group, shouldCheck) => {
    if (role === 'Admin') return;
    const childKeys = group.children.map(c => c.key);
    setPermissions(prev => {
      const updated = prev.map(p => {
        if (p.role === role && childKeys.includes(p.resource)) {
          return { ...p, canAccess: shouldCheck };
        }
        return p;
      });

      // Also ensure any missing child permission records are added
      childKeys.forEach(resKey => {
        if (!updated.some(p => p.role === role && p.resource === resKey)) {
          updated.push({ role, resource: resKey, canAccess: shouldCheck });
        }
      });

      return updated;
    });
  };

  // Save Role Permissions
  const handleSaveRolePermissions = async () => {
    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      const payload = permissions.filter(p => p.role !== 'Admin');

      await api.put('/permissions', { permissions: payload });

      setSuccessMsg(language === 'kh' ? 'កែប្រែសិទ្ធិតាមតួនាទី (Role) បានជោគជ័យ!' : 'Role permissions updated successfully!');
      playSound('success');

      setTimeout(() => {
        setSuccessMsg('');
      }, 3500);
    } catch (error) {
      console.error('Error saving permissions:', error);
      setErrorMsg(language === 'kh' ? 'មិនអាចរក្សាទុកសិទ្ធិបានទេ!' : 'Failed to save permissions configuration.');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  // Employee-Specific Permission Handlers
  const handleToggleEmpPermission = (resourceKey) => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    setEmpEffectivePerms(prev => {
      if (prev.includes(resourceKey)) {
        return prev.filter(k => k !== resourceKey);
      } else {
        return [...prev, resourceKey];
      }
    });
  };

  const handleToggleEmpGroup = (group, shouldCheck) => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    const groupKeys = group.children.map(c => c.key);
    setEmpEffectivePerms(prev => {
      if (shouldCheck) {
        return Array.from(new Set([...prev, ...groupKeys]));
      } else {
        return prev.filter(k => !groupKeys.includes(k));
      }
    });
  };

  const handleSelectAllEmpPerms = () => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    const allKeys = [];
    resourceCategories.forEach(g => {
      g.children.forEach(c => allKeys.push(c.key));
    });
    setEmpEffectivePerms(allKeys);
  };

  const handleDeselectAllEmpPerms = () => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    setEmpEffectivePerms([]);
  };

  const handleResetToRoleDefault = async () => {
    if (!selectedEmployee) return;
    if (!window.confirm(
      language === 'kh'
        ? `តើអ្នកប្រាកដថាចង់កំណត់សិទ្ធិរបស់ "${selectedEmployee.nameEn || selectedEmployee.nameKh}" តាមតួនាទី (${selectedEmployee.role}) ដើមវិញមែនទេ?`
        : `Reset permissions for "${selectedEmployee.nameEn || selectedEmployee.nameKh}" to their default Role (${selectedEmployee.role})?`
    )) {
      return;
    }

    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      await api.put(`/permissions/employee/${selectedEmployee.id}`, {
        resetToRole: true,
        customPermissions: null
      });

      setEmpHasCustom(false);
      setEmpEffectivePerms(empRolePerms);
      setSuccessMsg(
        language === 'kh'
          ? `បានកំណត់សិទ្ធិរបស់ ${selectedEmployee.nameEn || selectedEmployee.nameKh} តាមតួនាទី (${selectedEmployee.role}) ដើមវិញដោយជោគជ័យ!`
          : `Permissions reset to default ${selectedEmployee.role} role!`
      );
      playSound('success');

      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error resetting employee permissions:', err);
      setErrorMsg(language === 'kh' ? 'មិនអាចកំណត់សិទ្ធិឡើងវិញបានទេ' : 'Failed to reset employee permissions.');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmpPermissions = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      await api.put(`/permissions/employee/${selectedEmployee.id}`, {
        resetToRole: false,
        customPermissions: empEffectivePerms
      });

      setEmpHasCustom(true);
      setSuccessMsg(
        language === 'kh'
          ? `បានរក្សាទុកសិទ្ធិផ្ទាល់ខ្លួនរបស់ ${selectedEmployee.nameEn || selectedEmployee.nameKh} ដោយជោគជ័យ!`
          : `Custom permissions saved for ${selectedEmployee.nameEn || selectedEmployee.nameKh}!`
      );
      playSound('success');

      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error saving employee permissions:', err);
      setErrorMsg(language === 'kh' ? 'មិនអាចរក្សាទុកសិទ្ធិបុគ្គលិកបានទេ' : 'Failed to save employee permissions.');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return resourceCategories;
    const q = searchQuery.trim().toLowerCase();

    return resourceCategories
      .map(cat => {
        const catLabel = (language === 'kh' ? cat.labelKh : cat.labelEn).toLowerCase();
        const catMatches = catLabel.includes(q) || cat.labelEn.toLowerCase().includes(q) || cat.labelKh.toLowerCase().includes(q);

        const matchedChildren = cat.children.filter(c => {
          const labelKh = (c.labelKh || '').toLowerCase();
          const labelEn = (c.labelEn || '').toLowerCase();
          const descKh = (c.descKh || '').toLowerCase();
          const descEn = (c.descEn || '').toLowerCase();
          const key = (c.key || '').toLowerCase();
          return labelKh.includes(q) || labelEn.includes(q) || descKh.includes(q) || descEn.includes(q) || key.includes(q);
        });

        if (catMatches) {
          return cat;
        }

        if (matchedChildren.length > 0) {
          return {
            ...cat,
            children: matchedChildren
          };
        }

        return null;
      })
      .filter(Boolean);
  }, [searchQuery, language]);

  // Filter employees for employee select dropdown (Exclude Admin since Admin always has full access)
  const filteredEmployees = useMemo(() => {
    const nonAdminEmployees = employees.filter(emp => emp.role !== 'Admin');
    if (!empFilterQuery || !empFilterQuery.trim()) return nonAdminEmployees;
    const q = empFilterQuery.trim().toLowerCase();
    return nonAdminEmployees.filter(emp => {
      const staffId = (emp.staffId || '').toLowerCase();
      const nameEn = (emp.nameEn || '').toLowerCase();
      const nameKh = (emp.nameKh || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();
      return staffId.includes(q) || nameEn.includes(q) || nameKh.includes(q) || role.includes(q);
    });
  }, [employees, empFilterQuery]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">
            {t("permissions")}
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-khmer">
            {language === 'kh'
              ? 'កំណត់សិទ្ធិប្រើប្រាស់ប្រព័ន្ធតាមតួនាទី (Role) ឬកំណត់សិទ្ធិពិសេសសម្រាប់បុគ្គលិកម្នាក់ៗ (Employee-specific)'
              : 'Configure role-based access control (RBAC) or manage custom permissions per individual employee'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => { setActiveTab('roles'); setSuccessMsg(''); setErrorMsg(''); }}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer font-khmer ${
              activeTab === 'roles'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheckIcon className="h-4 w-4" />
            <span>{language === 'kh' ? 'សិទ្ធិតាមតួនាទី (Role)' : 'Role Permissions'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('employees'); setSuccessMsg(''); setErrorMsg(''); }}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer font-khmer ${
              activeTab === 'employees'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>{language === 'kh' ? 'សិទ្ធិតាមបុគ្គលិកម្នាក់ៗ (Individual)' : 'Employee Specific'}</span>
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300 font-khmer animate-fade-in flex items-center gap-2">
          <CheckIcon className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-300 font-khmer animate-fade-in flex items-center gap-2">
          <XMarkIcon className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ROLE PERMISSIONS (សិទ្ធិតាមតួនាទី)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls toolbar */}
          <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'kh'
                    ? 'ស្វែងរកសិទ្ធិ ឬឈ្មោះមុខងារ...'
                    : 'Search permission or module name...'
                }
                className="pl-9 w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-500 font-khmer"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={toggleExpandAll}
                className="py-2.5 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all font-khmer border border-white/10 cursor-pointer"
              >
                {isAllExpanded
                  ? (language === 'kh' ? 'បង្រួមទាំងអស់' : 'Collapse All')
                  : (language === 'kh' ? 'ពង្រីកទាំងអស់' : 'Expand All')}
              </button>
              <button
                onClick={handleSaveRolePermissions}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                    <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                  </>
                ) : (
                  <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិតាម Role' : 'Save Role Permissions'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Main Role Matrix Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                    <tr>
                      <th className="py-4 px-6 font-khmer font-bold">
                        {language === 'kh' ? 'មុខងារ / សិទ្ធិប្រើប្រាស់' : 'Feature / Resource'}
                      </th>
                      {roles.map(role => (
                        <th key={role.key} className="py-4 px-6 text-center font-khmer whitespace-nowrap font-bold">
                          {role.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-khmer">
                          {t("noData")}
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map(cat => {
                        const isExpanded = expandedGroups[cat.key];
                        const catLabel = language === 'kh' ? cat.labelKh : cat.labelEn;

                        return (
                          <React.Fragment key={cat.key}>
                            {/* Parent Category Header Row */}
                            <tr className="bg-slate-900/50 hover:bg-slate-900/80 transition-colors border-y border-white/10">
                              <td className="py-4 px-6 font-bold text-white font-khmer text-sm">
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(cat.key)}
                                  className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer bg-transparent border-none outline-none text-sm font-khmer"
                                >
                                  {isExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                                  )}
                                  <span>{catLabel}</span>
                                </button>
                              </td>
                              {roles.map(role => {
                                const isAdmin = role.key === 'Admin';
                                const checkedCount = cat.children.filter(c => getPermissionVal(role.key, c.key)).length;
                                const allChecked = checkedCount === cat.children.length;
                                const someChecked = checkedCount > 0 && checkedCount < cat.children.length;

                                return (
                                  <td key={`${role.key}-${cat.key}`} className="py-4 px-6 text-center">
                                    <label className="inline-flex items-center justify-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        disabled={isAdmin}
                                        checked={allChecked}
                                        ref={el => {
                                          if (el) el.indeterminate = someChecked;
                                        }}
                                        onChange={() => {
                                          handleGroupCheckboxChange(role.key, cat, !allChecked);
                                        }}
                                        className="w-4 h-4 text-indigo-600 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      />
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Child Rows */}
                            {isExpanded &&
                              cat.children.map(child => {
                                const childLabel = language === 'kh' ? child.labelKh : child.labelEn;
                                const childDesc = language === 'kh' ? child.descKh : child.descEn;

                                return (
                                  <tr
                                    key={child.key}
                                    className="hover:bg-white/5 transition-colors bg-slate-950/20"
                                  >
                                    <td className="py-3 px-6 pl-12 font-medium text-white text-xs">
                                      <div className="font-semibold text-white font-khmer text-[13px]">
                                        {childLabel}
                                      </div>
                                      {childDesc && (
                                        <div className="text-[11px] text-slate-400 mt-0.5 font-khmer">
                                          {childDesc} • <code className="text-[10px] text-indigo-400 font-mono">{child.key}</code>
                                        </div>
                                      )}
                                    </td>
                                    {roles.map(role => {
                                      const isChecked = getPermissionVal(role.key, child.key);
                                      const isAdmin = role.key === 'Admin';
                                      return (
                                        <td key={`${role.key}-${child.key}`} className="py-3 px-6 text-center">
                                          <label className="inline-flex items-center justify-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              disabled={isAdmin}
                                              checked={isChecked}
                                              onChange={() => handleCheckboxChange(role.key, child.key)}
                                              className="w-4 h-4 text-indigo-600 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            />
                                          </label>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="p-6 bg-slate-950/40 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-xs text-slate-400 font-khmer">
                {language === 'kh'
                  ? '💡 ចំណាំ៖ Admin មានសិទ្ធិពេញលេញលើគ្រប់មុខងារទាំងអស់ក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។'
                  : '💡 Note: Admin has full automatic permissions across all system modules.'}
              </span>
              <button
                onClick={handleSaveRolePermissions}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                    <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                  </>
                ) : (
                  <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិតាម Role' : 'Save Role Permissions'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INDIVIDUAL EMPLOYEE PERMISSIONS (សិទ្ធិតាមបុគ្គលិកម្នាក់ៗ)              */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="space-y-6 animate-fade-in">
          {/* Employee Selector Bar */}
          <div className="glass-card p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Searchable Select Employee Trigger */}
            <div className="md:col-span-2 space-y-1 relative" ref={empDropdownRef}>
              <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                {language === 'kh' ? 'ជ្រើសរើសបុគ្គលិកដើម្បីកំណត់សិទ្ធិ' : 'Select Employee to Manage Permissions'}
              </label>

              <div
                onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
                style={{ backgroundColor: '#FFFFFF', borderColor: empDropdownOpen ? '#2D60FF' : '#CBD5E1' }}
                className={`w-full py-2.5 px-4 border rounded-xl text-sm flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                  empDropdownOpen ? 'ring-2 ring-blue-500/20' : 'hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {selectedEmployee ? (
                    <>
                      {selectedEmployee.photoUrl ? (
                        <img
                          src={selectedEmployee.photoUrl}
                          alt="avatar"
                          className="h-7 w-7 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {selectedEmployee.nameEn?.[0] || 'U'}
                        </div>
                      )}
                      <span style={{ color: '#000000' }} className="truncate font-bold text-xs">
                        {selectedEmployee.nameEn?.toUpperCase() || selectedEmployee.nameKh} | {selectedEmployee.staffId} ({selectedEmployee.role})
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#64748B' }} className="text-xs font-medium font-khmer">
                      {language === 'kh' ? 'ចុចទីនេះដើម្បីជ្រើសរើសបុគ្គលិក...' : 'Click to select an employee...'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2">
                  {selectedEmployee && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployee(null);
                        setEmpEffectivePerms([]);
                      }}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 cursor-pointer bg-transparent border-none outline-none"
                      title="Clear selection"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                  {empDropdownOpen ? (
                    <ChevronUpIcon className="h-4 w-4 text-slate-600 stroke-[2.5]" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-slate-600 stroke-[2.5]" />
                  )}
                </div>
              </div>

              {/* Dropdown Menu Popup */}
              {empDropdownOpen && (
                <div
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
                  className="absolute left-0 right-0 top-full mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }} className="p-2 border-b">
                    <input
                      type="text"
                      value={empFilterQuery}
                      onChange={(e) => setEmpFilterQuery(e.target.value)}
                      placeholder={language === 'kh' ? 'វាយស្វែងរកឈ្មោះ ឬ Staff ID...' : 'Type name or staff ID...'}
                      style={{ color: '#000000', backgroundColor: '#FFFFFF', borderColor: '#2D60FF' }}
                      className="w-full py-1.5 px-3 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400 font-medium font-sans"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-100 font-sans">
                    {filteredEmployees.length === 0 ? (
                      <div style={{ color: '#64748B' }} className="py-3 px-3 text-center text-xs font-khmer">
                        {t("noData")}
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = selectedEmployee?.id === emp.id;
                        return (
                          <div
                            key={emp.id || emp.staffId}
                            onClick={() => selectEmployee(emp)}
                            style={{
                              color: isSelected ? '#FFFFFF' : '#000000',
                              backgroundColor: isSelected ? '#2D60FF' : 'transparent',
                            }}
                            className={`py-2.5 px-3 text-xs cursor-pointer transition-colors flex items-center justify-between font-semibold ${
                              isSelected ? 'font-bold' : 'hover:!bg-blue-50 hover:!text-[#2D60FF]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {emp.photoUrl ? (
                                <img src={emp.photoUrl} alt="avatar" className="h-6 w-6 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {emp.nameEn?.[0] || 'U'}
                                </div>
                              )}
                              <span className="truncate">
                                {emp.nameEn?.toUpperCase() || emp.nameKh} | {emp.staffId}
                              </span>
                            </div>

                            <span
                              style={{
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                                color: isSelected ? '#FFFFFF' : '#475569',
                              }}
                              className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shrink-0"
                            >
                              {emp.role}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper / Info */}
            <div className="text-xs text-slate-400 font-khmer md:border-l md:border-white/10 md:pl-4">
              {selectedEmployee ? (
                <div>
                  <div className="text-white font-bold">
                    {selectedEmployee.nameEn || selectedEmployee.nameKh}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {language === 'kh' ? 'តួនាទីដើម៖ ' : 'Base Role: '}
                    <span className="text-indigo-400 font-semibold">{selectedEmployee.role}</span>
                  </div>
                </div>
              ) : (
                <span>
                  {language === 'kh'
                    ? '👈 សូមជ្រើសរើសបុគ្គលិកដើម្បីមើល និងកែប្រែសិទ្ធិផ្ទាល់ខ្លួន'
                    : '👈 Select an employee above to inspect and assign custom permissions'}
                </span>
              )}
            </div>
          </div>

          {/* If No Employee Selected */}
          {!selectedEmployee ? (
            <div className="glass-card p-12 rounded-2xl text-center space-y-3">
              <UserGroupIcon className="h-12 w-12 text-indigo-400 mx-auto opacity-70" />
              <h3 className="text-base font-bold text-white font-khmer">
                {language === 'kh' ? 'មិនទាន់បានជ្រើសរើសបុគ្គលិកនៅឡើយទេ' : 'No Employee Selected'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto font-khmer">
                {language === 'kh'
                  ? 'សូមជ្រើសរើសបុគ្គលិកពីប្រអប់ខាងលើ ដើម្បីមើលសិទ្ធិបច្ចុប្បន្ន និងកំណត់សិទ្ធិពិសេសផ្ទាល់ខ្លួនសម្រាប់បុគ្គលិកនោះ។'
                  : 'Please select an employee using the dropdown above to manage customized permissions for that individual.'}
              </p>
            </div>
          ) : empPermissionsLoading ? (
            <div className="glass-card p-12 rounded-2xl text-center text-slate-400 font-khmer">
              <span className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-500 border-t-transparent inline-block mb-3"></span>
              <div>{t("loading")}</div>
            </div>
          ) : (
            <>
              {/* Employee Status Banner & Action Toolbar */}
              <div className="glass-card p-6 rounded-2xl glow-indigo space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {/* Left: Employee Info & Status Badge */}
                  <div className="flex items-center gap-4">
                    {selectedEmployee.photoUrl ? (
                      <img
                        src={selectedEmployee.photoUrl}
                        alt="emp"
                        className="h-14 w-14 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                        {selectedEmployee.nameEn?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          {selectedEmployee.nameEn || selectedEmployee.nameKh}
                        </h3>
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-lg bg-white/10 text-indigo-300">
                          {selectedEmployee.staffId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 font-khmer">
                          {language === 'kh' ? 'តួនាទី Role៖ ' : 'Role: '}
                          <strong className="text-slate-200">{selectedEmployee.role}</strong>
                        </span>
                        <span>•</span>
                        {empHasCustom ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-khmer flex items-center gap-1">
                            <SparklesIcon className="h-3 w-3" />
                            {language === 'kh' ? 'សិទ្ធិកំណត់ផ្ទាល់ខ្លួន (Customized)' : 'Customized Permissions'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-khmer">
                            {language === 'kh' ? 'អនុវត្តតាមតួនាទីដើម (Inherited)' : 'Inherited from Role'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: Web Login Toggle Switch */}
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-white/10 shadow-inner">
                    <div className="text-left">
                      <div className="text-xs font-bold text-white font-khmer flex items-center gap-1.5">
                        <GlobeAltIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>{language === 'kh' ? 'សិទ្ធិ Login Website' : 'Web Login Access'}</span>
                      </div>
                      <div className="text-[10px] font-khmer mt-0.5 font-medium">
                        {canLoginWeb ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {language === 'kh' ? 'បើកដំណើរការ (Enabled)' : 'Enabled for Web'}
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                            {language === 'kh' ? 'បានបិទ (App Mobile ប្រើធម្មតា)' : 'Disabled (Mobile only)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      disabled={saving || selectedEmployee?.role === 'Admin'}
                      onClick={handleToggleWebLogin}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                        canLoginWeb ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                      title={canLoginWeb ? 'Disable web login' : 'Enable web login'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          canLoginWeb ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {empHasCustom && (
                      <button
                        type="button"
                        onClick={handleResetToRoleDefault}
                        disabled={saving}
                        className="py-2.5 px-3.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-all border border-amber-500/30 cursor-pointer font-khmer flex items-center gap-1.5"
                        title="Reset to default role permissions"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        <span>{language === 'kh' ? 'កំណត់តាម Role ដើមវិញ' : 'Reset to Role'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSelectAllEmpPerms}
                      className="py-2.5 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer font-khmer"
                    >
                      {language === 'kh' ? 'ជ្រើសទាំងអស់' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllEmpPerms}
                      className="py-2.5 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer font-khmer"
                    >
                      {language === 'kh' ? 'ដកចេញទាំងអស់' : 'Deselect All'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEmpPermissions}
                      disabled={saving}
                      className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                          <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិបុគ្គលិកនេះ' : 'Save Employee Permissions'}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Employee Permissions Checkboxes List */}
              <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
                {resourceCategories.map((group) => {
                  const isExpanded = expandedGroups[group.key];
                  const groupLabel = language === 'kh' ? group.labelKh : group.labelEn;
                  const groupKeys = group.children.map(c => c.key);
                  const checkedCount = group.children.filter(c => empEffectivePerms.includes(c.key)).length;
                  const allChecked = checkedCount === group.children.length;
                  const someChecked = checkedCount > 0 && checkedCount < group.children.length;

                  return (
                    <div key={group.key} className="p-4 sm:p-6 space-y-4">
                      {/* Group Header */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer bg-transparent border-none outline-none text-sm sm:text-base font-khmer text-left"
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          )}
                          <span>{groupLabel}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-normal">
                            {checkedCount}/{group.children.length}
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 font-khmer cursor-pointer flex items-center gap-1.5">
                            <span>{allChecked ? (language === 'kh' ? 'ដកចេញក្រុមនេះ' : 'Deselect Group') : (language === 'kh' ? 'ជ្រើសរើសក្រុមនេះ' : 'Select Group')}</span>
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={el => {
                                if (el) el.indeterminate = someChecked;
                              }}
                              onChange={() => handleToggleEmpGroup(group, !allChecked)}
                              className="w-4 h-4 text-indigo-600 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Group Items Grid */}
                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-2 sm:pl-6 pt-2">
                          {group.children.map((child) => {
                            const isChecked = empEffectivePerms.includes(child.key);
                            const childLabel = language === 'kh' ? child.labelKh : child.labelEn;
                            const childDesc = language === 'kh' ? child.descKh : child.descEn;

                            return (
                              <div
                                key={child.key}
                                onClick={() => handleToggleEmpPermission(child.key)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                  isChecked
                                    ? 'bg-indigo-600/15 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                                    : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className={`text-xs font-bold font-khmer ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                                    {childLabel}
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-khmer leading-tight">
                                    {childDesc}
                                  </p>
                                  <code className="text-[10px] text-indigo-400/80 font-mono block">
                                    {child.key}
                                  </code>
                                </div>

                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // Handled by container click
                                  className="w-4 h-4 text-indigo-600 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 mt-0.5 shrink-0 cursor-pointer"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Save Button */}
              <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-xs text-slate-400 font-khmer">
                  {language === 'kh'
                    ? '💡 នៅពេលរក្សាទុក បុគ្គលិកនេះនឹងទទួលបានសិទ្ធិពិសេសភ្លាមៗដោយមិនបាច់រង់ចាំ Log in ឡើងវិញឡើយ។'
                    : '💡 Once saved, custom permissions for this employee take effect immediately.'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveEmpPermissions}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                      <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិបុគ្គលិក' : 'Save Employee Permissions'}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Permissions;
