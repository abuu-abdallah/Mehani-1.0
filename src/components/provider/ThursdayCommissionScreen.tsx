import React, { useState } from 'react';
import {
  Wallet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Upload,
  Copy,
  Check,
  Clock,
  FileCheck,
  Building2,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ThursdayCommissionDeposit } from '../../types';
import { compressImage } from '../../utils/imageCompression';

export const ThursdayCommissionScreen: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { currentUser } = useAuth();
  const { deposits, submitThursdayDeposit, requests, setActiveTab, goBack } = useApp();

  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const isProviderOrAdmin = currentUser?.role === 'provider' || currentUser?.role === 'admin';

  // Filter deposits for this provider
  const myDeposits = deposits.filter(
    d => !currentUser || d.providerId === currentUser.id || currentUser.role !== 'provider'
  );
  const rejectedDeposits = myDeposits.filter(d => d.status === 'rejected');
  const pendingReviewDeposits = myDeposits.filter(d => d.status === 'pending_verification');

  const [amount, setAmount] = useState<string>(
    currentUser?.pendingCommissionDueSDG ? String(currentUser.pendingCommissionDueSDG) : ''
  );
  const [bankakRef, setBankakRef] = useState<string>('BK-');
  const [depositDate, setDepositDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [resubmitDepositId, setResubmitDepositId] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isProviderOrAdmin) {
    return (
      <div className="pb-28 max-w-md mx-auto px-4 pt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
          <ShieldAlert className="w-8 h-8 text-slate-500 dark:text-slate-400" />
        </div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {language === 'ar' ? 'قسم مخصص لأصحاب المهن ومقدمي الخدمات' : 'Reserved for Service Providers'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {language === 'ar'
            ? 'هذه الصفحة مخصصة للمهنيين المستقلين لمتابعة حساباتهم وتوريداتهم الأسبوعية.'
            : 'This section is reserved for verified trade providers to manage weekly settlements.'}
        </p>
        <button
          onClick={() => setActiveTab('home')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white font-bold text-xs cursor-pointer shadow-xs"
        >
          {t('navHome')}
        </button>
      </div>
    );
  }

  // Compute accurate earnings, 8% commission & collected cancellation penalties
  const completedRequests = requests.filter(
    r => r.providerId === currentUser?.id && r.status === 'completed'
  );
  const totalEarned =
    completedRequests.reduce((sum, r) => sum + r.agreedPriceSDG, 0) ||
    currentUser?.totalEarningsSDG ||
    0;
  const totalCollectedPenalties = completedRequests.reduce(
    (sum, r) => sum + (r.cancellationFeePenaltySDG || 0),
    0
  );
  const totalCommission8Percent = completedRequests.reduce(
    (sum, r) => sum + (r.commissionFeeSDG || Math.round(r.agreedPriceSDG * 0.08)),
    0
  );
  const pendingDue =
    currentUser?.pendingCommissionDueSDG !== undefined
      ? currentUser.pendingCommissionDueSDG
      : Math.round(totalEarned * 0.08) + totalCollectedPenalties;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('2334155');
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormError(null);
      try {
        const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
        setReceiptUrl(compressed);
      } catch (err) {
        console.error('Failed to compress receipt image', err);
        setFormError(language === 'ar' ? 'تعذر معالجة صورة الإشعار، يرجى اختيار صورة أخرى' : 'Could not process image');
      }
    }
  };

  const handleStartReupload = (dep: ThursdayCommissionDeposit) => {
    setFormError(null);
    setSubmittedSuccess(false);
    setResubmitDepositId(dep.id);
    setAmount(String(dep.amountSDG));
    setBankakRef(dep.bankakReferenceNumber || 'BK-');
    setDepositDate(dep.depositDate || new Date().toISOString().split('T')[0]);
    setNotes(dep.notes || '');
    setReceiptUrl('');
    const formEl = document.getElementById('deposit-upload-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCancelReupload = () => {
    setResubmitDepositId(null);
    setFormError(null);
    setAmount(currentUser?.pendingCommissionDueSDG ? String(currentUser.pendingCommissionDueSDG) : '');
    setBankakRef('BK-');
    setDepositDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setReceiptUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setFormError(language === 'ar' ? 'يرجى إدخال مبلغ توريد صحيح' : 'Please enter a valid deposit amount');
      return;
    }

    if (!bankakRef.trim() || bankakRef.trim() === 'BK-') {
      setFormError(language === 'ar' ? 'يرجى إدخال رقم إشعار بنكك الصحيح' : 'Please enter the Bankak transaction reference');
      return;
    }

    if (!receiptUrl) {
      setFormError(language === 'ar' ? 'يرجى إرفاق صورة إشعار التحويل من بنكك' : 'Please upload a screenshot of your Bankak receipt');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitThursdayDeposit({
        amountSDG: numAmount,
        depositDate,
        bankakReferenceNumber: bankakRef.trim(),
        receiptFileUrl: receiptUrl,
        notes: notes.trim() || undefined,
        resubmitDepositId: resubmitDepositId || undefined,
      });

      if (res.success) {
        setSubmittedSuccess(true);
        setResubmitDepositId(null);
        setBankakRef('BK-');
        setReceiptUrl('');
        setNotes('');
        setTimeout(() => setSubmittedSuccess(false), 5000);
      } else {
        setFormError(res.error || (language === 'ar' ? 'تعذر إرسال إشعار التوريد' : 'Failed to submit deposit'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRejectedTarget = resubmitDepositId
    ? myDeposits.find(d => d.id === resubmitDepositId)
    : null;

  return (
    <div className="pb-28 max-w-4xl mx-auto px-4 pt-3 space-y-6">
      {/* Top Navigation Back Button Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للرئيسية' : 'Back to Home'}
        >
          <BackArrowIcon className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Page Title */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg w-fit border border-amber-200 dark:border-amber-800">
          <Calendar className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'موعد التوريد الأسبوعي: كل يوم خميس' : 'Weekly Settlement: Every Thursday'}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
          {t('thursdayCommissionTitle')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {t('thursdayCommissionSubtitle')}
        </p>
      </div>

      {/* URGENT REJECTED DEPOSIT ALERT BANNER */}
      {rejectedDeposits.length > 0 && (
        <div className="rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-5 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold text-rose-950 dark:text-rose-200">
                {language === 'ar'
                  ? `تنبيه هام: يوجد (${rejectedDeposits.length}) إشعار توريد مرفوض ويحتاج إلى إعادة رفع`
                  : `Action Required: ${rejectedDeposits.length} Deposit Proof(s) Rejected — Please Re-upload`}
              </h2>
              <p className="text-xs text-rose-900 dark:text-rose-300/90 leading-relaxed">
                {language === 'ar'
                  ? 'راجعت الإدارة إشعار التحويل المرفق وتبين أنه غير صالح أو غير مطابق. لا يتم خصم العمولة المستحقة إلا بعد اعتماد إشعار تحويل صحيح.'
                  : 'An administrator reviewed your deposit receipt and marked it invalid. Your commission due remains unpaid until a valid receipt is uploaded and approved.'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {rejectedDeposits.map(dep => (
              <div
                key={dep.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {dep.amountSDG.toLocaleString()} {t('sdg')}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">{dep.bankakReferenceNumber}</span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{dep.depositDate}</span>
                  </div>
                  <div className="text-rose-800 dark:text-rose-300 font-semibold flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      {language === 'ar' ? 'سبب الرفض: ' : 'Rejection reason: '}
                      {dep.rejectionReason ||
                        (language === 'ar'
                          ? 'إشعار التحويل غير واضح أو غير مطابق، يرجى إعادة الرفع'
                          : 'Invalid or mismatched transfer receipt, please re-upload')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartReupload(dep)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إعادة رفع إشعار صحيح' : 'Re-upload Valid Proof'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Commission Due (8%) */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100 uppercase tracking-wide">
              {t('dueCommission')}
            </span>
            <Wallet className="w-5 h-5 text-amber-200" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
            {pendingDue.toLocaleString()}
            <span className="text-xs font-medium text-amber-100 ms-1.5">{t('sdg')}</span>
          </div>
          <span className="text-[11px] text-amber-100 block leading-snug">
            {totalCollectedPenalties > 0
              ? language === 'ar'
                ? `تشمل عمولة 8% (${totalCommission8Percent.toLocaleString()} ج.س) + غرامات إلغاء محصلة (${totalCollectedPenalties.toLocaleString()} ج.س)`
                : `Includes 8% fee (${totalCommission8Percent.toLocaleString()} SDG) + collected penalties (${totalCollectedPenalties.toLocaleString()} SDG)`
              : language === 'ar'
                ? 'تشمل نسبة 8% عن الطلبات المكتملة + أي غرامات إلغاء محصلة من العملاء'
                : '8% platform fee from completed jobs + any collected cancellation penalties'}
          </span>
        </div>

        {/* Gross Revenue */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wide">
              {t('totalGrossEarnings')}
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {totalEarned.toLocaleString()}
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 ms-1.5">{t('sdg')}</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            {completedRequests.length} {language === 'ar' ? 'خدمات منجزة ومستلمة' : 'completed jobs'}
          </span>
        </div>

        {/* Settlement Status */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wide">
              {language === 'ar' ? 'حالة توريد هذا الأسبوع' : 'This Week Settlement'}
            </span>
            <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            {rejectedDeposits.length > 0 ? (
              <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {language === 'ar' ? 'إشعار مرفوض — يلزم إعادة الرفع' : 'Invalid Proof — Re-upload'}
              </span>
            ) : pendingReviewDeposits.length > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="w-5 h-5 shrink-0" />
                {language === 'ar' ? 'قيد مراجعة واعتماد الإدارة' : 'Pending Admin Review'}
              </span>
            ) : pendingDue === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {language === 'ar' ? 'مكتمل ومسدد بالكامل' : 'All Settled'}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Calendar className="w-5 h-5 shrink-0" />
                {language === 'ar' ? 'بانتظار إيداع الخميس' : 'Due this Thursday'}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            {rejectedDeposits.length > 0
              ? language === 'ar'
                ? 'اضغط إعادة رفع إشعار صحيح أدناه لتحديث الطلب'
                : 'Use Re-upload Valid Proof below'
              : language === 'ar'
                ? 'إشعار بنكك يُرفع عبر النموذج أدناه'
                : 'Upload Bankak receipt below'}
          </span>
        </div>
      </div>

      {/* Official Mehani Bankak Account Details Card */}
      <div className="bg-slate-900 dark:bg-slate-900/95 border border-transparent dark:border-slate-800 text-white rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-sm font-bold text-white">{t('companyBankakAccount')}</h2>
              <span className="text-[11px] text-slate-400">بنك الخرطوم - Bank of Khartoum (BOK)</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-teal-900/60 text-teal-300 text-[11px] font-bold border border-teal-700/50">
            حساب رسمي معتمد
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                {language === 'ar' ? 'رقم الحساب (Account No.)' : 'Account Number'}
              </span>
              <span className="text-xl font-mono font-extrabold tracking-wider text-teal-300">
                2334155
              </span>
            </div>
            <button
              onClick={handleCopyAccount}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAccount ? (language === 'ar' ? 'تم النسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}</span>
            </button>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">
              {language === 'ar' ? 'اسم المستفيد (Beneficiary)' : 'Account Name'}
            </span>
            <span className="text-sm font-bold text-white block mt-0.5">
              Ahmed Almostafa Omer - احمدالمصطفى عمر
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-300 pt-1 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>
            {language === 'ar'
              ? 'خطوات التوريد: افتح تطبيق بنكك -> تحويل لحساب آخر (2334155) -> التقط صورة للإشعار -> ارفع الإشعار أدناه.'
              : 'Steps: Open Bankak app -> Transfer to 2334155 -> Take receipt screenshot -> Upload below.'}
          </span>
        </div>
      </div>

      {/* Thursday Deposit Proof Upload Form */}
      <div id="deposit-upload-form" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {resubmitDepositId
                  ? language === 'ar'
                    ? 'إعادة رفع إشعار التوريد المصحح'
                    : 'Re-upload Corrected Deposit Proof'
                  : t('depositProofUpload')}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'توثيق سداد عمولة الـ 8% وغرامات الإلغاء المحصلة لحساب مهني'
                  : 'Record 8% commission & collected penalty settlement with screenshot'}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-transparent dark:border-teal-800 px-2.5 py-1 rounded-lg">
            {language === 'ar' ? 'العمولة 8% + الغرامات' : '8% + Penalties'}
          </span>
        </div>

        {activeRejectedTarget && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-950 dark:text-amber-200 block">
                {language === 'ar'
                  ? `أنت تقوم الآن بتحديث الإشعار المرفوض (${activeRejectedTarget.bankakReferenceNumber})`
                  : `Updating rejected receipt (${activeRejectedTarget.bankakReferenceNumber})`}
              </span>
              {activeRejectedTarget.rejectionReason && (
                <span className="text-amber-900 dark:text-amber-300 block">
                  {activeRejectedTarget.rejectionReason}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCancelReupload}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
            </button>
          </div>
        )}

        {submittedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{t('depositSubmittedSuccess')}</span>
          </div>
        )}

        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount (SDG) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('depositAmount')} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="25000"
                  required
                  className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none tabular-nums"
                />
                <span className="absolute end-3 top-2.5 text-xs text-slate-400 dark:text-slate-500 font-bold">
                  {t('sdg')}
                </span>
              </div>
            </div>

            {/* Bankak Reference Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('bankakRefNumber')} *
              </label>
              <input
                type="text"
                value={bankakRef}
                onChange={(e) => setBankakRef(e.target.value)}
                placeholder="BK-984310284"
                required
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
              />
            </div>

            {/* Deposit Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {language === 'ar' ? 'تاريخ التحويل / الإيداع *' : 'Deposit Date *'}
              </label>
              <input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {language === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (Optional)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: عمولة أسبوع 8 أكتوبر عن صيانة مكيفات' : 'e.g. October 8 week settlement'}
                className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Screenshot Upload with Live Preview */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {t('depositReceiptImage')} *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer transition-colors text-center group">
                <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 mb-2 transition-colors" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {receiptUrl
                    ? language === 'ar'
                      ? 'اضغط لتغيير صورة إشعار بنكك'
                      : 'Click to replace Bankak receipt'
                    : language === 'ar'
                      ? 'اضغط لاختيار صورة إشعار بنكك'
                      : 'Click to select Bankak receipt'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  PNG, JPG, Screenshot (BOK / Bankak)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>

              {receiptUrl ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <img
                    src={receiptUrl}
                    alt="Receipt preview"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      {language === 'ar' ? 'معاينة الإشعار المرفق' : 'Receipt Preview'}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'جاهز للإرسال والمراجعة' : 'Ready for review'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 text-center">
                  {language === 'ar'
                    ? 'لم يتم اختيار صورة الإشعار بعد'
                    : 'No receipt screenshot selected yet'}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {resubmitDepositId ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>
              {resubmitDepositId
                ? language === 'ar'
                  ? 'إرسال الإشعار المصحح للمراجعة'
                  : 'Submit Corrected Proof for Review'
                : t('submitDeposit')}
            </span>
          </button>
        </form>
      </div>

      {/* History of Past Thursday Deposits */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <span>{language === 'ar' ? 'سجل توريدات الخميس السابقة' : 'Past Thursday Deposit Receipts'}</span>
        </h2>

        {myDeposits.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
            {language === 'ar' ? 'لا توجد توريدات مسجلة بعد' : 'No deposits recorded yet'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {myDeposits.map((dep) => {
              const isVerified = dep.status === 'verified';
              const isRejected = dep.status === 'rejected';
              return (
                <div key={dep.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {dep.amountSDG.toLocaleString()} {t('sdg')}
                      </span>

                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          {language === 'ar' ? 'معتمد' : 'Verified'}
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-[10px] border border-rose-200 dark:border-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          {language === 'ar' ? 'مرفوض - غير صالح (يلزم إعادة الرفع)' : 'Rejected - Re-upload Required'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[10px] border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" />
                          {language === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">
                      {dep.bankakReferenceNumber} · {dep.depositDate}
                    </span>

                    {dep.notes && (
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 block">{dep.notes}</span>
                    )}

                    {isRejected && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-[11px] space-y-1.5">
                        <div className="font-semibold flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            {language === 'ar' ? 'ملاحظة الإدارة: ' : 'Admin note: '}
                            {dep.rejectionReason ||
                              (language === 'ar'
                                ? 'الإشعار المرفق غير صالح، يرجى إعادة رفع إشعار صحيح.'
                                : 'Receipt invalid, please re-upload a valid receipt.')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartReupload(dep)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{language === 'ar' ? 'إعادة رفع الإشعار الآن' : 'Re-upload Proof Now'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {dep.receiptFileUrl && (
                    <img
                      src={dep.receiptFileUrl}
                      alt="Receipt"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
