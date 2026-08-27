import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const Permissions = () => {
  const { language, t } = useLanguage();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/permissions');
      setPermissions(res.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setErrorMsg(language === 'kh' ? 'មិនអាចទាញយកទិន្នន័យសិទ្ធិបានទេ' : 'Failed to load role permissions from server.');
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      const payload = permissions.filter(p => p.role !== 'Admin');

      await api.put('/permissions', { permissions: payload });

      setSuccessMsg(language === 'kh' ? 'កែប្រែសិទ្ធិបានជោគជ័យ!' : 'Permissions updated successfully!');
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
              ? 'កំណត់សិទ្ធិប្រើប្រាស់ប្រព័ន្ធសម្រាប់ Admin, HR, Manager, និង Employee'
              : 'Configure role-based access control and system permissions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleExpandAll}
            className="py-2.5 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all font-khmer border border-white/10 cursor-pointer"
          >
            {isAllExpanded
              ? (language === 'kh' ? 'បង្រួមទាំងអស់' : 'Collapse All')
              : (language === 'kh' ? 'ពង្រីកទាំងអស់' : 'Expand All')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
              </>
            ) : (
              <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិ' : 'Save Permissions'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300 font-khmer animate-fade-in">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-300 font-khmer animate-fade-in">
          {errorMsg}
        </div>
      )}

      {/* Search Filter Panel */}
      <div className="glass-card p-6 rounded-2xl flex items-center gap-3">
        <div className="relative w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'kh'
                ? 'ស្វែងរកសិទ្ធិ ឬឈ្មោះមុខងារ (ឧ. វត្តមាន, បុគ្គលិក, ច្បាប់)...'
                : 'Search permission or module name (e.g. attendance, employee, leaves)...'
            }
            className="pl-9 w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-500 font-khmer"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="py-2 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer whitespace-nowrap font-khmer"
          >
            {language === 'kh' ? 'ជម្រះ' : 'Clear'}
          </button>
        )}
      </div>

      {/* Main List Table */}
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

                        {/* Child Rows (rendered if group is expanded) */}
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

        {/* Footer actions */}
        <div className="p-6 bg-slate-950/40 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-slate-400 font-khmer">
            {language === 'kh'
              ? '💡 ចំណាំ៖ Admin មានសិទ្ធិពេញលេញលើគ្រប់មុខងារទាំងអស់ក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។'
              : '💡 Note: Admin has full automatic permissions across all system modules.'}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                <span>{language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
              </>
            ) : (
              <span>{language === 'kh' ? 'រក្សាទុកសិទ្ធិ' : 'Save Permissions'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Permissions;
