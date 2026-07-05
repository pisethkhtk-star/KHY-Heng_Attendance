import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const WorkHours = () => {
  const { t } = useLanguage();
  const [shift1Start, setShift1Start] = useState('08:00');
  const [shift1End, setShift1End] = useState('12:00');
  const [shift2Start, setShift2Start] = useState('13:00');
  const [shift2End, setShift2End] = useState('17:00');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get('/company-work-hours');
      if (res.data) {
        setShift1Start(res.data.shift1Start);
        setShift1End(res.data.shift1End);
        setShift2Start(res.data.shift2Start);
        setShift2End(res.data.shift2End);
      }
    } catch (err) {
      console.error('Error fetching work hours:', err);
      setErrorMsg('Failed to load company work hours.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkHours();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await api.post('/company-work-hours', {
        shift1Start,
        shift1End,
        shift2Start,
        shift2End,
      });
      setSuccessMsg('Company default work hours updated successfully!');
      playSound('success');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error updating work hours:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save company work hours.');
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <ClockIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-khmer">Company Work Hours</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-khmer">

          </p>
        </div>
      </div>

      {/* Messages */}
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

      {/* Main Settings Card */}
      <div className="glass-card p-6 rounded-2xl glow-indigo space-y-6">
        <h2 className="text-sm font-bold text-white border-b border-white/5 pb-2 font-khmer">
          Work Shifts Configuration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shift 1 (Morning) */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
              <h3 className="text-xs font-bold text-indigo-300 font-khmer tracking-wider uppercase">
                {t("shift1")} (Morning)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={shift1Start}
                    onChange={(e) => setShift1Start(e.target.value)}
                    required
                    className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={shift1End}
                    onChange={(e) => setShift1End(e.target.value)}
                    required
                    className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Shift 2 (Afternoon) */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
              <h3 className="text-xs font-bold text-indigo-300 font-khmer tracking-wider uppercase">
                {t("shift2")} (Afternoon)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={shift2Start}
                    onChange={(e) => setShift2Start(e.target.value)}
                    required
                    className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={shift2End}
                    onChange={(e) => setShift2End(e.target.value)}
                    required
                    className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Note info */}
          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-2.5">
            <ShieldCheckIcon className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 font-khmer leading-relaxed">
              <strong>បញ្ជាក់៖</strong> ម៉ោងការងារខាងលើនេះគឺជាតម្លៃលំនាំដើមរបស់ក្រុមហ៊ុន។ នៅពេលដែលបងបង្កើតគណនីបុគ្គលិកថ្មី វានឹងយកតម្លៃលំនាំដើមទាំងនេះទៅបំពេញឱ្យដោយស្វ័យប្រវត្ត ដើម្បីកាត់បន្ថយពេលវេលាវាយបញ្ចូល។ ប៉ុន្តែ បងក៏នៅតែអាចកែសម្រួលម៉ោងការងារដោយឡែកផ្សេងគ្នាសម្រាប់បុគ្គលិកម្នាក់ៗបានធម្មតា ទៅតាមស្ថានភាពជាក់ស្ដែង។
            </p>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 cursor-pointer transition-all border-none outline-none disabled:opacity-50 font-khmer flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkHours;
