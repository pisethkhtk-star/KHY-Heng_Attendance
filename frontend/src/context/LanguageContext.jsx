import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
  en: {
    // Nav & Sidebar
    dashboard: "Dashboard",
    departments: "Departments",
    positions: "Positions",
    employees: "Employees",
    attendance: "Attendance Log",
    leaveGroup: "Leave",
    requestItem: "Request",
    types: "Types",
    allowances: "Allowances",
    setupGroup: "Setup",
    workHours: "Work Hours",
    reports: "Reports",
    facescan: "Facescan",
    checkAttendance: "Check Attendance",
    facescanMode: "Facescan Mode",
    qrscanMode: "QR Code Scan",
    branchSetting: "Branch",
    logout: "Log Out",
    welcome: "Welcome back",
    role: "Role",

    // Dashboard
    totalEmployees: "Total Employees",
    presentToday: "Present Today",
    lateToday: "Late Today",
    earlyLeaveToday: "Early Leave Today",
    onLeaveToday: "On Leave Today",
    attendanceSummary: "Today's Live Attendance",
    liveConsole: "Attendance Console",
    checkin1: "Check-in 1",
    checkout1: "Check-out 1",
    checkin2: "Check-in 2",
    checkout2: "Check-out 2",
    notLogged: "Not Logged",
    normal: "On Time",
    late: "Late",
    earlyLeave: "Early Leave",
    logAttendanceSuccess: "Attendance logged successfully!",

    // General Actions
    add: "Add New",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    actions: "Actions",
    search: "Search...",
    filter: "Filter",
    clear: "Clear",
    all: "All",
    status: "Status",
    branch: "Branch",
    submit: "Submit",
    loading: "Loading...",
    noData: "No data available",
    confirmDelete: "Are you sure you want to delete this item?",

    // Departments & Positions
    deptNameEn: "Department Name (EN)",
    deptNameKh: "Department Name (KH)",
    description: "Description",
    posTitleEn: "Position Title (EN)",
    posTitleKh: "Position Title (KH)",
    selectDept: "Select Department",

    // Employees
    staffId: "Staff ID",
    nameEn: "Name (EN)",
    nameKh: "Name (KH)",
    gender: "Gender",
    joinDate: "Join Date",
    email: "Email",
    password: "Password",
    selectPos: "Select Position",
    shift1: "Shift 1 (Morning)",
    shift2: "Shift 2 (Afternoon)",
    start: "Start",
    end: "End",
    male: "Male",
    female: "Female",
    other: "Other",
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    address: "Address",
    idCardPassport: "ID Card / Passport",
    uploadPhoto: "Upload Photo",
    capturePhoto: "Capture Photo",
    viewProfile: "View Profile",
    faceEnrolled: "Face Enrolled",
    faceNotEnrolled: "Face Not Enrolled",
    profile: "Profile",

    // Leaves
    leaveType: "Leave Type",
    leaveDate: "Leave Date",
    amountDays: "Duration (Days)",
    reason: "Reason",
    managerName: "Approved By",
    requestLeave: "Request Leave",
    approvalManage: "Approval Manage",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    annualLeave: "Annual Leave",
    sickLeave: "Sick Leave",
    personalLeave: "Personal Leave",

    // Reports
    attendanceReport: "Attendance & Leaflet Report",
    startDate: "Start Date",
    endDate: "End Date",
    exportExcel: "Export Excel",
    printPdf: "Print / PDF Report",
    searchFilter: "Search & Filters",
  },
  kh: {
    // Nav & Sidebar
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    departments: "ដេប៉ាតឺម៉ង់",
    positions: "តួនាទី",
    employees: "បុគ្គលិក",
    attendance: "កំណត់ត្រាវត្តមាន",
    leaveGroup: "ច្បាប់សម្រាក",
    requestItem: "ស្នើសុំច្បាប់",
    types: "ប្រភេទច្បាប់",
    allowances: "ចំនួនថ្ងៃច្បាប់អនុញ្ញាត",
    setupGroup: "ការកំណត់ប្រព័ន្ធ",
    workHours: "ម៉ោងការងារ",
    reports: "របាយការណ៍",
    facescan: "ស្កេនផ្ទៃមុខ (Facescan)",
    checkAttendance: "ចុះវត្តមាន (Attendance)",
    facescanMode: "ស្កេនផ្ទៃមុខ (Facescan)",
    qrscanMode: "ស្កេន QR Code (QRscan)",
    branchSetting: "សាខា (Branch)",
    logout: "ចាកចេញ",
    welcome: "ស្វាគមន៍ការត្រឡប់មកវិញ",
    role: "តួនាទីគណនី",

    // Dashboard
    totalEmployees: "បុគ្គលិកសរុប",
    presentToday: "វត្តមានថ្ងៃនេះ",
    lateToday: "យឺតថ្ងៃនេះ",
    earlyLeaveToday: "ចេញមុនថ្ងៃនេះ",
    onLeaveToday: "សុំច្បាប់ថ្ងៃនេះ",
    attendanceSummary: "វត្តមានផ្ទាល់ថ្ងៃនេះ",
    liveConsole: "កុងសូលចុះវត្តមាន",
    checkin1: "វត្តមាន ចូលទី១",
    checkout1: "វត្តមាន ចេញទី១",
    checkin2: "វត្តមាន ចូលទី២",
    checkout2: "វត្តមាន ចេញទី២",
    notLogged: "មិនទាន់កត់ត្រា",
    normal: "ទាន់ពេល",
    late: "យឺត",
    earlyLeave: "ចេញមុនម៉ោង",
    logAttendanceSuccess: "កត់ត្រាវត្តមានបានជោគជ័យ!",

    // General Actions
    add: "បន្ថែមថ្មី",
    edit: "កែសម្រួល",
    delete: "លុប",
    save: "រក្សាទុក",
    cancel: "បោះបង់",
    actions: "សកម្មភាព",
    search: "ស្វែងរក...",
    filter: "ចម្រោះ",
    clear: "សម្អាត",
    all: "ទាំងអស់",
    status: "ស្ថានភាព",
    branch: "សាខា",
    submit: "ដាក់ស្នើ",
    loading: "កំពុងដំណើរការ...",
    noData: "គ្មានទិន្នន័យ",
    confirmDelete: "តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?",

    // Departments & Positions
    deptNameEn: "ឈ្មោះដេប៉ាតឺម៉ង់ (អង់គ្លេស)",
    deptNameKh: "ឈ្មោះដេប៉ាតឺម៉ង់ (ខ្មែរ)",
    description: "ការពិពណ៌នា",
    posTitleEn: "ឈ្មោះតួនាទី (អង់គ្លេស)",
    posTitleKh: "ឈ្មោះតួនាទី (ខ្មែរ)",
    selectDept: "ជ្រើសរើសដេប៉ាតឺម៉ង់",

    // Employees
    staffId: "អត្តសញ្ញាណប័ណ្ណបុគ្គលិក",
    nameEn: "ឈ្មោះ (អង់គ្លេស)",
    nameKh: "ឈ្មោះ (ខ្មែរ)",
    gender: "ភេទ",
    joinDate: "ថ្ងៃចូលធ្វើការ",
    email: "អ៊ីមែល",
    password: "លេខសម្ងាត់",
    selectPos: "ជ្រើសរើសតួនាទី",
    shift1: "វេនទី១ (ព្រឹក)",
    shift2: "វេនទី២ (រសៀល)",
    start: "ម៉ោងចូល",
    end: "ម៉ោងចេញ",
    male: "ប្រុស",
    female: "ស្រី",
    other: "ផ្សេងៗ",
    active: "កំពុងធ្វើការ",
    inactive: "ឈប់ធ្វើការ",
    suspended: "ផ្អាកបណ្តោះអាសន្ន",
    address: "អាសយដ្ឋាន",
    idCardPassport: "អត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែន",
    uploadPhoto: "ផ្ទុកឡើងរូបភាព",
    capturePhoto: "ថតរូបភាព",
    viewProfile: "មើលប្រវត្តិរូប",
    faceEnrolled: "បានចុះឈ្មោះផ្ទៃមុខ",
    faceNotEnrolled: "មិនទាន់ចុះឈ្មោះផ្ទៃមុខ",
    profile: "ប្រវត្តិរូប",

    // Leaves
    leaveType: "ប្រភេទច្បាប់",
    leaveDate: "ថ្ងៃសុំច្បាប់",
    amountDays: "ចំនួនថ្ងៃច្បាប់",
    reason: "មូលហេតុ",
    managerName: "អនុម័តដោយ",
    requestLeave: "ស្នើសុំច្បាប់",
    approvalManage: "កំណត់អ្នកអនុម័ត (Approvals)",
    approve: "អនុម័ត",
    reject: "បដិសេធ",
    pending: "កំពុងរង់ចាំ",
    approved: "បានអនុម័ត",
    rejected: "បានបដិសេធ",
    annualLeave: "ច្បាប់សម្រាកប្រចាំឆ្នាំ",
    sickLeave: "ច្បាប់ឈឺ",
    personalLeave: "ច្បាប់ផ្ទាល់ខ្លួន",

    // Reports
    attendanceReport: "របាយការណ៍វត្តមាន និងការសុំច្បាប់",
    startDate: "ថ្ងៃចាប់ផ្តើម",
    endDate: "ថ្ងៃបញ្ចប់",
    exportExcel: "ទាញយកជា Excel",
    printPdf: "បោះពុម្ព / របាយការណ៍ PDF",
    searchFilter: "ការស្វែងរក និងចម្រោះ",
  }
};

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('locale') || 'kh'; // Default to Khmer
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
    // Dynamically change HTML lang attribute
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key) => {
    return translations[locale][key] || key;
  };

  const getLocalizedName = (en, kh) => {
    return locale === 'kh' ? kh : en;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, getLocalizedName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
