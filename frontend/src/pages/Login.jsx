import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Navigate } from 'react-router-dom';
import appIcon from '../assets/app_icon.png';
import { Html5Qrcode } from 'html5-qrcode';

const Login = () => {
  const { user, login, loginWithQR } = useAuth();
  const { t, locale, setLocale } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // QR Login States & References
  const [loginMode, setLoginMode] = useState('password'); // password, qrcode
  const [qrError, setQrError] = useState('');
  const [scanLock, setScanLock] = useState(false);
  const qrScannerRef = useRef(null);

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

  const startQrScanner = async () => {
    setQrError('');
    if (qrScannerRef.current) {
      await stopQrScanner();
    }

    const element = document.getElementById("login-qr-reader");
    if (!element) return;

    const html5Qrcode = new Html5Qrcode("login-qr-reader");
    qrScannerRef.current = html5Qrcode;

    const config = { fps: 10, qrbox: { width: 180, height: 180 } };

    try {
      // 1. Try front/user camera
      await html5Qrcode.start(
        { facingMode: "user" },
        config,
        (decodedText) => handleQrLogin(decodedText),
        () => {}
      );
    } catch (errUser) {
      console.warn("User camera facingMode failed, trying environment fallback:", errUser);
      try {
        // 2. Try back/environment camera
        await html5Qrcode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => handleQrLogin(decodedText),
          () => {}
        );
      } catch (errEnv) {
        console.warn("Environment camera failed, trying getCameras fallback:", errEnv);
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await html5Qrcode.start(
              cameras[0].id,
              config,
              (decodedText) => handleQrLogin(decodedText),
              () => {}
            );
          } else {
            setQrError(locale === 'kh' ? 'រកមិនឃើញកាមេរ៉ាលើឧបករណ៍របស់អ្នកឡើយ' : 'No camera detected on this device');
          }
        } catch (errAll) {
          console.error("All camera initialization failed:", errAll);
          setQrError(locale === 'kh' ? 'មិនអាចបើកកាមេរ៉ាបានទេ (សូមពិនិត្យមើល Camera Permission)' : 'Failed to access camera. Please check permissions.');
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

  const handleQrLogin = async (decodedText) => {
    if (scanLock) return;
    setScanLock(true);
    setQrError('');

    // Stop scanner temporarily during verification
    await stopQrScanner();

    const result = await loginWithQR(decodedText);
    if (!result.success) {
      playSound('error');
      setQrError(result.message);
      setScanLock(false);
      // Restart scanner after 2 seconds
      setTimeout(() => {
        setScanLock(false);
        if (loginMode === 'qrcode' && qrScannerRef.current === null) {
          startQrScanner();
        }
      }, 2000);
    } else {
      playSound('success');
    }
  };

  const handleFileQrScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrError('');
    setScanLock(true);

    try {
      let scanner = qrScannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode("login-qr-reader");
      }
      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        await handleQrLogin(decodedText);
      }
    } catch (err) {
      console.error("Error scanning file:", err);
      playSound('error');
      setQrError(locale === 'kh' ? 'មិនអាចអាន QR Code ពីរូបភាពនេះបានទេ សូមសាកល្បងម្ដងទៀត' : 'Could not detect a QR Code in this image. Please try again.');
      setScanLock(false);
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
      setErrorMsg(result.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden text-[var(--text-primary)]">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--brand-blue)]/5 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--brand-blue)]/5 rounded-full filter blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 z-10">
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-8 rounded-[25px] shadow-sm glow-indigo">
          {/* Logo & Header */}
          <div className="flex flex-col items-center">
            <img src={appIcon} alt="HR Chomnan Logo" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-[var(--brand-blue)]/20" />
            <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-[var(--text-primary)] font-khmer">
              {locale === 'kh' ? 'Attendance Management' : 'Employee Attendance'}
            </h2>
          </div>

          {/* Login Mode Tabs */}
          <div className="flex border-b border-[var(--border-card)] mt-6 w-full">
            <button
              type="button"
              onClick={() => setLoginMode('password')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-[11px] transition-all cursor-pointer font-khmer border-none outline-none ${
                loginMode === 'password'
                  ? 'bg-[var(--brand-blue)]/5 text-[var(--brand-blue)] border-b-2 border-[var(--brand-blue)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {locale === 'kh' ? 'Password' : 'Password'}
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('qrcode')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-[11px] transition-all cursor-pointer font-khmer border-none outline-none ${
                loginMode === 'qrcode'
                  ? 'bg-[var(--brand-blue)]/5 text-[var(--brand-blue)] border-b-2 border-[var(--brand-blue)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {locale === 'kh' ? 'Scan QR Code' : 'QR Scan'}
            </button>
          </div>

          {loginMode === 'password' ? (
            /* Form */
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              {errorMsg && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-500 text-center font-khmer">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 font-khmer">
                    {t("email")}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-[15px] border border-[var(--border-card)] bg-[var(--bg-app)] py-3 px-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-blue)] text-sm transition-all outline-none"
                    placeholder="name@attendance.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 font-khmer">
                    {t("password")}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-[15px] border border-[var(--border-card)] bg-[var(--bg-app)] py-3 px-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-blue)] text-sm transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex w-full justify-center rounded-[15px] bg-[var(--brand-blue)] py-3 px-4 text-sm font-semibold text-white hover:bg-[var(--brand-blue)]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all font-khmer shadow-md shadow-[var(--brand-blue)]/25 disabled:opacity-50 cursor-pointer border-none"
                >
                  {submitting ? t("loading") : (locale === 'kh' ? 'ចូលប្រព័ន្ធ' : 'Sign In')}
                </button>
              </div>
            </form>
          ) : (
            /* QR Scanner view */
            <div className="mt-6 flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[240px] rounded-[25px] border border-[var(--border-card)] bg-[var(--bg-app)] overflow-hidden shadow-inner flex items-center justify-center">
                <div className="absolute inset-0 pointer-events-none border border-dashed border-[var(--brand-blue)]/30 m-4 rounded-xl flex items-center justify-center animate-pulse z-10">
                  <div className="w-28 h-28 border border-[var(--brand-blue)]/20 rounded-lg"></div>
                </div>
                <div id="login-qr-reader" className="w-full h-full object-cover [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
                {scanLock && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-semibold text-white font-khmer">កំពុងផ្ទៀងផ្ទាត់...</span>
                    </div>
                  </div>
                )}
              </div>

              {qrError && (
                <div className="mt-4 w-full rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 text-center font-khmer">
                  ⚠️ {qrError}
                </div>
              )}

              <div className="mt-4 text-[11px] font-semibold text-[var(--text-secondary)] font-khmer flex gap-2 items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand-blue)] animate-ping"></span>
                <span>{locale === 'kh' ? "សូមបង្ហាញកូដ QR ផ្ទាល់ខ្លួនរបស់លោកអ្នក" : "Please show your personal QR code badge"}</span>
              </div>

              {/* Upload QR Code Image Option */}
              <div className="mt-4 pt-3 border-t border-[var(--border-card)] w-full flex justify-center">
                <label className="cursor-pointer inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-blue)] hover:underline font-khmer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileQrScan}
                  />
                  <span>📁 {locale === 'kh' ? 'ឬផ្ទុករូបភាព QR Code ពីឧបករណ៍' : 'Or upload QR code image'}</span>
                </label>
              </div>
            </div>
          )}

        </div>

        {/* Global Language Toggle */}
        <div className="flex justify-center">
          <button
            onClick={() => setLocale(locale === 'kh' ? 'en' : 'kh')}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-sm font-semibold py-1.5 px-4 rounded-full bg-[var(--bg-card)] border border-[var(--border-card)] cursor-pointer"
          >
            <span>{locale === 'kh' ? '🇰🇭 ខ្មែរ' : '🇺🇸 English'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
