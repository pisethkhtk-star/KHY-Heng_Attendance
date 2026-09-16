import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
  Cog6ToothIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';

const PayrollSettings = () => {
  const { locale, language } = useLanguage();
  const isKhmer = locale === 'kh' || language === 'kh';

  const [loading, setLoading] = useState(true);
  const [savingNssf, setSavingNssf] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [togglingTax, setTogglingTax] = useState(false);

  // NSSF Settings
  const [employeeRate, setEmployeeRate] = useState(2);
  const [employerRate, setEmployerRate] = useState(2);
  const [maxWageCeilingKhr, setMaxWageCeilingKhr] = useState(1200000);
  const [defaultExchangeRateKhr, setDefaultExchangeRateKhr] = useState(4100);
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);

  // Tax on Salary Brackets
  const [taxBrackets, setTaxBrackets] = useState([]);
  const [dependentReliefKhr, setDependentReliefKhr] = useState(150000);

  // Banner
  const [bannerMsg, setBannerMsg] = useState({ type: '', text: '' });
  const showBanner = (text, type = 'success') => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg({ type: '', text: '' }), 4000);
  };

  const toUsd = (khrVal) => {
    if (khrVal === null || khrVal === undefined) return '';
    const rate = Number(defaultExchangeRateKhr) || 4100;
    return (Number(khrVal) / rate).toFixed(2);
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payroll/configs');
      if (res.data) {
        const { nssf, taxBrackets: brackets } = res.data;
        if (nssf) {
          setEmployeeRate(Number(nssf.employeeRate || 0.02) * 100);
          setEmployerRate(Number(nssf.employerRate || 0.02) * 100);
          setMaxWageCeilingKhr(Number(nssf.maxWageCeilingKhr || 1200000));
          setDefaultExchangeRateKhr(Number(nssf.defaultExchangeRateKhr || 4100));
          setIsTaxEnabled(nssf.isTaxEnabled !== false);
        }
        if (brackets && brackets.length > 0) {
          setTaxBrackets(brackets);
          if (brackets[0].dependentReliefKhr) {
            setDependentReliefKhr(Number(brackets[0].dependentReliefKhr));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching payroll configs:', err);
      showBanner(isKhmer ? 'បរាជ័យក្នុងការទាញយកការកំណត់' : 'Failed to load configs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleToggleTax = async () => {
    if (togglingTax) return;
    const nextState = !isTaxEnabled;
    setIsTaxEnabled(nextState);
    try {
      setTogglingTax(true);
      const res = await api.put('/payroll/configs/toggle-tax', { isTaxEnabled: nextState });
      if (res.data && res.data.isTaxEnabled !== undefined) {
        setIsTaxEnabled(res.data.isTaxEnabled !== false);
      }
      showBanner(
        nextState
          ? (isKhmer ? 'បានបើកដំណើរការគណនាពន្ធលើប្រាក់បៀវត្សរ៍ (Tax Enabled)' : 'Tax on Salary calculation enabled')
          : (isKhmer ? 'បានបិទការគណនាពន្ធលើប្រាក់បៀវត្សរ៍ (មិនគណនាពន្ធទេ ពន្ធ = $0.00)' : 'Tax on Salary calculation disabled (Tax = $0.00)'),
        'success'
      );
    } catch (err) {
      console.error('Error toggling tax:', err);
      setIsTaxEnabled(!nextState);
      showBanner(err.response?.data?.message || 'Error updating tax calculation status', 'error');
    } finally {
      setTogglingTax(false);
    }
  };

  const handleSaveNssf = async (e) => {
    e.preventDefault();
    try {
      setSavingNssf(true);
      await api.put('/payroll/configs/nssf', {
        employeeRate: Number(employeeRate) / 100,
        employerRate: Number(employerRate) / 100,
        maxWageCeilingKhr: Number(maxWageCeilingKhr),
        defaultExchangeRateKhr: Number(defaultExchangeRateKhr),
        isTaxEnabled: isTaxEnabled
      });
      showBanner(isKhmer ? 'បានរក្សាទុកការកំណត់ ប.ស.ស ដោយជោគជ័យ!' : 'NSSF configuration saved successfully!');
      await fetchConfigs();
    } catch (err) {
      console.error('Error saving NSSF config:', err);
      showBanner(err.response?.data?.message || 'Error saving NSSF settings', 'error');
    } finally {
      setSavingNssf(false);
    }
  };

  const handleSaveTax = async (e) => {
    e.preventDefault();
    try {
      setSavingTax(true);
      const updated = taxBrackets.map(b => ({
        ...b,
        dependentReliefKhr: Number(dependentReliefKhr)
      }));
      await api.put('/payroll/configs/tax-brackets', updated);
      showBanner(isKhmer ? 'បានរក្សាទុកកាំពន្ធលើប្រាក់បៀវត្សរ៍ដោយជោគជ័យ!' : 'Tax brackets saved successfully!');
      await fetchConfigs();
    } catch (err) {
      console.error('Error saving tax brackets:', err);
      showBanner(err.response?.data?.message || 'Error saving tax brackets', 'error');
    } finally {
      setSavingTax(false);
    }
  };

  // Two-way synchronization handlers for Tax Brackets
  const updateBracketMinKhr = (index, newMin) => {
    const copy = [...taxBrackets];
    copy[index].minKhr = newMin !== '' ? Number(newMin) : 0;
    setTaxBrackets(copy);
  };

  const updateBracketMaxKhr = (index, newMax) => {
    const copy = [...taxBrackets];
    copy[index].maxKhr = newMax !== '' ? Number(newMax) : null;
    setTaxBrackets(copy);
  };

  const updateBracketMinUsd = (index, newMinUsd) => {
    const rate = Number(defaultExchangeRateKhr) || 4100;
    const copy = [...taxBrackets];
    copy[index].minKhr = newMinUsd !== '' ? Math.round(Number(newMinUsd) * rate) : 0;
    setTaxBrackets(copy);
  };

  const updateBracketMaxUsd = (index, newMaxUsd) => {
    const rate = Number(defaultExchangeRateKhr) || 4100;
    const copy = [...taxBrackets];
    copy[index].maxKhr = newMaxUsd !== '' ? Math.round(Number(newMaxUsd) * rate) : null;
    setTaxBrackets(copy);
  };

  const updateBracketRate = (index, newRate) => {
    const copy = [...taxBrackets];
    copy[index].taxRate = Number(newRate) / 100;
    setTaxBrackets(copy);
  };

  // Two-way conversion for NSSF Ceiling and Dependent Relief
  const updateCeilingFromUsd = (usdVal) => {
    const rate = Number(defaultExchangeRateKhr) || 4100;
    if (usdVal === '') {
      setMaxWageCeilingKhr(0);
    } else {
      setMaxWageCeilingKhr(Math.round(Number(usdVal) * rate));
    }
  };

  const updateReliefFromUsd = (usdVal) => {
    const rate = Number(defaultExchangeRateKhr) || 4100;
    if (usdVal === '') {
      setDependentReliefKhr(0);
    } else {
      setDependentReliefKhr(Math.round(Number(usdVal) * rate));
    }
  };

  // Calculations for quick preview
  const maxNssfPerPersonKhr = Number(maxWageCeilingKhr) * (Number(employeeRate) / 100);
  const maxNssfPerPersonUsd = toUsd(maxNssfPerPersonKhr);
  const ceilingUsd = toUsd(maxWageCeilingKhr);
  const reliefUsd = toUsd(dependentReliefKhr);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12 text-slate-100">
      {/* Alert Banner */}
      {bannerMsg.text && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-sm shadow-md ${
          bannerMsg.type === 'error'
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        }`}>
          <span>{bannerMsg.text}</span>
          <button onClick={() => setBannerMsg({ type: '', text: '' })} className="cursor-pointer">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
            <Cog6ToothIcon className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-khmer">
              {isKhmer ? 'ការកំណត់ ប.ស.ស & កាំពន្ធបៀវត្សរ៍ (KHR / USD)' : 'Payroll Settings (NSSF & Tax Brackets)'}
            </h1>
            <p className="text-xs text-slate-400 font-khmer mt-0.5">
              {isKhmer
                ? 'ទិន្នន័យទាំងពីរ (ប្រាក់រៀល KHR និង ប្រាក់ដុល្លារ USD) អាចកែសម្រួលបានទាំងសងខាង ដោយប្តូរដោយស្វ័យប្រវត្តិ'
                : 'Both KHR and USD amounts can be directly edited with real-time automatic two-way conversion'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchConfigs}
            className="py-2.5 px-4 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all shadow-sm font-khmer flex items-center gap-2 cursor-pointer"
          >
            <ArrowPathIcon className="h-4 w-4 text-indigo-400" />
            <span>{isKhmer ? 'ផ្ទុកទិន្នន័យឡើងវិញ' : 'Reload Settings'}</span>
          </button>
        </div>
      </div>

      {/* Currency Exchange Rate & Tax Calculation Control Strip */}
      <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-lg bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <ArrowsRightLeftIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-khmer flex items-center gap-2">
              <span>{isKhmer ? 'អត្រាប្តូរប្រាក់គោល (Base Exchange Rate)' : 'Base Exchange Rate'}</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isKhmer ? 'ប្តូរទៅវិញទៅមក KHR ⇄ USD' : 'Two-way sync'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-khmer">
              {isKhmer
                ? 'លោកអ្នកអាចកែប្រែទិន្នន័យជា KHR ក៏បាន ឬជា USD ក៏បាន ប្រព័ន្ធនឹងបំលែងទៅវិញទៅមកដោយស្វ័យប្រវត្តិ'
                : 'You can edit in either KHR or USD; the system synchronizes both values automatically based on this rate'}
            </p>
          </div>
        </div>

        {/* Right side controls: Tax on Salary Toggle Switch & Exchange Rate */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tax Calculation Button Switch (pointed by user) */}
          <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-white/10 shadow-inner">
            <div className="text-right">
              <div className="text-xs font-bold font-khmer flex items-center gap-1.5 justify-end">
                <span>{isKhmer ? 'គណនាពន្ធបៀវត្សរ៍' : 'Tax on Salary'}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                  isTaxEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {isTaxEnabled ? (isKhmer ? 'បើក (ON)' : 'ON') : (isKhmer ? 'បិទ (OFF)' : 'OFF')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-khmer">
                {isTaxEnabled
                  ? (isKhmer ? 'កាត់ពន្ធតាមច្បាប់' : 'Tax calculated')
                  : (isKhmer ? 'មិនកាត់ពន្ធទេ (ពន្ធ = $0)' : 'Tax skipped (Tax = $0)')}
              </div>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              role="switch"
              aria-checked={isTaxEnabled}
              disabled={togglingTax}
              onClick={handleToggleTax}
              title={isKhmer ? (isTaxEnabled ? 'ចុចដើម្បីបិទមិនគណនាពន្ធ' : 'ចុចដើម្បីបើកគណនាពន្ធ') : (isTaxEnabled ? 'Click to disable tax' : 'Click to enable tax')}
              className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                isTaxEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                  isTaxEnabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              >
                {isTaxEnabled ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XMarkIcon className="w-4 h-4 text-slate-500" />
                )}
              </span>
            </button>
          </div>

          {/* Exchange Rate Badge */}
          <div className="flex items-center gap-2 font-mono text-sm bg-slate-950/70 px-4 py-2.5 rounded-xl border border-white/10">
            <span className="text-emerald-400 font-bold">1 USD</span>
            <span className="text-slate-500">=</span>
            <span className="text-amber-400 font-bold">{Number(defaultExchangeRateKhr).toLocaleString()} KHR</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: NSSF Configuration */}
        <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldCheckIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm font-khmer">
                  {isKhmer ? '១. ការកំណត់ ប.ស.ស (NSSF Configuration)' : '1. NSSF Configuration'}
                </h2>
                <p className="text-[10px] text-slate-400 font-khmer">
                  {isKhmer ? 'គណនាភាគទានសុខាភិបាល & ហានិភ័យការងារ' : 'Healthcare & Occupational Risk contribution'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              {employeeRate}% + {employerRate}%
            </span>
          </div>

          <form onSubmit={handleSaveNssf} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 font-khmer">
                  {isKhmer ? 'អត្រាភាគទាននិយោជិត (%)' : 'Employee Rate (%)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={employeeRate}
                  onChange={(e) => setEmployeeRate(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 font-khmer mt-1 block">
                  ស្ដង់ដារ: {employeeRate}% (អតិបរមា: {maxNssfPerPersonKhr.toLocaleString()}៛ / ~${maxNssfPerPersonUsd})
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5 font-khmer">
                  {isKhmer ? 'អត្រាភាគទាននិយោជក (%)' : 'Employer Rate (%)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={employerRate}
                  onChange={(e) => setEmployerRate(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 font-khmer mt-1 block">
                  ស្ដង់ដារ: {employerRate}% (ក្រុមហ៊ុនបង់បន្ថែម)
                </span>
              </div>
            </div>

            {/* Max Wage Ceiling: Dual editable in KHR & USD */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1 font-khmer">
                {isKhmer ? 'ពិតានប្រាក់ឈ្នួលជាប់កាតព្វកិច្ច (Max Wage Ceiling) — កែបានទាំង២' : 'Max Wage Ceiling (Editable in both KHR & USD)'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-khmer">គិតជាប្រាក់រៀល (KHR ៛)</div>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={maxWageCeilingKhr}
                      onChange={(e) => setMaxWageCeilingKhr(e.target.value)}
                      className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">៛</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-emerald-400 mb-1 font-khmer">គិតជាដុល្លារ (USD $)</div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={ceilingUsd}
                      onChange={(e) => updateCeilingFromUsd(e.target.value)}
                      className="w-full bg-slate-950/70 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-400 outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-emerald-400 font-mono">$</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 mt-2 rounded-xl bg-slate-950/40 border border-white/5 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-300 font-khmer">
                  <span>កាត់ ប.ស.ស និយោជិតអតិបរមា:</span>
                  <span className="font-mono text-indigo-300 font-bold">{maxNssfPerPersonKhr.toLocaleString()}៛ (~${maxNssfPerPersonUsd} USD)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 font-khmer">
                {isKhmer ? 'អត្រាប្តូរប្រាក់លំនាំដើម (Default Exchange Rate)' : 'Default Exchange Rate (KHR per USD)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={defaultExchangeRateKhr}
                  onChange={(e) => setDefaultExchangeRateKhr(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">KHR / $1</span>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-white/10">
              <button
                type="submit"
                disabled={savingNssf}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-500/25 cursor-pointer disabled:opacity-50 font-khmer border-none"
              >
                {savingNssf ? (isKhmer ? 'កំពុងរក្សាទុក...' : 'Saving...') : (isKhmer ? 'រក្សាទុកការកំណត់ ប.ស.ស' : 'Save NSSF Config')}
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: Tax on Salary Progressive Brackets */}
        <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <TableCellsIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm font-khmer">
                  {isKhmer ? '២. កាំពន្ធលើប្រាក់បៀវត្សរ៍ (Cambodia Tax Brackets)' : '2. Cambodia Tax on Salary'}
                </h2>
                <p className="text-[10px] text-slate-400 font-khmer">
                  {isKhmer ? 'ទិន្នន័យទាំងពីរ KHR និង USD អាចធ្វើការ Edit បានទាំងសងខាង' : 'Both KHR & USD brackets can be directly edited with instant two-way sync'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border font-mono ${
                isTaxEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {isTaxEnabled ? (isKhmer ? 'ដំណើរការ (Active)' : 'Active') : (isKhmer ? 'បានបិទ (Disabled)' : 'Disabled')}
              </span>
              <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                GDT Progressive
              </span>
            </div>
          </div>

          {!isTaxEnabled && (
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-khmer flex items-start gap-3 shadow-inner">
              <span className="text-lg leading-none">⚠️</span>
              <div className="space-y-0.5">
                <div className="font-bold text-amber-300">
                  {isKhmer ? 'ការគណនាពន្ធត្រូវបានបិទ (Tax Calculation is Disabled)' : 'Tax Calculation is Disabled'}
                </div>
                <div className="text-[11px] text-amber-200/80">
                  {isKhmer
                    ? 'នៅពេលដំណើរការ Run Payroll ប្រព័ន្ធនឹងរំលងមិនកាត់ពន្ធលើប្រាក់បៀវត្សរ៍ឡើយ (ប្រាក់ពន្ធ = $0.00)'
                    : 'When running payroll, the system will bypass tax on salary deduction completely (Tax = $0.00)'}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveTax} className="space-y-4 text-xs">
            {/* Dependent Relief: Dual editable in KHR & USD */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1 font-khmer">
                {isKhmer ? 'ប្រាក់កាត់បន្ថយបន្ទុកក្នុងម្នាក់ (Dependent Relief) — កែបានទាំង២' : 'Dependent Relief (Editable in KHR & USD)'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-khmer">គិតជាប្រាក់រៀល (KHR ៛)</div>
                  <div className="relative">
                    <input
                      type="number"
                      value={dependentReliefKhr}
                      onChange={(e) => setDependentReliefKhr(e.target.value)}
                      className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">៛</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-emerald-400 mb-1 font-khmer">គិតជាដុល្លារ (USD $)</div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={reliefUsd}
                      onChange={(e) => updateReliefFromUsd(e.target.value)}
                      className="w-full bg-slate-950/70 border border-emerald-500/30 rounded-xl p-2.5 text-emerald-400 outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-emerald-400 font-mono">$</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-khmer mt-1 block">
                ច្បាប់បច្ចុប្បន្ន: {Number(dependentReliefKhr).toLocaleString()} រៀល (~${reliefUsd} USD) ក្នុងកូនម្នាក់ ឬសហព័ទ្ធគ្មានមុខរបរ
              </span>
            </div>

            {/* Tax Brackets Table: Both KHR and USD Editable */}
            <div className="border border-white/10 rounded-xl overflow-hidden shadow-inner">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 border-b border-white/10 font-khmer text-[11px] uppercase tracking-wider">
                    <th className="p-2.5">Tier</th>
                    <th className="p-2.5">
                      {isKhmer ? 'កម្រិត KHR (៛) [កែបាន]' : 'Range in KHR [Edit]'}
                    </th>
                    <th className="p-2.5 font-bold text-emerald-400">
                      {isKhmer ? 'សមមូល USD ($) [កែបាន]' : 'USD Range [Edit]'}
                    </th>
                    <th className="p-2.5 text-center">អត្រា (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {taxBrackets.map((b, idx) => {
                    const minKhrNum = Number(b.minKhr || 0);
                    const maxKhrNum = b.maxKhr !== null && b.maxKhr !== undefined ? Number(b.maxKhr) : null;
                    const minUsd = toUsd(minKhrNum);
                    const maxUsd = maxKhrNum !== null ? toUsd(maxKhrNum) : null;

                    return (
                      <tr key={b.tier || idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-2.5 font-bold text-indigo-400">
                          T{b.tier}
                        </td>

                        {/* Editable KHR Inputs */}
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={b.minKhr ?? 0}
                              onChange={(e) => updateBracketMinKhr(idx, e.target.value)}
                              className="w-20 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                              title="Min KHR"
                            />
                            <span className="text-slate-500 text-[10px]">-</span>
                            {idx < 4 ? (
                              <input
                                type="number"
                                value={b.maxKhr ?? ''}
                                onChange={(e) => updateBracketMaxKhr(idx, e.target.value)}
                                className="w-24 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                                title="Max KHR"
                              />
                            ) : (
                              <span className="text-amber-400 text-[11px] font-khmer px-1">គ្មានពិតាន</span>
                            )}
                          </div>
                        </td>

                        {/* Editable USD Inputs */}
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-500 text-[11px]">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={minUsd}
                              onChange={(e) => updateBracketMinUsd(idx, e.target.value)}
                              className="w-16 bg-slate-950 border border-emerald-500/30 rounded-lg px-1.5 py-1 text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500 font-mono"
                              title="Min USD"
                            />
                            <span className="text-slate-500 text-[10px]">-</span>
                            {idx < 4 ? (
                              <div className="flex items-center gap-0.5">
                                <span className="text-emerald-500 text-[11px]">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={maxUsd ?? ''}
                                  onChange={(e) => updateBracketMaxUsd(idx, e.target.value)}
                                  className="w-18 bg-slate-950 border border-emerald-500/30 rounded-lg px-1.5 py-1 text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500 font-mono"
                                  title="Max USD"
                                />
                              </div>
                            ) : (
                              <span className="text-amber-400 text-[10px] font-mono">&gt; ${minUsd}</span>
                            )}
                          </div>
                        </td>

                        {/* Rate % */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="1"
                              value={Math.round(Number(b.taxRate || 0) * 100)}
                              onChange={(e) => updateBracketRate(idx, e.target.value)}
                              className="w-12 bg-slate-950 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center font-bold text-amber-300 focus:border-indigo-500 font-mono outline-none"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex justify-end border-t border-white/10">
              <button
                type="submit"
                disabled={savingTax}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-amber-500/25 cursor-pointer disabled:opacity-50 font-khmer border-none"
              >
                {savingTax ? (isKhmer ? 'កំពុងរក្សាទុក...' : 'Saving...') : (isKhmer ? 'រក្សាទុកកាំពន្ធ' : 'Save Tax Brackets')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PayrollSettings;
