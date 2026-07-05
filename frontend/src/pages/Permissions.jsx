import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheckIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const Permissions = () => {
  const { t } = useLanguage();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Define structured layout variables
  const roles = ['Admin', 'HR', 'Manager', 'Employee'];

  const resourceGroups = [
    {
      key: 'departments',
      label: 'Departments (ដេប៉ាតឺម៉ង់)',
      isStandalone: true
    },
    {
      key: 'positions',
      label: 'Positions (តួនាទី)',
      isStandalone: true
    },
    {
      key: 'employees',
      label: 'Employees (បុគ្គលិក)',
      isStandalone: true
    },
    {
      key: 'attendance_group',
      label: 'Attendance Management (គ្រប់គ្រងវត្តមាន)',
      children: [
        { key: 'attendance', label: 'View Attendance Logs (មើលវត្តមាន)' },
        { key: 'add_attendance', label: 'Add Attendance Logs (បន្ថែមវត្តមាន)' },
        { key: 'edit_attendance', label: 'Edit Attendance Logs (កែប្រែវត្តមាន)' },
        { key: 'delete_attendance', label: 'Delete Attendance Logs (លុបវត្តមាន)' }
      ]
    },
    {
      key: 'leaves_group',
      label: 'Leaves Management (គ្រប់គ្រងការសុំច្បាប់)',
      children: [
        { key: 'leaves', label: 'Leaves Approval (ច្បាប់ឈប់សម្រាក)' },
        { key: 'leave_types', label: 'Leave Types Configuration (កំណត់ប្រភេទច្បាប់)' },
        { key: 'leave_allowances', label: 'Leave Allowances Configuration (កំណត់ចំនួនច្បាប់បុគ្គលិក)' }
      ]
    },
    {
      key: 'leave_approvals_group',
      label: 'Leave Approvals Management (គ្រប់គ្រងអ្នកអនុម័តច្បាប់)',
      children: [
        { key: 'leave_approvals', label: 'Leave Approvals Management (គ្រប់គ្រងអ្នកអនុម័តច្បាប់)' },
        { key: 'edit_leave_approvals', label: 'Edit Leave Approvals (កែប្រែអ្នកអនុម័តច្បាប់)' },
        { key: 'delete_leave_approvals', label: 'Delete Leave Approvals (លុបអ្នកអនុម័តច្បាប់)' }
      ]
    },
    {
      key: 'kiosk_group',
      label: 'Facescan Kiosk & Settings (ម៉ាស៊ីនស្កេនផ្ទៃមុខ & ទីតាំង)',
      children: [
        { key: 'facescan', label: 'Facescan Mode (ម៉ាស៊ីនស្កេនផ្ទៃមុខ)' },
        { key: 'qrscan', label: 'QRscan Mode (ម៉ាស៊ីនស្កេន QR Code)' },
        { key: 'kiosk_settings', label: 'Branch Settings (កំណត់ទីតាំងសាខា)' }
      ]
    },
    {
      key: 'scan_behalf_group',
      label: 'Scan on Behalf (ស្កេនជំនួសអ្នកដទៃ)',
      children: [
        { key: 'scan_behalf_face', label: 'Scan Face on Behalf (ស្កេនផ្ទៃមុខជំនួសអ្នកដទៃ)' },
        { key: 'scan_behalf_qr', label: 'Scan QR on Behalf (ស្កេន QR ជំនួសអ្នកដទៃ)' }
      ]
    },
    {
      key: 'work_hours',
      label: 'Company Work Hours (កំណត់ម៉ោងការងារក្រុមហ៊ុន)',
      isStandalone: true
    },
    {
      key: 'reports',
      label: 'Reports view (របាយការណ៍)',
      isStandalone: true
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState({
    attendance_group: false,
    leaves_group: false,
    leave_approvals_group: false,
    kiosk_group: false,
    scan_behalf_group: false
  });

  const allGroupKeys = ['attendance_group', 'leaves_group', 'leave_approvals_group', 'kiosk_group', 'scan_behalf_group'];
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

  const handleGroupCheckboxChange = (role, group, shouldCheck) => {
    if (role === 'Admin') return;
    const childKeys = group.children.map(c => c.key);
    setPermissions(prev =>
      prev.map(p => {
        if (p.role === role && childKeys.includes(p.resource)) {
          return { ...p, canAccess: shouldCheck };
        }
        return p;
      })
    );
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
    const item = permissions.find(p => p.role === role && p.resource === resource);
    return item ? item.canAccess : false;
  };

  const handleCheckboxChange = (role, resource) => {
    // Admin permissions are locked for safety
    if (role === 'Admin') return;

    setPermissions(prev =>
      prev.map(p => {
        if (p.role === role && p.resource === resource) {
          return { ...p, canAccess: !p.canAccess };
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      // Filter out admin permissions if they exist to keep them locked
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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <span className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>

          <h1 className="text-2xl font-bold tracking-tight text-white mt-2 font-khmer">
            Manage Permissions
          </h1>

        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleExpandAll}
            className="py-2 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all font-khmer border border-slate-700/50 cursor-pointer"
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
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

      {/* Permissions Matrix Glass Card */}
      <div className="glass-card rounded-2xl overflow-hidden glow-indigo">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse glass-table">
            <thead>
              <tr>
                <th className="py-4 px-6 font-khmer text-slate-400 uppercase text-xs tracking-wider">
                  Resource / Feature
                </th>
                {roles.map(role => (
                  <th key={role} className="py-4 px-6 text-center font-khmer text-slate-400 uppercase text-xs tracking-wider">
                    {role === 'Admin' ? 'Admin 👑' : role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resourceGroups.map(item => {
                if (item.isStandalone) {
                  return (
                    <tr key={item.key} className="transition-colors hover:bg-white/5">
                      <td className="py-4 px-6 font-medium text-white text-sm font-khmer border-b border-white/5">
                        {item.label}
                      </td>
                      {roles.map(role => {
                        const isChecked = getPermissionVal(role, item.key);
                        const isAdmin = role === 'Admin';
                        return (
                          <td key={`${role}-${item.key}`} className="py-4 px-6 text-center border-b border-white/5">
                            <label className="inline-flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={isAdmin}
                                checked={isChecked}
                                onChange={() => handleCheckboxChange(role, item.key)}
                                className="w-4 h-4 text-indigo-600 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                } else {
                  // It's a group
                  const isExpanded = expandedGroups[item.key];
                  return (
                    <React.Fragment key={item.key}>
                      {/* Parent Group Row */}
                      <tr className="bg-slate-900/30 border-b border-white/5">
                        <td className="py-4 px-6 font-medium border-b border-white/5">
                          <div className="flex items-center justify-between select-none">
                            <button
                              type="button"
                              onClick={() => toggleGroup(item.key)}
                              className="flex items-center text-left gap-2 text-indigo-300 hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none font-semibold text-sm font-khmer"
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-indigo-400 shrink-0" />
                              )}
                              <span>{item.label}</span>
                            </button>
                          </div>
                        </td>
                        {roles.map(role => {
                          const isAdmin = role === 'Admin';
                          const checkedCount = item.children.filter(c => getPermissionVal(role, c.key)).length;
                          const allChecked = checkedCount === item.children.length;
                          const someChecked = checkedCount > 0 && checkedCount < item.children.length;

                          return (
                            <td key={`${role}-${item.key}`} className="py-4 px-6 text-center border-b border-white/5">
                              <label className="inline-flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={isAdmin}
                                  checked={allChecked}
                                  ref={el => {
                                    if (el) el.indeterminate = someChecked;
                                  }}
                                  onChange={() => {
                                    handleGroupCheckboxChange(role, item, !allChecked);
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
                        item.children.map(child => (
                          <tr key={child.key} className="transition-colors hover:bg-white/5 bg-slate-950/20">
                            <td className="py-3 px-6 pl-12 font-normal text-slate-300 text-xs font-khmer border-b border-white/5">
                              {child.label}
                            </td>
                            {roles.map(role => {
                              const isChecked = getPermissionVal(role, child.key);
                              const isAdmin = role === 'Admin';
                              return (
                                <td key={`${role}-${child.key}`} className="py-3 px-6 text-center border-b border-white/5">
                                  <label className="inline-flex items-center justify-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={isAdmin}
                                      checked={isChecked}
                                      onChange={() => handleCheckboxChange(role, child.key)}
                                      className="w-4 h-4 text-indigo-500 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    />
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                }
              })}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="p-6 bg-slate-950/40 border-t border-white/5 flex justify-between items-center">
          <span className="text-[11px] text-slate-400 font-khmer max-w-sm leading-relaxed">

          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-2.5 px-6 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-md shadow-indigo-500/25 font-khmer border-none outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></span>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Permissions</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Permissions;
