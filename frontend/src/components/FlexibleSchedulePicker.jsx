import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ArrowPathIcon,
  SparklesIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PencilSquareIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const DAYS_OF_WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_KH = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

const WEEKDAYS = [
  { key: 1, en: 'Monday', kh: 'ចន្ទ' },
  { key: 2, en: 'Tuesday', kh: 'អង្គារ' },
  { key: 3, en: 'Wednesday', kh: 'ពុធ' },
  { key: 4, en: 'Thursday', kh: 'ព្រហស្បតិ៍' },
  { key: 5, en: 'Friday', kh: 'សុក្រ' },
  { key: 6, en: 'Saturday', kh: 'សៅរ៍' },
  { key: 0, en: 'Sunday', kh: 'អាទិត្យ' },
];

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTHS_KH = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

/**
 * FlexibleSchedulePicker Component
 * Allows managers to configure daily/monthly flexible and rotating work hours.
 * 
 * @param {Object} scheduleData - Keyed by "YYYY-MM" -> { [dayNumber]: { isDayOff, hasTwoShifts, shift1Start, shift1End, shift2Start, shift2End, label } }
 * @param {Function} onChange - Callback (newScheduleData) => void
 * @param {Object} defaultShift - { shift1Start, shift1End, shift2Start, shift2End, enableShift2 }
 */
const FlexibleSchedulePicker = ({
  scheduleData = {},
  onChange,
  defaultShift = { shift1Start: '08:00', shift1End: '12:00', shift2Start: '13:00', shift2End: '17:00', enableShift2: true },
}) => {
  const { t, language } = useLanguage();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0 - 11
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [selectedDay, setSelectedDay] = useState(null); // for edit modal
  const [editingConfig, setEditingConfig] = useState(null);

  // Month Key: "YYYY-MM"
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Get total days in month
  const totalDaysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // First day of week index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Active Working Days (default Mon-Fri: [1, 2, 3, 4, 5])
  const activeWorkingDays = useMemo(() => {
    if (scheduleData && Array.isArray(scheduleData.workingDays)) {
      return scheduleData.workingDays;
    }
    return [1, 2, 3, 4, 5];
  }, [scheduleData]);

  // Current month schedule map
  const currentMonthSchedule = useMemo(() => {
    if (!scheduleData || typeof scheduleData !== 'object' || Array.isArray(scheduleData)) {
      return {};
    }
    return scheduleData[monthKey] || {};
  }, [scheduleData, monthKey]);

  // Helper to get day config (fallback to default shift or activeWorkingDays)
  const getDayConfig = (day) => {
    if (currentMonthSchedule && currentMonthSchedule[day]) {
      return currentMonthSchedule[day];
    }
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isWorkingDay = activeWorkingDays.includes(dayOfWeek);
    const dShift = defaultShift || {};
    return {
      isDayOff: !isWorkingDay,
      hasTwoShifts: dShift.enableShift2 ?? true,
      shift1Start: dShift.shift1Start || '08:00',
      shift1End: dShift.shift1End || '12:00',
      shift2Start: dShift.shift2Start || '13:00',
      shift2End: dShift.shift2End || '17:00',
    };
  };

  // Toggle day of week (Monday - Sunday)
  const handleToggleWeekday = (dayKey) => {
    const isCurrentlyActive = activeWorkingDays.includes(dayKey);
    const newWorkingDays = isCurrentlyActive
      ? activeWorkingDays.filter(d => d !== dayKey)
      : [...activeWorkingDays, dayKey];

    const newMonthData = { ...(currentMonthSchedule || {}) };
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dayOfWeek = new Date(currentYear, currentMonth, d).getDay();
      if (dayOfWeek === dayKey) {
        const existing = getDayConfig(d);
        newMonthData[d] = {
          ...existing,
          isDayOff: isCurrentlyActive,
        };
      }
    }

    const base = (scheduleData && typeof scheduleData === 'object' && !Array.isArray(scheduleData)) ? scheduleData : {};
    if (onChange) {
      onChange({
        ...base,
        workingDays: newWorkingDays,
        [monthKey]: newMonthData,
      });
    }
  };

  // Update a specific day
  const updateDaySchedule = (day, newConfig) => {
    const updatedMonth = {
      ...(currentMonthSchedule || {}),
      [day]: {
        ...getDayConfig(day),
        ...newConfig,
      },
    };
    const base = (scheduleData && typeof scheduleData === 'object' && !Array.isArray(scheduleData)) ? scheduleData : {};
    if (onChange) {
      onChange({
        ...base,
        [monthKey]: updatedMonth,
      });
    }
  };

  // Toggle Day Off for a specific day
  const toggleDayOff = (day, e) => {
    if (e) e.stopPropagation();
    const cfg = getDayConfig(day);
    updateDaySchedule(day, {
      isDayOff: !cfg.isDayOff,
      label: !cfg.isDayOff ? (language === 'kh' ? 'សម្រាក' : 'Day Off') : (language === 'kh' ? 'ធ្វើការ' : 'Work'),
    });
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Count stats
  const stats = useMemo(() => {
    let working = 0;
    let off = 0;
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const cfg = getDayConfig(d);
      if (cfg.isDayOff) off++;
      else working++;
    }
    return { working, off };
  }, [totalDaysInMonth, currentMonthSchedule, currentYear, currentMonth]);

  // Reset entire month
  const handleResetMonth = () => {
    const updated = (scheduleData && typeof scheduleData === 'object' && !Array.isArray(scheduleData)) ? { ...scheduleData } : {};
    delete updated[monthKey];
    if (onChange) {
      onChange(updated);
    }
  };

  // Open Edit Modal for a day
  const handleOpenEditDay = (day) => {
    setSelectedDay(day);
    setEditingConfig({ ...getDayConfig(day) });
  };

  const handleSaveDayEdit = () => {
    if (selectedDay && editingConfig) {
      updateDaySchedule(selectedDay, editingConfig);
      setSelectedDay(null);
      setEditingConfig(null);
    }
  };

  const monthLabel = language === 'kh' ? MONTHS_KH[currentMonth] : MONTHS_EN[currentMonth];
  const daysOfWeek = language === 'kh' ? DAYS_OF_WEEK_KH : DAYS_OF_WEEK_EN;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Month Navigation & Toolbar Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-900/90 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-950/20">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <CalendarDaysIcon className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-bold text-white font-khmer">
              {monthLabel} {currentYear}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Next Month"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-khmer font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {stats.working} {t("totalWorkingDays")}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-khmer font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            {stats.off} {t("totalDaysOff")}
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          {/* Calendar / Table toggle */}
          <div className="flex items-center bg-slate-950/60 p-0.5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'calendar' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Calendar View"
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400 uppercase font-khmer pb-1 border-b border-white/5">
            {daysOfWeek.map((dayName, idx) => (
              <div key={idx} className={idx === 0 || idx === 6 ? 'text-amber-400/80' : 'text-slate-300'}>
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty offset padding for days before 1st of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[90px] rounded-xl bg-slate-950/20 border border-white/[0.02]" />
            ))}

            {/* Day Cells (1 to totalDaysInMonth) */}
            {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const config = getDayConfig(day);
              const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={day}
                  onClick={() => handleOpenEditDay(day)}
                  className={`group relative min-h-[95px] p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.02] ${
                    config.isDayOff
                      ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/10'
                      : 'bg-slate-900/60 border-white/10 hover:border-indigo-500/40 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Top: Day number & Quick Day-Off toggle button */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-extrabold font-mono ${
                      config.isDayOff ? 'text-amber-400' : isWeekend ? 'text-indigo-300' : 'text-white'
                    }`}>
                      {String(day).padStart(2, '0')}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => toggleDayOff(day, e)}
                      title={config.isDayOff ? "Mark as Working" : "Mark as Day Off"}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-khmer font-bold transition-all cursor-pointer border ${
                        config.isDayOff
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/25'
                      }`}
                    >
                      {config.isDayOff ? t("dayOff") : t("workingDay")}
                    </button>
                  </div>

                  {/* Body: Working Hours or Day Off */}
                  <div className="mt-1 space-y-1">
                    {config.isDayOff ? (
                      <div className="text-[10px] text-amber-300/80 font-khmer font-semibold py-1">
                        🏖️ {t("dayOff")}
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-[9px] font-mono">
                        {/* Shift 1 */}
                        <div className="flex items-center gap-1 text-slate-300 bg-slate-950/40 px-1 py-0.5 rounded">
                          <span className="text-[8px] text-indigo-400 font-bold">S1:</span>
                          <span>{config.shift1Start}-{config.shift1End}</span>
                        </div>
                        {/* Shift 2 if enabled */}
                        {config.hasTwoShifts && config.shift2Start && (
                          <div className="flex items-center gap-1 text-slate-300 bg-slate-950/40 px-1 py-0.5 rounded">
                            <span className="text-[8px] text-purple-400 font-bold">S2:</span>
                            <span>{config.shift2Start}-{config.shift2End}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Edit hint on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1 right-1 text-slate-400">
                    <PencilSquareIcon className="h-3 w-3 text-indigo-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950/95 text-[10px] text-slate-400 uppercase font-khmer border-b border-white/10 z-10">
                <tr>
                  <th className="py-3 px-4">{t("day")}</th>
                  <th className="py-3 px-4">{t("status")}</th>
                  <th className="py-3 px-4">{t("shift1")}</th>
                  <th className="py-3 px-4">{t("shift2")}</th>
                  <th className="py-3 px-4 text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const config = getDayConfig(day);
                  const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
                  const dayName = daysOfWeek[dayOfWeek];

                  return (
                    <tr
                      key={day}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        config.isDayOff ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      {/* Date & Day */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {String(day).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-khmer">
                            ({dayName})
                          </span>
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-2.5 px-4 font-khmer">
                        <button
                          type="button"
                          onClick={() => toggleDayOff(day)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            config.isDayOff
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {config.isDayOff ? t("dayOff") : t("workingDay")}
                        </button>
                      </td>

                      {/* Shift 1 */}
                      <td className="py-2.5 px-4">
                        {!config.isDayOff ? (
                          <div className="flex items-center gap-1 text-slate-300">
                            <input
                              type="time"
                              value={config.shift1Start}
                              onChange={(e) => updateDaySchedule(day, { shift1Start: e.target.value })}
                              className="py-1 px-1.5 border border-white/10 bg-slate-950 rounded text-xs text-white"
                            />
                            <span>-</span>
                            <input
                              type="time"
                              value={config.shift1End}
                              onChange={(e) => updateDaySchedule(day, { shift1End: e.target.value })}
                              className="py-1 px-1.5 border border-white/10 bg-slate-950 rounded text-xs text-white"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Shift 2 */}
                      <td className="py-2.5 px-4">
                        {!config.isDayOff ? (
                          config.hasTwoShifts ? (
                            <div className="flex items-center gap-1 text-slate-300">
                              <input
                                type="time"
                                value={config.shift2Start}
                                onChange={(e) => updateDaySchedule(day, { shift2Start: e.target.value })}
                                className="py-1 px-1.5 border border-white/10 bg-slate-950 rounded text-xs text-white"
                              />
                              <span>-</span>
                              <input
                                type="time"
                                value={config.shift2End}
                                onChange={(e) => updateDaySchedule(day, { shift2End: e.target.value })}
                                className="py-1 px-1.5 border border-white/10 bg-slate-950 rounded text-xs text-white"
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateDaySchedule(day, { hasTwoShifts: true, shift2Start: '13:00', shift2End: '17:00' })}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-khmer underline cursor-pointer"
                            >
                              + {t("shift2")}
                            </button>
                          )
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Quick Edit modal */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDay(day)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition-all cursor-pointer"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT SPECIFIC DAY DETAILS */}
      {selectedDay !== null && editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-khmer flex items-center gap-2">
                  <CalendarDaysIcon className="h-4 w-4 text-indigo-400" />
                  <span>
                    {language === 'kh' ? 'កែសម្រួលថ្ងៃទី ' : 'Edit Day '} {selectedDay} {monthLabel} {currentYear}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 font-khmer mt-0.5">
                  {daysOfWeek[new Date(currentYear, currentMonth, selectedDay).getDay()]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedDay(null); setEditingConfig(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Day Off Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10">
              <div>
                <span className="text-xs font-bold text-white font-khmer">{t("dayOff")}</span>
                <p className="text-[10px] text-slate-400 font-khmer">
                  {editingConfig.isDayOff ? (language === 'kh' ? 'ថ្ងៃនេះជាថ្ងៃសម្រាក' : 'This day is a rest day') : (language === 'kh' ? 'ថ្ងៃនេះជាថ្ងៃធ្វើការ' : 'This day is a working day')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={editingConfig.isDayOff}
                onClick={() => setEditingConfig({ ...editingConfig, isDayOff: !editingConfig.isDayOff })}
                className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  editingConfig.isDayOff ? 'bg-amber-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    editingConfig.isDayOff ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* If NOT Day Off: Configure shifts */}
            {!editingConfig.isDayOff && (
              <div className="space-y-4">
                {/* 2 Shifts switch for this day */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-300 font-khmer">{t("twoShifts")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editingConfig.hasTwoShifts}
                    onClick={() => setEditingConfig({ ...editingConfig, hasTwoShifts: !editingConfig.hasTwoShifts })}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editingConfig.hasTwoShifts ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        editingConfig.hasTwoShifts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Shift 1 Input */}
                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-300 font-khmer uppercase">{t("shift1")}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">{t("start")}</label>
                      <input
                        type="time"
                        value={editingConfig.shift1Start || '08:00'}
                        onChange={(e) => setEditingConfig({ ...editingConfig, shift1Start: e.target.value })}
                        className="w-full py-1.5 px-2 border border-white/10 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">{t("end")}</label>
                      <input
                        type="time"
                        value={editingConfig.shift1End || '12:00'}
                        onChange={(e) => setEditingConfig({ ...editingConfig, shift1End: e.target.value })}
                        className="w-full py-1.5 px-2 border border-white/10 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Shift 2 Input */}
                {editingConfig.hasTwoShifts && (
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 space-y-2 animate-fade-in">
                    <span className="text-[11px] font-bold text-purple-300 font-khmer uppercase">{t("shift2")}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">{t("start")}</label>
                        <input
                          type="time"
                          value={editingConfig.shift2Start || '13:00'}
                          onChange={(e) => setEditingConfig({ ...editingConfig, shift2Start: e.target.value })}
                          className="w-full py-1.5 px-2 border border-white/10 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1 font-khmer">{t("end")}</label>
                        <input
                          type="time"
                          value={editingConfig.shift2End || '17:00'}
                          onChange={(e) => setEditingConfig({ ...editingConfig, shift2End: e.target.value })}
                          className="w-full py-1.5 px-2 border border-white/10 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => { setSelectedDay(null); setEditingConfig(null); }}
                className="py-2 px-4 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors font-khmer"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveDayEdit}
                className="py-2 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-600/30 font-khmer flex items-center gap-1.5"
              >
                <CheckIcon className="h-4 w-4" />
                <span>{t("save")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlexibleSchedulePicker;
