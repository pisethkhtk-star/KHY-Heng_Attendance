import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Navigate } from 'react-router-dom';
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

  const startQrScanner = () => {
    setQrError('');
    const html5Qrcode = new Html5Qrcode("login-qr-reader");
    qrScannerRef.current = html5Qrcode;

    const config = { fps: 10, qrbox: { width: 180, height: 180 } };
    html5Qrcode.start(
      { facingMode: "user" },
      config,
      async (decodedText) => {
        handleQrLogin(decodedText);
      },
      () => {
        // quiet
      }
    ).catch(err => {
      console.error("QR scanner start error:", err);
      setQrError("Failed to access camera for QR Code Scanner");
    });
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

    // Stop scanner temporary during verification
    await stopQrScanner();

    const result = await loginWithQR(decodedText);
    if (!result.success) {
      setQrError(result.message);
      setScanLock(false);
      // Restart scanner after 2 seconds
      setTimeout(() => {
        setScanLock(false);
        if (qrScannerRef.current === null) {
          startQrScanner();
        }
      }, 2000);
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

  const fillQuickCredentials = (e, p) => {
    setEmail(e);
    setPassword(p);
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-blue)] text-white shadow-lg shadow-[var(--brand-blue)]/20">
              <ClockIcon className="h-7 w-7 text-white animate-pulse" />
            </div>
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
            </div>
          )}

          {/* Quick Links for Testing */}
          <div className="mt-8 border-t border-[var(--border-card)] pt-6">
            <h3 className="text-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 font-khmer">
              Quick Accounts for Testing (សាកល្បងគណនីគំរូ)
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => fillQuickCredentials('admin@attendance.com', 'admin123')}
                className="p-2 text-left bg-[var(--bg-app)] hover:bg-[var(--border-card)] rounded-[12px] text-[var(--text-primary)] border border-[var(--border-card)] transition-all outline-none cursor-pointer"
              >
                <strong>Admin:</strong> admin@attendance.com (admin123)
              </button>
              <button
                onClick={() => fillQuickCredentials('hr@attendance.com', 'hr123')}
                className="p-2 text-left bg-[var(--bg-app)] hover:bg-[var(--border-card)] rounded-[12px] text-[var(--text-primary)] border border-[var(--border-card)] transition-all outline-none cursor-pointer"
              >
                <strong>HR:</strong> hr@attendance.com (hr123)
              </button>
              <button
                onClick={() => fillQuickCredentials('manager@attendance.com', 'manager123')}
                className="p-2 text-left bg-[var(--bg-app)] hover:bg-[var(--border-card)] rounded-[12px] text-[var(--text-primary)] border border-[var(--border-card)] transition-all outline-none cursor-pointer"
              >
                <strong>Manager:</strong> manager@attendance.com (manager123)
              </button>
              <button
                onClick={() => fillQuickCredentials('rath@attendance.com', 'emp123')}
                className="p-2 text-left bg-[var(--bg-app)] hover:bg-[var(--border-card)] rounded-[12px] text-[var(--text-primary)] border border-[var(--border-card)] transition-all outline-none cursor-pointer"
              >
                <strong>Employee:</strong> rath@attendance.com (emp123)
              </button>
            </div>
          </div>
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
