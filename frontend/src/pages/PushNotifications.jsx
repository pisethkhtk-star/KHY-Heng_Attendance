import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import pushNotificationService from '../services/PushNotificationService';
import departmentService from '../services/DepartmentService';
import employeeService from '../services/EmployeeService';
import {
  PaperAirplaneIcon,
  BellAlertIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ArrowPathIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  UserIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';

const PushNotifications = () => {
  const { locale, language } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';

  // State
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, cancelled: 0 });
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('ANNOUNCEMENT');
  const [targetAudience, setTargetAudience] = useState('ALL');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetStaffIds, setTargetStaffIds] = useState([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendTelegram, setSendTelegram] = useState(true);

  // Quick Templates
  const templates = [
    {
      label: isKhmer ? '📢 សេចក្តីជូនដំណឹងទូទៅ' : '📢 General Notice',
      type: 'ANNOUNCEMENT',
      title: isKhmer ? 'សេចក្តីជូនដំណឹងដល់បុគ្គលិកទាំងអស់' : 'Notice to All Staff Members',
      message: isKhmer
        ? 'សូមជម្រាបជូនដល់បុគ្គលិកទាំងអស់ជ្រាបថា ការិយាល័យនឹងរៀបចំកម្មវិធីជួបជុំនៅចុងសប្តាហ៍នេះ។'
        : 'Please be informed that there will be an all-hands meeting this Friday at 3:00 PM.',
    },
    {
      label: isKhmer ? '⏰ ការរំលឹកវត្តមាន' : '⏰ Attendance Reminder',
      type: 'REMINDER',
      title: isKhmer ? 'ការរំលឹក៖ សូមកុំភ្លេចចុះវត្តមាន' : 'Reminder: Check-in / Check-out',
      message: isKhmer
        ? 'សូមបុគ្គលិកទាំងអស់កុំភ្លេចស្កេនមុខចុះវត្តមានចេញ/ចូលទាន់ពេលវេលា។ អរគុណ!'
        : 'Please remember to complete your attendance scan for today. Thank you!',
    },
    {
      label: isKhmer ? '🚨 ដំណឹងបន្ទាន់' : '🚨 Urgent Alert',
      type: 'URGENT',
      title: isKhmer ? 'ដំណឹងបន្ទាន់ពីថ្នាក់ដឹកនាំ' : 'Urgent Notice from Management',
      message: isKhmer
        ? 'សូមបុគ្គលិកទាំងអស់ពិនិត្យមើលអ៊ីមែល ឬទាក់ទងមកកាន់ផ្នែករដ្ឋបាលជាបន្ទាន់។'
        : 'All staff members are requested to check their emails or contact HR immediately.',
    },
    {
      label: isKhmer ? '🎉 ថ្ងៃឈប់សម្រាកបុណ្យ' : '🎉 Holiday Announcement',
      type: 'EVENT',
      title: isKhmer ? 'សេចក្តីជូនដំណឹងអំពីថ្ងៃឈប់សម្រាកបុណ្យ' : 'Public Holiday Announcement',
      message: isKhmer
        ? 'ក្រុមហ៊ុននឹងឈប់សម្រាកក្នុងឱកាសបុណ្យខាងមុខនេះ។ សូមជូនពរឱ្យរីករាយក្នុងថ្ងៃឈប់សម្រាក!'
        : 'The company will be closed during the upcoming public holiday. Wishing everyone a restful break!',
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campList, campStats, deptList, empList] = await Promise.all([
        pushNotificationService.getAllCampaigns(),
        pushNotificationService.getCampaignStats(),
        departmentService.getAll().catch(() => []),
        employeeService.getAll().catch(() => []),
      ]);

      setCampaigns(campList || []);
      setStats(campStats || { total: 0, pending: 0, sent: 0, cancelled: 0 });
      setDepartments(deptList || []);
      setEmployees(empList || []);
    } catch (err) {
      console.error('Failed to load push notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyTemplate = (tmpl) => {
    setTitle(tmpl.title);
    setMessage(tmpl.message);
    setType(tmpl.type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!title.trim() || !message.trim()) {
      setErrorMessage(isKhmer ? 'សូមបញ្ចូលចំណងជើង និងខ្លឹមសារសារ' : 'Title and message are required');
      return;
    }

    if (isScheduled && !scheduledAt) {
      setErrorMessage(isKhmer ? 'សូមជ្រើសរើសកាលបរិច្ឆេទ និងម៉ោងផ្ញើ' : 'Please select a scheduled date and time');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        targetAudience,
        targetDepartmentId: targetAudience === 'DEPARTMENT' && targetDepartmentId ? targetDepartmentId : null,
        targetStaffIds: targetAudience === 'INDIVIDUAL' ? targetStaffIds : [],
        scheduledAt: isScheduled ? scheduledAt : null,
        sendTelegram,
      };

      await pushNotificationService.createCampaign(payload);
      setSuccessMessage(
        isScheduled
          ? (isKhmer ? 'ការជូនដំណឹងត្រូវបានកំណត់ពេលជោគជ័យ!' : 'Notification successfully scheduled!')
          : (isKhmer ? 'ការជូនដំណឹងត្រូវបានផ្ញើទៅកាន់ Mobile App ជោគជ័យ!' : 'Notification pushed to mobile app successfully!')
      );

      // Reset Form
      setTitle('');
      setMessage('');
      setType('ANNOUNCEMENT');
      setTargetAudience('ALL');
      setTargetDepartmentId('');
      setTargetStaffIds([]);
      setIsScheduled(false);
      setScheduledAt('');
      setShowModal(false);

      fetchData();
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to send push notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCampaign = async (id) => {
    if (!window.confirm(isKhmer ? 'តើអ្នកប្រាកដជាចង់បោះបង់ការជូនដំណឹងនេះ?' : 'Cancel this scheduled notification?')) return;
    try {
      await pushNotificationService.cancelCampaign(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm(isKhmer ? 'តើអ្នកប្រាកដជាចង់លុបចោលកំណត់ត្រានេះ?' : 'Delete this campaign record?')) return;
    try {
      await pushNotificationService.deleteCampaign(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const getTypeStyle = (t) => {
    switch ((t || '').toUpperCase()) {
      case 'URGENT':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
          dot: 'bg-rose-500',
          label: isKhmer ? 'បន្ទាន់' : 'Urgent',
        };
      case 'EVENT':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
          dot: 'bg-purple-500',
          label: isKhmer ? 'ព្រឹត្តិការណ៍' : 'Event',
        };
      case 'REMINDER':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          label: isKhmer ? 'ការរំលឹក' : 'Reminder',
        };
      case 'GENERAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
          dot: 'bg-emerald-500',
          label: isKhmer ? 'ទូទៅ' : 'General',
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
          dot: 'bg-blue-500',
          label: isKhmer ? 'សេចក្តីជូនដំណឹង' : 'Announcement',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[var(--bg-card)] border border-[var(--border-card)] p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <BellAlertIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                {isKhmer ? 'ផ្ញើការជូនដំណឹងទៅកាន់ Mobile App' : 'Mobile Push Notifications'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {isKhmer
                  ? 'បង្កើតការជូនដំណឹងភ្លាមៗ ឬកំណត់កាលវិភាគផ្ញើជាមុនទៅកាន់បុគ្គលិកទាំងអស់ តាមផ្នែក ឬបុគ្គលជាក់លាក់'
                  : 'Broadcast instant or scheduled notifications directly to employees mobile app & notifications drawer'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] hover:bg-[var(--border-card)] text-xs font-semibold cursor-pointer transition-all"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{isKhmer ? 'ទាញទិន្នន័យឡើងវិញ' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 cursor-pointer transition-all"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            <span>{isKhmer ? 'បង្កើតការជូនដំណឹងថ្មី' : 'New Push Notification'}</span>
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs animate-fadeIn">
          <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs animate-fadeIn">
          <XCircleIcon className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Stats Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {isKhmer ? 'ការជូនដំណឹងសរុប' : 'Total Broadcasts'}
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <MegaphoneIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-2">{stats.total || 0}</p>
          <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
            {isKhmer ? 'យុទ្ធនាការដែលបានបង្កើត' : 'Campaigns generated'}
          </span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {isKhmer ? 'បានកំណត់ពេល (រង់ចាំ)' : 'Scheduled (Pending)'}
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ClockIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-500 mt-2">{stats.pending || 0}</p>
          <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
            {isKhmer ? 'រង់ចាំដល់ម៉ោងផ្ញើដោយស្វ័យប្រវត្តិ' : 'Auto-dispatch on time'}
          </span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {isKhmer ? 'បានផ្ញើរួចរាល់' : 'Sent Successfully'}
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircleIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-500 mt-2">{stats.sent || 0}</p>
          <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
            {isKhmer ? 'បានទៅដល់ Mobile App' : 'Delivered to devices'}
          </span>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {isKhmer ? 'បានបោះបង់' : 'Cancelled'}
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <XCircleIcon className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-2">{stats.cancelled || 0}</p>
          <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
            {isKhmer ? 'បានលុបចោលកាលវិភាគ' : 'Cancelled by admin'}
          </span>
        </div>
      </div> */}

      {/* Campaign History Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-card)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {isKhmer ? 'ប្រវត្តិនៃការជូនដំណឹង (Notification History)' : 'Broadcast & Schedule Queue'}
            </h3>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            {campaigns.length} {isKhmer ? 'កំណត់ត្រា' : 'records'}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            <BellAlertIcon className="h-12 w-12 stroke-1 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {isKhmer ? 'មិនទាន់មានការជូនដំណឹងនៅឡើយទេ' : 'No push notifications generated yet'}
            </p>
            <p className="text-xs mt-1 opacity-70">
              {isKhmer ? 'ចុចលើ "បង្កើតការជូនដំណឹងថ្មី" ដើម្បីចាប់ផ្តើម' : 'Click "New Push Notification" above to broadcast to staff'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-app)]/50 border-b border-[var(--border-card)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">{isKhmer ? 'ប្រភេទ' : 'Type'}</th>
                  <th className="px-6 py-3.5">{isKhmer ? 'ចំណងជើង & ខ្លឹមសារ' : 'Title & Message'}</th>
                  <th className="px-6 py-3.5">{isKhmer ? 'គោលដៅ' : 'Target'}</th>
                  <th className="px-6 py-3.5">{isKhmer ? 'ពេលវេលា / ស្ថានភាព' : 'Schedule / Status'}</th>
                  <th className="px-6 py-3.5">{isKhmer ? 'ផ្ញើដោយ' : 'Created By'}</th>
                  <th className="px-6 py-3.5 text-right">{isKhmer ? 'សកម្មភាព' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-card)]">
                {campaigns.map((c) => {
                  const style = getTypeStyle(c.type);
                  const isPending = c.status === 'PENDING';
                  const isSent = c.status === 'SENT';
                  const isCancelled = c.status === 'CANCELLED';

                  return (
                    <tr key={c.id} className="hover:bg-[var(--bg-app)]/40 transition-colors">
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${style.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
                          {style.label}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top max-w-sm">
                        <p className="font-bold text-[var(--text-primary)] line-clamp-1">{c.title}</p>
                        <p className="text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                          {c.message}
                        </p>
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          {c.targetAudience === 'DEPARTMENT' ? (
                            <>
                              <BuildingOffice2Icon className="h-4 w-4 text-indigo-500" />
                              <span>{c.targetDepartmentName || 'Department'}</span>
                            </>
                          ) : c.targetAudience === 'INDIVIDUAL' ? (
                            <>
                              <UserIcon className="h-4 w-4 text-purple-500" />
                              <span>{c.recipientCount} {isKhmer ? 'នាក់' : 'Staff'}</span>
                            </>
                          ) : (
                            <>
                              <UserGroupIcon className="h-4 w-4 text-blue-500" />
                              <span>{isKhmer ? 'បុគ្គលិកទាំងអស់' : 'All Staff'} ({c.recipientCount || 0})</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        {isPending && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <ClockIcon className="h-3 w-3" />
                              {isKhmer ? 'រង់ចាំដល់ម៉ោង' : 'Scheduled'}
                            </span>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-mono">
                              {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString(isKhmer ? 'km-KH' : 'en-US', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }) : ''}
                            </p>
                          </div>
                        )}

                        {isSent && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircleIcon className="h-3 w-3" />
                              {isKhmer ? 'បានផ្ញើជោគជ័យ' : 'Sent'}
                            </span>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-mono">
                              {c.sentAt ? new Date(c.sentAt).toLocaleString(isKhmer ? 'km-KH' : 'en-US', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }) : ''}
                            </p>
                          </div>
                        )}

                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/30">
                            <XCircleIcon className="h-3 w-3" />
                            {isKhmer ? 'បានបោះបង់' : 'Cancelled'}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap text-[var(--text-secondary)]">
                        {c.createdBy || 'Admin'}
                      </td>

                      <td className="px-6 py-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              onClick={() => handleCancelCampaign(c.id)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all cursor-pointer"
                              title="Cancel Schedule"
                            >
                              {isKhmer ? 'បោះបង់' : 'Cancel'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCampaign(c.id)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Delete Record"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Schedule Notification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border-card)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
              <div className="flex items-center gap-2.5">
                <PaperAirplaneIcon className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {isKhmer ? 'ផ្ញើការជូនដំណឹងថ្មី (Push Notification)' : 'Create Push Notification'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--border-card)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Quick Template Picker */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                  <SparklesIcon className="h-4 w-4 text-amber-400" />
                  <span>{isKhmer ? 'គំរូសាររហ័ស (Quick Templates)' : 'Quick Message Templates'}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="p-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] hover:border-indigo-500 text-left text-xs text-[var(--text-primary)] transition-all cursor-pointer truncate"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  {isKhmer ? 'ចំណងជើងការជូនដំណឹង *' : 'Notification Title *'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isKhmer ? 'បញ្ចូលចំណងជើង...' : 'Enter notification title...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-primary)] text-xs outline-none focus:border-indigo-500 transition-all"
                  required
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  {isKhmer ? 'ប្រភេទសារ' : 'Notification Category'}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'ANNOUNCEMENT', label: isKhmer ? 'សេចក្តីជូនដំណឹង' : 'Announcement', color: 'blue' },
                    { id: 'URGENT', label: isKhmer ? 'បន្ទាន់' : 'Urgent', color: 'rose' },
                    { id: 'EVENT', label: isKhmer ? 'ព្រឹត្តិការណ៍' : 'Event', color: 'purple' },
                    { id: 'REMINDER', label: isKhmer ? 'ការរំលឹក' : 'Reminder', color: 'amber' },
                    { id: 'GENERAL', label: isKhmer ? 'ទូទៅ' : 'General', color: 'emerald' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id)}
                      className={`py-2 px-2 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${type === cat.id
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                          : 'border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:border-gray-400'
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Content */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex justify-between">
                  <span>{isKhmer ? 'ខ្លឹមសារការជូនដំណឹង *' : 'Notification Message *'}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">{message.length} chars</span>
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isKhmer ? 'សរសេរខ្លឹមសារដែលត្រូវផ្ញើទៅកាន់ទូរស័ព្ទដៃ...' : 'Type your notification message here...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-primary)] text-xs outline-none focus:border-indigo-500 transition-all leading-relaxed"
                  required
                />
              </div>

              {/* Target Audience Selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  {isKhmer ? 'គោលដៅទទួលសារ (Target Audience)' : 'Target Audience'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudience('ALL')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${targetAudience === 'ALL'
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        : 'border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
                      }`}
                  >
                    <UserGroupIcon className="h-4 w-4" />
                    <span>{isKhmer ? 'បុគ្គលិកទាំងអស់' : 'All Staff'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience('DEPARTMENT')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${targetAudience === 'DEPARTMENT'
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        : 'border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
                      }`}
                  >
                    <BuildingOffice2Icon className="h-4 w-4" />
                    <span>{isKhmer ? 'តាមដេប៉ាតឺម៉ង់' : 'By Department'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience('INDIVIDUAL')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${targetAudience === 'INDIVIDUAL'
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                        : 'border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-secondary)]'
                      }`}
                  >
                    <UserIcon className="h-4 w-4" />
                    <span>{isKhmer ? 'បុគ្គលជាក់លាក់' : 'Specific Staff'}</span>
                  </button>
                </div>

                {/* If Department Target */}
                {targetAudience === 'DEPARTMENT' && (
                  <div className="mt-3">
                    <select
                      value={targetDepartmentId}
                      onChange={(e) => setTargetDepartmentId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--bg-app)] text-[var(--text-primary)] text-xs outline-none focus:border-indigo-500 cursor-pointer"
                      required
                    >
                      <option value="">{isKhmer ? '-- ជ្រើសរើសដេប៉ាតឺម៉ង់ --' : '-- Select Department --'}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameKh ? `${d.nameKh} (${d.nameEn})` : d.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* If Individual Target */}
                {targetAudience === 'INDIVIDUAL' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {isKhmer ? 'ជ្រើសរើសបុគ្គលិកដែលត្រូវទទួលសារ (បានជ្រើស ' : 'Select staff to receive ('}
                      <span className="font-bold text-indigo-500">{targetStaffIds.length}</span>
                      {isKhmer ? ' នាក់)' : ' selected)'}
                    </p>
                    <div className="max-h-36 overflow-y-auto border border-[var(--border-card)] rounded-xl p-2 bg-[var(--bg-app)] space-y-1">
                      {employees.map((emp) => {
                        const isSelected = targetStaffIds.includes(emp.staffId);
                        return (
                          <label
                            key={emp.staffId}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 text-indigo-600 font-semibold' : 'text-[var(--text-primary)] hover:bg-[var(--border-card)]'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetStaffIds([...targetStaffIds, emp.staffId]);
                                } else {
                                  setTargetStaffIds(targetStaffIds.filter((id) => id !== emp.staffId));
                                }
                              }}
                              className="rounded border-[var(--border-card)] text-indigo-500 focus:ring-indigo-400"
                            />
                            <span>
                              {emp.staffId} - {emp.nameKh || emp.nameEn} ({emp.role})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Timing: Send Immediately vs Schedule */}
              <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-card)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <ClockIcon className="h-4 w-4 text-indigo-500" />
                    <span>{isKhmer ? 'ពេលវេលាផ្ញើ (Delivery Timing)' : 'Delivery Timing'}</span>
                  </span>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="timing"
                        checked={!isScheduled}
                        onChange={() => setIsScheduled(false)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{isKhmer ? 'ផ្ញើភ្លាមៗ' : 'Send Immediately'}</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="timing"
                        checked={isScheduled}
                        onChange={() => setIsScheduled(true)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{isKhmer ? 'កំណត់ពេលជាក់លាក់' : 'Schedule for Later'}</span>
                    </label>
                  </div>
                </div>

                {isScheduled && (
                  <div className="pt-2 border-t border-[var(--border-card)]">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      {isKhmer ? 'កាលបរិច្ឆេទ & ម៉ោងត្រូវផ្ញើ *' : 'Choose Date & Time *'}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-primary)] text-xs outline-none focus:border-indigo-500 font-mono"
                      required={isScheduled}
                    />
                  </div>
                )}
              </div>

              {/* Telegram Sync Toggle */}
              <label className="flex items-center gap-2.5 text-xs text-[var(--text-primary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendTelegram}
                  onChange={(e) => setSendTelegram(e.target.checked)}
                  className="rounded border-[var(--border-card)] text-indigo-600 focus:ring-indigo-500"
                />
                <span>{isKhmer ? 'ផ្ញើចម្លងសារនេះទៅកាន់ Telegram Channel របស់ក្រុមហ៊ុនផងដែរ' : 'Also cross-post notification to Telegram Channel'}</span>
              </label>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-card)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-[var(--border-card)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--border-card)] transition-all cursor-pointer"
                >
                  {isKhmer ? 'បោះបង់' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <PaperAirplaneIcon className={`h-4 w-4 ${submitting ? 'animate-bounce' : ''}`} />
                  <span>
                    {submitting
                      ? (isKhmer ? 'កំពុងដំណើរការ...' : 'Processing...')
                      : isScheduled
                        ? (isKhmer ? 'កំណត់កាលវិភាគ' : 'Schedule Notification')
                        : (isKhmer ? 'ផ្ញើទៅកាន់ Mobile App' : 'Push to Mobile App')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushNotifications;
