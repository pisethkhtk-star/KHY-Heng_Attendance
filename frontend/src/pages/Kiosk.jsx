import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { QrCodeIcon, CameraIcon, ClockIcon, MapPinIcon, Cog6ToothIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { Html5Qrcode } from 'html5-qrcode';
import { faceDataService, branchLocationService } from '../services';
import { faceStore, branchLocationStore } from '../models';
import { registerCameraStream, stopAllCameraStreams } from '../utils/cameraManager';

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

  // Verification & matched employee state
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [matchedEmployee, setMatchedEmployee] = useState(null);

  // Kiosk Verification and Auto-Scan States
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [nextAction, setNextAction] = useState(null);
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');

  // Behalf scan States
  const [scanOnBehalf, setScanOnBehalf] = useState(false);
  const [showBehalfModal, setShowBehalfModal] = useState(false);
  const [behalfStaffId, setBehalfStaffId] = useState('');
  const [behalfError, setBehalfError] = useState('');

  // Geolocation State
  const [coords, setCoords] = useState(null);
  const coordsRef = useRef(null); // ref mirror so interval always reads latest coords
  const [locationError, setLocationError] = useState('');

  // Client-side geofence evaluation using preloaded branchLocationStore
  const geofenceStatus = useMemo(() => {
    if (!coords) return null;
    if (!branchLocationStore.hasBranches()) return null;
    return branchLocationService.checkGeofence(coords.latitude, coords.longitude, user?.branch);
  }, [coords, user?.branch]);

  // References for Media and HTML5 QR
  const videoRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const qrScannerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Ensure camera streams are automatically closed when navigating to any other page
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopFaceRecognition();
      stopQrScanner();
      stopAllCameraStreams();
    };
  }, []);

  // Keep coordsRef in sync with state so setInterval closures always read latest coords
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Keep scanLockRef in sync with state so setInterval closures always read latest lock
  useEffect(() => {
    scanLockRef.current = scanLock;
  }, [scanLock]);

  const formatActionLabel = (action) => {
    if (!action) return 'Check In/Out';
    const lower = String(action).toLowerCase();
    if (lower === 'checkin_1') return 'ចូលវេនទី ១ (Check In 1)';
    if (lower === 'checkout_1') return 'ចេញវេនទី ១ (Check Out 1)';
    if (lower === 'checkin_2') return 'ចូលវេនទី ២ (Check In 2)';
    if (lower === 'checkout_2') return 'ចេញវេនទី ២ (Check Out 2)';
    if (lower === 'completed') return 'បានចុះវត្តមានគ្រប់វេនហើយ (All Shifts Completed)';
    return action;
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
      setBehalfStaffId('');
      // Directly check in for this employee without asking for late/early reasons
      await handleFaceCheckIn(null, matched.staffId);
    } catch (err) {
      console.error(err);
      setBehalfError('មានបញ្ហាក្នុងការទាក់ទងទៅកាន់ម៉ាស៊ីនបម្រើ (Network error)');
    } finally {
      setVerifying(false);
    }
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
    scanLockRef.current = true;
    setScanError('');

    // Keep camera active and smoothly scan next employee after 3 seconds
    setTimeout(() => {
      setSuccessResult(null);
      scanLockRef.current = false;
      setScanLock(false);
    }, 3000);
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

    // Client-side geofence pre-check using preloaded branchLocationStore
    if (geofenceStatus && !geofenceStatus.isInside) {
      playSound('error');
      const branchName = geofenceStatus.closestBranch?.name || 'សាខាអនុញ្ញាត';
      setScanError(`ក្រៅទីតាំងអនុញ្ញាត! (Out of zone). សាខា "${branchName}" នៅចម្ងាយ ${geofenceStatus.closestDistance}m (កម្រិតអនុញ្ញាតត្រឹម ${geofenceStatus.closestRadius}m)។`);
      setTimeout(() => {
        scanLockRef.current = false;
        setScanLock(false);
      }, 2500);
      return;
    }

    try {
      const response = await api.post('/qrcode/scan', {
        qrToken: decodedText,
        latitude: coords.latitude,
        longitude: coords.longitude,
        note: 'Auto scan: QR Code'
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
      setTimeout(() => {
        scanLockRef.current = false;
        setScanLock(false);
      }, 2500);
    }
  };

  // Process Face Recognition embedding check
  const handleFaceCheckIn = async (descriptorArray, matchedStaffId = null) => {
    // Use ref to avoid stale closure
    if (scanLockRef.current) return;
    const currentCoords = coordsRef.current;
    if (!currentCoords) {
      playSound('error');
      setScanError('កំពុងស្វែងរកទីតាំង GPS... សូមរង់ចាំមួយភ្លែត ឬបើក Location Access លើ browser (Acquiring location...)');
      requestLocation(true);
      return;
    }

    // Client-side geofence pre-check using preloaded branchLocationStore
    if (geofenceStatus && !geofenceStatus.isInside) {
      playSound('error');
      const branchName = geofenceStatus.closestBranch?.name || 'សាខាអនុញ្ញាត';
      setScanError(`ក្រៅទីតាំងអនុញ្ញាត! (Out of zone). សាខា "${branchName}" នៅចម្ងាយ ${geofenceStatus.closestDistance}m (កម្រិតអនុញ្ញាតត្រឹម ${geofenceStatus.closestRadius}m)។`);
      setTimeout(() => {
        scanLockRef.current = false;
        setScanLock(false);
      }, 2500);
      return;
    }

    scanLockRef.current = true;
    setScanLock(true);

    try {
      const response = await api.post('/face/checkin', {
        staffId: matchedStaffId, // Pre-matched locally from preloaded face model store!
        faceDescriptor: descriptorArray,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        note: 'Auto scan: Face Recognition'
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
      setTimeout(() => {
        scanLockRef.current = false;
        setScanLock(false);
      }, 2500);
    }
  };

  // Face recognition engine handlers
  const startFaceRecognition = async () => {
    try {
      setFaceStatus('loading_models');
      setScanError('');

      // Ensure face embedding models, neural net models & branch locations are preloaded
      await Promise.all([
        faceDataService.preloadFaceData(),
        faceDataService.preloadModels(),
        branchLocationService.preloadBranchLocations()
      ]);

      // Wait up to 10s for CDN script to finish loading (defer attribute causes timing issues)
      let waited = 0;
      while (!window.faceapi && waited < 10000) {
        await new Promise(resolve => setTimeout(resolve, 200));
        waited += 200;
      }
      if (!window.faceapi) {
        throw new Error('Face recognition library (face-api.js) failed to load. Check internet connection.');
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

      if (!isMountedRef.current || !isUnlocked) return;

      setFaceStatus('scanning');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      registerCameraStream(stream);

      // Guard: if user navigated away while waiting for camera access
      if (!isMountedRef.current || !isUnlocked) {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      faceStreamRef.current = stream;

      // Scan every 1.2 seconds — with client-side face recognition comparison
      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || scanLockRef.current || !isMountedRef.current) return;
        try {
          const detection = await window.faceapi.detectSingleFace(
            videoRef.current,
            new window.faceapi.TinyFaceDetectorOptions()
          ).withFaceLandmarks().withFaceDescriptor();

          if (detection && detection.descriptor) {
            const descriptorArray = Array.from(detection.descriptor);

            // 1. Client-side FaceDataModel store match
            if (faceStore.hasEnrolledFaces()) {
              const matchResult = faceDataService.matchFace(detection.descriptor, 0.52);

              if (matchResult && matchResult.match) {
                console.log(`[Face Scan] Locally recognized: ${matchResult.match.nameEn} (${matchResult.match.staffId}), dist: ${matchResult.distance.toFixed(3)}, conf: ${matchResult.confidence}%`);
                await handleFaceCheckIn(descriptorArray, matchResult.match.staffId);
              } else {
                // Face detected in camera frame, but no registered employee matched locally.
                // Do NOT send request to backend — prevents network spam and server lag!
              }
            } else {
              // Fallback to backend matching if faceStore is not yet populated
              await handleFaceCheckIn(descriptorArray, null);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 1200);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setFaceStatus('error');
        setScanError(err.message || 'Camera hardware authorization or loading models failed');
      }
    }
  };

  const stopFaceRecognition = () => {
    if (faceIntervalRef.current) {
      clearInterval(faceIntervalRef.current);
      faceIntervalRef.current = null;
    }
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      faceStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const s = videoRef.current.srcObject;
        if (s && typeof s.getTracks === 'function') {
          s.getTracks().forEach(t => {
            try { t.stop(); } catch (e) {}
          });
        }
      } catch (e) {}
      videoRef.current.srcObject = null;
    }
  };

  // QR scanner engine handlers
  const startQrScanner = () => {
    if (!isMountedRef.current || !isUnlocked) return;
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
    ).then(() => {
      // If user navigated away while camera was initializing
      if (!isMountedRef.current || !isUnlocked) {
        stopQrScanner();
      }
    }).catch(err => {
      console.error("QR scanner start error:", err);
      if (isMountedRef.current) {
        setScanError("Failed to access camera for QR Code Scanner");
      }
    });
  };

  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (err) {
        console.warn('QR scanner stop error:', err);
      }
      try {
        qrScannerRef.current.clear();
      } catch (e) {}
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

          {/* Geolocation Status Badge & Preloaded Branch Geofence Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2">
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

            {/* Client-side Branch Geofence evaluation badge */}
            {geofenceStatus && (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-khmer font-bold transition-all ${
                  geofenceStatus.isInside
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300 animate-pulse shadow-sm shadow-rose-500/10'
                }`}
                title={
                  geofenceStatus.isInside
                    ? `Inside allowed zone: ${geofenceStatus.activeBranch?.name}`
                    : `Outside zone: closest branch is ${geofenceStatus.closestBranch?.name} (${geofenceStatus.closestDistance}m away)`
                }
              >
                <span>{geofenceStatus.isInside ? '🟢' : '🔴'}</span>
                <span>
                  {geofenceStatus.isInside
                    ? `ក្នុងទីតាំង: ${geofenceStatus.activeBranch?.name} (${geofenceStatus.closestDistance}m)`
                    : `ក្រៅទីតាំង: ${geofenceStatus.closestBranch?.name || 'សាខា'} (${geofenceStatus.closestDistance}m / limit ${geofenceStatus.closestRadius}m)`}
                </span>
              </div>
            )}
          </div>
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
                <span className="font-semibold text-emerald-300">{formatActionLabel(successResult.action)}</span>
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
            {/* Overlay target indicator */}
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-indigo-500/20 m-6 rounded-xl flex items-center justify-center">
              {activeTab === 'face' && (
                <div className="w-40 h-40 rounded-full border-2 border-indigo-400/40 animate-pulse"></div>
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

          {/* Active Auto-Recognition Status Badge & Behalf Option */}
          <div className="w-full flex flex-col items-center mt-5 space-y-2">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold font-khmer shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>
                {activeTab === 'face'
                  ? 'ស្កេនផ្ទៃមុខស្វ័យប្រវត្តិ (Auto Face Recognition Active)'
                  : 'ស្កេន QR Code កំពុងដំណើរការ (QR Scanner Active)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-khmer text-center">
              {activeTab === 'face'
                ? 'សូមសម្លឹងមើលកាមេរ៉ា — ប្រព័ន្ធនឹងស្គាល់គ្រប់បុគ្គលិក និងចុះវត្តមាន Check In/Out ដោយស្វ័យប្រវត្តិ'
                : 'សូមបង្ហាញកាត QR Code របស់អ្នកទៅកាន់កាមេរ៉ា'}
            </p>

            {(activeTab === 'face' ? hasPermission('scan_behalf_face') : hasPermission('scan_behalf_qr')) && (
              <button
                type="button"
                onClick={() => {
                  setBehalfStaffId('');
                  setBehalfError('');
                  setShowBehalfModal(true);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-khmer cursor-pointer bg-transparent border-none outline-none mt-2 transition-colors"
              >
                ចុះវត្តមានជំនួសអ្នកដទៃ (Scan on Behalf)
              </button>
            )}
          </div>

          {/* Error Message display block */}
          {scanError && (
            <div className="mt-4 w-full rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center font-khmer">
              ⚠️ {scanError}
            </div>
          )}
        </div>
      </div>





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
