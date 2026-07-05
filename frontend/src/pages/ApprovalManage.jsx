import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, TrashIcon, ShieldCheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const ApprovalManage = () => {
  const { t, getLocalizedName } = useLanguage();
  const { hasPermission } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editRuleId, setEditRuleId] = useState(null);

  // Lookups
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [approverId, setApproverId] = useState('');
  const [scope, setScope] = useState('Employee');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetStaffIds, setTargetStaffIds] = useState([]); // multi-select
  const [empSearch, setEmpSearch] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter lists
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, empRes, deptRes] = await Promise.all([
        api.get('/leave-approvals'),
        api.get('/employees'),
        api.get('/departments')
      ]);
      setRules(rulesRes.data);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Error loading approvals data:', err);
      setErrorMsg('Failed to load approval management data.');
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

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditRuleId(null);
    const managers = employees.filter(e => ['Admin', 'HR', 'Manager'].includes(e.role));
    setApproverId(managers.length > 0 ? managers[0].staffId : '');
    setScope('Employee');
    setTargetStaffIds([]);
    setEmpSearch('');
    setTargetDeptId(departments.length > 0 ? departments[0].id : '');
    setErrorMsg('');
    setSuccessMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (rule) => {
    setIsEditMode(true);
    setEditRuleId(rule.id);
    setApproverId(rule.approverId || '');
    setScope(rule.scope || 'Employee');
    if (rule.scope === 'Department') {
      setTargetDeptId(rule.targetDeptId || (departments.length > 0 ? departments[0].id : ''));
      setTargetStaffIds([]);
    } else {
      setTargetStaffIds(rule.targetStaffId ? [rule.targetStaffId] : []);
      setTargetDeptId(departments.length > 0 ? departments[0].id : '');
    }
    setEmpSearch('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowModal(true);
  };

  const toggleEmployeeSelection = (staffId) => {
    if (isEditMode) {
      setTargetStaffIds([staffId]);
    } else {
      setTargetStaffIds(prev =>
        prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
      );
    }
  };

  const toggleSelectAll = () => {
    const visible = filteredEmpList.map(e => e.staffId);
    const allSelected = visible.every(id => targetStaffIds.includes(id));
    if (allSelected) {
      setTargetStaffIds(prev => prev.filter(id => !visible.includes(id)));
    } else {
      setTargetStaffIds(prev => [...new Set([...prev, ...visible])]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!approverId || !scope) {
      setErrorMsg('Approver and Scope are required');
      return;
    }
    if (scope === 'Department' && !targetDeptId) {
      setErrorMsg('Target Department is required');
      return;
    }
    if (scope === 'Employee' && targetStaffIds.length === 0) {
      setErrorMsg('Please select at least one target employee');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      
      let res;
      let msg;
      
      if (isEditMode) {
        res = await api.put(`/leave-approvals/${editRuleId}`, {
          approverId,
          scope,
          targetDeptId: scope === 'Department' ? targetDeptId : null,
          targetStaffId: scope === 'Employee' ? targetStaffIds[0] : null
        });
        msg = res.data?.message || 'Leave approval rule updated successfully!';
      } else {
        res = await api.post('/leave-approvals', {
          approverId,
          scope,
          targetDeptId: scope === 'Department' ? targetDeptId : null,
          targetStaffIds: scope === 'Employee' ? targetStaffIds : null
        });
        msg = res.data?.message || 'Leave approval rules created successfully!';
      }

      setSuccessMsg(msg);
      playSound('success');
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving approval rule:', err);
      setErrorMsg(err.response?.data?.message || 'Error saving approval rule');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this approval rule?')) return;
    try {
      await api.delete(`/leave-approvals/${id}`);
      setSuccessMsg('Approval rule deleted successfully!');
      playSound('success');
      fetchData();
    } catch (err) {
      console.error('Error deleting approval rule:', err);
      setErrorMsg('Failed to delete approval rule.');
      playSound('error');
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter(rule => {
    const approverName = rule.approver ? `${rule.approver.nameEn} ${rule.approver.nameKh}`.toLowerCase() : '';
    const targetName = rule.targetEmployee ? `${rule.targetEmployee.nameEn} ${rule.targetEmployee.nameKh}`.toLowerCase() : '';
    const deptName = rule.targetDept ? `${rule.targetDept.nameEn} ${rule.targetDept.nameKh}`.toLowerCase() : '';

    return approverName.includes(search.toLowerCase()) ||
      targetName.includes(search.toLowerCase()) ||
      deptName.includes(search.toLowerCase()) ||
      rule.approverId.toLowerCase().includes(search.toLowerCase()) ||
      (rule.targetStaffId && rule.targetStaffId.toLowerCase().includes(search.toLowerCase()));
  });

  const managers = employees.filter(e => ['Admin', 'HR', 'Manager'].includes(e.role));
  const filteredEmpList = employees.filter(e =>
    `${e.nameEn} ${e.nameKh} ${e.staffId}`.toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-100">
      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm text-emerald-300 font-khmer flex justify-between items-center">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-sm text-rose-300 font-khmer flex justify-between items-center">
          <span>❌ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* Header Block */}
      <div className="glass-card p-6 rounded-2xl glow-indigo flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">Approval Manage</h2>
        </div>
        {hasPermission('leave_approvals') && (
          <button
            onClick={handleOpenAddModal}
            className="py-2.5 px-5 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-md shadow-indigo-500/25 font-khmer border-none outline-none cursor-pointer flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Approver Rule</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row gap-4">
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pl-9 pr-4 bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            🔍
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">កំពុងទាញយកទិន្នន័យ (Loading)...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-4 px-6 font-khmer">Approver</th>
                  <th className="py-4 px-6 font-khmer">Scope Type</th>
                  <th className="py-4 px-6 font-khmer">Target</th>
                  {(hasPermission('edit_leave_approvals') || hasPermission('delete_leave_approvals')) && (
                    <th className="py-4 px-6 text-right font-khmer">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={(hasPermission('edit_leave_approvals') || hasPermission('delete_leave_approvals')) ? 4 : 3} className="py-6 text-center text-slate-500 font-khmer">
                      មិនទាន់មានច្បាប់កំណត់អ្នកអនុម័តនៅឡើយទេ
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-semibold text-white">
                          {rule.approver ? getLocalizedName(rule.approver.nameEn, rule.approver.nameKh) : rule.approverId}
                        </p>
                        <p className="text-xs text-indigo-400">ID: {rule.approverId}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${rule.scope === 'Department'
                          ? 'bg-purple-500/10 text-purple-300 ring-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/20'
                          }`}>
                          {rule.scope}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {rule.scope === 'Department' ? (
                          <span className="text-white font-semibold">
                            🏢 ដេប៉ាតឺម៉ង់៖ {rule.targetDept ? getLocalizedName(rule.targetDept.nameEn, rule.targetDept.nameKh) : 'N/A'}
                          </span>
                        ) : (
                          <div>
                            <p className="font-semibold text-white">
                              👤 {rule.targetEmployee ? getLocalizedName(rule.targetEmployee.nameEn, rule.targetEmployee.nameKh) : rule.targetStaffId}
                            </p>
                            <p className="text-xs text-slate-400">ID: {rule.targetStaffId}</p>
                          </div>
                        )}
                      </td>
                      {(hasPermission('edit_leave_approvals') || hasPermission('delete_leave_approvals')) && (
                        <td className="py-4 px-6 text-right space-x-2">
                          {hasPermission('edit_leave_approvals') && (
                            <button
                              onClick={() => handleOpenEditModal(rule)}
                              className="inline-flex p-2 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-xl text-indigo-400 transition-colors cursor-pointer mr-2"
                              title="Edit Rule"
                            >
                              <PencilIcon className="h-4.5 w-4.5" />
                            </button>
                          )}
                          {hasPermission('delete_leave_approvals') && (
                            <button
                              onClick={() => handleDelete(rule.id)}
                              className="inline-flex p-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 rounded-xl text-rose-400 transition-colors cursor-pointer"
                              title="Delete Rule"
                            >
                              <TrashIcon className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full rounded-2xl overflow-hidden shadow-2xl glow-indigo border border-white/10">
            <div className="p-6 border-b border-white/5 bg-slate-950/40">
              <h3 className="text-lg font-bold text-white font-khmer">
                {isEditMode ? 'Edit Approval Leave Rule' : 'Manage Approval leave'}
              </h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Select Approver */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">Select Approver</label>
                  <select
                    value={approverId}
                    onChange={(e) => setApproverId(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    {managers.map(m => (
                      <option key={m.staffId} value={m.staffId} className="bg-slate-900">
                        {getLocalizedName(m.nameEn, m.nameKh)} ({m.role} - ID: {m.staffId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope Selection */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">Scope Type</label>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={scope === 'Employee'}
                        onChange={() => setScope('Employee')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Persional Employee</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={scope === 'Department'}
                        onChange={() => setScope('Department')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Group/Department</span>
                    </label>
                  </div>
                </div>

                {/* Target depending on scope */}
                {scope === 'Employee' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">Target Employees</label>
                      <span className="text-xs text-indigo-400 font-semibold">{targetStaffIds.length} Selected</span>
                    </div>
                    {/* Search within employees */}
                    <input
                      type="text"
                      placeholder="Search Employee..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className="w-full py-1.5 px-3 bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all"
                    />
                    {/* Select All toggle */}
                    {!isEditMode && (
                      <div
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${filteredEmpList.length > 0 && filteredEmpList.every(e => targetStaffIds.includes(e.staffId))
                          ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'
                          }`}>
                          {filteredEmpList.length > 0 && filteredEmpList.every(e => targetStaffIds.includes(e.staffId)) && (
                            <span className="text-white text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-300 font-khmer">Select All</span>
                      </div>
                    )}
                    {/* Scrollable employee list */}
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5 bg-slate-950/60">
                      {filteredEmpList.length === 0 ? (
                        <div className="py-4 text-center text-slate-500 text-xs font-khmer">រកមិនឃើញបុគ្គលិក</div>
                      ) : (
                        filteredEmpList.map(emp => {
                          const selected = targetStaffIds.includes(emp.staffId);
                          return (
                            <div
                              key={emp.staffId}
                              onClick={() => toggleEmployeeSelection(emp.staffId)}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-indigo-500/15' : 'hover:bg-white/5'
                                }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'
                                }`}>
                                {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold truncate ${selected ? 'text-indigo-300' : 'text-white'}`}>
                                  {getLocalizedName(emp.nameEn, emp.nameKh)}
                                </p>
                                <p className="text-[10px] text-slate-500">ID: {emp.staffId}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">ជ្រើសរើសដេប៉ាតឺម៉ង់គោលដៅ (Target Department)</label>
                    <select
                      value={targetDeptId}
                      onChange={(e) => setTargetDeptId(e.target.value)}
                      className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                    >
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id} className="bg-slate-900">
                          {getLocalizedName(dept.nameEn, dept.nameKh)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/5 bg-slate-950/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer bg-transparent"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-4 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-khmer cursor-pointer border-none outline-none disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isEditMode ? 'Update' : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalManage;
