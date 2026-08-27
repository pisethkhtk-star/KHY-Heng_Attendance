import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
  BellAlertIcon,
  ArrowPathIcon,
  KeyIcon,
  ClockIcon,
  CalendarDaysIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

const TelegramSettings = () => {
  const { language } = useLanguage();

  // Active Channel Tab
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'leave'

  // Attendance Channel State
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [sendOnCheckin, setSendOnCheckin] = useState(true);
  const [sendOnCheckout, setSendOnCheckout] = useState(true);
  const [sendOnlyLate, setSendOnlyLate] = useState(false);

  // Leave Channel State
  const [leaveBotToken, setLeaveBotToken] = useState('');
  const [leaveChatId, setLeaveChatId] = useState('');
  const [leaveEnabled, setLeaveEnabled] = useState(true);
  const [sendOnLeaveRequest, setSendOnLeaveRequest] = useState(true);
  const [sendOnLeaveApproval, setSendOnLeaveApproval] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get('/telegram-settings');
      if (res.data) {
        setBotToken(res.data.botToken || '');
        setChatId(res.data.chatId || '');
        setIsEnabled(res.data.isEnabled ?? true);
        setSendOnCheckin(res.data.sendOnCheckin ?? true);
        setSendOnCheckout(res.data.sendOnCheckout ?? true);
        setSendOnlyLate(res.data.sendOnlyLate ?? false);

        setLeaveBotToken(res.data.leaveBotToken || '');
        setLeaveChatId(res.data.leaveChatId || '');
        setLeaveEnabled(res.data.leaveEnabled ?? true);
        setSendOnLeaveRequest(res.data.sendOnLeaveRequest ?? true);
        setSendOnLeaveApproval(res.data.sendOnLeaveApproval ?? true);
      }
    } catch (err) {
      console.error('Error fetching telegram settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await api.post('/telegram-settings', {
        botToken,
        chatId,
        isEnabled,
        sendOnCheckin,
        sendOnCheckout,
        sendOnlyLate,
        leaveBotToken,
        leaveChatId,
        leaveEnabled,
        sendOnLeaveRequest,
        sendOnLeaveApproval,
      });
      setSuccessMsg(language === 'kh' ? 'បានរក្សាទុកការកំណត់ Telegram ទាំងពីរ Channel ដោយជោគជ័យ!' : 'Telegram settings for both channels saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving telegram settings:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save Telegram settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (activeTab === 'attendance') {
      if (!botToken.trim() || !chatId.trim()) {
        setErrorMsg(language === 'kh' ? 'សូមបញ្ចូល Bot Token និង Group Chat ID សម្រាប់ Attendance មុនពេលតេស្ត!' : 'Please enter Attendance Bot Token and Group Chat ID before testing!');
        return;
      }
    } else {
      const targetToken = leaveBotToken.trim() || botToken.trim();
      const targetChat = leaveChatId.trim();
      if (!targetToken || !targetChat) {
        setErrorMsg(language === 'kh' ? 'សូមបញ្ចូល Leave Group Chat ID មុនពេលតេស្ត!' : 'Please enter Leave Group Chat ID before testing!');
        return;
      }
    }

    setTesting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      if (activeTab === 'attendance') {
        const res = await api.post('/telegram-settings/test', {
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        });
        setSuccessMsg(res.data?.message || (language === 'kh' ? 'សារតេស្តត្រូវបានផ្ញើទៅ Attendance Telegram Group ដោយជោគជ័យ!' : 'Test message sent to Attendance Telegram Group successfully!'));
      } else {
        const targetToken = leaveBotToken.trim() || botToken.trim();
        const res = await api.post('/telegram-settings/test-leave', {
          botToken: targetToken,
          chatId: leaveChatId.trim(),
        });
        setSuccessMsg(res.data?.message || (language === 'kh' ? 'សារតេស្តត្រូវបានផ្ញើទៅ Leave Requests Telegram Group ដោយជោគជ័យ!' : 'Test message sent to Leave Requests Telegram Group successfully!'));
      }
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error testing telegram message:', err);
      setErrorMsg(err.response?.data?.message || (language === 'kh' ? 'មិនអាចផ្ញើសារបានទេ។ សូមពិនិត្យមើល Bot Token និង Group Chat ID ឡើងវិញ!' : 'Failed to send test message. Check your Bot Token and Chat ID.'));
    } finally {
      setTesting(false);
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
          <PaperAirplaneIcon className="h-6 w-6 text-indigo-400 -rotate-45" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-khmer">
            {language === 'kh' ? 'ការកំណត់ Telegram Notification Groups' : 'Telegram Notification Channels'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-khmer">
            {language === 'kh'
              ? 'បែងចែកការផ្ញើសារជូនដំណឹងដោយស្វ័យប្រវត្តរវាង វត្តមាន (Attendance) និង ច្បាប់ឈប់សម្រាក (Leave Requests)'
              : 'Configure dedicated Telegram groups for Attendance check-ins and Leave requests'}
          </p>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-300 font-khmer animate-fade-in flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-300 font-khmer animate-pulse flex items-center gap-2">
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Navigation Tabs for Channels */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/60 border border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-khmer transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
        >
          <ClockIcon className="h-4 w-4" />
          <span>{language === 'kh' ? '១. ក្រុមវត្តមាន (Attendance Alerts)' : '1. Attendance Alerts'}</span>
          {isEnabled && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold font-khmer transition-all flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'leave'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
        >
          <CalendarDaysIcon className="h-4 w-4" />
          <span>{language === 'kh' ? '២. ក្រុមច្បាប់ឈប់សម្រាក (Leave Requests)' : '2. Leave Requests'}</span>
          {leaveEnabled && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="glass-card p-6 rounded-2xl glow-indigo space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* TAB 1: ATTENDANCE NOTIFICATIONS */}
          {activeTab === 'attendance' && (
            <div className="space-y-6 animate-fade-in">
              {/* Channel Master Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border transition-all ${isEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                    <BellAlertIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white font-khmer">
                        {language === 'kh' ? 'សេវាជូនដំណឹងវត្តមាន (Attendance Alerts)' : 'Attendance Alerts Service'}
                      </h2>
                      {isEnabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-khmer">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-khmer mt-0.5">
                      {language === 'kh'
                        ? 'ផ្ញើសាររាល់ពេលបុគ្គលិកស្កេន Check In 1/2 ឬ Check Out 1/2'
                        : 'Dispatches real-time alerts on Check-In and Check-Out scans'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center bg-slate-900 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-xs font-bold text-slate-300 font-khmer">
                    {isEnabled ? (language === 'kh' ? 'ដំណើរការ' : 'ENABLED') : (language === 'kh' ? 'បិទ' : 'DISABLED')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Bot & Group ID */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-black dark:text-white font-khmer tracking-wider uppercase flex items-center gap-1.5">
                    <KeyIcon className="h-4 w-4 text-black dark:text-white" />
                    {language === 'kh' ? 'ព័ត៌មានសម្ងាត់ Attendance Bot & Group' : 'Attendance Bot & Group ID'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 uppercase font-bold mb-1 font-khmer">
                      {language === 'kh' ? 'Telegram Bot Token' : 'Bot Token'} *
                    </label>
                    <input
                      type="text"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="8763912668:AAGsasaHgECgohqDDLVm5BBiacPlDrbZOk8"
                      className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 font-khmer">
                      {language === 'kh' ? 'ទទួលបានពី @BotFather លើ Telegram' : 'From @BotFather'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 uppercase font-bold mb-1 font-khmer">
                      {language === 'kh' ? 'Attendance Group Chat ID' : 'Attendance Group ID'} *
                    </label>
                    <input
                      type="text"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      placeholder="-1004413549777"
                      className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 font-khmer">
                      {language === 'kh' ? 'លេខ ID របស់ Group វត្តមាន (ឧ. -1004413549777)' : 'Group ID for Attendance'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attendance Triggers */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-black dark:text-white font-khmer tracking-wider uppercase flex items-center gap-1.5">
                    <AdjustmentsHorizontalIcon className="h-4 w-4 text-black dark:text-white" />
                    {language === 'kh' ? 'លក្ខខណ្ឌនៃការផ្ញើសារវត្តមាន (Attendance Triggers)' : 'Attendance Triggers'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="p-3 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all">
                    <div>
                      <p className="text-xs font-bold text-white font-khmer">🟢 {language === 'kh' ? 'ពេល Check In' : 'On Check In'}</p>
                      <p className="text-[10px] text-slate-400 font-khmer">{language === 'kh' ? 'វេនទី ១ និង វេនទី ២' : 'Shift 1 & 2'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendOnCheckin}
                      onChange={(e) => setSendOnCheckin(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all">
                    <div>
                      <p className="text-xs font-bold text-white font-khmer">🔴 {language === 'kh' ? 'ពេល Check Out' : 'On Check Out'}</p>
                      <p className="text-[10px] text-slate-400 font-khmer">{language === 'kh' ? 'ចេញបាយ & ចេញទៅផ្ទះ' : 'Lunch & Day End'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendOnCheckout}
                      onChange={(e) => setSendOnCheckout(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all">
                    <div>
                      <p className="text-xs font-bold text-white font-khmer">⚠️ {language === 'kh' ? 'តែពេលមកយឺត' : 'Late Only'}</p>
                      <p className="text-[10px] text-slate-400 font-khmer">{language === 'kh' ? 'ផ្ញើតែអ្នកយឺត' : 'Filter late only'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendOnlyLate}
                      onChange={(e) => setSendOnlyLate(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEAVE REQUESTS NOTIFICATIONS */}
          {activeTab === 'leave' && (
            <div className="space-y-6 animate-fade-in">
              {/* Channel Master Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border transition-all ${leaveEnabled
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                    <CalendarDaysIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white font-khmer">
                        {language === 'kh' ? 'សេវាជូនដំណឹងច្បាប់ឈប់សម្រាក (Leave Requests)' : 'Leave Requests Channel'}
                      </h2>
                      {leaveEnabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-khmer">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-khmer mt-0.5">
                      {language === 'kh'
                        ? 'ផ្ញើសារទៅកាន់ Group របស់ថ្នាក់ដឹកនាំ/HR រាល់ពេលមានបុគ្គលិកសុំច្បាប់ ឬអនុម័តច្បាប់'
                        : 'Alerts management/HR group whenever an employee requests or gets leave approved'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center bg-slate-900 px-4 py-2 rounded-xl border border-white/10">
                  <span className="text-xs font-bold text-slate-300 font-khmer">
                    {leaveEnabled ? (language === 'kh' ? 'ដំណើរការ' : 'ENABLED') : (language === 'kh' ? 'បិទ' : 'DISABLED')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={leaveEnabled}
                    onClick={() => setLeaveEnabled(!leaveEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${leaveEnabled ? 'bg-purple-600 shadow-lg shadow-purple-600/30' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${leaveEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Bot & Leave Group ID */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-black dark:text-white font-khmer tracking-wider uppercase flex items-center gap-1.5">
                    <KeyIcon className="h-4 w-4 text-black dark:text-white" />
                    {language === 'kh' ? 'ព័ត៌មាន Leave Bot & Leave Group ID' : 'Leave Bot & Group ID'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 uppercase font-bold mb-1 font-khmer">
                      {language === 'kh' ? 'Leave Bot Token (ទុកទំនេរ បើប្រើ Bot ដូចគ្នា)' : 'Leave Bot Token (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={leaveBotToken}
                      onChange={(e) => setLeaveBotToken(e.target.value)}
                      placeholder={botToken || '8763912668:AAGsasaHgECgohqDDLVm5BBiacPlDrbZOk8'}
                      className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 font-khmer">
                      {language === 'kh' ? 'បើមិនបំពេញ វានឹងប្រើ Bot Token ខាងមុខដោយស្វ័យប្រវត្ត' : 'Falls back to main Bot Token if empty'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-700 dark:text-slate-400 uppercase font-bold mb-1 font-khmer">
                      {language === 'kh' ? 'Leave Telegram Group Chat ID' : 'Leave Group Chat ID'} *
                    </label>
                    <input
                      type="text"
                      value={leaveChatId}
                      onChange={(e) => setLeaveChatId(e.target.value)}
                      placeholder="-100xxxxxxxxxx"
                      className="block w-full py-2 px-3 border border-white/10 rounded-xl text-xs bg-slate-900/60 text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 font-khmer">
                      {language === 'kh' ? 'លេខ ID របស់ Group សម្រាប់មើលច្បាប់ឈប់សម្រាក' : 'Group ID for Leave alerts'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Leave Triggers */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-black dark:text-white font-khmer tracking-wider uppercase flex items-center gap-1.5">
                    <AdjustmentsHorizontalIcon className="h-4 w-4 text-black dark:text-white" />
                    {language === 'kh' ? 'លក្ខខណ្ឌនៃការផ្ញើសារច្បាប់ (Leave Triggers)' : 'Leave Triggers'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3.5 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all">
                    <div>
                      <p className="text-xs font-bold text-white font-khmer">🌴 {language === 'kh' ? 'ពេលបុគ្គលិកស្នើសុំច្បាប់' : 'On Leave Request'}</p>
                      <p className="text-[10px] text-slate-400 font-khmer">{language === 'kh' ? 'ផ្ញើព័ត៌មានសុំច្បាប់ និងមូលហេតុភ្លាមៗ' : 'Alert on new leave submission'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendOnLeaveRequest}
                      onChange={(e) => setSendOnLeaveRequest(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10"
                    />
                  </label>

                  <label className="p-3.5 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between cursor-pointer hover:border-indigo-500/30 transition-all">
                    <div>
                      <p className="text-xs font-bold text-white font-khmer">✅ {language === 'kh' ? 'ពេលអនុម័ត ឬបដិសេធច្បាប់' : 'On Approval / Reject'}</p>
                      <p className="text-[10px] text-slate-400 font-khmer">{language === 'kh' ? 'ផ្ញើសារប្រាប់លទ្ធផលច្បាប់' : 'Alert on status update'}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sendOnLeaveApproval}
                      onChange={(e) => setSendOnLeaveApproval(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/10"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Quick Instructions Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-2.5">
            <ShieldCheckIcon className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-300 font-khmer leading-relaxed">
              <strong>បញ្ជាក់៖</strong> បងអាចប្រើប្រាស់ <strong>Bot Token តែមួយ</strong> សម្រាប់ Group ទាំងពីរ ឬបង្កើត <strong>Bot ផ្សេងគ្នា ២</strong> ដាច់ដោយឡែកពីគ្នាក៏បាន។ គ្រាន់តែ Add Bot នោះចូលទៅក្នុង Group នីមួយៗជា Admin រួចបំពេញ Group ID ជាការស្រេច។
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-khmer"
            >
              {testing ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  {language === 'kh' ? 'កំពុងផ្ញើតេស្ត...' : 'Sending Test...'}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4 -rotate-45" />
                  {language === 'kh'
                    ? `ផ្ញើតេស្ត (${activeTab === 'attendance' ? 'Attendance' : 'Leave'})`
                    : `Send Test (${activeTab === 'attendance' ? 'Attendance' : 'Leave'})`}
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 cursor-pointer transition-all border-none outline-none disabled:opacity-50 font-khmer flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  {language === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-4 w-4" />
                  {language === 'kh' ? 'រក្សាទុកការកំណត់ទាំងអស់' : 'Save All Settings'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TelegramSettings;
