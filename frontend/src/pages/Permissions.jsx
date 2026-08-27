import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const Permissions = () => {
  const { t } = useLanguage();
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

  // Structured Categorization of All Permissions in the System
  const resourceCategories = [
    {
      key: 'org_group',
      label: 'Organization & Employees (រចនាសម្ព័ន្ធ & គ្រប់គ្រងបុគ្គលិក)',
      children: [
        { key: 'departments', label: 'Departments (គ្រប់គ្រងដេប៉ាតឺម៉ង់)', desc: 'View and manage departments' },
        { key: 'positions', label: 'Positions (គ្រប់គ្រងតួនាទី)', desc: 'View and manage positions' },
        { key: 'employees', label: 'View Employee Directory (មើលបញ្ជីបុគ្គលិក)', desc: 'View active and resigned employees' },
        { key: 'add_employee', label: 'Add New Employee (បន្ថែមបុគ្គលិកថ្មី)', desc: 'Register new employee with face data' },
        { key: 'edit_employee', label: 'Edit Employee (កែប្រែព័ត៌មានបុគ្គលិក)', desc: 'Update employee profile & settings' },
        { key: 'delete_employee', label: 'Delete Employee (លុបបុគ្គលិក)', desc: 'Remove employee profile from system' },
        { key: 'work_hours', label: 'Company Work Hours (កំណត់ម៉ោងការងារក្រុមហ៊ុន)', desc: 'Set daily shift schedules & working hours' }
      ]
    },
    {
      key: 'attendance_group',
      label: 'Attendance Management (គ្រប់គ្រងវត្តមាន)',
      children: [
        { key: 'attendance', label: 'All Attendance Logs (កំណត់ត្រាវត្តមានទាំងអស់)', desc: 'View comprehensive check-in logs' },
        { key: 'attendance_early_in', label: 'Early-In Logs (កំណត់ត្រាមកមុនម៉ោង)', desc: 'View early morning check-ins' },
        { key: 'attendance_late', label: 'Late Arrival Logs (កំណត់ត្រាមកយឺត)', desc: 'View late arrival records & penalty' },
        { key: 'attendance_early_out', label: 'Early-Out Logs (កំណត់ត្រាចេញមុនម៉ោង)', desc: 'View early checkout departures' },
        { key: 'add_attendance', label: 'Add Manual Attendance (បន្ថែមវត្តមានដោយផ្ទាល់)', desc: 'Manually insert missed attendance log' },
        { key: 'edit_attendance', label: 'Edit Attendance Log (កែប្រែកំណត់ត្រាវត្តមាន)', desc: 'Modify check-in / check-out timestamps' },
        { key: 'delete_attendance', label: 'Delete Attendance Log (លុបកំណត់ត្រាវត្តមាន)', desc: 'Remove attendance record' }
      ]
    },
    {
      key: 'overtime_group',
      label: 'Overtime Management (គ្រប់គ្រងថែមម៉ោង OT)',
      children: [
        { key: 'overtime', label: 'View & Request Overtime (មើល និងស្នើសុំថែមម៉ោង)', desc: 'Submit and view overtime requests' },
        { key: 'approve_overtime', label: 'Approve / Reject Overtime (អនុម័ត ឬបដិសេធថែមម៉ោង)', desc: 'Review team overtime requests' },
        { key: 'delete_overtime', label: 'Delete Overtime Request (លុបសំណើថែមម៉ោង)', desc: 'Remove pending overtime requests' }
      ]
    },
    {
      key: 'leaves_group',
      label: 'Leaves & Approvals (គ្រប់គ្រងការសុំច្បាប់ & អនុម័ត)',
      children: [
        { key: 'leaves', label: 'View & Request Leaves (មើល និងស្នើសុំច្បាប់)', desc: 'Submit leave request and view history' },
        { key: 'approve_leaves', label: 'Approve / Reject Leaves (អនុម័ត ឬបដិសេធច្បាប់)', desc: 'Process leave requests by line manager' },
        { key: 'leave_types', label: 'Leave Types Configuration (កំណត់ប្រភេទច្បាប់)', desc: 'Manage annual, sick, special leave types' },
        { key: 'leave_allowances', label: 'Leave Allowances Configuration (កំណត់ចំនួនច្បាប់បុគ្គលិក)', desc: 'Set annual leave quota per employee' },
        { key: 'leave_approvals', label: 'Approval Workflows (គ្រប់គ្រងអ្នកអនុម័តច្បាប់)', desc: 'Assign manager approval matrix' },
        { key: 'edit_leave_approvals', label: 'Edit Approvals (កែប្រែអ្នកអនុម័ត)', desc: 'Modify approval hierarchy' },
        { key: 'delete_leave_approvals', label: 'Delete Approvals (លុបអ្នកអនុម័ត)', desc: 'Remove approval configuration' }
      ]
    },
    {
      key: 'kiosk_group',
      label: 'Kiosk, Facescan & Geofencing (ម៉ាស៊ីនស្កេន & ទីតាំង)',
      children: [
        { key: 'facescan', label: 'Facescan Kiosk Mode (ម៉ាស៊ីនស្កេនផ្ទៃមុខ)', desc: 'Face recognition check-in terminal' },
        { key: 'qrscan', label: 'QRscan Kiosk Mode (ម៉ាស៊ីនស្កេន QR Code)', desc: 'QR code scanning terminal' },
        { key: 'kiosk_settings', label: 'Branch & GPS Geofencing (កំណត់ទីតាំង និងសាខា)', desc: 'Manage company branches & GPS radius' },
        { key: 'scan_behalf_face', label: 'Scan Face on Behalf (ស្កេនផ្ទៃមុខជំនួសអ្នកដទៃ)', desc: 'Admin scan face for other staff' },
        { key: 'scan_behalf_qr', label: 'Scan QR on Behalf (ស្កេន QR ជំនួសអ្នកដទៃ)', desc: 'Admin scan QR for other staff' }
      ]
    },
    {
      key: 'system_group',
      label: 'Reports & System Settings (របាយការណ៍ & កំណត់ប្រព័ន្ធ)',
      children: [
        { key: 'reports', label: 'View Reports & Analytics (មើលរបាយការណ៍ និងស្ថិតិ)', desc: 'Generate monthly attendance reports' },
        { key: 'telegram_settings', label: 'Telegram Notifications (កំណត់ Telegram Group)', desc: 'Configure instant alert bot & channels' },
        { key: 'permissions', label: 'Role Permissions Configuration (កំណត់សិទ្ធិប្រព័ន្ធ)', desc: 'Manage access rights for system roles' }
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
      setErrorMsg('Failed to load role permissions from server.');
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

      setSuccessMsg('Permissions updated successfully! (កែប្រែសិទ្ធិបានជោគជ័យ)');
      playSound('success');

      setTimeout(() => {
        setSuccessMsg('');
      }, 3500);
    } catch (error) {
      console.error('Error saving permissions:', error);
      setErrorMsg('Failed to save permissions configuration.');
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
        const catMatches = cat.label.toLowerCase().includes(q);
        const matchedChildren = cat.children.filter(
          c => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q) || (c.desc && c.desc.toLowerCase().includes(q))
        );

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
  }, [searchQuery]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("permissions")}</h2>
          <p className="text-slate-400 text-xs mt-1">Configure role-based access control and system permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleExpandAll}
            className="py-2.5 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all font-khmer border border-white/10 cursor-pointer"
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Permissions</span>
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
            placeholder="Search permission or module name (e.g. attendance, employee, leaves)..."
            className="pl-9 w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-500 font-sans"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="py-2 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/10 cursor-pointer whitespace-nowrap"
          >
            Clear
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
                  <th className="py-4 px-6 font-khmer">Feature / Resource</th>
                  {roles.map(role => (
                    <th key={role.key} className="py-4 px-6 text-center font-khmer whitespace-nowrap">
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
                              <span>{cat.label}</span>
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
                          cat.children.map(child => (
                            <tr
                              key={child.key}
                              className="hover:bg-white/5 transition-colors bg-slate-950/20"
                            >
                              <td className="py-3 px-6 pl-12 font-medium text-white text-xs">
                                <div className="font-semibold text-white font-khmer text-[13px]">
                                  {child.label}
                                </div>
                                {child.desc && (
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {child.desc} • <code className="text-[10px] text-indigo-400 font-mono">{child.key}</code>
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
                          ))}
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
            💡 ចំណាំ៖ Admin មានសិទ្ធិពេញលេញលើគ្រប់មុខងារទាំងអស់ក្នុងប្រព័ន្ធ។
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Permissions;
