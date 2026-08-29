import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, TrashIcon, ShieldCheckIcon, PencilIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const ApprovalManage = () => {
  const { t, getLocalizedName, language } = useLanguage();
  const { hasPermission } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'table' or 'tree'
  const [viewMode, setViewMode] = useState('table');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Pagination (10 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
    const active = employees.filter(e => e.status !== 'Inactive' && e.status !== 'Resigned' && e.status !== 'Terminated');
    setApproverId(active.length > 0 ? active[0].staffId : (employees.length > 0 ? employees[0].staffId : ''));
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
    if (staffId === approverId) {
      setErrorMsg('បុគ្គលិកមិនអាចធ្វើជាអ្នកអនុម័ត (Approver) ឱ្យខ្លួនឯងបានទេ (An approver cannot approve themselves)');
      playSound('error');
      return;
    }
    const assigned = assignedApproversMap.get(staffId);
    if (assigned && !isEditMode) {
      setErrorMsg(`បុគ្គលិកនេះមានអ្នកអនុម័តរួចហើយ (${assigned.approverName})! បុគ្គលិកម្នាក់មាន approver តែម្នាក់ប៉ុណ្ណោះ`);
      playSound('error');
      return;
    }

    if (isEditMode) {
      setTargetStaffIds([staffId]);
    } else {
      setTargetStaffIds(prev =>
        prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
      );
    }
  };

  const toggleSelectAll = () => {
    const selectable = filteredEmpList
      .filter(e => !assignedApproversMap.has(e.staffId) && e.staffId !== approverId)
      .map(e => e.staffId);

    const allSelected = selectable.length > 0 && selectable.every(id => targetStaffIds.includes(id));
    if (allSelected) {
      setTargetStaffIds(prev => prev.filter(id => !selectable.includes(id)));
    } else {
      setTargetStaffIds(prev => [...new Set([...prev, ...selectable])]);
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

    // Business Rule: One employee can only have ONE approver
    if (scope === 'Employee') {
      const conflict = targetStaffIds.find(id => assignedApproversMap.has(id));
      if (conflict) {
        const assigned = assignedApproversMap.get(conflict);
        setErrorMsg(`បុគ្គលិក ID ${conflict} មាន Approver រួចហើយ (${assigned.approverName})! បុគ្គលិកម្នាក់មាន approver តែម្នាក់ប៉ុណ្ណោះ`);
        playSound('error');
        return;
      }
      if (targetStaffIds.includes(approverId)) {
        setErrorMsg('បុគ្គលិកមិនអាចធ្វើជាអ្នកអនុម័តឱ្យខ្លួនឯងបានទេ (Approver cannot approve themselves)');
        playSound('error');
        return;
      }
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

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Pagination for rules table (shows next page if data > 10)
  const totalPages = Math.ceil(filteredRules.length / pageSize) || 1;
  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, currentPage, pageSize]);

  const getPaginationItems = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta) ||
        (currentPage <= 4 && i <= 5) ||
        (currentPage >= totalPages - 3 && i >= totalPages - 4)
      ) {
        range.push(i);
      }
    }

    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);
    for (let i of uniqueRange) {
      if (l) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  const getEmployeePhoto = (emp) => {
    if (!emp) return '';
    if (emp.photoUrl) return emp.photoUrl;
    if (Array.isArray(emp.faceData) && emp.faceData[0]?.photoUrl) return emp.faceData[0].photoUrl;
    if (emp.faceData?.photoUrl) return emp.faceData.photoUrl;
    return '';
  };

  const activeEmployees = employees.filter(e => e.status !== 'Inactive' && e.status !== 'Resigned' && e.status !== 'Terminated');
  const approverList = activeEmployees.length > 0 ? activeEmployees : employees;
  const filteredEmpList = (activeEmployees.length > 0 ? activeEmployees : employees).filter(e =>
    `${e.nameEn} ${e.nameKh} ${e.staffId}`.toLowerCase().includes(empSearch.toLowerCase())
  );

  // Map of employees who already have an approver assigned
  const assignedApproversMap = useMemo(() => {
    const map = new Map();
    rules.forEach(r => {
      if (r.scope === 'Employee' && r.targetStaffId && r.id !== editRuleId) {
        const approverEmp = employees.find(e => e.staffId === r.approverId) || r.approver;
        const approverName = approverEmp ? getLocalizedName(approverEmp.nameEn, approverEmp.nameKh) : r.approverId;
        map.set(r.targetStaffId, {
          approverId: r.approverId,
          approverName,
          ruleId: r.id
        });
      }
    });
    return map;
  }, [rules, employees, editRuleId, getLocalizedName]);

  // Build recursive Approval Hierarchy Tree from rules
  const approvalTreeData = useMemo(() => {
    if (rules.length === 0) return [];

    const getEmpInfo = (staffId) => {
      const emp = employees.find(e => e.staffId === staffId);
      if (!emp) return { staffId, name: staffId, role: 'Staff', department: '', position: '', photoUrl: '' };
      return {
        staffId: emp.staffId,
        name: getLocalizedName(emp.nameEn, emp.nameKh) || emp.staffId,
        role: emp.role || 'Staff',
        department: emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : (emp.departmentName || ''),
        position: emp.position ? getLocalizedName(emp.position.titleEn, emp.position.titleKh) : (emp.positionName || ''),
        photoUrl: getEmployeePhoto(emp),
      };
    };

    const allApproverIds = [...new Set(rules.map(r => r.approverId).filter(Boolean))];
    const allTargetStaffIds = new Set(rules.filter(r => r.scope === 'Employee').map(r => r.targetStaffId));

    // Root approvers: approvers who are not targets of any other approver
    let rootIds = allApproverIds.filter(id => !allTargetStaffIds.has(id));
    if (rootIds.length === 0) {
      rootIds = allApproverIds;
    }

    const buildNode = (staffId, visited = new Set()) => {
      if (visited.has(staffId)) return null;
      const nextVisited = new Set(visited).add(staffId);

      const empInfo = getEmpInfo(staffId);
      const myRules = rules.filter(r => r.approverId === staffId);

      const children = [];

      // 1. Direct Employee targets
      myRules.filter(r => r.scope === 'Employee').forEach(r => {
        const targetId = r.targetStaffId;
        if (targetId && targetId !== staffId) {
          if (allApproverIds.includes(targetId)) {
            const childTree = buildNode(targetId, nextVisited);
            if (childTree) children.push(childTree);
          } else {
            children.push({
              ...getEmpInfo(targetId),
              isLeaf: true,
              children: [],
            });
          }
        }
      });

      // 2. Department targets
      myRules.filter(r => r.scope === 'Department').forEach(r => {
        const dept = r.targetDept || departments.find(d => String(d.id) === String(r.targetDeptId));
        const deptName = dept ? getLocalizedName(dept.nameEn, dept.nameKh) : 'Department';
        const deptEmps = employees.filter(e => {
          if (e.status === 'Inactive' || e.status === 'Resigned' || e.status === 'Terminated') return false;
          if (e.staffId === staffId) return false;
          return String(e.departmentId) === String(r.targetDeptId) ||
                 String(e.department?.id) === String(r.targetDeptId) ||
                 (e.department?.nameEn && dept?.nameEn && e.department.nameEn === dept.nameEn);
        });

        children.push({
          isDepartment: true,
          deptId: r.targetDeptId,
          name: deptName,
          children: deptEmps.map(emp => ({
            ...getEmpInfo(emp.staffId),
            isLeaf: true,
            children: [],
          })),
        });
      });

      return {
        ...empInfo,
        children,
      };
    };

    return rootIds.map(id => buildNode(id)).filter(Boolean);
  }, [rules, employees, departments, getLocalizedName]);

  const renderTreeNode = (node, path = '0') => {
    if (!node) return null;

    const isMatch = search && (
      node.name?.toLowerCase().includes(search.toLowerCase()) ||
      node.staffId?.toLowerCase().includes(search.toLowerCase()) ||
      node.department?.toLowerCase().includes(search.toLowerCase()) ||
      node.position?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <li key={path} className="flex flex-col items-center">
        {node.isDepartment ? (
          <div className={`p-3 rounded-2xl border transition-all duration-300 shadow-xl flex items-center gap-3 min-w-[200px] z-10 ${
            isMatch
              ? 'bg-purple-900/90 border-purple-400 ring-2 ring-purple-400 scale-105 shadow-purple-500/30'
              : 'bg-purple-950/80 hover:bg-purple-900/70 border-purple-500/40 text-purple-200'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl shadow flex-shrink-0">
              🏢
            </div>
            <div className="text-left min-w-0">
              <span className="text-[9px] uppercase font-bold text-purple-300 font-mono tracking-wider">Group Scope</span>
              <p className="text-xs font-bold text-white font-khmer truncate">{node.name}</p>
              <span className="text-[10px] text-purple-300/80">{node.children?.length || 0} employees</span>
            </div>
          </div>
        ) : (
          <div className={`relative w-44 sm:w-48 p-3 rounded-2xl transition-all duration-300 shadow-xl flex flex-col items-center text-center cursor-pointer border z-10 ${
            isMatch
              ? 'bg-indigo-900/90 border-indigo-400 ring-2 ring-indigo-400 scale-105 shadow-indigo-500/30'
              : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700/70 hover:border-indigo-500/60'
          }`}>
            {/* Top Role Badge */}
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {node.role || 'Staff'}
            </div>

            {/* Circular Photo */}
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500/40 shadow-md mb-1.5 flex-shrink-0 bg-slate-800 flex items-center justify-center">
              {node.photoUrl ? (
                <img src={node.photoUrl} alt={node.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  {node.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>

            {/* Staff ID */}
            <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {node.staffId}
            </span>

            {/* Name */}
            <h4 className="font-bold text-white text-xs truncate max-w-full uppercase mt-0.5">
              {node.name}
            </h4>

            {/* Department */}
            <p className="text-[10px] text-slate-300 truncate max-w-full mt-0.5 font-khmer">
              {node.department || '—'}
            </p>

            {/* Position */}
            <p className="text-[10px] text-indigo-400 font-semibold truncate max-w-full mt-0.5 font-khmer">
              {node.position || node.role}
            </p>
          </div>
        )}

        {/* Children Subtree */}
        {node.children && node.children.length > 0 && (
          <ul className="flex justify-center pt-6 relative">
            {node.children.map((child, idx) => renderTreeNode(child, `${path}-${idx}`))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Embedded Tree CSS Connectors */}
      <style>{`
        .approval-tree-root > ul {
          padding-left: 0;
          margin: 0;
          display: flex;
          justify-content: center;
          gap: 24px;
        }
        .approval-tree-root ul {
          display: flex;
          justify-content: center;
          position: relative;
          padding-top: 24px;
          padding-left: 0;
          margin: 0;
          gap: 16px;
        }
        .approval-tree-root li {
          position: relative;
          padding: 24px 8px 0 8px;
          list-style-type: none;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        /* Connectors */
        .approval-tree-root li::before, .approval-tree-root li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid rgba(148, 163, 184, 0.4);
          width: 50%;
          height: 24px;
        }
        .approval-tree-root li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid rgba(148, 163, 184, 0.4);
        }
        .approval-tree-root li:only-child::after, .approval-tree-root li:only-child::before {
          display: none;
        }
        .approval-tree-root li:only-child {
          padding-top: 0;
        }
        .approval-tree-root li:first-child::before {
          border: 0 none;
        }
        .approval-tree-root li:last-child::after {
          border: 0 none;
        }
        .approval-tree-root li:last-child::before {
          border-right: 2px solid rgba(148, 163, 184, 0.4);
          border-radius: 0 8px 0 0;
        }
        .approval-tree-root li:first-child::after {
          border-radius: 8px 0 0 0;
        }
        .approval-tree-root ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid rgba(148, 163, 184, 0.4);
          width: 0;
          height: 24px;
        }
      `}</style>

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
      <div className="glass-card p-6 rounded-2xl glow-indigo flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">Approval Manage</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Tree View Toggle Button */}
          <button
            onClick={() => setViewMode(prev => prev === 'tree' ? 'table' : 'tree')}
            className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 border cursor-pointer font-khmer ${
              viewMode === 'tree'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-indigo-500/30 ring-2 ring-indigo-400/50'
                : 'bg-indigo-50 dark:bg-slate-900 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-800 hover:text-indigo-900 dark:hover:text-white shadow-sm'
            }`}
            title={viewMode === 'tree' ? 'Switch to Table View' : 'Switch to Tree View'}
          >
            {viewMode === 'tree' ? (
              <>
                <TableCellsIcon className="h-4 w-4 text-white" />
                <span>{language === 'kh' ? 'ទម្រង់តារាង (Table)' : 'Table View'}</span>
              </>
            ) : (
              <>
                <svg className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                <span className="font-bold tracking-wide">{language === 'kh' ? 'ទម្រង់ Tree (Tree View)' : 'Tree View'}</span>
              </>
            )}
          </button>

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
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row gap-4">
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder={viewMode === 'tree' ? 'Search in tree...' : 'Search...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pl-9 pr-4 bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            🔍
          </div>
        </div>
      </div>

      {/* View Mode: Tree View or Table View */}
      {viewMode === 'tree' ? (
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <div>
                <h3 className="text-sm font-bold text-white font-khmer">
                  {language === 'kh' ? 'រចនាសម្ព័ន្ធអនុម័ត (Approval Hierarchy Tree)' : 'Approval Hierarchy Tree'}
                </h3>
                <p className="text-xs text-slate-400 font-khmer">
                  {language === 'kh' ? 'បង្ហាញទំនាក់ទំនងរវាងអ្នកអនុម័ត និងបុគ្គលិកគោលដៅ' : 'Visual hierarchy of approvers and their designated target employees'}
                </p>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold cursor-pointer transition-colors"
                title="Zoom Out"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white font-mono cursor-pointer hover:bg-slate-900 transition-colors"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold cursor-pointer transition-colors"
                title="Zoom In"
              >
                +
              </button>
            </div>
          </div>

          {/* Tree Canvas */}
          <div className="overflow-x-auto overflow-y-auto min-h-[520px] p-6 bg-slate-950/70 rounded-xl border border-white/5 flex justify-center">
            {approvalTreeData.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-khmer flex flex-col items-center gap-2 m-auto">
                <span className="text-4xl">🌳</span>
                <span>មិនទាន់មានច្បាប់អនុម័តដើម្បីបង្កើត Tree នៅឡើយទេ</span>
              </div>
            ) : (
              <div
                className="approval-tree-root transition-transform duration-200 origin-top"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <ul>
                  {approvalTreeData.map((rootNode, idx) => renderTreeNode(rootNode, `root-${idx}`))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Rules Table */
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400 font-khmer">កំពុងទាញយកទិន្នន័យ (Loading)...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6 font-khmer whitespace-nowrap w-16 text-center">{t("noNumber")}</th>
                    <th className="py-4 px-6 font-khmer">Target</th>
                    <th className="py-4 px-6 font-khmer">Scope Type</th>
                    <th className="py-4 px-6 font-khmer">Approver</th>
                    {(hasPermission('edit_leave_approvals') || hasPermission('delete_leave_approvals')) && (
                      <th className="py-4 px-6 text-right font-khmer">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={(hasPermission('edit_leave_approvals') || hasPermission('delete_leave_approvals')) ? 5 : 4} className="py-6 text-center text-slate-500 font-khmer">
                        មិនទាន់មានច្បាប់កំណត់អ្នកអនុម័តនៅឡើយទេ
                      </td>
                    </tr>
                  ) : (
                    paginatedRules.map((rule, index) => {
                      const rowNumber = (currentPage - 1) * pageSize + index + 1;
                      const approverEmp = employees.find(e => e.staffId === rule.approverId) || rule.approver;
                      const approverNameEn = approverEmp?.nameEn || rule.approverId;
                      const approverNameKh = approverEmp?.nameKh || '';
                      const approverPhoto = getEmployeePhoto(approverEmp);
                      const approverRole = approverEmp?.role || '';
                      const approverDept = approverEmp?.department ? getLocalizedName(approverEmp.department.nameEn, approverEmp.department.nameKh) : '';
                      const approverPos = approverEmp?.position ? getLocalizedName(approverEmp.position.titleEn, approverEmp.position.titleKh) : '';

                      const targetEmp = employees.find(e => e.staffId === rule.targetStaffId) || rule.targetEmployee;
                      const targetNameEn = targetEmp?.nameEn || rule.targetStaffId;
                      const targetNameKh = targetEmp?.nameKh || '';
                      const targetPhoto = getEmployeePhoto(targetEmp);
                      const targetRole = targetEmp?.role || '';
                      const targetDept = targetEmp?.department ? getLocalizedName(targetEmp.department.nameEn, targetEmp.department.nameKh) : '';
                      const targetPos = targetEmp?.position ? getLocalizedName(targetEmp.position.titleEn, targetEmp.position.titleKh) : '';

                      return (
                        <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 px-6 text-center font-semibold text-slate-400 whitespace-nowrap font-mono">
                            {rowNumber}
                          </td>

                          {/* Target Profile */}
                          <td className="py-4 px-6">
                            {rule.scope === 'Department' ? (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg flex-shrink-0 shadow-md">
                                  🏢
                                </div>
                                <div>
                                  <p className="font-semibold text-white">
                                    {rule.targetDept ? getLocalizedName(rule.targetDept.nameEn, rule.targetDept.nameKh) : 'N/A'}
                                  </p>
                                  <p className="text-xs text-purple-300">Department Scope</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                {targetPhoto ? (
                                  <img
                                    src={targetPhoto}
                                    alt={targetNameEn}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                                    {targetNameEn?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-white">
                                    {getLocalizedName(targetNameEn, targetNameKh)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    ID: <span className="text-slate-300 font-semibold">{rule.targetStaffId}</span>
                                    {targetRole && <span> • {targetRole}</span>}
                                  </p>
                                  {(targetDept || targetPos) && (
                                    <p className="text-xs font-semibold text-indigo-400">
                                      {[targetDept, targetPos].filter(Boolean).join(' • ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Scope Type */}
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${rule.scope === 'Department'
                              ? 'bg-purple-500/10 text-purple-300 ring-purple-500/20'
                              : 'bg-indigo-500/10 text-indigo-300 ring-indigo-500/20'
                              }`}>
                              {rule.scope}
                            </span>
                          </td>

                          {/* Approver Profile */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {approverPhoto ? (
                                <img
                                  src={approverPhoto}
                                  alt={approverNameEn}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                                  {approverNameEn?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">
                                  {getLocalizedName(approverNameEn, approverNameKh)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  ID: <span className="text-indigo-400 font-semibold">{rule.approverId}</span>
                                  {approverRole && <span> • {approverRole}</span>}
                                </p>
                                {(approverDept || approverPos) && (
                                  <p className="text-xs font-semibold text-indigo-400">
                                    {[approverDept, approverPos].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </div>
                            </div>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls - only show when rules > 10 */}
          {!loading && filteredRules.length > pageSize && (
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs no-print">
              <div className="text-slate-600 dark:text-slate-400 font-khmer">
                Total : <span className="font-bold text-slate-800 dark:text-white font-mono">{filteredRules.length}</span> records
                <span className="ml-2 text-slate-400">({language === 'kh' ? `ទំព័រ ${currentPage} នៃ ${totalPages}` : `Page ${currentPage} of ${totalPages}`})</span>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 min-w-[32px] px-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer shadow-sm"
                  title="Previous Page"
                >
                  &lsaquo;
                </button>

                {getPaginationItems().map((pageItem, idx) => {
                  if (pageItem === '...') {
                    return (
                      <span key={`dots-${idx}`} className="h-8 min-w-[32px] flex items-center justify-center text-slate-400 font-mono">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = pageItem === currentPage;
                  return (
                    <button
                      key={`page-${pageItem}`}
                      type="button"
                      onClick={() => setCurrentPage(pageItem)}
                      className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white shadow-sm'
                      }`}
                    >
                      {pageItem}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 min-w-[32px] px-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer shadow-sm"
                  title="Next Page"
                >
                  &rsaquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">Select Approver</label>
                  <select
                    value={approverId}
                    onChange={(e) => setApproverId(e.target.value)}
                    className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    {approverList.map(m => (
                      <option key={m.staffId} value={m.staffId} className="bg-slate-900">
                        {getLocalizedName(m.nameEn, m.nameKh)} ({m.role || 'Employee'} - ID: {m.staffId})
                      </option>
                    ))}
                  </select>

                  {/* Selected Approver Profile Card Preview */}
                  {(() => {
                    const selManager = approverList.find(m => m.staffId === approverId) || employees.find(m => m.staffId === approverId);
                    if (!selManager) return null;
                    const mgrPhoto = getEmployeePhoto(selManager);
                    return (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
                        {mgrPhoto ? (
                          <img
                            src={mgrPhoto}
                            alt={selManager.nameEn}
                            className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 flex-shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-sm">
                            {selManager.nameEn?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">
                            {getLocalizedName(selManager.nameEn, selManager.nameKh)}
                          </p>
                          <p className="text-[10px] text-indigo-400 truncate">
                            {selManager.role} • ID: {selManager.staffId}
                            {selManager.department ? ` • ${getLocalizedName(selManager.department.nameEn, selManager.department.nameKh)}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
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
                      <span>Personal Employee</span>
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
                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${
                          filteredEmpList.filter(e => !assignedApproversMap.has(e.staffId) && e.staffId !== approverId).length > 0 &&
                          filteredEmpList.filter(e => !assignedApproversMap.has(e.staffId) && e.staffId !== approverId).every(e => targetStaffIds.includes(e.staffId))
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-500'
                        }`}>
                          {filteredEmpList.filter(e => !assignedApproversMap.has(e.staffId) && e.staffId !== approverId).length > 0 &&
                            filteredEmpList.filter(e => !assignedApproversMap.has(e.staffId) && e.staffId !== approverId).every(e => targetStaffIds.includes(e.staffId)) && (
                              <span className="text-white text-[10px] font-bold">✓</span>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-slate-300 font-khmer">Select All (បុគ្គលិកមិនទាន់មាន Approver)</span>
                      </div>
                    )}

                    {/* Scrollable employee list */}
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5 bg-slate-950/60">
                      {filteredEmpList.length === 0 ? (
                        <div className="py-4 text-center text-slate-500 text-xs font-khmer">រកមិនឃើញបុគ្គលិក</div>
                      ) : (
                        filteredEmpList.map(emp => {
                          const isApproverThemself = emp.staffId === approverId;
                          const assigned = assignedApproversMap.get(emp.staffId);
                          const isDisabled = !isEditMode && (assigned || isApproverThemself);
                          const selected = targetStaffIds.includes(emp.staffId);
                          const empPhoto = getEmployeePhoto(emp);

                          return (
                            <div
                              key={emp.staffId}
                              onClick={() => !isDisabled && toggleEmployeeSelection(emp.staffId)}
                              className={`flex items-center justify-between px-3 py-2.5 transition-colors ${
                                isDisabled
                                  ? 'opacity-50 cursor-not-allowed bg-slate-950/40'
                                  : selected
                                  ? 'bg-indigo-500/15 cursor-pointer'
                                  : 'hover:bg-white/5 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                                  selected
                                    ? 'border-indigo-500 bg-indigo-500'
                                    : isDisabled
                                    ? 'border-slate-700 bg-slate-800'
                                    : 'border-slate-500'
                                }`}>
                                  {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                                </div>
                                {/* Profile Avatar */}
                                {empPhoto ? (
                                  <img
                                    src={empPhoto}
                                    alt={emp.nameEn}
                                    className="w-8 h-8 rounded-full object-cover border border-indigo-500/30 flex-shrink-0 shadow-sm"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-sm">
                                    {emp.nameEn?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className={`text-xs font-semibold truncate ${
                                    isDisabled ? 'text-slate-400' : selected ? 'text-indigo-300' : 'text-white'
                                  }`}>
                                    {getLocalizedName(emp.nameEn, emp.nameKh)}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    ID: {emp.staffId} • {emp.department ? getLocalizedName(emp.department.nameEn, emp.department.nameKh) : ''}
                                  </p>
                                </div>
                              </div>

                              {/* Status Badges */}
                              {isApproverThemself && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono flex-shrink-0">
                                  Approver Self
                                </span>
                              )}
                              {assigned && !isApproverThemself && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-khmer flex-shrink-0 flex items-center gap-1">
                                  🔒 Approver: {assigned.approverName}
                                </span>
                              )}
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
