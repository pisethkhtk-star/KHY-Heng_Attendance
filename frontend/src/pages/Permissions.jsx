import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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
  GlobeAltIcon,
  KeyIcon,
  BuildingOfficeIcon,
  ClockIcon,
  BoltIcon,
  CalendarDaysIcon,
  ComputerDesktopIcon,
  DocumentChartBarIcon,
  LockClosedIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

const Permissions = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();

  // Active Tab: 'roles' | 'employees'
  const [activeTab, setActiveTab] = useState('roles');

  // Role Permissions State
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All'); // 'All' | 'HR' | 'Manager' | 'Employee'
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

  const getEmpPhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  const roles = [
    { key: 'Admin', label: 'Admin 👑', descKh: 'សិទ្ធិពេញលេញលើប្រព័ន្ធទាំងអស់', descEn: 'Full system administrative access' },
    { key: 'HR', label: 'HR 💼', descKh: 'គ្រប់គ្រងបុគ្គលិក វត្តមាន និងច្បាប់', descEn: 'Manage staff, attendance & policies' },
    { key: 'Manager', label: 'Manager 👔', descKh: 'អនុម័តច្បាប់ ថែមម៉ោង និងមើលក្រុម', descEn: 'Approve leaves, overtime & reports' },
    { key: 'Employee', label: 'Employee 👤', descKh: 'កត់ត្រាវត្តមាន ស្នើសុំច្បាប់ និង OT', descEn: 'Daily check-in & self-service' }
  ];

  // Hierarchical Structured Categorization: Groups -> Pages/Modules -> Actions (Add, Edit, Delete)
  const resourceCategories = [
    {
      key: 'org_group',
      labelEn: 'Organization & Staff Management',
      labelKh: 'រចនាសម្ព័ន្ធ & គ្រប់គ្រងបុគ្គលិក',
      icon: BuildingOfficeIcon,
      modules: [
        {
          key: 'departments',
          labelEn: 'Departments Management',
          labelKh: 'ដេប៉ាតឺម៉ង់ (Departments)',
          descEn: 'Browse and view corporate departments',
          descKh: 'មើលបញ្ជីដេប៉ាតឺម៉ង់របស់ក្រុមហ៊ុន',
          actions: [
            {
              key: 'add_department',
              actionType: 'add',
              labelEn: 'Add Department',
              labelKh: 'បន្ថែមដេប៉ាតឺម៉ង់ថ្មី',
              descEn: 'Create new business department',
              descKh: 'បង្កើតដេប៉ាតឺម៉ង់ ឬផ្នែកការងារថ្មី'
            },
            {
              key: 'edit_department',
              actionType: 'edit',
              labelEn: 'Edit Department',
              labelKh: 'កែប្រែដេប៉ាតឺម៉ង់',
              descEn: 'Update department name and details',
              descKh: 'កែប្រែព័ត៌មាន និងឈ្មោះដេប៉ាតឺម៉ង់'
            },
            {
              key: 'delete_department',
              actionType: 'delete',
              labelEn: 'Delete Department',
              labelKh: 'លុបដេប៉ាតឺម៉ង់',
              descEn: 'Remove department from organization',
              descKh: 'លុបដេប៉ាតឺម៉ង់ដែលមិនដំណើរការ'
            }
          ]
        },
        {
          key: 'positions',
          labelEn: 'Positions Management',
          labelKh: 'តួនាទី និងមុខតំណែង (Positions)',
          descEn: 'Browse and view job positions',
          descKh: 'មើលបញ្ជីតួនាទី និងមុខតំណែងការងារ',
          actions: [
            {
              key: 'add_position',
              actionType: 'add',
              labelEn: 'Add Position',
              labelKh: 'បន្ថែមតួនាទីថ្មី',
              descEn: 'Create new corporate job position',
              descKh: 'បង្កើតតួនាទី ឬមុខតំណែងថ្មី'
            },
            {
              key: 'edit_position',
              actionType: 'edit',
              labelEn: 'Edit Position',
              labelKh: 'កែប្រែតួនាទី',
              descEn: 'Modify position title and department assignment',
              descKh: 'កែប្រែឈ្មោះតួនាទី និងការភ្ជាប់ដេប៉ាតឺម៉ង់'
            },
            {
              key: 'delete_position',
              actionType: 'delete',
              labelEn: 'Delete Position',
              labelKh: 'លុបតួនាទី',
              descEn: 'Remove job position record',
              descKh: 'លុបតួនាទីដែលលែងប្រើប្រាស់'
            }
          ]
        },
        {
          key: 'employees',
          labelEn: 'Employees Directory',
          labelKh: 'គ្រប់គ្រងបុគ្គលិក (Employees)',
          descEn: 'View active and resigned employees master list',
          descKh: 'មើលបញ្ជីឈ្មោះបុគ្គលិកទាំងអស់ក្នុងស្ថាប័ន',
          actions: [
            {
              key: 'add_employee',
              actionType: 'add',
              labelEn: 'Add New Employee',
              labelKh: 'បន្ថែមបុគ្គលិកថ្មី',
              descEn: 'Register new employee with face data & credentials',
              descKh: 'ចុះឈ្មោះបុគ្គលិកថ្មី និងបញ្ចូលទិន្នន័យស្កេនមុខ'
            },
            {
              key: 'edit_employee',
              actionType: 'edit',
              labelEn: 'Edit Employee Details',
              labelKh: 'កែប្រែព័ត៌មានបុគ្គលិក',
              descEn: 'Update employee profile, shift, photo & settings',
              descKh: 'កែប្រែព័ត៌មានផ្ទាល់ខ្លួន វេនការងារ និងរូបភាពបុគ្គលិក'
            },
            {
              key: 'delete_employee',
              actionType: 'delete',
              labelEn: 'Delete Employee',
              labelKh: 'លុបបុគ្គលិក',
              descEn: 'Remove employee profile from the system',
              descKh: 'លុបគណនីបុគ្គលិកចេញពីប្រព័ន្ធ'
            }
          ]
        },
        {
          key: 'work_hours',
          labelEn: 'Company Work Hours',
          labelKh: 'កំណត់ម៉ោងការងារក្រុមហ៊ុន',
          descEn: 'Set standard shift hours and flexible work schedule policy',
          descKh: 'កំណត់វេនការងារ និងម៉ោងធ្វើការប្រចាំថ្ងៃរបស់ក្រុមហ៊ុន',
          actions: []
        }
      ]
    },
    {
      key: 'attendance_group',
      labelEn: 'Attendance Logs & Shifts',
      labelKh: 'គ្រប់គ្រងវត្តមាន និងវេនការងារ',
      icon: ClockIcon,
      modules: [
        {
          key: 'attendance',
          labelEn: 'Attendance Management',
          labelKh: 'កំណត់ត្រាវត្តមាន (Attendance)',
          descEn: 'View general check-in and check-out logs',
          descKh: 'មើលកំណត់ត្រាវត្តមានស្កេនចូល-ចេញទូទៅទាំងអស់',
          actions: [
            {
              key: 'attendance_early_in',
              actionType: 'view',
              labelEn: 'Early-In Logs',
              labelKh: 'កំណត់ត្រាមកមុនម៉ោង (Early In)',
              descEn: 'View morning early check-in records',
              descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកមកមុនម៉ោងធ្វើការ'
            },
            {
              key: 'attendance_late',
              actionType: 'view',
              labelEn: 'Late Arrival Logs',
              labelKh: 'កំណត់ត្រាមកយឺត (Late)',
              descEn: 'View late arrivals, minutes late & penalty',
              descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកដែលមកយឺត'
            },
            {
              key: 'attendance_early_out',
              actionType: 'view',
              labelEn: 'Early-Out Logs',
              labelKh: 'កំណត់ត្រាចេញមុនម៉ោង (Early Out)',
              descEn: 'View early checkout departures',
              descKh: 'មើលកំណត់ត្រាវត្តមានបុគ្គលិកដែលចេញមុនម៉ោង'
            },
            {
              key: 'attendance_incomplete',
              actionType: 'view',
              labelEn: 'Incomplete Shifts Logs',
              labelKh: 'កំណត់ត្រាមិនពេញលេញ (ភ្លេចស្កេន)',
              descEn: 'View missing shift check-in or check-out scans',
              descKh: 'មើលកំណត់ត្រាវត្តមានដែលខ្វះស្កេនចូល ឬស្កេនចេញ'
            },
            {
              key: 'add_attendance',
              actionType: 'add',
              labelEn: 'Add Manual Attendance',
              labelKh: 'បន្ថែមវត្តមានដោយផ្ទាល់',
              descEn: 'Manually insert missed attendance entries',
              descKh: 'បញ្ចូលវត្តមានដែលបុគ្គលិកខកខានស្កេនដោយផ្ទាល់'
            },
            {
              key: 'edit_attendance',
              actionType: 'edit',
              labelEn: 'Edit Attendance Entry',
              labelKh: 'កែប្រែកំណត់ត្រាវត្តមាន',
              descEn: 'Modify check-in / check-out timestamps',
              descKh: 'កែប្រែម៉ោង Check-in ឬ Check-out ឱ្យត្រូវជាក់ស្ដែង'
            },
            {
              key: 'delete_attendance',
              actionType: 'delete',
              labelEn: 'Delete Attendance Entry',
              labelKh: 'លុបកំណត់ត្រាវត្តមាន',
              descEn: 'Remove invalid or duplicate attendance logs',
              descKh: 'លុបកំណត់ត្រាវត្តមានដែលស្ទួន ឬខុសបច្ចេកទេស'
            }
          ]
        }
      ]
    },
    {
      key: 'overtime_group',
      labelEn: 'Overtime Management (OT)',
      labelKh: 'គ្រប់គ្រងការថែមម៉ោង (OT)',
      icon: BoltIcon,
      modules: [
        {
          key: 'overtime',
          labelEn: 'Overtime (OT)',
          labelKh: 'ការថែមម៉ោង (Overtime)',
          descEn: 'View & request overtime hours',
          descKh: 'មើល និងស្នើសុំការថែមម៉ោង',
          actions: [
            {
              key: 'approve_overtime',
              actionType: 'approve',
              labelEn: 'Approve / Reject Overtime',
              labelKh: 'អនុម័ត ឬបដិសេធថែមម៉ោង',
              descEn: 'Review & approve team member overtime requests',
              descKh: 'ពិនិត្យ អនុម័ត ឬបដិសេធសំណើថែមម៉ោងរបស់ក្រុម'
            },
            {
              key: 'edit_overtime',
              actionType: 'edit',
              labelEn: 'Edit Overtime Records',
              labelKh: 'កែប្រែទិន្នន័យថែមម៉ោង',
              descEn: 'Modify overtime hours, date and reasons',
              descKh: 'កែសម្រួលម៉ោងថែម កាលបរិច្ឆេទ និងមូលហេតុ'
            },
            {
              key: 'delete_overtime',
              actionType: 'delete',
              labelEn: 'Delete Overtime Request',
              labelKh: 'លុបសំណើថែមម៉ោង',
              descEn: 'Remove pending overtime requests',
              descKh: 'លុបសំណើថែមម៉ោងដែលមិនត្រឹមត្រូវ'
            }
          ]
        }
      ]
    },
    {
      key: 'leaves_group',
      labelEn: 'Leaves & Approval Workflows',
      labelKh: 'គ្រប់គ្រងការសុំច្បាប់ & អនុម័ត',
      icon: CalendarDaysIcon,
      modules: [
        {
          key: 'leaves',
          labelEn: 'Leave Requests & Policies',
          labelKh: 'ច្បាប់ឈប់សម្រាក (Leaves)',
          descEn: 'Submit leave request and view leave history',
          descKh: 'ស្នើសុំច្បាប់ឈប់សម្រាក និងតាមដានស្ថានភាព',
          actions: [
            {
              key: 'approve_leaves',
              actionType: 'approve',
              labelEn: 'Approve / Reject Leaves',
              labelKh: 'អនុម័ត ឬបដិសេធច្បាប់',
              descEn: 'Process and approve team member leave requests',
              descKh: 'ពិនិត្យ និងអនុម័តពាក្យសុំច្បាប់ឈប់សម្រាក'
            },
            {
              key: 'leave_types',
              actionType: 'config',
              labelEn: 'Configure Leave Types',
              labelKh: 'កំណត់ប្រភេទច្បាប់',
              descEn: 'Manage Annual, Sick, Maternity & Special leave categories',
              descKh: 'កំណត់ប្រភេទច្បាប់ប្រចាំឆ្នាំ ឈឺ ពិសេស និងចំនួនថ្ងៃ'
            },
            {
              key: 'leave_allowances',
              actionType: 'config',
              labelEn: 'Configure Leave Allowances',
              labelKh: 'កំណត់កូតាច្បាប់បុគ្គលិក',
              descEn: 'Set customized annual leave allowances per employee',
              descKh: 'កំណត់ចំនួនថ្ងៃច្បាប់ប្រចាំឆ្នាំសម្រាប់បុគ្គលិកម្នាក់ៗ'
            }
          ]
        },
        {
          key: 'leave_approvals',
          labelEn: 'Approval Hierarchy Matrix',
          labelKh: 'រចនាសម្ព័ន្ធអ្នកអនុម័ត (Approval Matrix)',
          descEn: 'Assign and view line-manager approval chain',
          descKh: 'ចាត់តាំង និងមើលរចនាសម្ព័ន្ធអ្នកអនុម័តច្បាប់',
          actions: [
            {
              key: 'edit_leave_approvals',
              actionType: 'edit',
              labelEn: 'Edit Approval Matrix',
              labelKh: 'កែប្រែអ្នកអនុម័ត',
              descEn: 'Modify approval hierarchy rules',
              descKh: 'កែប្រែថ្នាក់អ្នកអនុម័តក្នុងរចនាសម្ព័ន្ធ'
            },
            {
              key: 'delete_leave_approvals',
              actionType: 'delete',
              labelEn: 'Delete Approval Matrix',
              labelKh: 'លុបអ្នកអនុម័ត',
              descEn: 'Remove configured approval workflows',
              descKh: 'លុបការចាត់តាំងអ្នកអនុម័តដែលលែងប្រើ'
            }
          ]
        }
      ]
    },
    {
      key: 'kiosk_group',
      labelEn: 'Branch Offices & Kiosk Terminals',
      labelKh: 'សាខាក្រុមហ៊ុន & ម៉ាស៊ីនស្កេនវត្តមាន (Kiosk)',
      icon: MapPinIcon,
      modules: [
        {
          key: 'kiosk_settings',
          labelEn: 'Branch Office Management',
          labelKh: 'សាខាក្រុមហ៊ុន (Branch Settings)',
          descEn: 'Configure office branches, GPS geofences and scan radius',
          descKh: 'គ្រប់គ្រងសាខាក្រុមហ៊ុន កំណត់ទីតាំង GPS និងកាំរង្វង់អនុញ្ញាតស្កេន',
          actions: [
            {
              key: 'add_branch',
              actionType: 'add',
              labelEn: 'Create Branch',
              labelKh: 'បន្ថែមសាខាថ្មី',
              descEn: 'Register a new office branch and GPS geofence boundary',
              descKh: 'បង្កើតសាខាថ្មី និងកំណត់កូអរដោនេទីតាំង GPS'
            },
            {
              key: 'edit_branch',
              actionType: 'edit',
              labelEn: 'Edit Branch',
              labelKh: 'កែប្រែព័ត៌មានសាខា',
              descEn: 'Update branch title, latitude, longitude and radius meters',
              descKh: 'កែប្រែឈ្មោះសាខា ទីតាំង ឬកាំរង្វង់ម៉ែត្រ'
            },
            {
              key: 'delete_branch',
              actionType: 'delete',
              labelEn: 'Delete Branch',
              labelKh: 'លុបសាខា',
              descEn: 'Remove office branch and its geofence from the system',
              descKh: 'លុបទីតាំងសាខាដែលលែងដំណើរការចេញពីប្រព័ន្ធ'
            }
          ]
        },
        {
          key: 'facescan',
          labelEn: 'Face Recognition Kiosk Terminal',
          labelKh: 'ម៉ាស៊ីនស្កេនផ្ទៃមុខ (Face Kiosk)',
          descEn: 'Open camera terminal for automatic face recognition check-in',
          descKh: 'ដំណើរការម៉ាស៊ីនស្កេនផ្ទៃមុខដើម្បីកត់ត្រាវត្តមាន',
          actions: [
            {
              key: 'qrscan',
              actionType: 'view',
              labelEn: 'QR Code Kiosk Terminal',
              labelKh: 'ម៉ាស៊ីនស្កេន QR Code',
              descEn: 'Scan employee QR badges for rapid attendance verification',
              descKh: 'ដំណើរការម៉ាស៊ីនស្កេន QR Code សម្រាប់បុគ្គលិក'
            },
            {
              key: 'scan_behalf_face',
              actionType: 'admin',
              labelEn: 'Scan Face on Behalf of Others',
              labelKh: 'ស្កេនមុខជំនួសអ្នកដទៃ',
              descEn: 'Special privilege to register/scan face for other staff',
              descKh: 'សិទ្ធិស្កេនមុខជំនួសបុគ្គលិកផ្សេងទៀតនៅពេលចាំបាច់'
            },
            {
              key: 'scan_behalf_qr',
              actionType: 'admin',
              labelEn: 'Scan QR on Behalf of Others',
              labelKh: 'ស្កេន QR ជំនួសអ្នកដទៃ',
              descEn: 'Special privilege to scan QR on behalf of other staff',
              descKh: 'សិទ្ធិស្កេន QR ជំនួសបុគ្គលិកផ្សេងទៀតនៅពេលចាំបាច់'
            }
          ]
        }
      ]
    },
    {
      key: 'reports_group',
      labelEn: 'Reports & Analytics',
      labelKh: 'របាយការណ៍ និងស្ថិតិ (Reports)',
      icon: DocumentChartBarIcon,
      modules: [
        {
          key: 'reports',
          labelEn: 'Attendance Report',
          labelKh: 'របាយការណ៍វត្តមាន (Attendance Report)',
          descEn: 'Analyze monthly attendance trends, logs and employee metrics',
          descKh: 'មើល និងទាញយករបាយការណ៍វត្តមានប្រចាំខែ និងស្ថិតិបុគ្គលិក',
          actions: [
            {
              key: 'export_reports',
              actionType: 'admin',
              labelEn: 'Export Attendance (Excel / PDF)',
              labelKh: 'ទាញយករបាយការណ៍វត្តមានជា Excel / PDF',
              descEn: 'Download attendance monthly logs to Excel / PDF',
              descKh: 'ទាញយកតារាងវត្តមានប្រចាំខែជាឯកសារ Excel ឬ PDF'
            }
          ]
        },
        {
          key: 'leave_reports',
          labelEn: 'Leave Report',
          labelKh: 'របាយការណ៍សុំច្បាប់ (Leave Report)',
          descEn: 'Review company leave requests, allowances and balance usage',
          descKh: 'ពិនិត្យមើលរបាយការណ៍ប្រើប្រាស់ច្បាប់ និងកូតាច្បាប់នៅសល់',
          actions: []
        }
      ]
    },
    {
      key: 'system_group',
      labelEn: 'System Security & Web Configuration',
      labelKh: 'កំណត់ប្រព័ន្ធ សុវត្ថិភាព & Website',
      icon: KeyIcon,
      modules: [
        {
          key: 'telegram_settings',
          labelEn: 'Telegram Alert Bot & Channels',
          labelKh: 'កំណត់ Telegram Group Alerts',
          descEn: 'Configure instant check-in/late/leave telegram broadcast notifications',
          descKh: 'កំណត់ Telegram Bot និងក្រុមទទួលសារជូនដំណឹងវត្តមាន',
          actions: []
        },
        {
          key: 'permissions',
          labelEn: 'Permissions & RBAC Configuration',
          labelKh: 'កំណត់សិទ្ធិប្រព័ន្ធ (Role & Individual)',
          descEn: 'Manage system roles, resource access and employee overrides',
          descKh: 'គ្រប់គ្រងសិទ្ធិប្រើប្រាស់តាមតួនាទី និងសិទ្ធិបុគ្គលិកម្នាក់ៗ',
          actions: []
        },
        {
          key: 'toggle_web_login',
          labelEn: 'Toggle Employee Web Login Access',
          labelKh: 'បើក/បិទសិទ្ធិ Login Website បុគ្គលិក',
          descEn: 'Grant or revoke browser website login access per individual staff',
          descKh: 'សិទ្ធិបើក ឬបិទការ Login ចូលក្នុង Website សម្រាប់បុគ្គលិក',
          actions: []
        }
      ]
    }
  ];

  // Flat list of all resource keys
  const allResources = useMemo(() => {
    const list = [];
    resourceCategories.forEach(g => {
      g.modules.forEach(m => {
        list.push(m.key);
        if (m.actions && m.actions.length > 0) {
          m.actions.forEach(a => list.push(a.key));
        }
      });
    });
    return list;
  }, []);

  const allGroupKeys = resourceCategories.map(c => c.key);
  const allModuleKeysWithActions = useMemo(() => {
    const list = [];
    resourceCategories.forEach(g => {
      g.modules.forEach(m => {
        if (m.actions && m.actions.length > 0) list.push(m.key);
      });
    });
    return list;
  }, []);

  // Expand state for groups (categories)
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const init = {};
    allGroupKeys.forEach(k => { init[k] = true; });
    return init;
  });

  // Expand state for module action dropdowns (e.g. departments, positions, employees, etc.)
  const [expandedModules, setExpandedModules] = useState(() => {
    const init = {};
    allModuleKeysWithActions.forEach(k => { init[k] = true; }); // Open by default
    return init;
  });

  const isAllGroupsExpanded = allGroupKeys.every(k => expandedGroups[k]);
  const isAllModulesExpanded = allModuleKeysWithActions.every(k => expandedModules[k]);

  const toggleExpandAll = () => {
    const nextState = !(isAllGroupsExpanded && isAllModulesExpanded);
    const newGroups = {};
    allGroupKeys.forEach(k => { newGroups[k] = nextState; });
    setExpandedGroups(newGroups);

    const newModules = {};
    allModuleKeysWithActions.forEach(k => { newModules[k] = nextState; });
    setExpandedModules(newModules);
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const toggleModuleDropdown = (moduleKey, e) => {
    if (e) e.stopPropagation();
    setExpandedModules(prev => ({
      ...prev,
      [moduleKey]: !prev[moduleKey]
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
        osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.16);
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
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
      console.error('Error fetching permissions data:', error);
      setErrorMsg(language === 'kh' ? 'មិនអាចទាញយកទិន្នន័យសិទ្ធិបានទេ' : 'Failed to load permissions from server.');
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
      console.warn('Could not fetch custom permissions, falling back to role defaults:', err);
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

  const handleUpdateEmployeeRole = async (newRole) => {
    if (!selectedEmployee) return;
    if (selectedEmployee.role === newRole) return;

    try {
      setChangingRole(true);
      const res = await api.put(`/permissions/employee/${selectedEmployee.id}/role`, {
        role: newRole
      });

      const updatedRole = res.data?.role || newRole;
      const updatedCanLoginWeb = res.data?.canLoginWeb !== undefined ? Boolean(res.data.canLoginWeb) : (updatedRole === 'Admin' || canLoginWeb);

      const updatedEmp = {
        ...selectedEmployee,
        role: updatedRole,
        canLoginWeb: updatedCanLoginWeb
      };

      setSelectedEmployee(updatedEmp);
      setCanLoginWeb(updatedCanLoginWeb);

      // Update in employees list
      setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? { ...e, role: updatedRole } : e));

      // Update base role permissions
      const roleBasePerms = permissions
        .filter(p => p.role === updatedRole && Boolean(p.canAccess))
        .map(p => p.resource);
      setEmpRolePerms(roleBasePerms);

      // If user has no custom overrides, effective permissions should automatically follow the new role
      if (!empHasCustom) {
        setEmpEffectivePerms(roleBasePerms);
      }

      setSuccessMsg(
        language === 'kh'
          ? `បានប្តូរតួនាទី (Role) របស់ ${selectedEmployee.nameEn || selectedEmployee.nameKh} ទៅជា ${updatedRole} ដោយជោគជ័យ!`
          : `Updated role for ${selectedEmployee.nameEn || selectedEmployee.nameKh} to ${updatedRole} successfully!`
      );
      playSound('success');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error updating employee role:', err);
      setErrorMsg(
        language === 'kh'
          ? 'មិនអាចកែប្រែតួនាទី (Role) បានទេ!'
          : 'Failed to update employee role.'
      );
      playSound('error');
    } finally {
      setChangingRole(false);
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

  // Group select / deselect
  const handleGroupCheckboxChange = (role, group, shouldCheck) => {
    if (role === 'Admin') return;
    const allKeys = [];
    group.modules.forEach(m => {
      allKeys.push(m.key);
      if (m.actions) m.actions.forEach(a => allKeys.push(a.key));
    });

    setPermissions(prev => {
      const updated = prev.map(p => {
        if (p.role === role && allKeys.includes(p.resource)) {
          return { ...p, canAccess: shouldCheck };
        }
        return p;
      });

      allKeys.forEach(resKey => {
        if (!updated.some(p => p.role === role && p.resource === resKey)) {
          updated.push({ role, resource: resKey, canAccess: shouldCheck });
        }
      });

      return updated;
    });
  };

  // Module select / deselect (e.g. check Department + Add + Edit + Delete in one click)
  const handleModuleCheckboxChange = (role, mod, shouldCheck) => {
    if (role === 'Admin') return;
    const modKeys = [mod.key];
    if (mod.actions) mod.actions.forEach(a => modKeys.push(a.key));

    setPermissions(prev => {
      const updated = prev.map(p => {
        if (p.role === role && modKeys.includes(p.resource)) {
          return { ...p, canAccess: shouldCheck };
        }
        return p;
      });

      modKeys.forEach(resKey => {
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

      setTimeout(() => setSuccessMsg(''), 3500);
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
    const groupKeys = [];
    group.modules.forEach(m => {
      groupKeys.push(m.key);
      if (m.actions) m.actions.forEach(a => groupKeys.push(a.key));
    });

    setEmpEffectivePerms(prev => {
      if (shouldCheck) {
        return Array.from(new Set([...prev, ...groupKeys]));
      } else {
        return prev.filter(k => !groupKeys.includes(k));
      }
    });
  };

  const handleToggleEmpModule = (mod, shouldCheck) => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    const modKeys = [mod.key];
    if (mod.actions) mod.actions.forEach(a => modKeys.push(a.key));

    setEmpEffectivePerms(prev => {
      if (shouldCheck) {
        return Array.from(new Set([...prev, ...modKeys]));
      } else {
        return prev.filter(k => !modKeys.includes(k));
      }
    });
  };

  const handleSelectAllEmpPerms = () => {
    if (!selectedEmployee) return;
    setEmpHasCustom(true);
    setEmpEffectivePerms([...allResources]);
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

  // Filter categories and nested modules based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return resourceCategories;
    const q = searchQuery.trim().toLowerCase();

    return resourceCategories
      .map(cat => {
        const catLabel = (language === 'kh' ? cat.labelKh : cat.labelEn).toLowerCase();
        const catMatches = catLabel.includes(q);

        const matchedModules = cat.modules.filter(m => {
          const mLabelKh = (m.labelKh || '').toLowerCase();
          const mLabelEn = (m.labelEn || '').toLowerCase();
          const mDescKh = (m.descKh || '').toLowerCase();
          const mDescEn = (m.descEn || '').toLowerCase();
          const mKey = (m.key || '').toLowerCase();

          const mMatches = mLabelKh.includes(q) || mLabelEn.includes(q) || mDescKh.includes(q) || mDescEn.includes(q) || mKey.includes(q);
          const hasMatchingAction = m.actions && m.actions.some(a => {
            return (a.labelKh || '').toLowerCase().includes(q) ||
                   (a.labelEn || '').toLowerCase().includes(q) ||
                   (a.key || '').toLowerCase().includes(q);
          });

          return mMatches || hasMatchingAction;
        });

        if (catMatches) return cat;
        if (matchedModules.length > 0) {
          return {
            ...cat,
            modules: matchedModules
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [searchQuery, language]);

  // Filter employees for employee select dropdown
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

  // Filter visible roles for role matrix table
  const visibleRoles = useMemo(() => {
    if (selectedRoleFilter === 'All') return roles;
    return roles.filter(r => r.key === 'Admin' || r.key === selectedRoleFilter);
  }, [selectedRoleFilter]);

  // Count employees with custom permissions
  const customEmpCount = useMemo(() => {
    return employees.filter(e => e.role !== 'Admin' && e.customPermissions && e.customPermissions.trim() !== '' && e.customPermissions !== '[]').length;
  }, [employees]);

  // Helper for badge rendering based on action type
  const getActionBadge = (type) => {
    if (type === 'add') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <PlusCircleIcon className="h-3 w-3" /> Add
        </span>
      );
    }
    if (type === 'edit') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <PencilSquareIcon className="h-3 w-3" /> Edit
        </span>
      );
    }
    if (type === 'delete') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <TrashIcon className="h-3 w-3" /> Delete
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
        Action
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans pb-12">
      {/* Top Header & Stat Banner */}
      <div className="glass-card p-6 md:p-8 rounded-3xl glow-indigo border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full pointer-events-none blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <ShieldCheckIcon className="h-4 w-4" />
              <span>{language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិសុវត្ថិភាពកម្រិតខ្ពស់' : 'Hierarchical RBAC Permission System'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white font-khmer tracking-tight">
              {t("permissions")}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-khmer max-w-2xl leading-relaxed">
              {language === 'kh'
                ? 'កំណត់ និងគ្រប់គ្រងសិទ្ធិប្រើប្រាស់ប្រព័ន្ធយ៉ាងលម្អិត ដោយបែងចែកតាមទំព័រនីមួយៗ និងមាន Dropdown បង្ហាញសិទ្ធិ Add, Edit, Delete យ៉ាងមានរបៀប។'
                : 'Configure fine-grained system access organized with collapsible dropdown actions (Add, Edit, Delete) per page and module.'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="flex-1 lg:flex-none p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 text-center min-w-[110px]">
              <div className="text-xs text-slate-400 font-khmer">{language === 'kh' ? 'សិទ្ធិសរុប' : 'Permissions'}</div>
              <div className="text-xl font-black text-indigo-400 font-mono mt-0.5">{allResources.length}</div>
            </div>
            <div className="flex-1 lg:flex-none p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 text-center min-w-[110px]">
              <div className="text-xs text-slate-400 font-khmer">{language === 'kh' ? 'ក្រុមតួនាទី' : 'Roles'}</div>
              <div className="text-xl font-black text-purple-400 font-mono mt-0.5">4</div>
            </div>
            <div className="flex-1 lg:flex-none p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 text-center min-w-[120px]">
              <div className="text-xs text-slate-400 font-khmer">{language === 'kh' ? 'សិទ្ធិពិសេស' : 'Custom Staff'}</div>
              <div className="text-xl font-black text-amber-400 font-mono mt-0.5">{customEmpCount}</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={() => { setActiveTab('roles'); setSuccessMsg(''); setErrorMsg(''); }}
            className={`flex items-center gap-2.5 py-2.5 px-5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer font-khmer border ${
              activeTab === 'roles'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-indigo-400/50 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheckIcon className="h-4 w-4" />
            <span>{language === 'kh' ? '១. សិទ្ធិតាមតួនាទី (Role Matrix)' : '1. Role Permissions Matrix'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('employees'); setSuccessMsg(''); setErrorMsg(''); }}
            className={`flex items-center gap-2.5 py-2.5 px-5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer font-khmer border ${
              activeTab === 'employees'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-indigo-400/50 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            <span>{language === 'kh' ? '២. សិទ្ធិតាមបុគ្គលិកម្នាក់ៗ (Individual Overrides)' : '2. Individual Employee Overrides'}</span>
            {customEmpCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold">
                {customEmpCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-300 font-khmer animate-fade-in flex items-center justify-between shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <span className="p-1 rounded-full bg-emerald-500/20">
              <CheckIcon className="h-4 w-4 text-emerald-400" />
            </span>
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white cursor-pointer bg-transparent border-none">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300 font-khmer animate-fade-in flex items-center justify-between shadow-lg shadow-rose-500/10">
          <div className="flex items-center gap-3">
            <span className="p-1 rounded-full bg-rose-500/20">
              <XMarkIcon className="h-4 w-4 text-rose-400" />
            </span>
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white cursor-pointer bg-transparent border-none">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ROLE PERMISSIONS MATRIX                                            */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls toolbar */}
          <div className="glass-card p-4 md:p-5 rounded-2xl border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Search filter input */}
            <div className="relative w-full lg:w-96">
              <MagnifyingGlassIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'kh'
                    ? 'ស្វែងរកសិទ្ធិ ឬឈ្មោះទំព័រ (ឧ. department, add, edit)...'
                    : 'Search permissions, pages or actions...'
                }
                className="pl-10 pr-9 w-full py-2.5 px-3 border border-white/10 bg-slate-950/70 text-white rounded-xl text-xs md:text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-500 font-khmer"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer bg-transparent border-none"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Role Filter & Actions */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
              {/* Role filter select */}
              <div className="flex items-center gap-1 p-1 bg-slate-950/70 border border-white/10 rounded-xl text-xs font-khmer">
                <span className="px-2 text-slate-400 text-[11px]">{language === 'kh' ? 'តម្រង Role:' : 'Filter:'}</span>
                {['All', 'HR', 'Manager', 'Employee'].map((rf) => (
                  <button
                    key={rf}
                    type="button"
                    onClick={() => setSelectedRoleFilter(rf)}
                    className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer border-none ${
                      selectedRoleFilter === rf
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {rf}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleExpandAll}
                className="py-2 px-3.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all font-khmer border border-white/10 cursor-pointer"
              >
                {isAllGroupsExpanded && isAllModulesExpanded
                  ? (language === 'kh' ? 'បង្រួមទាំងអស់' : 'Collapse All')
                  : (language === 'kh' ? 'ពង្រីកទាំងអស់' : 'Expand All')}
              </button>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-lg shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិតាម Role' : 'Save Role Matrix'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Role Matrix Table */}
          <div className="glass-card rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            {loading ? (
              <div className="py-20 text-center text-slate-400 font-khmer space-y-3">
                <span className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent inline-block"></span>
                <div>{t("loading")}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/90 text-xs text-slate-300 uppercase border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-4 px-6 font-khmer font-bold min-w-[340px]">
                        {language === 'kh' ? 'ទំព័រ & សកម្មភាពសិទ្ធិ (Page / Actions Dropdown)' : 'Page & Action Permissions Hierarchy'}
                      </th>
                      {visibleRoles.map(role => {
                        const isAdmin = role.key === 'Admin';
                        return (
                          <th key={role.key} className="py-4 px-6 text-center font-khmer whitespace-nowrap font-bold min-w-[130px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs px-2.5 py-0.5 rounded-lg border font-bold ${
                                isAdmin
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                  : role.key === 'HR'
                                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                                  : role.key === 'Manager'
                                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                  : 'bg-slate-500/15 border-slate-500/30 text-slate-300'
                              }`}>
                                {role.label}
                              </span>
                              {isAdmin && (
                                <span className="text-[10px] text-slate-500 lowercase flex items-center gap-0.5">
                                  <LockClosedIcon className="h-3 w-3" /> Full
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={visibleRoles.length + 1} className="py-12 text-center text-slate-400 font-khmer">
                          <div className="space-y-2">
                            <MagnifyingGlassIcon className="h-8 w-8 mx-auto text-slate-500 opacity-60" />
                            <div>{language === 'kh' ? 'រកមិនឃើញសិទ្ធិដែលត្រូវនឹងពាក្យស្វែងរកឡើយ' : 'No matching permissions found.'}</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map(cat => {
                        const isGroupExpanded = expandedGroups[cat.key];
                        const catLabel = language === 'kh' ? cat.labelKh : cat.labelEn;
                        const CategoryIcon = cat.icon || ShieldCheckIcon;

                        // Calculate total perms in this category
                        const groupAllKeys = [];
                        cat.modules.forEach(m => {
                          groupAllKeys.push(m.key);
                          if (m.actions) m.actions.forEach(a => groupAllKeys.push(a.key));
                        });

                        return (
                          <React.Fragment key={cat.key}>
                            {/* 1. Category Header Row */}
                            <tr className="bg-slate-900/80 hover:bg-slate-900 transition-colors border-t-2 border-indigo-500/30">
                              <td className="py-4 px-6 font-bold text-white font-khmer text-sm">
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(cat.key)}
                                  className="flex items-center gap-3 text-indigo-300 hover:text-indigo-200 font-bold transition-colors cursor-pointer bg-transparent border-none outline-none text-sm font-khmer text-left w-full"
                                >
                                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                                    <CategoryIcon className="h-4 w-4" />
                                  </span>
                                  <span className="flex-1 tracking-wide">{catLabel}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono font-normal">
                                    {groupAllKeys.length} perms
                                  </span>
                                  {isGroupExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                                  )}
                                </button>
                              </td>

                              {visibleRoles.map(role => {
                                const isAdmin = role.key === 'Admin';
                                const checkedCount = groupAllKeys.filter(k => getPermissionVal(role.key, k)).length;
                                const allChecked = checkedCount === groupAllKeys.length;
                                const someChecked = checkedCount > 0 && checkedCount < groupAllKeys.length;

                                return (
                                  <td key={`${role.key}-${cat.key}`} className="py-4 px-6 text-center">
                                    <div className="flex flex-col items-center gap-1">
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
                                          className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        />
                                      </label>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {checkedCount}/{groupAllKeys.length}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>

                            {/* 2. Module Rows (Pages) and Nested Action Dropdowns */}
                            {isGroupExpanded &&
                              cat.modules.map(mod => {
                                const hasActions = mod.actions && mod.actions.length > 0;
                                const isModExpanded = hasActions && expandedModules[mod.key];
                                const modLabel = language === 'kh' ? mod.labelKh : mod.labelEn;
                                const modDesc = language === 'kh' ? mod.descKh : mod.descEn;

                                return (
                                  <React.Fragment key={mod.key}>
                                    {/* Page / Module Row */}
                                    <tr className="hover:bg-white/5 transition-colors bg-slate-950/40 border-b border-white/5">
                                      <td className="py-3 px-6 pl-8 font-medium text-white text-xs">
                                        <div className="flex items-center gap-2">
                                          {hasActions ? (
                                            <button
                                              type="button"
                                              onClick={(e) => toggleModuleDropdown(mod.key, e)}
                                              className="p-1 rounded-lg hover:bg-white/10 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-none outline-none flex items-center gap-1 text-[11px] font-khmer font-bold"
                                              title={isModExpanded ? 'Collapse Actions' : 'Expand Actions (Add, Edit, Delete)'}
                                            >
                                              {isModExpanded ? (
                                                <ChevronDownIcon className="h-3.5 w-3.5" />
                                              ) : (
                                                <ChevronRightIcon className="h-3.5 w-3.5" />
                                              )}
                                              <span className="text-white font-semibold text-[13px] font-khmer">
                                                {modLabel}
                                              </span>
                                              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-normal">
                                                {mod.actions.length} actions ▼
                                              </span>
                                            </button>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <span className="w-4 h-4 inline-block"></span>
                                              <span className="font-semibold text-white font-khmer text-[13px]">
                                                {modLabel}
                                              </span>
                                            </div>
                                          )}

                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                                            {mod.key}
                                          </span>
                                        </div>

                                        {modDesc && (
                                          <div className="text-[11px] text-slate-400 mt-0.5 pl-6 font-khmer leading-tight">
                                            {modDesc}
                                          </div>
                                        )}
                                      </td>

                                      {/* Main Module Checkbox */}
                                      {visibleRoles.map(role => {
                                        const isChecked = getPermissionVal(role.key, mod.key);
                                        const isAdmin = role.key === 'Admin';
                                        return (
                                          <td key={`${role.key}-${mod.key}`} className="py-3 px-6 text-center">
                                            <label className="inline-flex items-center justify-center cursor-pointer">
                                              <input
                                                type="checkbox"
                                                disabled={isAdmin}
                                                checked={isChecked}
                                                onChange={() => handleCheckboxChange(role.key, mod.key)}
                                                className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                              />
                                            </label>
                                          </td>
                                        );
                                      })}
                                    </tr>

                                    {/* 3. Nested Action Dropdown Rows (Add, Edit, Delete, etc.) */}
                                    {hasActions && isModExpanded &&
                                      mod.actions.map((act) => {
                                        const actLabel = language === 'kh' ? act.labelKh : act.labelEn;
                                        const actDesc = language === 'kh' ? act.descKh : act.descEn;

                                        return (
                                          <tr
                                            key={act.key}
                                            className="hover:bg-indigo-500/5 transition-colors bg-slate-950/70 border-l-4 border-l-indigo-500/40"
                                          >
                                            <td className="py-2.5 px-6 pl-16 font-medium text-slate-200 text-xs">
                                              <div className="flex items-center gap-2">
                                                <span className="text-slate-500 font-mono select-none">↳</span>
                                                {getActionBadge(act.actionType)}
                                                <span className="font-semibold text-white font-khmer text-xs">
                                                  {actLabel}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                                                  {act.key}
                                                </span>
                                              </div>
                                              {actDesc && (
                                                <div className="text-[11px] text-slate-400 pl-6 mt-0.5 font-khmer">
                                                  {actDesc}
                                                </div>
                                              )}
                                            </td>

                                            {/* Action Checkbox for each visible role */}
                                            {visibleRoles.map(role => {
                                              const isChecked = getPermissionVal(role.key, act.key);
                                              const isAdmin = role.key === 'Admin';
                                              return (
                                                <td key={`${role.key}-${act.key}`} className="py-2.5 px-6 text-center">
                                                  <label className="inline-flex items-center justify-center cursor-pointer">
                                                    <input
                                                      type="checkbox"
                                                      disabled={isAdmin}
                                                      checked={isChecked}
                                                      onChange={() => handleCheckboxChange(role.key, act.key)}
                                                      className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            <div className="p-6 bg-slate-950/60 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs text-slate-400 font-khmer flex items-center gap-1.5">
                <LockClosedIcon className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  {language === 'kh'
                    ? 'Admin មានសិទ្ធិពេញលេញលើគ្រប់មុខងារទាំងអស់ក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ (Locked Full Access)'
                    : 'Admin maintains full automatic privileges over all modules (Locked full access).'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-lg shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិតាម Role' : 'Save Role Permissions'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INDIVIDUAL EMPLOYEE OVERRIDES                                      */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="space-y-6 animate-fade-in">
          {/* Employee Selector Header Card */}
          <div className="glass-card p-6 rounded-3xl border border-white/10 relative" ref={empDropdownRef}>
            <label className="block text-xs font-bold text-indigo-400 uppercase font-khmer mb-2 flex items-center gap-1.5">
              <UserIcon className="h-4 w-4" />
              <span>{language === 'kh' ? 'ជ្រើសរើសបុគ្គលិកដើម្បីពិនិត្យ និងកំណត់សិទ្ធិផ្ទាល់ខ្លួន' : 'Select Employee to Configure Custom Permissions'}</span>
            </label>

            {/* Custom Themed Select Trigger */}
            <div
              onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
              className={`w-full py-3 px-4 rounded-2xl border bg-slate-950/70 flex items-center justify-between cursor-pointer transition-all shadow-inner ${
                empDropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/15 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {selectedEmployee ? (
                  <>
                    {getEmpPhoto(selectedEmployee) ? (
                      <img
                        src={getEmpPhoto(selectedEmployee)}
                        alt="avatar"
                        className="h-9 w-9 rounded-full object-cover border-2 border-indigo-500/40 shrink-0 shadow"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow">
                        {selectedEmployee.nameEn?.[0] || 'U'}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{selectedEmployee.nameEn || selectedEmployee.nameKh}</span>
                        <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-indigo-300 font-semibold">
                          {selectedEmployee.staffId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-khmer">
                        {selectedEmployee.role} • {selectedEmployee.department?.nameEn || selectedEmployee.department?.nameKh || 'Company'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-khmer">
                    <UserGroupIcon className="h-5 w-5 text-slate-500" />
                    <span>{language === 'kh' ? '👉 ចុចទីនេះដើម្បីជ្រើសរើសបុគ្គលិក...' : '👉 Click here to select an employee...'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployee(null);
                      setEmpEffectivePerms([]);
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer bg-transparent border-none outline-none transition-colors"
                    title="Clear selection"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
                {empDropdownOpen ? (
                  <ChevronUpIcon className="h-5 w-5 text-indigo-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>

            {/* Custom Dropdown Menu with Dark Glass Styling */}
            {empDropdownOpen && (
              <div className="absolute left-6 right-6 top-full mt-2 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fade-in">
                {/* Search Box */}
                <div className="p-3 border-b border-white/10 bg-slate-950/60">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={empFilterQuery}
                      onChange={(e) => setEmpFilterQuery(e.target.value)}
                      placeholder={language === 'kh' ? 'វាយស្វែងរកឈ្មោះ ឬ Staff ID...' : 'Type employee name or staff ID...'}
                      className="w-full pl-9 pr-3 py-2 border border-white/10 bg-slate-900 text-white rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-medium font-sans placeholder:text-slate-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Employee Items List */}
                <div className="max-h-64 overflow-y-auto py-1 divide-y divide-white/5 font-sans">
                  {filteredEmployees.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-khmer">
                      {t("noData")}
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = selectedEmployee?.id === emp.id;
                      const hasCustom = emp.customPermissions && emp.customPermissions.trim() !== '' && emp.customPermissions !== '[]';

                      return (
                        <div
                          key={emp.id || emp.staffId}
                          onClick={() => selectEmployee(emp)}
                          className={`py-3 px-4 text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            {getEmpPhoto(emp) ? (
                              <img src={getEmpPhoto(emp)} alt="avatar" className="h-8 w-8 rounded-full object-cover shrink-0 border border-white/10" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.nameEn?.[0] || 'U'}
                              </div>
                            )}
                            <div className="truncate">
                              <div className="font-semibold text-sm">
                                {emp.nameEn || emp.nameKh}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                ID: <span className="text-indigo-400">{emp.staffId}</span> • {emp.role}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasCustom && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-khmer">
                                {language === 'kh' ? 'សិទ្ធិពិសេស' : 'Custom'}
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold">
                              {emp.role}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* If No Employee Selected */}
          {!selectedEmployee ? (
            <div className="glass-card p-16 rounded-3xl text-center space-y-4 border border-white/10">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <UserGroupIcon className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-white font-khmer">
                {language === 'kh' ? 'មិនទាន់បានជ្រើសរើសបុគ្គលិកនៅឡើយទេ' : 'No Employee Selected'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto font-khmer leading-relaxed">
                {language === 'kh'
                  ? 'សូមចុចជ្រើសរើសបុគ្គលិកពីប្រអប់ខាងលើ ដើម្បីមើលសិទ្ធិបច្ចុប្បន្ន កំណត់សិទ្ធិ Login Website និងកែប្រែសិទ្ធិពិសេសផ្ទាល់ខ្លួនសម្រាប់បុគ្គលិកនោះ។'
                  : 'Please pick an employee from the dropdown above to view their effective permissions, configure web access, and set custom overrides.'}
              </p>
            </div>
          ) : empPermissionsLoading ? (
            <div className="glass-card p-16 rounded-3xl text-center text-slate-400 font-khmer space-y-3 border border-white/10">
              <span className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent inline-block"></span>
              <div>{t("loading")}</div>
            </div>
          ) : (
            <>
              {/* Employee Overview Card with Web Login Toggle */}
              <div className="glass-card p-6 md:p-8 rounded-3xl glow-indigo border border-white/10 space-y-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  {/* Left: Employee Info */}
                  <div className="flex items-center gap-4">
                    {getEmpPhoto(selectedEmployee) ? (
                      <img
                        src={getEmpPhoto(selectedEmployee)}
                        alt="emp"
                        className="h-16 w-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-xl"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-xl">
                        {selectedEmployee.nameEn?.[0] || 'U'}
                      </div>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-lg md:text-xl font-bold text-white">
                          {selectedEmployee.nameEn}
                        </h2>
                        {selectedEmployee.nameKh && (
                          <span className="text-sm font-semibold text-slate-300 font-khmer">
                            ({selectedEmployee.nameKh})
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {selectedEmployee.staffId}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-slate-400 font-khmer">
                          {language === 'kh' ? 'តួនាទីដើម៖ ' : 'Role: '}
                          <strong className="text-white font-bold">{selectedEmployee.role}</strong>
                        </span>
                        <span>•</span>
                        {empHasCustom ? (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-khmer flex items-center gap-1.5">
                            <SparklesIcon className="h-3.5 w-3.5" />
                            <span>{language === 'kh' ? 'សិទ្ធិកំណត់ផ្ទាល់ខ្លួន (Customized)' : 'Custom Overrides'}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-khmer flex items-center gap-1.5">
                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                            <span>{language === 'kh' ? 'អនុវត្តតាមតួនាទីដើម (Inherited)' : 'Inherited from Role'}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-xs text-indigo-300 font-mono font-bold">
                          {empEffectivePerms.length}/{allResources.length} {language === 'kh' ? 'សិទ្ធិបានអនុញ្ញាត' : 'granted'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Role Assignment & Web Login Control Box */}
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    {/* Role Assignment Selector Box */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 shadow-inner w-full sm:w-auto justify-between">
                      <div className="text-left">
                        <div className="text-xs font-bold text-white font-khmer flex items-center gap-1.5">
                          <UserGroupIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span>{language === 'kh' ? 'កែប្រែតួនាទី (Role)' : 'Assign Role'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-khmer mt-0.5">
                          {language === 'kh' ? 'តួនាទីប្រព័ន្ធ' : 'System Role'}
                        </div>
                      </div>

                      <div className="relative">
                        <select
                          value={selectedEmployee.role || 'Employee'}
                          disabled={changingRole || (user?.staffId && selectedEmployee.staffId === user.staffId)}
                          onChange={(e) => handleUpdateEmployeeRole(e.target.value)}
                          className="py-1.5 px-3 pr-8 rounded-xl border border-white/10 bg-slate-900 text-white text-xs font-bold font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer disabled:opacity-50 appearance-none shadow-sm hover:border-indigo-500/40"
                          title={selectedEmployee.staffId === user?.staffId ? 'Cannot change own role' : 'Select role'}
                        >
                          <option value="Employee">Employee</option>
                          <option value="Manager">Manager</option>
                          <option value="HR">HR</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Web Login Control Box */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/70 border border-white/10 shadow-inner w-full sm:w-auto justify-between">
                      <div className="text-left">
                        <div className="text-xs font-bold text-white font-khmer flex items-center gap-2">
                          <GlobeAltIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span>{language === 'kh' ? 'សិទ្ធិ Login Website' : 'Web Login Access'}</span>
                        </div>
                        <div className="text-[11px] font-khmer mt-0.5">
                          {canLoginWeb ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              {language === 'kh' ? 'បើកដំណើរការ (Can Login Web)' : 'Enabled for Web'}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                              {language === 'kh' ? 'បានបិទ (App Mobile ប្រើធម្មតា)' : 'Disabled (Mobile only)'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        disabled={saving || selectedEmployee?.role === 'Admin'}
                        onClick={handleToggleWebLogin}
                        className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                          canLoginWeb ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                        title={canLoginWeb ? 'Disable web login' : 'Enable web login'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            canLoginWeb ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toolbar for employee actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    {empHasCustom && (
                      <button
                        type="button"
                        onClick={handleResetToRoleDefault}
                        disabled={saving}
                        className="py-2 px-3.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl transition-all border border-amber-500/30 cursor-pointer font-khmer flex items-center gap-1.5 shadow-sm"
                        title="Reset permissions to base role defaults"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        <span>{language === 'kh' ? 'កំណត់តាម Role ដើមវិញ' : 'Reset to Role Defaults'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSelectAllEmpPerms}
                      className="py-2 px-3.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer font-khmer"
                    >
                      {language === 'kh' ? 'ជ្រើសទាំងអស់' : 'Select All'}
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllEmpPerms}
                      className="py-2 px-3.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer font-khmer"
                    >
                      {language === 'kh' ? 'ដកចេញទាំងអស់' : 'Deselect All'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveEmpPermissions}
                    disabled={saving}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-lg shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                        <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4" />
                        <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិបុគ្គលិកនេះ' : 'Save Employee Permissions'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Granular Permission Modules & Dropdowns */}
              <div className="glass-card rounded-3xl overflow-hidden divide-y divide-white/10 border border-white/10 shadow-2xl">
                {resourceCategories.map((group) => {
                  const isGroupExpanded = expandedGroups[group.key];
                  const groupLabel = language === 'kh' ? group.labelKh : group.labelEn;
                  const CategoryIcon = group.icon || ShieldCheckIcon;

                  // Group all keys
                  const groupKeys = [];
                  group.modules.forEach(m => {
                    groupKeys.push(m.key);
                    if (m.actions) m.actions.forEach(a => groupKeys.push(a.key));
                  });

                  const checkedCount = groupKeys.filter(c => empEffectivePerms.includes(c)).length;
                  const allChecked = checkedCount === groupKeys.length;
                  const someChecked = checkedCount > 0 && checkedCount < groupKeys.length;

                  return (
                    <div key={group.key} className="p-5 md:p-6 space-y-4">
                      {/* Group Header */}
                      <div className="flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex items-center gap-3 text-indigo-300 hover:text-indigo-200 font-bold transition-colors cursor-pointer bg-transparent border-none outline-none text-sm md:text-base font-khmer text-left"
                        >
                          <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                            <CategoryIcon className="h-5 w-5" />
                          </span>
                          <span>{groupLabel}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                            allChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : checkedCount > 0
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-white/5 text-slate-400'
                          }`}>
                            {checkedCount}/{groupKeys.length}
                          </span>
                          {isGroupExpanded ? (
                            <ChevronDownIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                          )}
                        </button>

                        <label className="text-xs text-slate-300 font-khmer cursor-pointer flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-950/60 border border-white/10 hover:border-white/20 transition-all">
                          <span>{allChecked ? (language === 'kh' ? 'ដកចេញទាំងអស់' : 'Deselect Group') : (language === 'kh' ? 'ជ្រើសទាំងអស់' : 'Select Group')}</span>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => {
                              if (el) el.indeterminate = someChecked;
                            }}
                            onChange={() => handleToggleEmpGroup(group, !allChecked)}
                            className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Group Content: Page/Module Cards */}
                      {isGroupExpanded && (
                        <div className="space-y-4 pt-2">
                          {group.modules.map((mod) => {
                            const hasActions = mod.actions && mod.actions.length > 0;
                            const isModExpanded = hasActions && expandedModules[mod.key];
                            const isMainChecked = empEffectivePerms.includes(mod.key);
                            const modLabel = language === 'kh' ? mod.labelKh : mod.labelEn;
                            const modDesc = language === 'kh' ? mod.descKh : mod.descEn;

                            // Mod actions checked
                            const actCheckedCount = hasActions
                              ? mod.actions.filter(a => empEffectivePerms.includes(a.key)).length
                              : 0;

                            return (
                              <div
                                key={mod.key}
                                className="p-4 md:p-5 rounded-2xl bg-slate-950/50 border border-white/10 space-y-3"
                              >
                                {/* Main Module Line */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div
                                    onClick={() => handleToggleEmpPermission(mod.key)}
                                    className="flex items-start gap-3 cursor-pointer flex-1"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isMainChecked}
                                      onChange={() => {}} // Handled by container click
                                      className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 mt-1 cursor-pointer"
                                    />
                                    <div>
                                      <div className={`text-sm font-bold font-khmer ${isMainChecked ? 'text-white' : 'text-slate-300'}`}>
                                        {modLabel}
                                      </div>
                                      <div className="text-xs text-slate-400 font-khmer mt-0.5 leading-relaxed">
                                        {modDesc} • <code className="text-[10px] text-indigo-400 font-mono">{mod.key}</code>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Dropdown Toggle Button for Actions if present */}
                                  {hasActions && (
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => toggleModuleDropdown(mod.key, e)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-khmer transition-all cursor-pointer ${
                                          isModExpanded
                                            ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                        }`}
                                      >
                                        <span>{language === 'kh' ? 'សកម្មភាព' : 'Actions'}</span>
                                        <span className="text-[11px] font-mono px-1.5 rounded-full bg-white/10">
                                          {actCheckedCount}/{mod.actions.length}
                                        </span>
                                        {isModExpanded ? (
                                          <ChevronUpIcon className="h-3.5 w-3.5" />
                                        ) : (
                                          <ChevronDownIcon className="h-3.5 w-3.5" />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleEmpModule(mod, actCheckedCount < mod.actions.length)}
                                        className="text-[11px] text-slate-400 hover:text-indigo-300 font-khmer underline cursor-pointer bg-transparent border-none"
                                      >
                                        {actCheckedCount === mod.actions.length ? (language === 'kh' ? 'ដកចេញសកម្មភាព' : 'Clear') : (language === 'kh' ? 'ជ្រើសរើសទាំងអស់' : 'All')}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Nested Action Dropdown Cards */}
                                {hasActions && isModExpanded && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-white/5 pl-2 sm:pl-7">
                                    {mod.actions.map((act) => {
                                      const isActChecked = empEffectivePerms.includes(act.key);
                                      const actLabel = language === 'kh' ? act.labelKh : act.labelEn;
                                      const actDesc = language === 'kh' ? act.descKh : act.descEn;

                                      return (
                                        <div
                                          key={act.key}
                                          onClick={() => handleToggleEmpPermission(act.key)}
                                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                                            isActChecked
                                              ? 'bg-indigo-600/15 border-indigo-500/40 shadow-sm'
                                              : 'bg-slate-900/40 border-white/5 hover:border-white/20'
                                          }`}
                                        >
                                          <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              {getActionBadge(act.actionType)}
                                              <span className={`text-xs font-bold font-khmer ${isActChecked ? 'text-white' : 'text-slate-300'}`}>
                                                {actLabel}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-khmer leading-tight">
                                              {actDesc}
                                            </div>
                                            <code className="text-[10px] text-indigo-400/80 font-mono block">
                                              {act.key}
                                            </code>
                                          </div>

                                          <input
                                            type="checkbox"
                                            checked={isActChecked}
                                            onChange={() => {}} // Handled by container click
                                            className="w-4 h-4 text-indigo-600 border border-white/20 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 mt-0.5 shrink-0 cursor-pointer"
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
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Save Action Bar */}
              <div className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
                <span className="text-xs text-slate-400 font-khmer">
                  {language === 'kh'
                    ? '💡 នៅពេលរក្សាទុក សិទ្ធិថ្មីនឹងអនុវត្តភ្លាមៗលើបុគ្គលិកនេះដោយស្វ័យប្រវត្តិ។'
                    : '💡 Once saved, permission changes take effect immediately for this employee.'}
                </span>

                <button
                  type="button"
                  onClick={handleSaveEmpPermissions}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-7 py-3 rounded-2xl font-bold text-xs md:text-sm transition-all shadow-xl shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50 w-full sm:w-auto justify-center"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4" />
                      <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិបុគ្គលិកនេះ' : 'Save Employee Permissions'}</span>
                    </>
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
