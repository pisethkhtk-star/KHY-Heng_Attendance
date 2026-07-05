import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const Positions = () => {
  const { t, getLocalizedName } = useLanguage();
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [editId, setEditId] = useState(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleKh, setTitleKh] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const posRes = await api.get('/positions');
      setPositions(posRes.data);

      const deptRes = await api.get('/departments');
      setDepartments(deptRes.data);
    } catch (error) {
      console.error('Error fetching position data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditId(null);
    setTitleEn('');
    setTitleKh('');
    setDepartmentId(departments[0]?.id || '');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (pos) => {
    setEditId(pos.id);
    setTitleEn(pos.titleEn);
    setTitleKh(pos.titleKh);
    setDepartmentId(pos.departmentId);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titleEn || !titleKh || !departmentId) {
      setErrorMsg('Required fields are missing');
      return;
    }

    try {
      const payload = { titleEn, titleKh, departmentId };
      if (editId) {
        await api.put(`/positions/${editId}`, payload);
      } else {
        await api.post('/positions', payload);
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving position:', error);
      setErrorMsg(error.response?.data?.message || 'Error saving position');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      await api.delete(`/positions/${id}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert(error.response?.data?.message || 'Error deleting position');
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title Block */}
      <div className="flex justify-between items-center glass-card p-6 rounded-2xl glow-indigo">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("positions")}</h2>
          <p className="text-slate-400 text-xs mt-1">Manage corporate organizational positions</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          disabled={departments.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer disabled:opacity-50 cursor-pointer border-none outline-none"
        >
          <PlusIcon className="h-5 w-5" />
          {t("add")}
        </button>
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
                  <th className="py-4 px-6 font-khmer">{t("posTitleEn")}</th>
                  <th className="py-4 px-6 font-khmer">{t("posTitleKh")}</th>
                  <th className="py-4 px-6 font-khmer">{t("departments")}</th>
                  <th className="py-4 px-6 text-center font-khmer">{t("totalEmployees")}</th>
                  <th className="py-4 px-6 text-right font-khmer">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6 font-semibold text-white">{pos.titleEn}</td>
                      <td className="py-4 px-6 font-semibold text-white">{pos.titleKh}</td>
                      <td className="py-4 px-6 font-semibold text-slate-400">
                        {getLocalizedName(pos.department?.nameEn, pos.department?.nameKh)}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-white">
                        {pos._count?.employees || 0}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(pos)}
                          className="inline-flex p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pos.id)}
                          className="inline-flex p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10">
              <h3 className="font-bold text-white font-khmer">
                {editId ? t("edit") : t("add")} {t("positions")}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("posTitleEn")} *
                </label>
                <input
                  type="text"
                  required
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Software Developer"
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("posTitleKh")} *
                </label>
                <input
                  type="text"
                  required
                  value={titleKh}
                  onChange={(e) => setTitleKh(e.target.value)}
                  placeholder="ឧទាហរណ៍៖ អ្នកអភិវឌ្ឍន៍កម្មវិធី"
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                  {t("selectDept")} *
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id} className="bg-slate-900">
                      {getLocalizedName(dept.nameEn, dept.nameKh)}
                    </option>
                  ))}
                </select>
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
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Positions;
