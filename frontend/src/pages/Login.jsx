import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Navigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCodeIcon,
  KeyIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

const Login = () => {
  const { user, login, loginWithQR } = useAuth();
  const { t, locale, setLocale } = useLanguage();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mode states: 'password' | 'qrcode'
  const [loginMode, setLoginMode] = useState('password');
  const [qrError, setQrError] = useState('');
  const [scanLock, setScanLock] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const qrScannerRef = useRef(null);

  const isKhmer = locale === 'kh';

  // Audio feedback
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
        osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.18);
        setTimeout(() => { osc.stop(); ctx.close(); }, 220);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.32);
        setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // QR Code scanner methods
  const startQrScanner = async (targetFacing = null) => {
    setQrError('');
    if (qrScannerRef.current) {
      await stopQrScanner();
    }

    const element = document.getElementById("login-qr-reader");
    if (!element) return;

    const html5Qrcode = new Html5Qrcode("login-qr-reader");
    qrScannerRef.current = html5Qrcode;

    const config = { fps: 12, qrbox: { width: 200, height: 200 } };
    const facing = targetFacing || facingMode;

    try {
      await html5Qrcode.start(
        { facingMode: facing },
        config,
        (decodedText) => handleQrLogin(decodedText),
        () => { }
      );
    } catch (errFacing) {
      try {
        const altFacing = facing === 'user' ? 'environment' : 'user';
        await html5Qrcode.start(
          { facingMode: altFacing },
          config,
          (decodedText) => handleQrLogin(decodedText),
          () => { }
        );
        setFacingMode(altFacing);
      } catch (errAlt) {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await html5Qrcode.start(
              cameras[0].id,
              config,
              (decodedText) => handleQrLogin(decodedText),
              () => { }
            );
          } else {
            setQrError(isKhmer ? 'រកមិនឃើញកាមេរ៉ាលើឧបករណ៍របស់អ្នកឡើយ' : 'No camera detected on this device');
          }
        } catch (errAll) {
          setQrError(isKhmer ? 'មិនអាចបើកកាមេរ៉ាបានទេ (សូមអនុញ្ញាត Permission)' : 'Cannot access camera. Please allow permissions.');
        }
      }
    }
  };

  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (err) {
        console.error("QR scanner stop error:", err);
      }
      qrScannerRef.current = null;
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await stopQrScanner();
    await startQrScanner(nextMode);
  };

  const handleQrLogin = async (decodedText) => {
    if (scanLock) return;
    setScanLock(true);
    setQrError('');
    await stopQrScanner();

    const result = await loginWithQR(decodedText);
    if (!result.success) {
      playSound('error');
      setQrError(result.message || (isKhmer ? 'កូដ QR មិនត្រឹមត្រូវ ឬផុតកំណត់' : 'Invalid or expired QR badge'));
      setScanLock(false);
      setTimeout(() => {
        setScanLock(false);
        if (loginMode === 'qrcode' && qrScannerRef.current === null) {
          startQrScanner();
        }
      }, 2200);
    } else {
      playSound('success');
    }
  };


  useEffect(() => {
    if (loginMode === 'qrcode') {
      const timer = setTimeout(() => {
        startQrScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopQrScanner();
    }

    return () => {
      stopQrScanner();
    };
  }, [loginMode]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const result = await login(email, password);
    if (!result.success) {
      playSound('error');
      setErrorMsg(result.message || (isKhmer ? 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' : 'Invalid email or password'));
      setSubmitting(false);
    } else {
      playSound('success');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white text-slate-800 font-sans selection:bg-[#0077C8] selection:text-white">
      {/* ============================================================== */}
      {/* LEFT SIDE: Solid Blue Brand Panel (Matches Figma Design)       */}
      {/* ============================================================== */}
      <div className="w-full lg:w-1/2 bg-[#0077C8] py-12 px-8 sm:px-12 lg:px-20 lg:min-h-screen flex flex-col justify-center">
        <div className="max-w-md">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] font-khmer">
            {isKhmer ? (
              <>
                HR chomnan<br />
                Attendance<br />
                Management
              </>
            ) : (
              <>
                HR chomnan<br />
                Attendance<br />
                Management
              </>
            )}
          </h1>
          {isKhmer && (
            <p className="text-white/80 font-khmer text-lg mt-3 font-medium">

            </p>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT SIDE: Clean White Form with Rounded Blue-Bordered Card   */}
      {/* ============================================================== */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 lg:min-h-screen">
        {/* Top spacer */}
        <div className="hidden lg:block h-6" />

        {/* Center Container & Card */}
        <div className="w-full max-w-[460px] mx-auto my-auto py-6">
          <div className="bg-white rounded-[32px] border-[2.5px] border-[#0084FF] p-8 sm:p-10 shadow-sm transition-all">
            {/* Circle "A" Icon */}
            {/* <div className="w-13 h-13 rounded-full bg-[#0077C8] text-white flex items-center justify-center font-bold text-xl mb-6 shadow-sm">
              A
            </div> */}

            {/* Header Titles */}
            <h2 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight font-khmer">
              {isKhmer ? 'សូមស្វាគមន៍មកកាន់ប្រព័ន្ធ' : 'Welcome back'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-6 font-khmer leading-relaxed">
              {isKhmer
                ? 'សូមបញ្ចូលគណនីរបស់អ្នកដើម្បីចូលប្រើប្រាស់ផ្ទាំងគ្រប់គ្រងវត្តមាន។'
                : 'Sign in to access your attendance dashboard.'}
            </p>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-5 flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-khmer animate-shake">
                <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {loginMode === 'password' ? (
              /* Password Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 font-khmer">
                    {isKhmer ? 'អាសយដ្ឋានអ៊ីមែល' : 'Email address'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@attendance.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/10 outline-none transition-all"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 font-khmer">
                    {isKhmer ? 'ពាក្យសម្ងាត់ (Password)' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:border-[#0084FF] focus:ring-2 focus:ring-[#0084FF]/10 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-medium text-[#0077C8] hover:text-[#005a96] transition-colors border-none bg-transparent cursor-pointer select-none"
                    >
                      {showPassword ? (isKhmer ? 'លាក់' : 'Hide') : (isKhmer ? 'បង្ហាញ' : 'Show')}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                {/* <div className="pt-0.5">
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(isKhmer ? 'សូមទាក់ទងមកកាន់អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin) ដើម្បីកំណត់លេខសម្ងាត់ឡើងវិញ' : 'Please contact your system administrator to reset your password.');
                    }}
                    className="text-xs font-semibold text-[#0077C8] hover:underline transition-colors font-khmer inline-block"
                  >
                    {isKhmer ? 'ភ្លេចលេខសម្ងាត់?' : 'Forgot password?'}
                  </a>
                </div> */}

                {/* Sign in Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-[#1814F3] hover:bg-[#120fd0] active:scale-[0.99] transition-all duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-none cursor-pointer font-khmer"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>{isKhmer ? 'ចូលប្រព័ន្ធ' : 'Sign in'}</span>
                    )}
                  </button>
                </div>

                {/* Clean QR Switcher option */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('qrcode');
                      setErrorMsg('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0077C8] font-khmer transition-colors border-none bg-transparent cursor-pointer"
                  >
                    <QrCodeIcon className="w-4 h-4" />
                    <span>{isKhmer ? 'ឬស្កេនកាតសម្គាល់ខ្លួន (QR Badge)' : 'Or sign in with QR Badge'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* QR Code Scanner Mode inside same clean card */
              <div className="space-y-4">
                <div className="relative w-full aspect-square max-w-[260px] mx-auto rounded-2xl border-2 border-dashed border-[#0084FF] bg-slate-50 overflow-hidden flex items-center justify-center">
                  <div
                    id="login-qr-reader"
                    className="w-full h-full object-cover [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
                  />

                  {scanLock && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center z-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-[#0077C8] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-slate-700 font-khmer">
                          {isKhmer ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Verifying...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {qrError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-khmer text-center">
                    {qrError}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-600 font-khmer pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isKhmer ? 'កាមេរ៉ាសកម្ម' : 'Camera active'}
                  </span>

                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="inline-flex items-center gap-1 text-[#0077C8] hover:underline cursor-pointer border-none bg-transparent"
                  >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                    <span>{isKhmer ? 'ប្តូរកាមេរ៉ា' : 'Flip camera'}</span>
                  </button>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('password');
                      setQrError('');
                    }}
                    className="text-xs text-[#0077C8] hover:underline font-khmer text-center cursor-pointer border-none bg-transparent py-1"
                  >
                    {isKhmer ? 'ត្រឡប់ទៅប្រើពាក្យសម្ងាត់' : 'Back to Password Login'}
                  </button>
                </div>
              </div>
            )}

            {/* Card Note (Matches Figma) */}
            <p className="text-[11px] text-slate-400 text-center mt-6 font-khmer leading-relaxed">
              {isKhmer
                ? 'ប្រព័ន្ធអាចនឹងតម្រូវឱ្យផ្ទៀងផ្ទាត់កត្តាពីរ (Two-factor authentication) បន្ទាប់ពីចូលប្រើប្រាស់។'
                : 'Two-factor authentication may be required after sign in.'}
            </p>
          </div>
        </div>

        {/* Bottom Bar: Language Pill on Right & Copyright */}
        <div className="w-full max-w-[460px] mx-auto flex flex-col gap-4">
          {/* Language Selector Pill (Matches Figma) */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setLocale(locale === 'kh' ? 'en' : 'kh')}
              className="px-4 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer shadow-xs"
            >
              {locale === 'kh' ? 'ភាសាខ្មែរ' : 'English'}
            </button>
          </div>

          {/* Copyright (Matches Figma) */}
          <div className="text-center text-[11px] text-slate-400 font-sans pb-2">
            © 2026 Attendance Management
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
