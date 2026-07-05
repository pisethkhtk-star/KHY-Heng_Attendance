import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { QrCodeIcon, CameraIcon, ClockIcon, MapPinIcon, Cog6ToothIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Html5Qrcode } from 'html5-qrcode';

// Helper: display Khmer name if available, otherwise English
const getLocalizedName = (nameEn, nameKh) => {
  if (nameKh && nameKh.trim()) return nameKh.trim();
  return nameEn || '';
};

const Kiosk = () => {
  const { user, hasPermission } = useAuth(); // destructure user and hasPermission for permission-guarded UI
  const [activeTab, setActiveTab] = useState('face'); // face, qrcode

  // Set default active tab based on permissions
  useEffect(() => {
    if (!hasPermission('facescan') && hasPermission('qrscan')) {
      setActiveTab('qrcode');
    } else if (hasPermission('facescan')) {
      setActiveTab('face');
    }
  }, [hasPermission]);

  // Real-time Clock State
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Scanning State
  const [scanLock, setScanLock] = useState(false);
  const scanLockRef = useRef(false); // ref mirror to avoid stale closure in setInterval
  const [scanError, setScanError] = useState('');
  const [faceStatus, setFaceStatus] = useState('idle'); // idle, loading_models, scanning, error
  const [successResult, setSuccessResult] = useState(null);

  // Kiosk Verification and Locked Camera States
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [searchStaffId, setSearchStaffId] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [nextAction, setNextAction] = useState('checkin_1');
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalType, setReasonModalType] = useState(''); // 'late' or 'early'

  // Behalf scan States
  const [scanOnBehalf, setScanOnBehalf] = useState(false);
  const [showBehalfModal, setShowBehalfModal] = useState(false);
  const [behalfStaffId, setBehalfStaffId] = useState('');
  const [behalfError, setBehalfError] = useState('');

  // Geolocation State
  const [coords, setCoords] = useState(null);
  const coordsRef = useRef(null); // ref mirror so interval always reads latest coords
  const [locationError, setLocationError] = useState('');

  // References for Media and HTML5 QR
  const videoRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const qrScannerRef = useRef(null);

  // Keep coordsRef in sync with state so setInterval closures always read latest coords
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Keep scanLockRef in sync with state so setInterval closures always read latest lock
  useEffect(() => {
    scanLockRef.current = scanLock;
  }, [scanLock]);

  const verifyEmployeeDirectly = async (staffId) => {
    setVerifying(true);
    setVerifyError('');
    try {
      let matched = null;
      if (user && user.staffId && user.staffId.toLowerCase() === staffId.toLowerCase()) {
        matched = user;
      } else {
        const empRes = await api.get(`/employees?search=${staffId}`);
        matched = empRes.data.find(emp => emp.staffId.toLowerCase() === staffId.toLowerCase());
      }

      if (!matched) {
        alert('រកមិនឃើញព័ត៌មានគណនីបុគ្គលិកឡើយ! (Employee account details not found)');
        setVerifying(false);
        return;
      }

      setMatchedEmployee(matched);

      const today = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Phnom_Penh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(today);
      const month = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      const year = parts.find(p => p.type === 'year').value;
      const todayDateStr = `${year}-${month}-${day}`;

      const logsRes = await api.get(`/attendances/history?staffId=${matched.staffId}`);
      const todayRec = logsRes.data.find(item => {
        if (!item.attendanceDate) return false;
        const logDate = new Date(item.attendanceDate);
        const logParts = formatter.formatToParts(logDate);
        const lMonth = logParts.find(p => p.type === 'month').value;
        const lDay = logParts.find(p => p.type === 'day').value;
        const lYear = logParts.find(p => p.type === 'year').value;
        const logDateStr = `${lYear}-${lMonth}-${lDay}`;
        return logDateStr === todayDateStr;
      });

      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const now = new Date();
      const timeOptions = { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false };
      const currentTimeStr = now.toLocaleTimeString('en-US', timeOptions);

      const currentMinutes = timeToMinutes(currentTimeStr);
      const s1StartMinutes = timeToMinutes(matched.shift1Start);
      const s1EndMinutes = timeToMinutes(matched.shift1End);
      const s2StartMinutes = timeToMinutes(matched.shift2Start);
      const s2EndMinutes = timeToMinutes(matched.shift2End);

      const checkin1 = todayRec?.checkin1;
      const checkout1 = todayRec?.checkout1;
      const checkin2 = todayRec?.checkin2;
      const checkout2 = todayRec?.checkout2;

      let determinedAction = 'checkin_1';

      if (checkin2 && !checkout2) {
        determinedAction = 'checkout_2';
      } else if (checkout1 || (currentMinutes >= s1EndMinutes && !checkin1)) {
        if (!checkin2) {
          determinedAction = 'checkin_2';
        } else {
          determinedAction = 'completed';
        }
      } else if (checkin1 && !checkout1) {
        const midpoint = s1EndMinutes + (s2StartMinutes - s1EndMinutes) / 2;
        if (currentMinutes < midpoint) {
          determinedAction = 'checkout_1';
        } else {
          if (!checkin2) {
            determinedAction = 'checkin_2';
          } else {
            determinedAction = 'completed';
          }
        }
      } else if (!checkin1 && currentMinutes < s1EndMinutes) {
        determinedAction = 'checkin_1';
      } else {
        // Fallback sequential checks
        if (!checkin1) determinedAction = 'checkin_1';
        else if (!checkout1) determinedAction = 'checkout_1';
        else if (!checkin2) determinedAction = 'checkin_2';
        else if (!checkout2) determinedAction = 'checkout_2';
        else determinedAction = 'completed';
      }

      if (determinedAction === 'completed') {
        alert('អ្នកធ្លាប់បាន check រួចហើយ (You have already checked in/out today)');
        setVerifying(false);
        return;
      }

      setNextAction(determinedAction);


      const compareTime = (t1, t2) => {
        if (!t1 || !t2) return 0;
        const [h1, m1] = t1.split(':').map(Number);
        const [h2, m2] = t2.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
      };

      let isLate = false;
      if (determinedAction === 'checkin_1' && matched.shift1Start) {
        if (compareTime(currentTimeStr, matched.shift1Start) > 0) {
          isLate = true;
        }
      } else if (determinedAction === 'checkin_2' && matched.shift2Start) {
        if (compareTime(currentTimeStr, matched.shift2Start) > 0) {
          isLate = true;
        }
      }

      let isEarly = false;
      if (determinedAction === 'checkout_1' && matched.shift1End) {
        if (compareTime(currentTimeStr, matched.shift1End) < 0) {
          isEarly = true;
        }
      } else if (determinedAction === 'checkout_2' && matched.shift2End) {
        if (compareTime(currentTimeStr, matched.shift2End) < 0) {
          isEarly = true;
        }
      }

      if (isLate) {
        setReasonModalType('late');
        setEarlyCheckoutReason('');
        setShowReasonModal(true);
      } else if (isEarly) {
        setReasonModalType('early');
        setEarlyCheckoutReason('');
        setShowReasonModal(true);
      } else {
        setEarlyCheckoutReason('');
        setIsUnlocked(true);
        alert(`ផ្ទៀងផ្ទាត់ជោគជ័យ! បើកកាមេរ៉ាស្កេន (សកម្មភាព៖ ${determinedAction === 'checkin_1' ? 'Check In 1' : determinedAction === 'checkout_1' ? 'Check Out 1' : determinedAction === 'checkin_2' ? 'Check In 2' : 'Check Out 2'})`);
      }
    } catch (err) {
      console.error(err);
      alert('មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់វត្តមានគណនី!');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckPress = () => {
    const isBehalfAllowed = activeTab === 'face' ? hasPermission('scan_behalf_face') : hasPermission('scan_behalf_qr');
    if (scanOnBehalf && isBehalfAllowed) {
      setBehalfStaffId('');
      setBehalfError('');
      setShowBehalfModal(true);
    } else {
      if (user && user.staffId) {
        verifyEmployeeDirectly(user.staffId);
      } else {
        alert("រកមិនឃើញព័ត៌មានគណនីរបស់អ្នកឡើយ! (User session not found)");
      }
    }
  };

  const handleBehalfVerifySubmit = async (e) => {
    e.preventDefault();
    if (!behalfStaffId.trim()) {
      setBehalfError('សូមបញ្ចូលអត្តលេខបុគ្គលិក (Staff ID is required)');
      return;
    }
    setVerifying(true);
    setBehalfError('');
    try {
      const empRes = await api.get(`/employees?search=${behalfStaffId.trim()}`);
      const matched = empRes.data.find(emp => emp.staffId.toLowerCase() === behalfStaffId.trim().toLowerCase());
      if (!matched) {
        setBehalfError('រកមិនឃើញបុគ្គលិកដែលមានអត្តលេខនេះទេ! (Employee not found)');
        setVerifying(false);
        return;
      }

      setShowBehalfModal(false);
      verifyEmployeeDirectly(matched.staffId);
    } catch (err) {
      console.error(err);
      setBehalfError('មានបញ្ហាក្នុងការទាក់ទងទៅកាន់ម៉ាស៊ីនបម្រើ (Network error)');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitReason = (e) => {
    e.preventDefault();
    if (!earlyCheckoutReason.trim()) {
      alert(reasonModalType === 'late' ? 'សូមបញ្ចូលមូលហេតុនៃការមកយឺតកំណត់ (Please input your reason for being late)' : 'សូមបញ្ចូលមូលហេតុនៃការចាកចេញមុនម៉ោងកំណត់ (Please input your reason for early check-out)');
      return;
    }
    setShowReasonModal(false);
    setIsUnlocked(true);
    alert(`រក្សាទុកមូលហេតុរួចរាល់! បើកកាមេរ៉ាស្កេន (សកម្មភាព៖ ${nextAction === 'checkin_1' ? 'Check In 1' : nextAction === 'checkout_1' ? 'Check Out 1' : nextAction === 'checkin_2' ? 'Check In 2' : 'Check Out 2'})`);
  };

  // Geolocation tracker with fallback for low accuracy (crucial for desktops without GPS cards)
  const requestLocation = (highAccuracy = true) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const c = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCoords(c);
          coordsRef.current = c;
          setLocationError('');
        },
        (error) => {
          console.error(`Error fetching location (highAccuracy=${highAccuracy}):`, error);
          if (highAccuracy && error.code !== error.PERMISSION_DENIED) {
            // Retry with low accuracy (uses WiFi/IP geo) if high accuracy times out/fails
            requestLocation(false);
          } else {
            setLocationError('Enable GPS / Location access on this device');
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 5000 }
      );
    } else {
      setLocationError('Geolocation not supported by this browser.');
    }
  };

  // Digital clock & Geolocation tracking
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Initial fetch
    requestLocation(true);

    // Continuously watch the position (more responsive than setInterval polling)
    let watchId = null;
    const startWatching = (highAccuracy = true) => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const c = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            setCoords(c);
            coordsRef.current = c;
            setLocationError('');
          },
          (error) => {
            console.error(`WatchPosition error (highAccuracy=${highAccuracy}):`, error);
            if (highAccuracy && error.code !== error.PERMISSION_DENIED) {
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              startWatching(false);
            } else {
              setLocationError('Enable GPS / Location access on this device');
            }
          },
          { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 10000 }
        );
      }
    };

    startWatching(true);

    return () => {
      clearInterval(interval);
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Web Audio buzzer sound generator
  const playSound = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.16);
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      }
    } catch (err) {
      console.error('Audio feedback error:', err);
    }
  };

  // Process Success Result Modal
  const triggerSuccessModal = (result) => {
    playSound('success');
    setSuccessResult(result);
    setScanLock(true);
    setScanError('');

    // Lock camera again immediately
    setIsUnlocked(false);

    // Stop scanners temporarily while success modal is open
    stopFaceRecognition();
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      qrScannerRef.current.pause();
    }

    setTimeout(() => {
      setSuccessResult(null);
      setScanLock(false);
    }, 3500);
  };

  // Process QR Code Scans
  const handleQrScan = async (decodedText) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanLock(true);
    if (!coords) {
      playSound('error');
      setScanError('កំពុងស្វែងរកទីតាំង GPS... សូមរង់ចាំមួយភ្លែត ឬបើក Location Access លើ browser (Acquiring location...)');
      requestLocation(true);
      return;
    }
    try {
      const response = await api.post('/qrcode/scan', {
        qrToken: decodedText,
        latitude: coords.latitude,
        longitude: coords.longitude,
        note: earlyCheckoutReason,
        action: nextAction
      });
      if (response.data.success) {
        triggerSuccessModal(response.data);
      } else {
        throw new Error(response.data.message || 'QR Scan failed');
      }
    } catch (error) {
      console.error('QR Scan API error:', error);
      playSound('error');
      setScanError(error.response?.data?.message || error.message || 'Invalid or expired QR code badge');
    }
  };

  // Process Face Recognition embedding check
  const handleFaceCheckIn = async (descriptorArray) => {
    // Use ref to avoid stale closure
    if (scanLockRef.current) return;
    const currentCoords = coordsRef.current;
    if (!currentCoords) {
      playSound('error');
      setScanError('កំពុងស្វែងរកទីតាំង GPS... សូមរង់ចាំមួយភ្លែត ឬបើក Location Access លើ browser (Acquiring location...)');
      requestLocation(true);
      return;
    }
    try {
      const response = await api.post('/face/checkin', {
        faceDescriptor: descriptorArray,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        note: earlyCheckoutReason,
        action: nextAction
      });
      if (response.data.success) {
        triggerSuccessModal(response.data);
      } else {
        throw new Error(response.data.message || 'Face Check-in failed');
      }
    } catch (error) {
      console.error('Face Check-in API error:', error);
      playSound('error');
      setScanError(error.response?.data?.message || error.message || 'Face scan verification failed');
    }
  };

  // Face recognition engine handlers
  const startFaceRecognition = async () => {
    try {
      setFaceStatus('loading_models');
      setScanError('');

      // Wait up to 10s for CDN script to finish loading (defer attribute causes timing issues)
      let waited = 0;
      while (!window.faceapi && waited < 10000) {
        await new Promise(resolve => setTimeout(resolve, 200));
        waited += 200;
      }
      if (!window.faceapi) {
        throw new Error('Face recognition library (face-api.js) failed to load. Check internet connection.');
      }

      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      if (!window.faceapi.nets.tinyFaceDetector.params) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      }
      if (!window.faceapi.nets.faceLandmark68Net.params) {
        await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      }
      if (!window.faceapi.nets.faceRecognitionNet.params) {
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      }

      setFaceStatus('scanning');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      faceStreamRef.current = stream;

      // Scan every 1.5 seconds — use refs to avoid stale closure
      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || scanLockRef.current) return;
        try {
          const detection = await window.faceapi.detectSingleFace(
            videoRef.current,
            new window.faceapi.TinyFaceDetectorOptions()
          ).withFaceLandmarks().withFaceDescriptor();

          if (detection) {
            const descriptorArray = Array.from(detection.descriptor);
            await handleFaceCheckIn(descriptorArray);
          }
        } catch (err) {
          console.error(err);
        }
      }, 1500);
    } catch (err) {
      console.error(err);
      setFaceStatus('error');
      setScanError(err.message || 'Camera hardware authorization or loading models failed');
    }
  };

  const stopFaceRecognition = () => {
    if (faceIntervalRef.current) {
      clearInterval(faceIntervalRef.current);
      faceIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(track => track.stop());
      faceStreamRef.current = null;
    }
  };

  // QR scanner engine handlers
  const startQrScanner = () => {
    setScanError('');
    const html5Qrcode = new Html5Qrcode("qr-reader");
    qrScannerRef.current = html5Qrcode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5Qrcode.start(
      { facingMode: "user" },
      config,
      async (decodedText) => {
        handleQrScan(decodedText);
      },
      () => {
        // Quiet mode
      }
    ).catch(err => {
      console.error("QR scanner start error:", err);
      setScanError("Failed to access camera for QR Code Scanner");
    });
  };

  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (err) {
        console.error(err);
      }
      qrScannerRef.current = null;
    }
  };

  // Sync scanners with active tab and isUnlocked status
  useEffect(() => {
    const toggleScanners = async () => {
      if (!isUnlocked) {
        stopFaceRecognition();
        await stopQrScanner();
        return;
      }

      if (activeTab === 'face' && hasPermission('facescan')) {
        await stopQrScanner();
        startFaceRecognition();
      } else if (activeTab === 'qrcode' && hasPermission('qrscan')) {
        stopFaceRecognition();
        setTimeout(() => {
          startQrScanner();
        }, 300);
      }
    };

    toggleScanners();

    return () => {
      stopFaceRecognition();
      stopQrScanner();
    };
  }, [activeTab, isUnlocked]);

  // Reset behalf scan selection on tab toggle
  useEffect(() => {
    setScanOnBehalf(false);
    setShowBehalfModal(false);
  }, [activeTab]);

  return (
    <div className="min-h-[85vh] flex flex-col justify-between items-center text-slate-100 relative">
      {/* Kiosk Clock Banner */}
      <div className="w-full text-center space-y-2 mt-4 relative">

        {/* Permission-guarded: Link to Geofencing Settings Page */}
        {hasPermission('kiosk_settings') && (
          <Link
            to="/kiosk-settings"
            className="absolute top-2 right-4 flex items-center gap-1.5 p-2 px-3 bg-slate-900/60 text-slate-400 hover:text-indigo-400 border border-white/10 hover:border-indigo-500/30 rounded-xl transition-all cursor-pointer z-20 text-xs font-semibold font-khmer"
            title="Configure Kiosk Geolocation Limits"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Geofence Settings</span>
          </Link>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 text-indigo-300 font-khmer text-xs">
            <ClockIcon className="h-4 w-4 animate-pulse" />
            <span>KIOSK ACTIVE scan mode</span>
          </div>

          {/* Geolocation Status Badge */}
          {coords ? (
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20 text-emerald-300 font-khmer text-[11px]">
              <MapPinIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>📍 GPS Active ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-rose-500/10 px-3.5 py-1 rounded-full border border-rose-500/20 text-rose-300 font-khmer text-[11px] animate-pulse">
              <MapPinIcon className="h-3.5 w-3.5 text-rose-400" />
              <span>⚠️ GPS Offline — {locationError || 'Acquiring location...'}</span>
            </div>
          )}
        </div>

        <h1 className="text-4xl font-extrabold text-white tracking-widest tabular-nums mt-2">
          {timeStr}
        </h1>
        <p className="text-slate-400 font-khmer text-xs">
          {dateStr}
        </p>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full max-w-lg glass-card rounded-3xl overflow-hidden glow-indigo my-6 relative flex flex-col items-center">
        {/* Success Scan Slide Modal Overlay */}
        {successResult && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <span className="text-5xl animate-bounce">🎉</span>
            <h2 className="text-2xl font-bold text-emerald-400 font-khmer mt-4">
              ស្កេនបានជោគជ័យ! (Scan Success)
            </h2>

            <div className="mt-6 space-y-2 max-w-xs bg-slate-900/60 p-5 rounded-2xl border border-white/10 w-full">
              <p className="text-xs text-slate-400 font-khmer">ឈ្មោះបុគ្គលិក (Employee):</p>
              <p className="text-lg font-bold text-white">
                {getLocalizedName(successResult.employee.nameEn, successResult.employee.nameKh)}
              </p>
              <div className="h-px bg-white/5 my-2"></div>

              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-khmer">អត្តលេខ (ID):</span>
                <span className="font-semibold">{successResult.employee.staffId}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-khmer">ផ្នែក (Dept):</span>
                <span className="font-semibold">{successResult.employee.department}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-khmer">សកម្មភាព (Action):</span>
                <span className="font-semibold text-emerald-300 uppercase">{successResult.action}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-khmer">ម៉ោងស្កេន (Time):</span>
                <span className="font-semibold">{successResult.timeString}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-khmer mt-8 animate-pulse">
              ម៉ាស៊ីននឹងចាប់ផ្តើមស្កេនឡើងវិញក្នុងពេលបន្តិចទៀត...
            </p>
          </div>
        )}

        {/* Tab Selector */}
        {hasPermission('facescan') && hasPermission('qrscan') && (
          <div className="flex border-b border-white/10 w-full">
            <button
              onClick={() => setActiveTab('face')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold text-sm transition-all cursor-pointer font-khmer border-none outline-none ${activeTab === 'face'
                ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <CameraIcon className="h-5 w-5" />
              Face Scan
            </button>
            <button
              onClick={() => setActiveTab('qrcode')}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-semibold text-sm transition-all cursor-pointer font-khmer border-none outline-none ${activeTab === 'qrcode'
                ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <QrCodeIcon className="h-5 w-5" />
              QR Scan
            </button>
          </div>
        )}

        {/* Scanning Window Frame */}
        <div className="p-6 w-full flex flex-col items-center">
          <div className="relative w-full aspect-video md:aspect-[4/3] rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-inner flex items-center justify-center">
            {/* Locked screen overlay */}
            {!isUnlocked && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-500 z-30">
                <div className="p-4 bg-slate-900/60 rounded-full border border-white/5">
                  <LockClosedIcon className="h-10 w-10 text-slate-600 animate-pulse" />
                </div>
                <p className="font-khmer text-xs font-semibold text-slate-400">Camera Locked</p>
                <p className="font-khmer text-[10px] text-slate-600">Please Click Button "Check Attendance" to Open Camera</p>
              </div>
            )}

            {/* Overlay indicators */}
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-indigo-500/20 m-6 rounded-xl flex items-center justify-center">
              {activeTab === 'face' && isUnlocked && (
                <div className="w-40 h-40 rounded-full border border-indigo-500/30 animate-pulse"></div>
              )}
            </div>

            {/* Face Recognition view states */}
            {activeTab === 'face' && (
              <>
                {faceStatus === 'loading_models' && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 text-slate-400 z-10 text-xs">
                    <span className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-500 border-t-transparent"></span>
                    <span className="font-khmer">កំពុងទាញយកម៉ូដែលមុខ (Loading Face AI Models)...</span>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              </>
            )}

            {/* QR Scanner view state */}
            {activeTab === 'qrcode' && (
              <div id="qr-reader" className="w-full h-full object-cover [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
            )}
          </div>

          {/* Check Button */}
          {!isUnlocked ? (
            <div className="w-full flex flex-col items-center">
              <button
                onClick={handleCheckPress}
                className="mt-6 w-full max-w-xs py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-khmer cursor-pointer border-none outline-none text-center text-sm"
              >
                Check
              </button>

              {(activeTab === 'face' ? hasPermission('scan_behalf_face') : hasPermission('scan_behalf_qr')) && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 cursor-pointer mt-4 font-khmer select-none">
                  <input
                    type="checkbox"
                    checked={scanOnBehalf}
                    onChange={(e) => setScanOnBehalf(e.target.checked)}
                    className="w-4 h-4 border border-white/10 rounded-md bg-slate-950 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                  />
                  <span>ចុះវត្តមានជំនួសអ្នកដទៃ (Scan on Behalf)</span>
                </label>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 font-khmer uppercase tracking-widest bg-indigo-500/10 px-3.5 py-1.5 rounded-lg border border-indigo-500/20">
                សកម្មភាព៖ {nextAction === 'checkin_1' ? 'Check In 1' : nextAction === 'checkout_1' ? 'Check Out 1' : nextAction === 'checkin_2' ? 'Check In 2' : 'Check Out 2'}
              </span>
              <button
                onClick={() => setIsUnlocked(false)}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 underline cursor-pointer bg-transparent border-none outline-none mt-1"
              >
                ចាក់សោឡើងវិញ (Lock Camera)
              </button>
            </div>
          )}

          {/* Error Message display block */}
          {scanError && (
            <div className="mt-4 w-full rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center font-khmer">
              ⚠️ {scanError}
            </div>
          )}

          {/* Status indicators */}
          <div className="mt-4 text-xs font-semibold text-slate-400 font-khmer flex gap-2 items-center">
            {isUnlocked ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                {activeTab === 'face' ? "កំពុងស្កេនផ្ទៃមុខស្វ័យប្រវត្តិ (Scanning faces auto)..." : "សូមបង្ហាញកូដ QR របស់លោកអ្នក (Show QR code badge)"}
              </>
            ) : (
              <>

              </>
            )}
          </div>
        </div>
      </div>




      {/* Reason Description Modal (Late / Early Out) */}
      {showReasonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-left">
          <form onSubmit={handleSubmitReason} className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in">
            {reasonModalType === 'late' ? (
              <>
                <h3 className="text-lg font-bold text-rose-400 font-khmer">⚠️ មកយឺតជាងម៉ោងកំណត់ (Late Check-in)</h3>
                <p className="text-xs text-slate-300 font-khmer leading-relaxed">
                  ម៉ោងចូលរបស់អ្នកគឺយឺតជាងម៉ោងកំណត់។ សូមបំពេញមូលហេតុនៃការមកយឺត៖
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-amber-400 font-khmer">⚠️ ចាកចេញមុនម៉ោងកំណត់ (Early Check-out)</h3>
                <p className="text-xs text-slate-300 font-khmer leading-relaxed">
                  ម៉ោងចាកចេញរបស់អ្នកគឺលឿនជាងម៉ោងកំណត់។ សូមបំពេញមូលហេតុនៃការចាកចេញមុនម៉ោងកំណត់៖
                </p>
              </>
            )}
            <textarea
              rows="3"
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-khmer"
              placeholder="សរសេរមូលហេតុនៅទីនេះ..."
              value={earlyCheckoutReason}
              onChange={(e) => setEarlyCheckoutReason(e.target.value)}
              autoFocus
            ></textarea>
            <div className="flex gap-3 justify-end text-xs font-semibold font-khmer">
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 rounded-lg text-white transition-colors cursor-pointer border-none"
              >
                យល់ព្រម (Submit)
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Behalf Verification Modal */}
      {showBehalfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleBehalfVerifySubmit} className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-fade-in text-left">
            <h3 className="text-lg font-bold text-white font-khmer flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-indigo-400" />
              ចុះវត្តមានជំនួស (Scan on Behalf)
            </h3>
            <p className="text-xs text-slate-400 font-khmer leading-relaxed">
              សូមបញ្ចូលអត្តលេខបុគ្គលិកដែលលោកអ្នកចង់ចុះវត្តមានជំនួស៖
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-khmer">អត្តលេខបុគ្គលិក (Employee Staff ID)</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="ឧ. EMP001"
                value={behalfStaffId}
                onChange={(e) => setBehalfStaffId(e.target.value)}
                autoFocus
              />
            </div>

            {behalfError && (
              <p className="text-xs text-rose-400 font-khmer">⚠️ {behalfError}</p>
            )}

            <div className="flex gap-3 justify-end text-xs font-semibold font-khmer pt-2">
              <button
                type="button"
                onClick={() => setShowBehalfModal(false)}
                className="px-4 py-2 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-800 rounded-lg text-white transition-colors cursor-pointer border-none"
              >
                {verifying ? 'កំពុងស្វែងរក...' : 'បន្ត (Continue)'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Kiosk;
