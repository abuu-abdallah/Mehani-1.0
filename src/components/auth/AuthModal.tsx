import React, { useState } from 'react';
import { 
  X, 
  Phone, 
  Lock, 
  User, 
  MapPin, 
  Upload, 
  Briefcase, 
  Banknote, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Camera,
  Clock,
  Loader2,
  Mail,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { SERVICE_CATEGORIES, SUDAN_STATES_CITIES } from '../../data/mockData';
import { validateSudanPhone, detectSudanOperator } from '../../utils/phoneValidation';
import { validateEmail } from '../../utils/emailValidation';
import { compressImage } from '../../utils/imageCompression';
import { BrandLogo } from '../common/BrandLogo';

export const AuthModal: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const {
    currentUser,
    isGuest,
    login,
    registerCustomer,
    registerProvider,
    requestPasswordReset,
    resetPassword,
    continueAsGuest,
  } = useAuth();
  const { 
    showAuthModal, 
    setShowAuthModal, 
    authModalMode, 
    setAuthModalMode,
    closeAuthModal,
    setActiveTab,
    categories
  } = useApp();

  // Shared form fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedState, setSelectedState] = useState('الخرطوم');
  const [neighborhood, setNeighborhood] = useState('الرياض');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Forgot password / 6-digit reset state
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'done'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Provider specific form fields
  const [tradeCategoryId, setTradeCategoryId] = useState('tailor');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(['tailor']);
  const [basePrice, setBasePrice] = useState('25000');
  const [bio, setBio] = useState('');
  const [nidFileUrl, setNidFileUrl] = useState<string>('');
  const [nidFileName, setNidFileName] = useState<string>('');
  const [coveredAreas, setCoveredAreas] = useState('الرياض، المعمورة، الطائف');

  // Pending approval screen state
  const [pendingApprovalUser, setPendingApprovalUser] = useState<any | null>(null);

  const [isCompressingNid, setIsCompressingNid] = useState<boolean>(false);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState<boolean>(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState<boolean>(false);
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState<boolean>(false);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (!showAuthModal) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingAvatar(true);
        const compressed = await compressImage(file, { maxWidth: 320, maxHeight: 320, quality: 0.8 });
        setAvatarUrl(compressed);
      } catch (err) {
        console.error('Failed to compress avatar', err);
      } finally {
        setIsCompressingAvatar(false);
      }
    }
  };

  const handleNidFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingNid(true);
        setNidFileName(file.name);
        // Optimize document image: max 1024px, JPEG 0.75 quality (~70KB instead of 10MB)
        const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
        setNidFileUrl(compressed);
      } catch (err) {
        console.error('Failed to compress NID document', err);
        setErrorMessage(language === 'ar' ? 'تعذر معالجة صورة المستند، يرجى المحاولة مرة أخرى' : 'Failed to process document photo');
      } finally {
        setIsCompressingNid(false);
      }
    }
  };

  const handleRemoveNidFile = () => {
    setNidFileUrl('');
    setNidFileName('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!phone.trim() || !password.trim()) {
      setErrorMessage(t('fillRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(phone.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'فشل تسجيل الدخول');
        return;
      }

      // If provider needs to re-upload NID or check status, navigate directly to profile
      if (res.user && res.user.role === 'provider') {
        if (res.user.nidStatus === 'reupload_requested' || res.user.isActive === false) {
          setActiveTab('profile');
        }
      }

      setShowAuthModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage(t('fillRequired'));
      return;
    }

    // Enforce Sudanese phone validation (10 digits starting with MTN, Zain, or Sudani)
    const custPhoneVal = validateSudanPhone(phone);
    if (!custPhoneVal.isValid) {
      setErrorMessage(language === 'ar' ? custPhoneVal.errorMessageAr! : custPhoneVal.errorMessageEn!);
      return;
    }

    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setErrorMessage(language === 'ar' ? emailVal.errorMessageAr! : emailVal.errorMessageEn!);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerCustomer({
        name: name.trim(),
        phone: custPhoneVal.cleanPhone,
        email: emailVal.cleanEmail,
        password,
        state: selectedState,
        city: selectedState,
        neighborhood: neighborhood.trim(),
        avatarUrl: avatarUrl || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'فشل التسجيل');
        return;
      }

      setShowAuthModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage(t('fillRequired'));
      return;
    }

    // Enforce Sudanese phone validation (10 digits starting with MTN, Zain, or Sudani)
    const provPhoneVal = validateSudanPhone(phone);
    if (!provPhoneVal.isValid) {
      setErrorMessage(language === 'ar' ? provPhoneVal.errorMessageAr! : provPhoneVal.errorMessageEn!);
      return;
    }

    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setErrorMessage(language === 'ar' ? emailVal.errorMessageAr! : emailVal.errorMessageEn!);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('passwordMismatch'));
      return;
    }

    // Service provider must select at least 1 service
    if (selectedCategoryIds.length === 0) {
      setErrorMessage(language === 'ar'
        ? 'يجب اختيار وتحديد خدمة واحدة على الأقل لتقديمها للزبائن'
        : 'Please select at least one service to offer');
      return;
    }

    // Explicit user requirement: service providers must upload their NID copy (uploaded, not typed)
    if (!nidFileUrl) {
      setErrorMessage(language === 'ar'
        ? 'يرجى إرفاق ورفع صورة مستند الرقم الوطني أو جواز السفر لتوثيق واعتماد الحساب'
        : 'Please upload a copy of your National ID (NID) or Passport for account verification');
      return;
    }

    const primaryCatId = selectedCategoryIds[0];
    const selectedCategory = categories.find(c => c.id === primaryCatId) || SERVICE_CATEGORIES.find(c => c.id === primaryCatId);
    const numPrice = parseFloat(basePrice) || 25000;

    setIsSubmitting(true);
    try {
      const res = await registerProvider({
        name: name.trim(),
        phone: provPhoneVal.cleanPhone,
        email: emailVal.cleanEmail,
        password,
        state: selectedState,
        city: selectedState,
        neighborhood: neighborhood.trim(),
        tradeCategoryId: primaryCatId,
        serviceCategoryIds: selectedCategoryIds,
        tradeTitleAr: selectedCategory?.nameAr || 'مهني وحرفي معتمد',
        tradeTitleEn: selectedCategory?.nameEn || 'Verified Craftsman',
        bioAr: bio.trim() || (language === 'ar' ? 'مهني وحرفي معتمد في منصة مهني' : 'Verified Mehani trade worker'),
        basePriceSDG: numPrice,
        nidUrl: nidFileUrl,
        nidNumber: nidFileName || (language === 'ar' ? 'مستند هوية مرفق' : 'Uploaded ID Document'),
        coveredNeighborhoods: coveredAreas.split(/[،,]/).map(s => s.trim()).filter(Boolean),
        avatarUrl: avatarUrl || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'فشل تسجيل الحساب');
        return;
      }

      if (res.user) {
        setPendingApprovalUser(res.user);
      } else {
        setShowAuthModal(false);
        setActiveTab('home');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMessage(null);

    const emailVal = validateEmail(resetEmail);
    if (!emailVal.isValid) {
      setErrorMessage(language === 'ar' ? emailVal.errorMessageAr! : emailVal.errorMessageEn!);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(emailVal.cleanEmail);
      if (!res.success) {
        setErrorMessage(res.error || 'تعذر إرسال رمز الاستعادة');
        return;
      }
      setResetEmail(emailVal.cleanEmail);
      setDevPreviewCode(res.devPreviewCode || null);
      setResetSuccessMessage(
        res.message ||
          (language === 'ar'
            ? 'تم إرسال رمز تحقق مكون من 6 أرقام صالح لمدة 15 دقيقة.'
            : 'A 6-digit verification code valid for 15 minutes has been sent.')
      );
      setResendCooldown(60);
      setResetStep('verify');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(resetEmail);
      if (!res.success) {
        setErrorMessage(res.error || 'تعذر إعادة إرسال الرمز');
        return;
      }
      setDevPreviewCode(res.devPreviewCode || null);
      setResetSuccessMessage(
        res.message ||
          (language === 'ar'
            ? 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.'
            : 'A new verification code has been sent to your email.')
      );
      setResendCooldown(60);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = resetCode.replace(/\s+/g, '');
    if (!/^[0-9]{6}$/.test(cleanCode)) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام' : 'Please enter the 6-digit code');
      return;
    }
    if (resetNewPassword.length < 6) {
      setErrorMessage(
        language === 'ar'
          ? 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل'
          : 'New password must be at least 6 characters'
      );
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage(t('passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPassword({
        email: resetEmail,
        code: cleanCode,
        newPassword: resetNewPassword,
      });
      if (!res.success) {
        setErrorMessage(res.error || 'فشل تحديث كلمة المرور');
        return;
      }
      setResetSuccessMessage(
        res.message ||
          (language === 'ar'
            ? 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول برقم هاتفك.'
            : 'Password updated successfully! You can now sign in with your phone number.')
      );
      setDevPreviewCode(null);
      setResetStep('done');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForgotPasswordFlow = () => {
    setErrorMessage(null);
    setResetSuccessMessage(null);
    setDevPreviewCode(null);
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetStep('request');
    setAuthModalMode('forgot_password');
  };

  return (
    <div 
      onClick={closeAuthModal}
      className="fixed inset-0 z-50 bg-black/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6"
      >
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 dark:bg-slate-950 border-b border-transparent dark:border-slate-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <div>
              <h2 className="font-extrabold text-base text-white">
                {authModalMode === 'login' && t('login')}
                {authModalMode === 'register_customer' && (language === 'ar' ? 'تسجيل حساب عميل' : 'Customer Sign Up')}
                {authModalMode === 'register_provider' && (language === 'ar' ? 'تسجيل مقدم خدمة حرفي' : 'Provider Sign Up')}
                {authModalMode === 'forgot_password' && t('resetPasswordTitle')}
              </h2>
              <span className="text-[11px] text-teal-300">
                {t('appName')} · {t('appTagline')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pendingApprovalUser ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold inline-block border border-amber-200 dark:border-amber-800">
                {t('pendingNidApproval')}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'تم استلام طلب تسجيلك بنجاح!' : 'Provider Registration Received!'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {language === 'ar'
                  ? 'حسابك كمهني مسجل الآن وهو معطل مؤقتاً بانتظار مراجعة وتدقيق صورة الرقم الوطني أو جواز السفر من قبل إدارة منصة مهني لضمان أمان وموثوقية السوق. سيتم مراجعة طلبك وتفعيل الحساب قريباً.'
                  : 'Your account is registered but deactivated by default while administrators review your uploaded National ID (NID) or Passport. It will be activated shortly after verification.'}
              </p>
            </div>

            {/* Provider Summary Badge */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-start text-xs space-y-2 max-w-md mx-auto">
              <div className="flex items-center gap-3">
                <img
                  src={pendingApprovalUser.avatarUrl}
                  alt={pendingApprovalUser.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{pendingApprovalUser.name}</h3>
                  <span className="text-teal-700 dark:text-teal-400 font-medium block">{pendingApprovalUser.tradeTitleAr}</span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">{pendingApprovalUser.phone}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">مستند الهوية المرفق:</span>
                  <span className="font-bold text-teal-800 dark:text-teal-300">نسخة الرقم الوطني / الجواز (مرفقة بنجاح)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">حالة الحساب:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    بانتظار مراجعة واعتماد الإدارة (معطل مؤقتاً)
                  </span>
                </div>
              </div>

              {pendingApprovalUser.nidUrl && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">مستند الرقم الوطني أو جواز السفر المرفق:</span>
                  <img
                    src={pendingApprovalUser.nidUrl}
                    alt="NID Document preview"
                    className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setPendingApprovalUser(null);
                setShowAuthModal(false);
                setActiveTab('home');
              }}
              className="w-full max-w-md mx-auto py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'فهمت ذلك — الانتقال إلى الرئيسية' : 'Understood — Go to Home'}
            </button>
          </div>
        ) : (
          <>
            {/* Tab Toggle for Mode */}
            {authModalMode === 'forgot_password' ? (
              <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setResetSuccessMessage(null);
                    setAuthModalMode('login');
                  }}
                  className="inline-flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer"
                >
                  {dir === 'rtl' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                  <span>{t('backToLogin')}</span>
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'التحقق عبر البريد الإلكتروني' : 'Email verification'}
                </span>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 flex gap-1 text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setAuthModalMode('login');
                  }}
                  className={`flex-1 py-2 rounded-xl transition-colors cursor-pointer text-center ${
                    authModalMode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t('login')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setAuthModalMode('register_customer');
                  }}
                  className={`flex-1 py-2 rounded-xl transition-colors cursor-pointer text-center ${
                    authModalMode === 'register_customer' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'ar' ? 'حساب عميل' : 'Hirer Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setAuthModalMode('register_provider');
                  }}
                  className={`flex-1 py-2 rounded-xl transition-colors cursor-pointer text-center ${
                    authModalMode === 'register_provider' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'ar' ? 'حساب مهني' : 'Worker Account'}
                </button>
              </div>
            )}

            {/* Error message alert */}
            {errorMessage && (
              <div className="mx-5 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

        {/* FORM 1: LOGIN (Phone Number or Email & Password) */}
        {authModalMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {language === 'ar' ? 'رقم الهاتف أو البريد الإلكتروني' : 'Phone Number or Email'} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={language === 'ar' ? '0912345678 أو name@example.com' : '0912345678 or name@example.com'}
                  required
                  className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('password')} *</label>
                <button
                  type="button"
                  onClick={openForgotPasswordFlow}
                  className="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 hover:underline cursor-pointer"
                >
                  {t('forgotPassword')}
                </button>
              </div>
              <div className="relative" dir="ltr">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full ps-3 pe-10 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('login')}</span>
            </button>
          </form>
        )}

        {/* FORM 1B: FORGOT PASSWORD (2-Step Email + 6-Digit Code) */}
        {authModalMode === 'forgot_password' && (
          <div className="p-5 space-y-4">
            {resetStep === 'request' && (
              <form onSubmit={handleRequestResetSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    {language === 'ar'
                      ? 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رمز تحقق مكون من 6 أرقام (صالح لمدة 15 دقيقة) لإعادة تعيين كلمة المرور.'
                      : 'Enter your registered email address and we will send a 6-digit verification code (valid for 15 minutes) to reset your password.'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('email')} *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute top-3 start-3" />
                    <input
                      type="email"
                      dir="ltr"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      required
                      className="w-full ps-9 pe-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('sendResetCode')}</span>
                </button>
              </form>
            )}

            {resetStep === 'verify' && (
              <form onSubmit={handleVerifyResetSubmit} className="space-y-3.5">
                {resetSuccessMessage && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{resetSuccessMessage}</span>
                    </div>
                    {devPreviewCode && (
                      <div className="pt-1 font-mono text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        {language === 'ar' ? 'رمز المعاينة المحلي:' : 'Local preview code:'} {devPreviewCode}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-300 font-mono truncate" dir="ltr">{resetEmail}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setResetStep('request');
                    }}
                    className="text-teal-700 dark:text-teal-400 font-bold hover:underline shrink-0 cursor-pointer ms-2"
                  >
                    {language === 'ar' ? 'تغيير البريد' : 'Change'}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('resetCode')} *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    className="w-full px-3 py-2.5 text-base font-mono tabular-nums tracking-[0.4em] text-center text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('newPassword')} *</label>
                    <div className="relative" dir="ltr">
                      <input
                        type={showResetNewPassword ? 'text' : 'password'}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        required
                        className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPassword((prev) => !prev)}
                        aria-label={showResetNewPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                        className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('confirmNewPassword')} *</label>
                    <div className="relative" dir="ltr">
                      <input
                        type={showResetConfirmPassword ? 'text' : 'password'}
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        required
                        className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                        aria-label={showResetConfirmPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                        className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('resetPasswordSubmit')}</span>
                </button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isSubmitting}
                    onClick={handleResendResetCode}
                    className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline disabled:text-slate-400 dark:disabled:text-slate-600 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `${t('resendCode')} (${resendCooldown}s)`
                      : t('resendCode')}
                  </button>
                </div>
              </form>
            )}

            {resetStep === 'done' && (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password Updated Successfully'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {resetSuccessMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setPassword('');
                    setAuthModalMode('login');
                  }}
                  className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer"
                >
                  {t('backToLogin')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* FORM 2: REGISTER CUSTOMER */}
        {authModalMode === 'register_customer' && (
          <form onSubmit={handleRegisterCustomerSubmit} className="p-5 space-y-3.5">
            {/* Profile Photo (Optional) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>{t('changeProfilePhoto')} ({language === 'ar' ? 'اختياري' : 'optional'})</span>
              </label>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="w-10 h-10 rounded-xl object-cover border border-teal-600 shadow-2xs" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{avatarUrl ? (language === 'ar' ? 'تغيير الصورة' : 'Change') : (language === 'ar' ? 'اختيار صورة شخصية' : 'Select Photo')}</span>
                  <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('name')} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أحمد مصطفى"
                required
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('phone')} *</label>
                {detectSudanOperator(phone) && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${detectSudanOperator(phone)?.badgeBg}`}>
                    📶 {detectSudanOperator(phone)?.nameAr}
                  </span>
                )}
              </div>
              <input
                type="tel"
                value={phone}
                maxLength={14}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                required
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                {language === 'ar' 
                  ? 'رقم سوداني مكون من 10 أرقام (زين: 090, 091, 096 | إم تي إن: 092, 093, 099 | سوداني: 010, 011, 012)'
                  : '10-digit Sudanese number (Zain: 090/091/096, MTN: 092/093/099, Sudani: 010/011/012)'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('email')} *</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                {language === 'ar'
                  ? 'يُستخدم لاستعادة كلمة المرور فقط (لا يُسمح بتكرار البريد الإلكتروني)'
                  : 'Used for password reset only (duplicate emails are not allowed)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('state')}</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {Object.keys(SUDAN_STATES_CITIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('neighborhood')}</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="مثال: الرياض"
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('password')} *</label>
                <div className="relative" dir="ltr">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('passwordConfirm')} *</label>
                <div className="relative" dir="ltr">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                    aria-label={showRegConfirmPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isCompressingAvatar}
              className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('register')}</span>
            </button>
          </form>
        )}

        {/* FORM 3: REGISTER SERVICE PROVIDER (NID UPLOAD, PRICE, TRADE, ETC.) */}
        {authModalMode === 'register_provider' && (
          <form onSubmit={handleRegisterProviderSubmit} className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
            
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-100">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{language === 'ar' ? 'تنبيه بشأن تفعيل حساب مقدم الخدمة:' : 'Provider Account Activation Notice:'}</span>
              </div>
              <p className="leading-relaxed">
                {language === 'ar'
                  ? 'حسابات المهنيين الجدد تكون معطلة افتراضياً لحين مراجعة واعتماد صورة الرقم الوطني أو جواز السفر المرفقة من قبل إدارة المنصة لضمان الأمان والموثوقية.'
                  : 'New provider accounts are deactivated by default until administrators verify your uploaded National ID (NID) or Passport.'}
              </p>
              <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold pt-0.5">
                · عمولة المنصة 8% عن كل خدمة مكتملة (بالإضافة لأي غرامات إلغاء محصلة) تدفع أسبوعياً كل خميس عبر بنكك.
              </div>
            </div>

            {/* Profile Photo (Optional) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>{t('changeProfilePhoto')} ({language === 'ar' ? 'اختياري' : 'optional'})</span>
              </label>
              <div className="flex items-center gap-3">
                {isCompressingAvatar ? (
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-300 dark:border-teal-700">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar preview" className="w-10 h-10 rounded-xl object-cover border border-teal-600 shadow-2xs" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{isCompressingAvatar ? (language === 'ar' ? 'جاري التحميل...' : 'Uploading...') : avatarUrl ? (language === 'ar' ? 'تغيير الصورة' : 'Change') : (language === 'ar' ? 'اختيار صورة شخصية للملف' : 'Select Photo')}</span>
                  <input type="file" accept="image/*" onChange={handleAvatarFileChange} disabled={isCompressingAvatar} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('name')} *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('phone')} *</label>
                  {detectSudanOperator(phone) && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${detectSudanOperator(phone)?.badgeBg}`}>
                      📶 {detectSudanOperator(phone)?.nameAr}
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  value={phone}
                  maxLength={14}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  {language === 'ar' 
                    ? 'رقم سوداني 10 أرقام (زين: 090, 091, 096 | إم تي إن: 092, 093, 099 | سوداني: 010, 011, 012)'
                    : '10-digit Sudanese number (Zain: 090/091/096, MTN: 092/093/099, Sudani: 010/011/012)'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('email')} *</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                {language === 'ar'
                  ? 'يُستخدم لاستعادة كلمة المرور فقط (لا يُسمح بتكرار البريد الإلكتروني)'
                  : 'Used for password reset only (duplicate emails are not allowed)'}
              </span>
            </div>

            {/* Multi-Service Selection (Provider can have more than 1 service, must have at least 1) */}
            <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>{language === 'ar' ? 'الحرف والخدمات التي تقدمها *' : 'Offered Services & Trades *'}</span>
                </label>
                <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/70 px-2 py-0.5 rounded-full">
                  {selectedCategoryIds.length} {language === 'ar' ? 'خدمات محددة' : 'selected'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'يمكنك اختيار أكثر من خدمة لتقديمها للزبائن، ويجب الاحتفاظ بخدمة واحدة على الأقل.'
                  : 'You can offer multiple services; at least 1 service is required.'}
              </p>

              {/* Selected Categories Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedCategoryIds.map(catId => {
                  const cat = categories.find(c => c.id === catId) || SERVICE_CATEGORIES.find(c => c.id === catId);
                  const isOnlyOne = selectedCategoryIds.length <= 1;
                  return (
                    <span 
                      key={catId} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-700 text-white text-xs font-medium shadow-xs"
                    >
                      <span>{cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : catId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isOnlyOne) {
                            setErrorMessage(language === 'ar' 
                              ? 'يجب على مقدم الخدمة الاحتفاظ بخدمة واحدة على الأقل' 
                              : 'You must offer at least 1 service');
                            return;
                          }
                          setSelectedCategoryIds(prev => prev.filter(id => id !== catId));
                        }}
                        className={`p-0.5 rounded-md hover:bg-teal-800 transition-colors cursor-pointer ${isOnlyOne ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title={isOnlyOne ? (language === 'ar' ? 'لا يمكن الحذف (مطلوب خدمة واحدة كحد أدنى)' : 'Cannot remove (at least 1 required)') : undefined}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Dropdown to add more services */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {language === 'ar' ? '+ إضافة خدمة أو حرفة أخرى:' : '+ Add another service:'}
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId && !selectedCategoryIds.includes(newId)) {
                      setSelectedCategoryIds(prev => [...prev, newId]);
                      setErrorMessage(null);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="">{language === 'ar' ? '-- اضغط لإضافة خدمة أخرى --' : '-- Select to add another service --'}</option>
                  {categories.filter(c => !selectedCategoryIds.includes(c.id)).map(c => (
                    <option key={c.id} value={c.id}>
                      {language === 'ar' ? c.nameAr : c.nameEn} (متوسط: {c.averageRateSDG.toLocaleString()} ج.س)
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>
                  {language === 'ar' 
                    ? 'هل تقدم خدمة غير متوفرة بالقائمة؟ يمكنك اقتراحها بعد تفعيل الحساب ليتم اعتمادها من الإدارة.' 
                    : 'Offer an unlisted service? Suggest it from your profile for admin review.'}
                </span>
              </div>
            </div>

            {/* Base Service Rate (SDG) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('servicePrice')} *</label>
              <div className="relative">
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="25000"
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <span className="absolute end-3 top-2 text-xs text-slate-400 dark:text-slate-500 font-bold">{t('sdg')}</span>
              </div>
            </div>

            {/* Dedicated File Upload Field for National ID or Passport */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>{language === 'ar' ? 'صورة الرقم الوطني أو جواز السفر *' : 'National ID (NID) or Passport Copy *'}</span>
                </label>
                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/70">
                  {language === 'ar' ? 'رفع ملف (إلزامي)' : 'Upload Required'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {language === 'ar'
                  ? 'يرجى إرفاق ورفع صورة واضحة للرقم الوطني أو جواز السفر لتوثيق واعتماد الحساب من قِبل الإدارة (يتم رفع صورة المستند ولا يلزم كتابة أرقام).'
                  : 'Please upload a clear photo or copy of your National ID or passport for administrative verification.'}
              </p>

              {/* Upload Dropzone / Button */}
              {isCompressingNid ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-teal-400 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/40 rounded-2xl text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                    {language === 'ar' ? 'جاري ضغط ومعالجة صورة المستند...' : 'Compressing & processing document...'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'يتم تحسين الحجم لضمان سرعة التحميل وثبات التطبيق على الهاتف' : 'Optimizing file size for mobile performance'}
                  </span>
                </div>
              ) : !nidFileUrl ? (
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-teal-500/50 dark:border-teal-600/50 hover:border-teal-600 dark:hover:border-teal-500 bg-teal-50/30 dark:bg-teal-950/30 hover:bg-teal-50/60 dark:hover:bg-teal-950/50 rounded-2xl cursor-pointer transition-all text-center group">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/70 text-teal-700 dark:text-teal-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                    {language === 'ar' ? 'اضغط لاختيار ورفع صورة الرقم الوطني أو الجواز' : 'Click to upload National ID or Passport copy'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'ar' ? 'الملفات المدعومة: صور JPG, PNG, WEBP' : 'Supported formats: JPG, PNG, WEBP images'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNidFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{language === 'ar' ? 'تم اختيار صورة الرقم الوطني أو الجواز بنجاح' : 'ID / Passport copy uploaded'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveNidFile}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'حذف' : 'Remove'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={nidFileUrl}
                      alt="Uploaded National ID preview"
                      className="w-20 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0 text-[11px]">
                      <span className="text-slate-900 dark:text-slate-100 font-bold block truncate">
                        {nidFileName || (language === 'ar' ? 'صورة الرقم الوطني أو الجواز المرفقة' : 'National ID / Passport Copy')}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] block mt-0.5">
                        {language === 'ar' ? 'جاهزة للمراجعة والتدقيق الإداري بعد التسجيل' : 'Ready for admin review after sign up'}
                      </span>
                      
                      <label className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 cursor-pointer underline">
                        <span>{language === 'ar' ? 'تغيير الملف' : 'Change file'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleNidFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* State and Neighborhood */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('state')}</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {Object.keys(SUDAN_STATES_CITIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('neighborhood')}</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="مثال: الرياض"
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Covered Areas */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('coveredAreas')}</label>
              <input
                type="text"
                value={coveredAreas}
                onChange={(e) => setCoveredAreas(e.target.value)}
                placeholder="الرياض، المعمورة، الطائف"
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('bio')}</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="اكتب نبذة عن سنوات خبرتك ومهارتك الحرفية..."
                className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Password and Confirm Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('password')} *</label>
                <div className="relative" dir="ltr">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('passwordConfirm')} *</label>
                <div className="relative" dir="ltr">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full ps-3 pe-10 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                    aria-label={showRegConfirmPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                    className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isCompressingNid || isCompressingAvatar}
              className={`w-full py-3.5 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition-colors mt-2 flex items-center justify-center gap-2 ${
                isSubmitting || isCompressingNid || isCompressingAvatar
                  ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-80'
                  : 'bg-teal-700 hover:bg-teal-600 cursor-pointer'
              }`}
            >
              {(isSubmitting || isCompressingNid || isCompressingAvatar) && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isCompressingNid || isCompressingAvatar
                  ? (language === 'ar' ? 'جاري معالجة وتجهيز المستندات...' : 'Processing documents...')
                  : (language === 'ar' ? 'إرسال طلب التسجيل وتوثيق الهوية' : 'Submit Registration & NID Verification')}
              </span>
            </button>
          </form>
        )}

        {/* Modal Footer: Continue as Guest option */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              continueAsGuest();
              setShowAuthModal(false);
            }}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold underline cursor-pointer"
          >
            {t('continueAsGuest')}
          </button>

          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'تصفح فوري بدون قيود' : 'Instant guest browsing'}
          </span>
        </div>
      </>
    )}

      </div>
    </div>
  );
};
