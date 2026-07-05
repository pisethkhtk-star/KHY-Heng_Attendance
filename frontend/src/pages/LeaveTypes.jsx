import React, { useState, useEffect } from 'react';
import api from '../utils/api';

import { Cog6ToothIcon, PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const LeaveTypes = () => {

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null); // null means adding
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameKh, setNameKh] = useState('');
  const [maxDays, setMaxDays] = useState('18.0');
  const [description, setDescription] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/leave-types');
      setLeaveTypes(res.data);
    } catch (err) {
      console.error('Error fetching leave types:', err);
      setErrorMsg('Failed to load leave types from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
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
    setEditId(null);
    setCode('');
    setNameEn('');
    setNameKh('');
    setMaxDays('18.0');
    setDescription('');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (type) => {
    setEditId(type.id);
    setCode(type.code);
    setNameEn(type.nameEn);
    setNameKh(type.nameKh);
    setMaxDays(type.maxDays !== undefined ? parseFloat(type.maxDays).toFixed(1) : '18.0');
    setDescription(type.description || '');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!code.trim() || !nameEn.trim() || !nameKh.trim() || !maxDays) {
      setErrorMsg('Code, English Name, Khmer Name, and Max Days are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      code: code.trim().toUpperCase(),
      nameEn: nameEn.trim(),
      nameKh: nameKh.trim(),
      maxDays: parseFloat(maxDays),
      description: description.trim() || null
    };

    try {
      if (editId) {
        await api.put(`/leave-types/${editId}`, payload);
        setSuccessMsg('Leave type updated successfully!');
      } else {
        await api.post('/leave-types', payload);
        setSuccessMsg('Leave type created successfully!');
      }
      playSound('success');
      setShowModal(false);
      fetchLeaveTypes();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving leave type:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save leave type.');
      playSound('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave type? This might affect leaves showing this type code.')) {
      return;
    }

    setDeletingId(id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/leave-types/${id}`);
      setSuccessMsg('Leave type deleted successfully!');
      playSound('success');
      fetchLeaveTypes();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error deleting leave type:', err);
      setErrorMsg('Failed to delete leave type.');
      playSound('error');
    } finally {
      setDeletingId(null);
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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Cog6ToothIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-khmer">Leav Types</h1>

          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/20 rounded-xl cursor-pointer transition-all border-none outline-none font-khmer"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Type</span>
        </button>
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

      {/* Leave Types Matrix Card */}
      <div className="glass-card rounded-2xl overflow-hidden glow-indigo">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse glass-table">
            <thead>
              <tr className="bg-slate-950/20">
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer w-24">
                  Code
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer">
                  Khmer Name
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer">
                  English Name
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer text-center w-36">
                  Max Days
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer">
                  Description
                </th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer text-center w-28">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((type) => (
                <tr key={type.id} className="transition-colors hover:bg-white/5 border-b border-white/5">
                  <td className="py-4 px-6 font-semibold text-indigo-400 text-sm font-mono">
                    {type.code}
                  </td>
                  <td className="py-4 px-6 text-white text-sm font-khmer">
                    {type.nameKh}
                  </td>
                  <td className="py-4 px-6 text-slate-300 text-sm font-medium">
                    {type.nameEn}
                  </td>
                  <td className="py-4 px-6 text-center text-indigo-300 text-sm font-bold font-mono">
                    {parseFloat(type.maxDays).toFixed(1)} day
                  </td>
                  <td className="py-4 px-6 text-slate-400 text-xs max-w-sm truncate font-khmer">
                    {type.description || '-'}
                  </td>
                  <td className="py-4 px-6 text-center border-none">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(type)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer border-none bg-transparent outline-none"
                        title="Edit Leave Type"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(type.id)}
                        disabled={deletingId === type.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer border-none bg-transparent outline-none disabled:opacity-50"
                        title="Delete Leave Type"
                      >
                        {deletingId === type.id ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leaveTypes.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 text-xs font-khmer">
                    គ្មានទិន្នន័យប្រភេទច្បាប់ទេ (No leave types found).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-white font-khmer border-b border-white/5 pb-2 mb-4">
              {editId ? '📝 កែប្រែប្រភេទច្បាប់' : '➕ បន្ថែមប្រភេទច្បាប់ថ្មី'}
            </h3>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-khmer animate-pulse">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5 font-khmer">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ML"
                    maxLength="5"
                    disabled={!!editId} // Locked code on edit for consistency
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono uppercase font-bold disabled:opacity-50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5 font-khmer">
                    ឈ្មោះជាខ្មែរ (Khmer Name) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ឧទាហរណ៍៖ ច្បាប់លំហែកូន"
                    value={nameKh}
                    onChange={(e) => setNameKh(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5 font-khmer">
                    English Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maternity Leave"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-medium"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5 font-khmer">
                    Max Days *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.5"
                    min="0.5"
                    placeholder="18.0"
                    value={maxDays}
                    onChange={(e) => setMaxDays(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5 font-khmer">
                  សេចក្តីពណ៌នា (Description)
                </label>
                <textarea
                  placeholder="លក្ខខណ្ឌ ឬសេចក្ដីលម្អិត..."
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/5">
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
                    <span>Save</span>
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

export default LeaveTypes;
