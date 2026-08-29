import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { ClockIcon, ShieldCheckIcon, CalendarDaysIcon, SparklesIcon } from '@heroicons/react/24/outline';
import FlexibleSchedulePicker from '../components/FlexibleSchedulePicker';
import { WEEKDAYS } from '../utils/constants';

const WorkHours = () => {
  const { t, language } = useLanguage();
  const [shift1Start, setShift1Start] = useState('08:00');
  const [shift1End, setShift1End] = useState('12:00');
  const [shift2Start, setShift2Start] = useState('13:00');
  const [shift2End, setShift2End] = useState('17:00');
  const [enableShift2, setEnableShift2] = useState(true);
  const [isFlexible, setIsFlexible] = useState(false);
  const [lateGraceMinutes, setLateGraceMinutes] = useState(0);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [flexibleSchedule, setFlexibleSchedule] = useState({});

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
        setShift1Start(res.data.shift1Start || '08:00');
        setShift1End(res.data.shift1End || '12:00');
        setShift2Start(res.data.shift2Start || '13:00');
        setShift2End(res.data.shift2End || '17:00');
        const has2 = !!(res.data.shift2Start && res.data.shift2End && res.data.shift2Start.trim() !== '' && res.data.shift2End.trim() !== '');
        setEnableShift2(has2);
        setIsFlexible(res.data.isFlexible || false);
        setLateGraceMinutes(res.data.lateGraceMinutes ?? 0);
        if (res.data.flexibleSchedule) {
          try {
            const parsed = typeof res.data.flexibleSchedule === 'string'
              ? JSON.parse(res.data.flexibleSchedule)
              : res.data.flexibleSchedule;
            setFlexibleSchedule(parsed || {});
            setWorkingDays(Array.isArray(parsed?.workingDays) ? parsed.workingDays : [1, 2, 3, 4, 5]);
          } catch (e) {
            setFlexibleSchedule({});
            setWorkingDays([1, 2, 3, 4, 5]);
          }
        }
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
        shift1Start: shift1Start || '08:00',
        shift1End: shift1End || '12:00',
        shift2Start: enableShift2 ? (shift2Start || '13:00') : '',
        shift2End: enableShift2 ? (shift2End || '17:00') : '',
        isFlexible,
        lateGraceMinutes: parseInt(lateGraceMinutes, 10) || 0,
        flexibleSchedule: JSON.stringify({
          ...(typeof flexibleSchedule === 'object' ? flexibleSchedule : {}),
          workingDays,
        }),
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <ClockIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-khmer">Company Work Hours</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-khmer">
            {isFlexible ? t("flexibleHoursDesc") : t("fixedShiftsDesc")}
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
        {/* Top Mode Header with Master Switch for Flexible Hours */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border transition-all ${isFlexible
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
              }`}>
              {isFlexible ? (
                <CalendarDaysIcon className="h-6 w-6 text-purple-400" />
              ) : (
                <ClockIcon className="h-6 w-6 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-khmer">
                  {t("flexibleHours")}
                </h2>
                {isFlexible && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse font-khmer">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-khmer mt-0.5">
                {t("flexibleHoursDesc")}
              </p>
            </div>
          </div>

          {/* Master Flexible Working Hours Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center bg-slate-900 px-4 py-2 rounded-xl border border-white/10">
            <span className="text-xs font-bold text-slate-300 font-khmer">
              {isFlexible ? t("flexibleHours") : t("fixedShifts")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isFlexible}
              onClick={() => setIsFlexible(!isFlexible)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isFlexible ? 'bg-purple-600 shadow-lg shadow-purple-600/40' : 'bg-slate-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isFlexible ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CONDITION 1: FIXED SHIFTS PANEL (When isFlexible is FALSE) */}
          {!isFlexible && (
            <div className="space-y-6 animate-fade-in">
              {/* Working Days Checkboxes (Monday - Sunday) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                  {t("workingDaysWeekly")} * ({language === 'kh' ? 'ជ្រើសរើសថ្ងៃធ្វើការប្រចាំសប្ដាហ៍' : 'Select working days of the week'})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 p-3.5 bg-slate-950/60 border border-white/10 rounded-xl">
                  {WEEKDAYS.map(day => {
                    const isChecked = workingDays.includes(day.key);
                    return (
                      <label key={day.key} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (workingDays.includes(day.key)) {
                              setWorkingDays(workingDays.filter(d => d !== day.key));
                            } else {
                              setWorkingDays([...workingDays, day.key]);
                            }
                          }}
                          className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer h-4 w-4"
                        />
                        <span className="font-khmer">{language === 'kh' ? day.kh : day.en}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white font-khmer">
                    {t("shiftConfig")}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-khmer mt-0.5">
                    {enableShift2 ? t("twoShiftsDesc") : t("singleShift")}
                  </p>
                </div>

                {/* 1 Shift / 2 Shifts Switch Toggle */}
                <div className="flex items-center gap-2.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-300 font-khmer">
                    {enableShift2 ? t("twoShifts") : t("singleShift")}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableShift2}
                    onClick={() => setEnableShift2(!enableShift2)}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableShift2 ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${enableShift2 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              <div className={`grid gap-6 transition-all duration-300 ${enableShift2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                }`}>
                {/* Shift 1 */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-300 font-khmer tracking-wider uppercase">
                      {t("shift1")}
                    </h4>
                    {!enableShift2 && (
                      <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-khmer">
                        {t("singleShift")}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                        {t("start")}
                      </label>
                      <input
                        type="time"
                        value={shift1Start}
                        onChange={(e) => setShift1Start(e.target.value)}
                        required={!isFlexible}
                        className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                        {t("end")}
                      </label>
                      <input
                        type="time"
                        value={shift1End}
                        onChange={(e) => setShift1End(e.target.value)}
                        required={!isFlexible}
                        className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Shift 2 (Only visible when enableShift2 is true) */}
                {enableShift2 && (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4 animate-fade-in">
                    <h4 className="text-xs font-bold text-indigo-300 font-khmer tracking-wider uppercase">
                      {t("shift2")}
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                          {t("start")}
                        </label>
                        <input
                          type="time"
                          value={shift2Start}
                          onChange={(e) => setShift2Start(e.target.value)}
                          required={!isFlexible && enableShift2}
                          className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                          {t("end")}
                        </label>
                        <input
                          type="time"
                          value={shift2End}
                          onChange={(e) => setShift2End(e.target.value)}
                          required={!isFlexible && enableShift2}
                          className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONDITION 2: FLEXIBLE WORKING HOURS MONTHLY SCHEDULE (When isFlexible is TRUE) */}
          {isFlexible && (
            <div className="space-y-4 animate-fade-in">
              <FlexibleSchedulePicker
                scheduleData={flexibleSchedule}
                onChange={setFlexibleSchedule}
                defaultShift={{
                  shift1Start,
                  shift1End,
                  shift2Start,
                  shift2End,
                  enableShift2,
                }}
              />
            </div>
          )}
          {/* LATE GRACE PERIOD (STYLE EXACTLY MATCHING SHIFT CARDS) */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-indigo-300 font-khmer tracking-wider uppercase">
                  {language === 'kh' ? 'ការអនុគ្រោះពេលមកយឺត (LATE GRACE PERIOD)' : 'LATE GRACE PERIOD'}
                </h4>
                <p className="text-[11px] text-slate-400 font-khmer mt-0.5">
                  {language === 'kh'
                    ? 'កំណត់ចំនួននាទីអនុគ្រោះមុនពេលប្រព័ន្ធចាប់ផ្តើមរាប់ថាមកយឺត (Grace tolerance minutes)'
                    : 'Grace window minutes before attendance is marked as late'}
                </p>
              </div>

              {lateGraceMinutes > 0 && (
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md font-mono border border-indigo-500/20">
                  +{lateGraceMinutes} mn
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                  {language === 'kh' ? 'ចំនួននាទីអនុគ្រោះ (MINUTES)' : 'GRACE MINUTES'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    {language === 'kh' ? 'នាទី' : 'mn'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">
                  {language === 'kh' ? 'ជ្រើសរើសរហ័ស (PRESETS)' : 'QUICK PRESETS'}
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {[0, 5, 10, 15, 20, 30].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setLateGraceMinutes(mins)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer font-mono ${lateGraceMinutes === mins
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border border-white/10'
                        }`}
                    >
                      {mins === 0 ? '0m (Off)' : `${mins}mn`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Example Description Note */}
            <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-slate-300 font-khmer leading-relaxed">
              💡 <strong>{language === 'kh' ? 'ឧទាហរណ៍៖' : 'Example:'}</strong> {language === 'kh'
                ? `បើកំណត់ ${lateGraceMinutes} នាទី ហើយវេនទី ១ ចាប់ផ្ដើមម៉ោង ${shift1Start || '08:00'} នោះបុគ្គលិកដែលស្កេនចូលមុន ឬត្រឹមម៉ោង ${shift1Start || '08:00'} + ${lateGraceMinutes}mn គឺមិនទាន់រាប់ថាយឺតទេ (មិនលោតផ្ទាំងបំពេញមូលហេតុយឺតឡើយ)។ លុះត្រាតែស្កេនចាប់ពី ១ នាទីក្រោយមកទៀត ទើបប្រព័ន្ធរាប់ថាមកយឺត និងតម្រូវឱ្យ Submit មូលហេតុ។`
                : `If set to ${lateGraceMinutes} minutes and Shift 1 starts at ${shift1Start || '08:00'}, check-in up to ${lateGraceMinutes} minutes after shift start is NOT considered late and will not trigger late modal. Check-in after that is marked late.`}
            </div>
          </div>

          {/* Alert Note info */}
          {/* <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-2.5">
            <ShieldCheckIcon className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 font-khmer leading-relaxed">
              <strong>បញ្ជាក់៖</strong> ម៉ោងការងារខាងលើនេះគឺជាតម្លៃលំនាំដើមរបស់ក្រុមហ៊ុន។ នៅពេលដែលបងបង្កើតគណនីបុគ្គលិកថ្មី វានឹងយកតម្លៃលំនាំដើមទាំងនេះទៅបំពេញឱ្យដោយស្វ័យប្រវត្ត ដើម្បីកាត់បន្ថយពេលវេលាវាយបញ្ចូល។ ប៉ុន្តែ បងក៏នៅតែអាចកែសម្រួលម៉ោងការងារដោយឡែកផ្សេងគ្នាសម្រាប់បុគ្គលិកម្នាក់ៗបានធម្មតា ទៅតាមស្ថានភាពជាក់ស្ដែង។
            </p>
          </div> */}

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
