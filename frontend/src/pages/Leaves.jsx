import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Leaves = () => {
  const { user } = useAuth();
  const { t, getLocalizedName } = useLanguage();
  const canApprove = ['Admin', 'HR', 'Manager'].includes(user.role);

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Filters State
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Request Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationType, setDurationType] = useState('Full Day');
  const [leaveType, setLeaveType] = useState('AL');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get('/leave-types');
      setLeaveTypes(res.data);
      if (res.data.length > 0) {
        setLeaveType(res.data[0].code);
      }
    } catch (err) {
      console.error('Error fetching leave types:', err);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const getLeaveTypeLabel = (code) => {
    const type = leaveTypes.find(t => t.code === code || t.nameEn === code);
    if (type) {
      return getLocalizedName(type.nameEn, type.nameKh);
    }
    if (code === 'Annual Leave') return t("annualLeave");
    if (code === 'Sick Leave') return t("sickLeave");
    if (code === 'Personal Leave') return t("personalLeave");
    return code;
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      let query = `?status=${filterStatus}&search=${search}`;

      const response = await api.get(`/leaves${query}`);
      setLeaves(response.data);
    } catch (error) {
      console.error('Error loading leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus, search]);

  const handleOpenRequestModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setDurationType('Full Day');
    if (leaveTypes.length > 0) {
      setLeaveType(leaveTypes[0].code);
    } else {
      setLeaveType('AL');
    }
    setReason('');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !leaveType || !durationType) {
      setErrorMsg('Required fields are missing');
      return;
    }

    try {
      await api.post('/leaves', {
        staffId: user.staffId, // Backend forces if Employee, otherwise uses this
        startDate,
        endDate,
        durationType,
        leaveType,
        reason
      });
      setShowModal(false);
      fetchLeaves();
    } catch (error) {
      console.error('Error submitting leave:', error);
      setErrorMsg(error.response?.data?.message || 'Error submitting leave');
    }
  };

  const handleDecision = async (id, status) => {
    try {
      await api.put(`/leaves/${id}/status`, {
        status,
        managerName: getLocalizedName(user.nameEn, user.nameKh)
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error making leave decision:', error);
      alert(error.response?.data?.message || 'Error executing action');
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("requestItem")}</h2>
          <p className="text-slate-400 text-xs mt-1">Submit requests and manage approvals</p>
        </div>
        <button
          onClick={handleOpenRequestModal}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none w-full sm:w-auto justify-center"
        >
          <PlusIcon className="h-5 w-5" />
          {t("requestLeave")}
        </button>
      </div>

      {/* Filter panel */}
      <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row gap-4">
        {/* Search */}
        {user.role !== 'Employee' && (
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        )}

        {/* Status selector */}
        <div className="w-full sm:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
          >
            <option value="" className="bg-slate-900">{t("status")} ({t("all")})</option>
            <option value="Pending" className="bg-slate-900">{t("pending")}</option>
            <option value="Approved" className="bg-slate-900">{t("approved")}</option>
            <option value="Rejected" className="bg-slate-900">{t("rejected")}</option>
          </select>
        </div>
      </div>

      {/* Leaves list table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  {user.role !== 'Employee' && <th className="py-4 px-6 font-khmer">{t("staffId")}</th>}
                  {user.role !== 'Employee' && <th className="py-4 px-6 font-khmer">{t("employees")}</th>}
                  <th className="py-4 px-6 font-khmer">{t("leaveDate")}</th>
                  <th className="py-4 px-6 font-khmer">{t("leaveType")}</th>
                  <th className="py-4 px-6 text-center font-khmer">{t("amountDays")}</th>
                  <th className="py-4 px-6 font-khmer">{t("reason")}</th>
                  <th className="py-4 px-6 font-khmer">{t("status")}</th>
                  <th className="py-4 px-6 font-khmer">{t("managerName")}</th>
                  {canApprove && <th className="py-4 px-6 text-right font-khmer">{t("actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={canApprove ? 9 : 7} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-white/5 transition-colors">
                      {user.role !== 'Employee' && <td className="py-4 px-6 font-semibold text-white">{leave.staffId}</td>}
                      {user.role !== 'Employee' && (
                        <td className="py-4 px-6">
                          <p className="font-semibold text-white">
                            {getLocalizedName(leave.employee.nameEn, leave.employee.nameKh)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {getLocalizedName(leave.employee.department.nameEn, leave.employee.department.nameKh)}
                          </p>
                        </td>
                      )}
                      <td className="py-4 px-6 font-semibold text-white">
                        {new Date(leave.leaveDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 font-khmer">
                        {getLeaveTypeLabel(leave.leaveType)}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-white">
                        {parseFloat(leave.amountDays).toFixed(1)}
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate text-slate-300">{leave.reason || '-'}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-khmer ring-1 ${leave.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                            : leave.status === 'Rejected'
                              ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                            }`}
                        >
                          {leave.status === 'Approved' ? t("approved") : leave.status === 'Rejected' ? t("rejected") : t("pending")}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-khmer text-slate-300">{leave.managerName || '-'}</td>
                      {canApprove && (
                        <td className="py-4 px-6 text-right space-x-2">
                          {leave.status === 'Pending' ? (
                            <>
                              <button
                                onClick={() => handleDecision(leave.id, 'Approved')}
                                className="inline-flex p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-colors border border-emerald-500/20 cursor-pointer"
                                title={t("approve")}
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDecision(leave.id, 'Rejected')}
                                className="inline-flex p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 rounded-lg transition-colors border border-rose-500/20 cursor-pointer"
                                title={t("reject")}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500 italic">No Action</span>
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

      {/* Submission Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 py-10">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10">
              <h3 className="font-bold text-white font-khmer">
                {t("requestLeave")}
              </h3>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    ថ្ងៃចាប់ផ្ដើម (Start Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    ថ្ងៃបញ្ចប់ (End Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  រយៈពេលក្នុងមួយថ្ងៃ (Duration Per Day) *
                </label>
                <select
                  value={durationType}
                  onChange={(e) => setDurationType(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  <option value="Full Day" className="bg-slate-900"> Full Day</option>
                  <option value="Morning" className="bg-slate-900"> Morning</option>
                  <option value="Afternoon" className="bg-slate-900"> Afternoon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("leaveType")} *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.code} className="bg-slate-900">
                      {getLocalizedName(type.nameEn, type.nameKh)}
                    </option>
                  ))}
                  {leaveTypes.length === 0 && (
                    <>
                      <option value="Annual Leave" className="bg-slate-900">{t("annualLeave")}</option>
                      <option value="Sick Leave" className="bg-slate-900">{t("sickLeave")}</option>
                      <option value="Personal Leave" className="bg-slate-900">{t("personalLeave")}</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("reason")}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the reason for request..."
                  rows={3}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none"
                >
                  {t("submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
