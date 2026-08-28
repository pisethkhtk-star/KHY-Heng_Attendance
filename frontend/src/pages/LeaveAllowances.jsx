import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { ClipboardDocumentCheckIcon, PencilSquareIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';

const LeaveAllowances = () => {
  const { t, getLocalizedName } = useLanguage();
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [limitsForm, setLimitsForm] = useState({}); // { [leaveCode]: value }
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getEmployeePhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, empRes] = await Promise.all([
        api.get('/employee-leave-limits'),
        api.get('/employees')
      ]);
      setData(res.data);
      setEmployees(empRes.data);

      // Extract unique departments for filtering
      const depts = [];
      res.data.forEach(item => {
        if (item.department && !depts.some(d => d.nameEn === item.department.nameEn)) {
          depts.push(item.department);
        }
      });
      setDepartments(depts);
    } catch (err) {
      console.error('Error fetching employee leave allowances:', err);
      setErrorMsg('Failed to load employee leave limits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleOpenEditModal = (emp) => {
    setSelectedEmployee(emp);
    const form = {};
    emp.allowances.forEach(type => {
      form[type.code] = type.hasOverride ? type.maxDays.toString() : '';
    });
    setLimitsForm(form);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleResetType = (code) => {
    setLimitsForm(prev => ({
      ...prev,
      [code]: '' // Set to empty indicates using the global limit (deletes override)
    }));
  };

  const handleSaveLimits = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const promises = Object.keys(limitsForm).map(code => {
        const val = limitsForm[code];
        return api.post('/employee-leave-limits', {
          staffId: selectedEmployee.staffId,
          leaveCode: code,
          maxDays: val === '' ? null : parseFloat(val)
        });
      });

      await Promise.all(promises);
      setSuccessMsg(`Allowances for ${getLocalizedName(selectedEmployee.nameEn, selectedEmployee.nameKh)} updated successfully!`);
      playSound('success');
      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving employee leave limits:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save leave limits overrides.');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLimits = async (emp) => {
    const name = getLocalizedName(emp.nameEn, emp.nameKh);
    const hasAnyOverride = emp.allowances.some(a => a.hasOverride);

    if (!hasAnyOverride) {
      alert(`${name} has no custom overrides to delete (already using global defaults).`);
      return;
    }

    if (!window.confirm(`Reset ALL custom leave allowances for "${name}" back to global defaults?`)) return;

    try {
      await api.delete(`/employee-leave-limits/${emp.staffId}`);
      setSuccessMsg(`All custom overrides for ${name} have been reset to global defaults.`);
      playSound('success');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error deleting leave limits:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to delete leave limits.');
      playSound('error');
    }
  };

  // Filter Logic
  const filteredData = data.filter(emp => {
    const nameMatch =
      emp.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      emp.nameKh.includes(search) ||
      emp.staffId.toLowerCase().includes(search.toLowerCase());
    const deptMatch = selectedDept === '' || emp.department?.nameEn === selectedDept;
    return nameMatch && deptMatch;
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <span className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></span>
      </div>
    );
  }

  // Get active leave types from first employee in list (if any)
  const activeLeaveTypes = data.length > 0 ? data[0].allowances : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <ClipboardDocumentCheckIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-khmer">Allowances Leave</h1>

          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-300 font-khmer animate-fade-in">
          🎉 {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-300 font-khmer animate-pulse">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Filters Area */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative col-span-2">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or staff ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/10 hover:border-white/20 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
          />
        </div>

        <div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full py-2.5 px-3.5 bg-slate-900/60 border border-white/10 hover:border-white/20 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map((dept, idx) => (
              <option key={idx} value={dept.nameEn} className="bg-slate-900">
                {getLocalizedName(dept.nameEn, dept.nameKh)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Table Card */}
      <div className="glass-card rounded-2xl overflow-hidden glow-indigo">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse glass-table">
            <thead>
              <tr className="bg-slate-950/20">
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer text-center w-16 whitespace-nowrap">
                  {t("noNumber")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer w-52">
                  Employee
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer w-40">
                  Department & Position
                </th>
                {activeLeaveTypes.map(type => (
                  <th key={type.id} className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer text-center">
                    {getLocalizedName(type.nameEn, type.nameKh)} ({type.code})
                  </th>
                ))}
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer text-center w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((emp, index) => {
                const fullEmp = employees.find(e => e.staffId === emp.staffId) || emp;
                const photo = getEmployeePhoto(fullEmp);
                const nameEn = fullEmp.nameEn || emp.nameEn;
                const nameKh = fullEmp.nameKh || emp.nameKh;
                const role = fullEmp.role || emp.role;

                return (
                  <tr key={emp.staffId} className="transition-colors hover:bg-white/5 border-b border-white/5">
                    <td className="py-4 px-6 text-center font-semibold text-slate-400 whitespace-nowrap font-mono">
                      {index + 1}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {photo ? (
                          <img
                            src={photo}
                            alt={nameEn}
                            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                            {nameEn?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div className="text-white text-sm font-semibold font-khmer">
                            {getLocalizedName(nameEn, nameKh)}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            ID: <span className="text-indigo-400 font-semibold">{emp.staffId}</span>
                            {role ? ` • ${role}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-slate-300 text-xs font-khmer">
                        {emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-khmer mt-0.5">
                        {emp.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : '-'}
                      </div>
                    </td>
                    {emp.allowances.map((type) => (
                      <td key={type.id} className="py-4 px-6 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/40 border border-white/5 font-mono text-xs">
                          <span className="text-white font-bold">{type.usedDays.toFixed(1)}</span>
                          <span className="text-slate-500">/</span>
                          <span className={`font-bold ${type.hasOverride ? 'text-indigo-400' : 'text-slate-400'}`} title={type.hasOverride ? 'Custom Override limit' : 'Global standard limit'}>
                            {type.maxDays.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    ))}
                    <td className="py-4 px-6 text-center border-none">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer border-none bg-transparent outline-none"
                          title="Edit Employee Leave Limits"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLimits(emp)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer border-none bg-transparent outline-none"
                          title="Reset all custom overrides to global defaults"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={activeLeaveTypes.length + 4} className="py-8 text-center text-slate-500 text-xs font-khmer">
                    គ្មានបុគ្គលិកត្រូវបង្ហាញទេ (No employees found).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Allowances Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 relative">
            {(() => {
              const fullSelected = employees.find(e => e.staffId === selectedEmployee.staffId) || selectedEmployee;
              const modalPhoto = getEmployeePhoto(fullSelected);
              const modalNameEn = fullSelected.nameEn || selectedEmployee.nameEn;
              const modalNameKh = fullSelected.nameKh || selectedEmployee.nameKh;

              return (
                <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
                  {modalPhoto ? (
                    <img
                      src={modalPhoto}
                      alt={modalNameEn}
                      className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/40 shadow-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-base shadow-md">
                      {modalNameEn?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-white font-khmer truncate">
                      {getLocalizedName(modalNameEn, modalNameKh)}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      ID: <span className="text-indigo-400 font-semibold">{selectedEmployee.staffId}</span>
                      {selectedEmployee.department ? ` • ${getLocalizedName(selectedEmployee.department.nameEn, selectedEmployee.department.nameKh)}` : ''}
                      {selectedEmployee.position ? ` • ${getLocalizedName(selectedEmployee.position.titleEn, selectedEmployee.position.titleKh)}` : ''}
                    </p>
                  </div>
                </div>
              );
            })()}

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-khmer animate-pulse">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveLimits} className="space-y-4">
              <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
                {selectedEmployee.allowances.map((type) => (
                  <div key={type.id} className="p-3 rounded-xl bg-slate-950/30 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-khmer">
                        {getLocalizedName(type.nameEn, type.nameKh)} ({type.code})
                      </span>
                      <span className="text-[10px] text-slate-500 font-khmer">
                        Global limit: {type.hasOverride ? 'N/A' : `${type.maxDays} days`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        placeholder="Default limit"
                        value={limitsForm[type.code] || ''}
                        onChange={(e) => setLimitsForm({
                          ...limitsForm,
                          [type.code]: e.target.value
                        })}
                        className="flex-1 py-1.5 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 outline-none transition-all font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleResetType(type.code)}
                        className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-white/15 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer outline-none bg-transparent font-khmer"
                        title="Reset to global limit settings"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 transition-all cursor-pointer outline-none bg-transparent font-khmer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 cursor-pointer transition-all border-none outline-none disabled:opacity-50 font-khmer flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveAllowances;
