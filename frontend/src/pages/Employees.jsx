import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, QrCodeIcon, CameraIcon, CalendarDaysIcon, ClockIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import FlexibleSchedulePicker from '../components/FlexibleSchedulePicker';
import { WEEKDAYS } from '../utils/constants';
import { registerCameraStream } from '../utils/cameraManager';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

const Employees = () => {
  const { user } = useAuth();
  const { t, getLocalizedName, locale } = useLanguage();
  const isReadOnly = user.role === 'Manager';

  // Data States
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // QR / Face Modals State
  const [showQrModal, setShowQrModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [qrImage, setQrImage] = useState('');
  const [faceStatus, setFaceStatus] = useState('idle'); // idle, loading_models, camera_ready, processing, success, error
  const [faceError, setFaceError] = useState('');
  const [faceEnrollMethod, setFaceEnrollMethod] = useState('camera'); // 'camera' or 'upload'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileEmp, setProfileEmp] = useState(null);

  // Filters & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form State
  const [editId, setEditId] = useState(null);
  const [staffId, setStaffId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameKh, setNameKh] = useState('');
  const [gender, setGender] = useState('Male');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [branch, setBranch] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [status, setStatus] = useState('Active');
  const [shift1Start, setShift1Start] = useState('08:00');
  const [shift1End, setShift1End] = useState('12:00');
  const [shift2Start, setShift2Start] = useState('13:00');
  const [shift2End, setShift2End] = useState('17:00');
  const [enableShift2, setEnableShift2] = useState(true);
  const [isFlexible, setIsFlexible] = useState(false);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [flexibleSchedule, setFlexibleSchedule] = useState({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Employee');
  const [address, setAddress] = useState('');
  const [idCardPassport, setIdCardPassport] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formFaceDescriptor, setFormFaceDescriptor] = useState(null);
  const [formPhotoStatus, setFormPhotoStatus] = useState('idle'); // idle, processing, success, error

  const [profilePhoto, setProfilePhoto] = useState(''); // profile photo (simple upload, no face detect)
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [branches, setBranches] = useState([]);
  const [defaultWorkHours, setDefaultWorkHours] = useState({
    shift1Start: '08:00',
    shift1End: '12:00',
    shift2Start: '13:00',
    shift2End: '17:00',
    isFlexible: false,
    flexibleSchedule: '{}',
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let query = `?search=${search}`;
      if (filterDept) query += `&departmentId=${filterDept}`;
      if (filterBranch) query += `&branch=${filterBranch}`;
      if (filterStatus) query += `&status=${filterStatus}`;

      const response = await api.get(`/employees${query}`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiltersData = async () => {
    try {
      const deptRes = await api.get('/departments');
      setDepartments(deptRes.data);

      const posRes = await api.get('/positions');
      setPositions(posRes.data);

      try {
        const workHoursRes = await api.get('/company-work-hours');
        if (workHoursRes.data) {
          setDefaultWorkHours(workHoursRes.data);
        }
      } catch (err) {
        console.error('Error fetching default work hours:', err);
      }

      try {
        const kioskRes = await api.get('/kiosk-settings');
        setBranches(kioskRes.data);
      } catch (err) {
        console.error('Error fetching kiosk branches:', err);
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchEmployees();
  }, [search, filterDept, filterBranch, filterStatus]);

  const totalRecords = employees.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedEmployees = employees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  // Filter positions matching selected department in Form Modal
  const availablePositions = positions.filter(pos => !pos.departmentId || String(pos.departmentId) === String(departmentId));
  const displayPositions = availablePositions.length > 0 ? availablePositions : positions;

  // Sync position selection when department changes in form
  useEffect(() => {
    if (displayPositions.length > 0) {
      if (!displayPositions.find(p => String(p.id) === String(positionId))) {
        setPositionId(displayPositions[0].id);
      }
    }
  }, [departmentId, positions]);

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

  const handleOpenQrModal = async (emp) => {
    setSelectedEmp(emp);
    setQrImage('');
    setShowQrModal(true);
    try {
      const res = await api.get(`/qrcode/generate/${emp.staffId}`);
      setQrImage(res.data.qrImage);
    } catch (error) {
      console.error('Error generating QR image:', error);
    }
  };

  const handleOpenFaceModal = (emp) => {
    setSelectedEmp(emp);
    setFaceEnrollMethod('camera');
    setFaceStatus('idle');
    setFaceError('');
    setShowFaceModal(true);
  };

  const startCamera = async () => {
    try {
      setFaceStatus('loading_models');
      if (!window.faceapi) {
        throw new Error('Face Recognition library loading. Please wait a second.');
      }

      // Load neural net models locally with CDN fallback
      const loadModels = async () => {
        try {
          if (!window.faceapi.nets.tinyFaceDetector.params) {
            await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          }
          if (!window.faceapi.nets.faceLandmark68Net.params) {
            await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
          }
          if (!window.faceapi.nets.faceRecognitionNet.params) {
            await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');
          }
        } catch (localErr) {
          console.warn('Falling back to CDN for face-api models:', localErr);
          const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
          await window.faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
          await window.faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        }
      };
      await loadModels();

      setFaceStatus('camera_ready');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      registerCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;
    } catch (err) {
      console.error(err);
      setFaceStatus('error');
      setFaceError(err.message || 'Error initializing camera or loading models');
    }
  };

  useEffect(() => {
    if (showFaceModal && selectedEmp) {
      if (faceEnrollMethod === 'camera') {
        startCamera();
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setFaceStatus('idle');
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [showFaceModal, selectedEmp, faceEnrollMethod]);

  const handleCaptureFace = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setFaceStatus('processing');
    setFaceError('');
    try {
      const detection = await window.faceapi.detectSingleFace(
        videoRef.current,
        new window.faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        throw new Error('No face detected. Please face the camera directly and try again.');
      }

      const descriptorArray = Array.from(detection.descriptor);

      // Take canvas screenshot of video frame
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 225;
      const ctx = canvas.getContext('2d');
      // Draw flipped video
      ctx.translate(300, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, 300, 225);
      const base64Photo = canvas.toDataURL('image/jpeg', 0.8);

      await api.post('/face/enroll', {
        staffId: selectedEmp.staffId,
        faceDescriptor: descriptorArray,
        photoUrl: base64Photo
      });

      setFaceStatus('success');
      playSound('success');

      // Refresh data
      fetchEmployees();

      setTimeout(() => {
        handleCloseFaceModal();
      }, 2000);
    } catch (err) {
      console.error('Face enroll error:', err);
      setFaceStatus('camera_ready');
      setFaceError(err.response?.data?.message || err.message || 'Error scanning face');
      playSound('error');
    }
  };

  const handleFileUploadFace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFaceStatus('processing');
    setFaceError('');

    try {
      if (!window.faceapi) {
        throw new Error('Face recognition models are loading. Please wait.');
      }

      // Load neural net models locally with CDN fallback
      const loadModels = async () => {
        try {
          if (!window.faceapi.nets.tinyFaceDetector.params) {
            await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          }
          if (!window.faceapi.nets.faceLandmark68Net.params) {
            await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
          }
          if (!window.faceapi.nets.faceRecognitionNet.params) {
            await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');
          }
        } catch (localErr) {
          console.warn('Falling back to CDN for face-api models:', localErr);
          const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await window.faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
          await window.faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
          await window.faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        }
      };
      await loadModels();

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image file.'));
      });

      const detection = await window.faceapi.detectSingleFace(
        img,
        new window.faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        throw new Error(locale === 'kh'
          ? 'រូបភាពមិនច្បាស់ ឬរកមិនឃើញផ្ទៃមុខឡើយ! សូមសាកល្បងរូបភាពផ្សេង។'
          : 'Image is not clear or no face detected. Please try another image.'
        );
      }

      const descriptorArray = Array.from(detection.descriptor);

      const canvas = document.createElement('canvas');
      const maxDim = 300;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const base64Photo = canvas.toDataURL('image/jpeg', 0.8);

      await api.post('/face/enroll', {
        staffId: selectedEmp.staffId,
        faceDescriptor: descriptorArray,
        photoUrl: base64Photo
      });

      setFaceStatus('success');
      playSound('success');

      fetchEmployees();

      setTimeout(() => {
        handleCloseFaceModal();
      }, 2000);
    } catch (err) {
      console.error('Face upload error:', err);
      setFaceStatus('idle');
      setFaceError(err.response?.data?.message || err.message || 'Error processing uploaded image.');
      playSound('error');
    }
  };


  const handleCloseFaceModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    setShowFaceModal(false);
    setSelectedEmp(null);
  };

  const handleProfilePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhotoLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize to max 400px
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; } }
        else { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setProfilePhoto(canvas.toDataURL('image/jpeg', 0.85));
        setProfilePhotoLoading(false);
      };
      img.onerror = () => setProfilePhotoLoading(false);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddModal = () => {
    setEditId(null);
    setStaffId('');
    setNameEn('');
    setNameKh('');
    setGender('Male');
    const firstDept = departments[0]?.id || '';
    setDepartmentId(firstDept);
    const validPos = positions.filter(p => !p.departmentId || String(p.departmentId) === String(firstDept));
    const firstPos = validPos[0]?.id || positions[0]?.id || '';
    setPositionId(firstPos);
    setBranch(branches[0]?.name || 'Phnom Penh HQ');
    setJoinDate(new Date().toISOString().split('T')[0]);
    setStatus('Active');
    const dHours = defaultWorkHours || {};
    const has2 = Boolean(dHours.shift2Start && String(dHours.shift2Start).trim() !== '' && dHours.shift2End && String(dHours.shift2End).trim() !== '');
    setEnableShift2(has2);
    setShift1Start(dHours.shift1Start || '08:00');
    setShift1End(dHours.shift1End || '12:00');
    setShift2Start(dHours.shift2Start || '13:00');
    setShift2End(dHours.shift2End || '17:00');
    setIsFlexible(Boolean(dHours.isFlexible));
    if (dHours.flexibleSchedule) {
      try {
        const parsed = typeof dHours.flexibleSchedule === 'string'
          ? JSON.parse(dHours.flexibleSchedule)
          : dHours.flexibleSchedule;
        setFlexibleSchedule(parsed || {});
        setWorkingDays(Array.isArray(parsed?.workingDays) ? parsed.workingDays : [1, 2, 3, 4, 5]);
      } catch (e) {
        setFlexibleSchedule({});
        setWorkingDays([1, 2, 3, 4, 5]);
      }
    } else {
      setFlexibleSchedule({});
      setWorkingDays([1, 2, 3, 4, 5]);
    }
    setEmail('');
    setPassword('');
    setRole('Employee');
    setAddress('');
    setIdCardPassport('');
    setFormPhoto('');
    setFormFaceDescriptor(null);
    setFormPhotoStatus('idle');
    setProfilePhoto('');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (emp) => {
    if (!emp) return;
    setEditId(emp.id);
    setStaffId(emp.staffId || '');
    setNameEn(emp.nameEn || '');
    setNameKh(emp.nameKh || '');
    setGender(emp.gender || 'Male');
    setDepartmentId(emp.departmentId || departments[0]?.id || '');
    setPositionId(emp.positionId || '');
    setBranch(emp.branch || '');
    setJoinDate(emp.joinDate ? emp.joinDate.split('T')[0] : '');
    setStatus(emp.status || 'Active');
    const has2 = Boolean(emp.shift2Start && String(emp.shift2Start).trim() !== '' && emp.shift2End && String(emp.shift2End).trim() !== '');
    setEnableShift2(has2);
    setShift1Start(emp.shift1Start || '08:00');
    setShift1End(emp.shift1End || '12:00');
    setShift2Start(emp.shift2Start || '13:00');
    setShift2End(emp.shift2End || '17:00');
    setIsFlexible(Boolean(emp.isFlexible));
    if (emp.flexibleSchedule) {
      try {
        const parsed = typeof emp.flexibleSchedule === 'string'
          ? JSON.parse(emp.flexibleSchedule)
          : emp.flexibleSchedule;
        setFlexibleSchedule(parsed || {});
        setWorkingDays(Array.isArray(parsed?.workingDays) ? parsed.workingDays : [1, 2, 3, 4, 5]);
      } catch (e) {
        setFlexibleSchedule({});
        setWorkingDays([1, 2, 3, 4, 5]);
      }
    } else {
      setFlexibleSchedule({});
      setWorkingDays([1, 2, 3, 4, 5]);
    }
    setEmail(emp.email || '');
    setPassword(''); // leave blank
    setRole(emp.role);
    setAddress(emp.address || '');
    setIdCardPassport(emp.idCardPassport || '');
    setFormPhoto(emp.faceData?.[0]?.photoUrl || '');
    setFormFaceDescriptor(null);
    setFormPhotoStatus(emp.faceData?.[0]?.photoUrl ? 'success' : 'idle');
    setProfilePhoto(emp.photoUrl || '');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!staffId.trim() || !nameEn.trim() || !nameKh.trim() || !email.trim()) {
      setErrorMsg(locale === 'kh' ? 'សូមបំពេញព័ត៌មានដែលចាំបាច់ទាំងអស់ (Staff ID, ឈ្មោះ, Email)!' : 'Please fill in all required fields (Staff ID, Name, Email)!');
      return;
    }

    if (!departmentId) {
      setErrorMsg(locale === 'kh' ? 'សូមជ្រើសរើសនាយកដ្ឋាន (Department)!' : 'Please select a department!');
      return;
    }

    if (!positionId) {
      setErrorMsg(locale === 'kh' ? 'សូមជ្រើសរើសតួនាទី (Position)!' : 'Please select a position!');
      return;
    }

    if (!editId && !password.trim()) {
      setErrorMsg(locale === 'kh' ? 'សូមវាយបញ្ចូលពាក្យសម្ងាត់ (Password) សម្រាប់បុគ្គលិកថ្មី!' : 'Please enter a password for the new employee!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        staffId: staffId.trim(),
        nameEn: nameEn.trim(),
        nameKh: nameKh.trim(),
        gender,
        positionId,
        departmentId,
        branch: branch || '',
        joinDate: joinDate || new Date().toISOString().split('T')[0],
        status,
        shift1Start: shift1Start || '08:00',
        shift1End: shift1End || '12:00',
        shift2Start: enableShift2 ? (shift2Start || '13:00') : '',
        shift2End: enableShift2 ? (shift2End || '17:00') : '',
        isFlexible: Boolean(isFlexible),
        flexibleSchedule: JSON.stringify({
          ...(typeof flexibleSchedule === 'object' ? flexibleSchedule : {}),
          workingDays,
        }),
        email: email.trim(),
        role,
        address: address || '',
        idCardPassport: idCardPassport || '',
        facePhoto: formPhotoStatus === 'success' ? formPhoto : undefined,
        faceDescriptor: formFaceDescriptor || undefined,
        profilePhoto: profilePhoto || undefined,
      };

      if (password && password.trim()) {
        payload.password = password.trim();
      }

      if (editId) {
        await api.put(`/employees/${editId}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      setShowModal(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      setErrorMsg(error.response?.data?.message || (locale === 'kh' ? 'មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យបុគ្គលិក' : 'Error saving employee'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("confirmDelete"))) return;

    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert(error.response?.data?.message || 'Error deleting employee');
    }
  };

  const handleExportExcel = () => {
    if (employees.length === 0) return;

    const todayStr = formatDateDDMMYYYY(new Date());
    const title = `Employee Personnel Records (${todayStr})`;

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Employees</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; }
          .title-row { font-size: 14pt; font-weight: bold; text-align: center; height: 35px; }
          table.report-table { border-collapse: collapse; width: 100%; border: 1px solid #000000; }
          table.report-table th { border: 1px solid #000000; background-color: #f3f4f6; font-weight: bold; text-align: left; padding: 6px 10px; font-size: 10pt; }
          table.report-table td { border: 1px solid #000000; padding: 6px 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
          <tr>
            <td colspan="12" class="title-row" style="font-size:14pt; font-weight:bold; text-align:center; height:35px;">
              ${title}
            </td>
          </tr>
        </table>

        <table class="report-table" border="1" style="border-collapse:collapse; width:100%; border:1px solid #000000;">
          <thead>
            <tr style="background-color:#f3f4f6;">
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:45px; text-align:center;">No</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:100px;">Staff ID</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Name (EN)</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Name (KH)</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:80px;">Gender</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Department</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:160px;">Position</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:120px;">Branch</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:180px;">Email</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:90px;">Role</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:110px;">Join Date</th>
              <th style="border:1px solid #000000; padding:6px 10px; font-weight:bold; width:90px;">Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    employees.forEach((emp, idx) => {
      const rowNo = idx + 1;
      const staffId = emp.staffId || '';
      const nameEn = emp.nameEn || '';
      const nameKh = emp.nameKh || '';
      const gender = emp.gender || '';
      const dept = emp.department?.nameEn || emp.department?.nameKh || '';
      const pos = emp.position?.titleEn || emp.position?.titleKh || '';
      const branch = emp.branch || '';
      const email = emp.email || '';
      const role = emp.role || '';
      const joinDate = formatDateDDMMYYYY(emp.joinDate);
      const status = emp.status || '';

      excelHTML += `
        <tr>
          <td style="border:1px solid #000000; text-align:center; padding:5px 8px;">${rowNo}</td>
          <td style="border:1px solid #000000; padding:5px 10px; font-weight:bold;">${staffId}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${nameEn}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${nameKh}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${gender}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${dept}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${pos}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${branch}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${email}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${role}</td>
          <td style="border:1px solid #000000; padding:5px 10px;">${joinDate}</td>
          <td style="border:1px solid #000000; padding:5px 10px; font-weight:bold;">${status}</td>
        </tr>
      `;
    });

    excelHTML += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const todayFileStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Employees_List_${todayFileStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center glass-card p-6 rounded-2xl glow-indigo gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-khmer">{t("employees")}</h2>
          <p className="text-slate-400 text-xs mt-1">Manage corporate personnel records</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={employees.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d1fae5] hover:bg-[#a7f3d0] border border-[#6ee7b7] text-[#059669] rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-khmer"
          >
            <ArrowDownTrayIcon className="h-4 w-4 stroke-[2.5]" />
            <span>{t('exportExcel')}</span>
          </button>
          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none"
            >
              <PlusIcon className="h-5 w-5" />
              {t("add")}
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-6 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="pl-10 w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
          />
        </div>

        {/* Department Filter */}
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
        >
          <option value="" className="bg-slate-900">{t("selectDept")} ({t("all")})</option>
          {departments.map(d => (
            <option key={d.id} value={d.id} className="bg-slate-900">{getLocalizedName(d.nameEn, d.nameKh)}</option>
          ))}
        </select>

        {/* Branch Filter */}
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
        >
          <option value="" className="bg-slate-900">{t("branch")} ({t("all")})</option>
          {branches.map(b => (
            <option key={b.id} value={b.name} className="bg-slate-900">{b.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
        >
          <option value="" className="bg-slate-900">{t("status")} ({t("all")})</option>
          <option value="Active" className="bg-slate-900">{t("active")}</option>
          <option value="Inactive" className="bg-slate-900">{t("inactive")}</option>
          <option value="Suspended" className="bg-slate-900">{t("suspended")}</option>
        </select>
      </div>

      {/* Employees Table List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-khmer">{t("loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs text-slate-300 uppercase border-b border-white/10">
                <tr>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap w-16 text-center">{t("noNumber")}</th>
                  <th className="py-4 px-6 font-khmer">{t("employees")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("gender")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("branch")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("status")}</th>
                  <th className="py-4 px-6 font-khmer whitespace-nowrap">{t("joinDate")}</th>
                  <th className="py-4 px-6 text-right font-khmer whitespace-nowrap">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500 font-khmer">
                      {t("noData")}
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((emp, index) => {
                    const rowNumber = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-center font-semibold text-slate-400 whitespace-nowrap font-mono">
                          {rowNumber}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {/* Profile Avatar */}
                            {emp.photoUrl ? (
                              <img
                                src={emp.photoUrl}
                                alt={emp.nameEn}
                                className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/30 flex-shrink-0 shadow-md"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-md">
                                {emp.nameEn?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-white">
                                {getLocalizedName(emp.nameEn, emp.nameKh)}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">
                                ID: <span className="text-indigo-400 font-semibold">{emp.staffId}</span>{emp.role ? ` • ${emp.role}` : ''}
                              </p>
                              <p className="text-xs font-semibold text-indigo-400">
                                {getLocalizedName(emp.department.nameEn, emp.department.nameKh)} • {getLocalizedName(emp.position.titleEn, emp.position.titleKh)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-khmer text-slate-300 whitespace-nowrap">{emp.gender === 'Male' ? t("male") : emp.gender === 'Female' ? t("female") : t("other")}</td>
                        <td className="py-4 px-6 text-slate-300 whitespace-nowrap">{emp.branch}</td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-khmer ring-1 ${emp.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                              : emp.status === 'Inactive'
                                ? 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                                : 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
                              }`}
                          >
                            {emp.status === 'Active' ? t("active") : emp.status === 'Inactive' ? t("inactive") : t("suspended")}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-300 whitespace-nowrap font-mono">
                          {formatDateDDMMYYYY(emp.joinDate)}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Always show View Profile button */}
                            <button
                              onClick={() => {
                                setProfileEmp(emp);
                                setShowProfileModal(true);
                              }}
                              className="inline-flex p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                              title={t("viewProfile")}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            </button>

                            {!isReadOnly && (
                              <>
                                <button
                                  onClick={() => handleOpenQrModal(emp)}
                                  className="inline-flex p-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="View QR Code"
                                >
                                  <QrCodeIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenFaceModal(emp)}
                                  className="inline-flex p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/25 border border-purple-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="Enroll Face Descriptor"
                                >
                                  <CameraIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(emp)}
                                  className="inline-flex p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20 rounded-lg transition-colors cursor-pointer"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(emp.id)}
                                  className="inline-flex p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && totalRecords > 0 && (
          <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-slate-400 font-khmer">
              Total : <span className="font-bold text-white font-mono">{totalRecords}</span> records
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
              {/* Prev Button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 min-w-[32px] px-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                &lsaquo;
              </button>

              {/* Page Number Buttons */}
              {getPaginationItems().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`dots-${idx}`} className="h-8 min-w-[32px] flex items-center justify-center text-slate-500 font-mono">
                      ...
                    </span>
                  );
                }
                const isCurrent = item === currentPage;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                        : 'border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 min-w-[32px] px-2 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 overflow-y-auto py-8">
          <div className="w-full max-w-5xl bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo my-auto">
            <div className="px-6 py-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-khmer flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                <span>{editId ? t("edit") : t("add")} {t("employees")}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 max-h-[82vh] overflow-y-auto">
              {errorMsg && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center">
                  {errorMsg}
                </div>
              )}

              {/* Profile Photo Upload */}
              <div className="flex flex-col items-center gap-3 mb-2">
                <div className="relative group">
                  {profilePhoto ? (
                    <div className="relative">
                      <img
                        src={profilePhoto}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500/40 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setProfilePhoto('')}
                        className="absolute -top-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow cursor-pointer border-none transition-colors"
                        title="Remove photo"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center gap-1 group-hover:border-indigo-400/70 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-400/70">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                  )}
                  {profilePhotoLoading && (
                    <div className="absolute inset-0 rounded-full bg-slate-900/70 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePhotoUpload}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-lg transition-all cursor-pointer font-khmer">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    {profilePhoto ? (locale === 'kh' ? 'ផ្លាស់ប្ដូររូបភាព' : 'Change Photo') : (locale === 'kh' ? 'ផ្ទុករូបភាព' : 'Upload Photo')}
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 font-khmer text-center">
                  {locale === 'kh' ? 'JPG, PNG, GIF • អតិបរិមា 5MB' : 'JPG, PNG, GIF • Max 5MB'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Staff ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("staffId")} *</label>
                  <input
                    type="text"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="EMP-001"
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("email")} *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@attendance.com"
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Name EN */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("nameEn")} *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Sok Mean"
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Name KH */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("nameKh")} *</label>
                  <input
                    type="text"
                    required
                    value={nameKh}
                    onChange={(e) => setNameKh(e.target.value)}
                    placeholder="សុខ មាន"
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">
                    {t("password")} {editId ? `(${locale === 'kh' ? 'ស្រេចចិត្ត' : 'optional'})` : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("gender")}</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    <option value="Male" className="bg-slate-900">{t("male")}</option>
                    <option value="Female" className="bg-slate-900">{t("female")}</option>
                    <option value="Other" className="bg-slate-900">{t("other")}</option>
                  </select>
                </div>

                {/* Address */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("address")}</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={locale === 'kh' ? 'ឧ. ផ្ទះលេខ ១២៣, ផ្លូវលេខ ៤៥៦, ភ្នំពេញ' : 'e.g. #123, St 456, Phnom Penh'}
                    rows={2}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Identity Card Number / Passport */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("idCardPassport")}</label>
                  <input
                    type="text"
                    value={idCardPassport}
                    onChange={(e) => setIdCardPassport(e.target.value)}
                    placeholder={locale === 'kh' ? 'ឧ. អត្តសញ្ញាណប័ណ្ណ ឬ លិខិតឆ្លងដែន' : 'e.g. Identity Card or Passport Number'}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Department Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("selectDept")} *</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id} className="bg-slate-900">{getLocalizedName(d.nameEn, d.nameKh)}</option>
                    ))}
                  </select>
                </div>

                {/* Position Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("selectPos")} *</label>
                  <select
                    value={positionId}
                    onChange={(e) => setPositionId(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    {displayPositions.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900">{getLocalizedName(p.titleEn, p.titleKh)}</option>
                    ))}
                  </select>
                </div>

                {/* Branch Selection (Multi-select via Checkboxes) */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase font-khmer">
                    {t("branch")} * (ជ្រើសរើសសាខាសម្រាប់ចុះវត្តមាន)
                  </label>
                  {branches.length === 0 && !branch ? (
                    <p className="text-xs text-slate-500 font-khmer">មិនទាន់មានសាខាត្រូវបានបង្កើតឡើយ (No branches created)</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/60 border border-white/10 rounded-xl">
                      {[...branches, ...(branch ? branch.split(',').map(x => x.trim()).filter(name => name && !branches.some(b => b.name.toLowerCase() === name.toLowerCase())).map(name => ({ id: `legacy-${name}`, name })) : [])].map(b => {
                        const isChecked = branch
                          ? branch.split(',').map(x => x.trim().toLowerCase()).includes(b.name.toLowerCase())
                          : false;

                        return (
                          <label key={b.id} className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const currentList = branch ? branch.split(',').map(x => x.trim()).filter(Boolean) : [];
                                let newList;
                                if (currentList.some(x => x.toLowerCase() === b.name.toLowerCase())) {
                                  newList = currentList.filter(x => x.toLowerCase() !== b.name.toLowerCase());
                                } else {
                                  newList = [...currentList, b.name];
                                }
                                setBranch(newList.join(', '));
                              }}
                              className="rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer h-4 w-4"
                            />
                            <span>{b.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Join Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("joinDate")}</label>
                  <input
                    type="date"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">{t("status")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all font-khmer"
                  >
                    <option value="Active" className="bg-slate-900">{t("active")}</option>
                    <option value="Inactive" className="bg-slate-900">{t("inactive")}</option>
                    <option value="Suspended" className="bg-slate-900">{t("suspended")}</option>
                  </select>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase font-khmer">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full py-2 px-3 border border-white/10 bg-slate-950/60 text-white rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-900 outline-none transition-all"
                  >
                    <option value="Employee" className="bg-slate-900">Employee</option>
                    <option value="Manager" className="bg-slate-900">Manager</option>
                    <option value="HR" className="bg-slate-900">HR</option>
                    <option value="Admin" className="bg-slate-900">Admin</option>
                  </select>
                </div>

                {/* Working Days Checkboxes (Monday - Sunday) - Located Between Role and Flexible */}
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase font-khmer">
                    {t("workingDaysWeekly")} * ({locale === 'kh' ? 'ជ្រើសរើសថ្ងៃធ្វើការប្រចាំសប្ដាហ៍' : 'Select working days of the week'})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 p-3.5 bg-slate-950/60 border border-white/10 rounded-xl">
                    {WEEKDAYS.map(day => {
                      const isChecked = workingDays.includes(day.key);
                      return (
                        <label key={day.key} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none font-semibold">
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
                          <span className="font-khmer">{locale === 'kh' ? day.kh : day.en}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shift definitions & Flexible Working Hours */}
              <div className="border-t border-white/10 pt-4 space-y-4">
                {/* Master Flexible Mode Switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-indigo-500/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isFlexible ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/10 text-indigo-400'}`}>
                      {isFlexible ? <CalendarDaysIcon className="h-5 w-5" /> : <ClockIcon className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-khmer">{t("flexibleHours")}</span>
                        {isFlexible && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-khmer">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-khmer mt-0.5">{t("flexibleHoursDesc")}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isFlexible}
                    onClick={() => setIsFlexible(!isFlexible)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isFlexible ? 'bg-purple-600 shadow-md shadow-purple-600/40' : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isFlexible ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* FIXED SHIFTS PANEL (When isFlexible is FALSE) */}
                {!isFlexible && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Shift Times Header & Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer">
                          {t("shiftConfig")}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-khmer mt-0.5">
                          {enableShift2 ? t("twoShiftsDesc") : t("singleShift")}
                        </p>
                      </div>

                      {/* Switch Toggle */}
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

                    <div className={`grid gap-4 bg-slate-950/40 p-4 rounded-xl border border-white/5 transition-all duration-300 ${enableShift2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                      }`}>
                      {/* Shift 1 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-slate-400 uppercase font-khmer">{t("shift1")}</p>
                          {!enableShift2 && (
                            <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md font-khmer">
                              {t("singleShift")}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase mb-0.5">{t("start")}</label>
                            <input
                              type="time"
                              value={shift1Start}
                              onChange={(e) => setShift1Start(e.target.value)}
                              required={!isFlexible}
                              className="block w-full py-1.5 px-2 border border-white/10 bg-slate-950/60 text-white rounded-lg outline-none font-mono focus:border-indigo-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 uppercase mb-0.5">{t("end")}</label>
                            <input
                              type="time"
                              value={shift1End}
                              onChange={(e) => setShift1End(e.target.value)}
                              required={!isFlexible}
                              className="block w-full py-1.5 px-2 border border-white/10 bg-slate-950/60 text-white rounded-lg outline-none font-mono focus:border-indigo-500 font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Shift 2 (Only visible if enableShift2 is true) */}
                      {enableShift2 && (
                        <div className="space-y-2 animate-fade-in">
                          <p className="text-[11px] font-bold text-slate-400 uppercase font-khmer">{t("shift2")}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase mb-0.5">{t("start")}</label>
                              <input
                                type="time"
                                value={shift2Start}
                                onChange={(e) => setShift2Start(e.target.value)}
                                required={!isFlexible && enableShift2}
                                className="block w-full py-1.5 px-2 border border-white/10 bg-slate-950/60 text-white rounded-lg outline-none font-mono focus:border-indigo-500 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 uppercase mb-0.5">{t("end")}</label>
                              <input
                                type="time"
                                value={shift2End}
                                onChange={(e) => setShift2End(e.target.value)}
                                required={!isFlexible && enableShift2}
                                className="block w-full py-1.5 px-2 border border-white/10 bg-slate-950/60 text-white rounded-lg outline-none font-mono focus:border-indigo-500 font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* FLEXIBLE WORKING HOURS MONTHLY SCHEDULE (When isFlexible is TRUE) */}
                {isFlexible && (
                  <div className="space-y-3 animate-fade-in">
                    <FlexibleSchedulePicker
                      scheduleData={{
                        ...(typeof flexibleSchedule === 'object' ? flexibleSchedule : {}),
                        workingDays,
                      }}
                      onChange={(newSchedule) => {
                        setFlexibleSchedule(newSchedule);
                        if (newSchedule && Array.isArray(newSchedule.workingDays)) {
                          setWorkingDays(newSchedule.workingDays);
                        }
                      }}
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
              </div>

              {/* Action Buttons */}
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
                  disabled={submitting}
                  className="py-2 px-5 text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/25 font-khmer cursor-pointer border-none outline-none disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></span>
                      <span>{locale === 'kh' ? 'កំពុងរក្សាទុក...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{t("save")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <div className="w-full max-w-sm bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white font-khmer">QR Code Badge</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 flex flex-col items-center space-y-4">
              <p className="text-sm font-semibold text-white font-khmer">
                {getLocalizedName(selectedEmp.nameEn, selectedEmp.nameKh)} ({selectedEmp.staffId})
              </p>
              {qrImage ? (
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <img src={qrImage} alt="QR Code Badge" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-sm font-khmer">
                  {t("loading")}
                </div>
              )}
              <p className="text-[11px] text-slate-400 text-center font-khmer leading-relaxed">
                Scan this QR badge at the Office Entrance Kiosk to check in or check out.
              </p>
              {qrImage && (
                <a
                  href={qrImage}
                  download={`QR_Badge_${selectedEmp.staffId}.png`}
                  className="w-full py-2.5 px-4 text-center text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md shadow-cyan-500/25 font-khmer"
                >
                  Download QR Code
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Face Capture Modal */}
      {showFaceModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white font-khmer">Enroll Face: {selectedEmp.nameEn}</h3>
              <button
                onClick={handleCloseFaceModal}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Tabs for enrolling method */}
            <div className="flex border-b border-white/10 bg-slate-950/20 text-xs">
              <button
                type="button"
                onClick={() => setFaceEnrollMethod('camera')}
                className={`flex-1 py-3 text-center font-semibold transition-colors cursor-pointer border-none outline-none ${faceEnrollMethod === 'camera'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/5'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                📹 {t("capturePhoto")}
              </button>
              <button
                type="button"
                onClick={() => setFaceEnrollMethod('upload')}
                className={`flex-1 py-3 text-center font-semibold transition-colors cursor-pointer border-none outline-none ${faceEnrollMethod === 'upload'
                  ? 'text-indigo-400 border-b-2 border-indigo-500 bg-white/5'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                📁 {t("uploadPhoto")}
              </button>
            </div>

            <div className="p-6 space-y-4">
              {faceEnrollMethod === 'camera' ? (
                <>
                  <div className="relative aspect-video rounded-xl border border-white/10 bg-slate-950/80 overflow-hidden flex items-center justify-center">
                    {faceStatus === 'loading_models' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 font-khmer bg-slate-950/90 z-10 text-xs">
                        <span className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></span>
                        <span>Initializing Face AI Models...</span>
                      </div>
                    )}
                    {faceStatus === 'processing' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 font-khmer bg-slate-950/90 z-10 text-xs">
                        <span className="animate-pulse text-indigo-400 font-bold">Scanning Face Coordinates...</span>
                      </div>
                    )}
                    {faceStatus === 'success' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 gap-2 font-khmer bg-slate-950/90 z-10 text-sm">
                        <span className="text-3xl">✅</span>
                        <span className="font-bold">Face Enrolled Successfully!</span>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  </div>

                  {faceError && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center font-khmer">
                      {faceError}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 font-khmer text-center">
                    {faceStatus === 'camera_ready' && "Position your face in the center of the frame and click 'Capture'."}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleCloseFaceModal}
                      className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={faceStatus !== 'camera_ready'}
                      onClick={handleCaptureFace}
                      className="py-2 px-4 text-xs font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/25 font-khmer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none"
                    >
                      Capture and Enroll
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-8 bg-slate-950/40 transition-colors flex flex-col items-center justify-center text-center cursor-pointer group gap-3 min-h-[180px]">
                    {faceStatus === 'processing' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 font-khmer bg-slate-950/95 rounded-xl z-10 text-xs">
                        <span className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></span>
                        <span>Verifying & Scanning Face Details...</span>
                      </div>
                    )}
                    {faceStatus === 'success' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 gap-2 font-khmer bg-slate-950/95 rounded-xl z-10 text-sm">
                        <span className="text-3xl">✅</span>
                        <span className="font-bold">Face Enrolled Successfully!</span>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadFace}
                      className="absolute inset-0 opacity-0 cursor-pointer z-20"
                    />

                    <div className="p-3 bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform rounded-xl">
                      <CameraIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 font-khmer">
                        {locale === 'kh' ? 'ចុចទីនេះដើម្បីផ្ទុកឡើងរូបភាព' : 'Click to Upload Photo'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-khmer mt-1 leading-relaxed">
                        Supports JPEG, PNG up to 5MB.<br />
                        <span className="text-amber-500/90 font-medium">⚠️ Condition: The photo must be clear & contain a recognizable face.</span>
                      </p>
                    </div>
                  </div>

                  {faceError && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center font-khmer">
                      {faceError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleCloseFaceModal}
                      className="py-2 px-4 text-xs font-semibold border border-white/10 text-slate-400 rounded-xl hover:bg-white/5 transition-colors font-khmer cursor-pointer"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Detail Modal */}
      {showProfileModal && profileEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 overflow-y-auto py-10">
          <div className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden glow-indigo my-auto">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white font-khmer">
                {t("profile")}: {getLocalizedName(profileEmp.nameEn, profileEmp.nameKh)}
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileEmp(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Profile Top Summary Section */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950/40 border border-white/5 rounded-2xl">
                {/* Profile Picture */}
                <div className="relative h-24 w-24 rounded-2xl overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center shadow-inner">
                  {profileEmp.photoUrl ? (
                    <img
                      src={profileEmp.photoUrl}
                      alt={profileEmp.nameEn}
                      className="h-full w-full object-cover"
                    />
                  ) : profileEmp.faceData?.[0]?.photoUrl ? (
                    <img
                      src={profileEmp.faceData[0].photoUrl}
                      alt={profileEmp.nameEn}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-3xl font-bold text-indigo-400 font-khmer select-none">
                      {profileEmp.nameEn.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h4 className="text-lg font-bold text-white">
                    {profileEmp.nameEn} ({profileEmp.nameKh})
                  </h4>
                  <p className="text-sm text-slate-400">{profileEmp.email}</p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1.5">
                    <span className="inline-flex items-center rounded-full bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold">
                      {profileEmp.role}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${profileEmp.faceData && profileEmp.faceData.length > 0
                      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
                      }`}>
                      {profileEmp.faceData && profileEmp.faceData.length > 0 ? t("faceEnrolled") : t("faceNotEnrolled")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Staff ID */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("staffId")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block">{profileEmp.staffId}</span>
                </div>

                {/* Gender */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("gender")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block font-khmer">
                    {profileEmp.gender === 'Male' ? t("male") : profileEmp.gender === 'Female' ? t("female") : t("other")}
                  </span>
                </div>

                {/* Department */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("selectDept")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {getLocalizedName(profileEmp.department?.nameEn, profileEmp.department?.nameKh)}
                  </span>
                </div>

                {/* Position */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("selectPos")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block">
                    {getLocalizedName(profileEmp.position?.titleEn, profileEmp.position?.titleKh)}
                  </span>
                </div>

                {/* Branch */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("branch")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block">{profileEmp.branch}</span>
                </div>

                {/* Join Date */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("joinDate")}</span>
                  <span className="text-sm font-semibold text-white mt-1 block font-mono">
                    {formatDateDDMMYYYY(profileEmp.joinDate)}
                  </span>
                </div>

                {/* ID Card / Passport */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("idCardPassport")}</span>
                  <span className="text-sm font-semibold text-indigo-300 mt-1 block">
                    {profileEmp.idCardPassport || 'N/A'}
                  </span>
                </div>

                {/* Address */}
                <div className="bg-slate-950/20 border border-white/5 p-3 rounded-xl sm:col-span-2">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-khmer">{t("address")}</span>
                  <span className="text-sm font-semibold text-slate-300 mt-1 block leading-relaxed whitespace-pre-wrap">
                    {profileEmp.address || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Work Shifts */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-khmer mb-3">{t("shiftConfig")}</h4>
                <div className={`grid gap-4 bg-slate-950/40 p-4 rounded-xl border border-white/5 text-xs ${profileEmp.shift2Start && profileEmp.shift2End ? 'grid-cols-2' : 'grid-cols-1'
                  }`}>
                  <div>
                    <span className="font-semibold text-indigo-400 block font-khmer mb-1">{t("shift1")}</span>
                    <span className="text-slate-300 font-mono">{profileEmp.shift1Start || 'N/A'} - {profileEmp.shift1End || 'N/A'}</span>
                  </div>
                  {profileEmp.shift2Start && profileEmp.shift2End ? (
                    <div>
                      <span className="font-semibold text-indigo-400 block font-khmer mb-1">{t("shift2")}</span>
                      <span className="text-slate-300 font-mono">{profileEmp.shift2Start} - {profileEmp.shift2End}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/60 border-t border-white/10 flex justify-end">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileEmp(null);
                }}
                className="py-2 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-khmer cursor-pointer border-none outline-none"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
