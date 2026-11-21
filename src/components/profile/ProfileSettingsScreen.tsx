import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  MapPin, 
  Lock, 
  Globe, 
  LogOut, 
  Briefcase, 
  ShieldCheck, 
  Upload, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Save,
  RotateCcw,
  Sparkles,
  Camera,
  Clock,
  X,
  Send,
  AlertTriangle,
  Loader2,
  Edit2,
  Trash2,
  Banknote,
  Tag,
  Check,
  ArrowLeft,
  ArrowRight,
  Mail,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { SUDAN_STATES_CITIES, SERVICE_CATEGORIES } from '../../data/mockData';
import { CategoryIcon } from '../common/CategoryIcon';
import { validateSudanPhone, detectSudanOperator } from '../../utils/phoneValidation';
import { validateEmail, normalizeEmail } from '../../utils/emailValidation';
import { compressImage } from '../../utils/imageCompression';
import { PRESET_AVATARS } from '../../config/avatars';
import { PrivacyPolicyModal } from '../common/PrivacyPolicyModal';

export const ProfileSettingsScreen: React.FC = () => {
  const { t, language, dir, toggleLanguage } = useLanguage();
  const { 
    currentUser, 
    updateProfile, 
    logout, 
    deleteAccount,
    isLoggingOut,
    switchUserRole,
    providerReuploadNid,
    allUsers 
  } = useAuth();
  const { 
    setAuthModalMode, 
    setShowAuthModal, 
    addPortfolioItem,
    toggleProviderAvailability,
    setActiveTab,
    categories,
    serviceSuggestions,
    addProviderService,
    setPrimaryProviderService,
    removeProviderService,
    addCustomService,
    updateCustomService,
    deleteCustomService,
    suggestNewService,
    goBack
  } = useApp();

  const { isDark, setTheme } = useTheme();
  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  // Profile Edit State
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [city, setCity] = useState(currentUser?.city || 'الخرطوم');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || 'الرياض');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Provider Specific Profile Edit State
  const [basePrice, setBasePrice] = useState(currentUser?.basePriceSDG ? String(currentUser.basePriceSDG) : '25000');
  const [bio, setBio] = useState(currentUser?.bioAr || '');
  const [mainCategoryId, setMainCategoryId] = useState(currentUser?.tradeCategoryId || '');
  const [isUpdatingMainCat, setIsUpdatingMainCat] = useState<string | null>(null);
  const [mainCatSuccessMsg, setMainCatSuccessMsg] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Provider Custom Services & Specific Pricing State
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [customServiceCategory, setCustomServiceCategory] = useState(currentUser?.tradeCategoryId || '');
  const [editingCustomServiceId, setEditingCustomServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
  const [editServiceCategory, setEditServiceCategory] = useState('');
  const [customServiceSuccessMsg, setCustomServiceSuccessMsg] = useState<string | null>(null);

  // Provider Service Management States
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState('');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestNameAr, setSuggestNameAr] = useState('');
  const [suggestNameEn, setSuggestNameEn] = useState('');
  const [suggestDescAr, setSuggestDescAr] = useState('');
  const [suggestRate, setSuggestRate] = useState('25000');
  const [suggestSuccess, setSuggestSuccess] = useState(false);

  // Add Portfolio Photo State
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDesc, setPortfolioDesc] = useState('');
  const [portfolioImgUrl, setPortfolioImgUrl] = useState('/src/assets/images/tailor_embroidery_craft_1791698438179.jpg');

  // Feedback states
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // NID Replacement States & Handlers
  const [showReuploadForm, setShowReuploadForm] = useState(false);
  const [newNidReplacementUrl, setNewNidReplacementUrl] = useState('');
  const [newNidReplacementName, setNewNidReplacementName] = useState('');
  const [newNidReplacementNumber, setNewNidReplacementNumber] = useState('');
  const [isCompressingReplacementNid, setIsCompressingReplacementNid] = useState(false);
  const [reuploadSuccessMsg, setReuploadSuccessMsg] = useState(false);

  const handleReplacementNidFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingReplacementNid(true);
        setNewNidReplacementName(file.name);
        const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 });
        setNewNidReplacementUrl(compressed);
      } catch (err) {
        console.error('Failed to compress replacement NID', err);
        setErrorMessage(language === 'ar' ? 'تعذر ضغط ومعالجة صورة المستند' : 'Failed to compress document photo');
      } finally {
        setIsCompressingReplacementNid(false);
      }
    }
  };

  const handleConfirmReuploadNid = async () => {
    if (!currentUser || !newNidReplacementUrl) return;
    const res = await providerReuploadNid(
      currentUser.id, 
      newNidReplacementUrl, 
      newNidReplacementNumber.trim() || currentUser.nidNumber || newNidReplacementName || 'صورة مستند محدثة'
    );
    if (res.success) {
      setReuploadSuccessMsg(true);
      setNewNidReplacementUrl('');
      setNewNidReplacementName('');
      setNewNidReplacementNumber('');
      setTimeout(() => setReuploadSuccessMsg(false), 8000);
    } else {
      setErrorMessage(res.error || 'فشل إرسال المستند');
    }
  };

  // Track whether the user is actively editing fields so background polling doesn't overwrite typed values
  const hasUnsavedEditsRef = React.useRef<boolean>(false);
  const lastSyncedUserIdRef = React.useRef<string | null>(null);

  // Synchronize state when user logs in or switches account (and when no unsaved edits exist)
  React.useEffect(() => {
    if (!currentUser) {
      lastSyncedUserIdRef.current = null;
      hasUnsavedEditsRef.current = false;
      return;
    }
    const isDifferentUser = lastSyncedUserIdRef.current !== currentUser.id;
    if (isDifferentUser || !hasUnsavedEditsRef.current) {
      lastSyncedUserIdRef.current = currentUser.id;
      hasUnsavedEditsRef.current = false;
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setCity(currentUser.city || 'الخرطوم');
      setNeighborhood(currentUser.neighborhood || 'الرياض');
      setAvatarUrl(currentUser.avatarUrl || '');
      setBasePrice(currentUser.basePriceSDG ? String(currentUser.basePriceSDG) : '25000');
      setBio(currentUser.bioAr || '');
      setMainCategoryId(currentUser.tradeCategoryId || '');
      if (isDifferentUser || !customServiceCategory) {
        setCustomServiceCategory(currentUser.tradeCategoryId || '');
      }
    }
  }, [currentUser]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, { maxWidth: 320, maxHeight: 320, quality: 0.8 });
        setAvatarUrl(compressed);
        await updateProfile({ avatarUrl: compressed });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        console.error('Failed to compress avatar upload', err);
      }
    }
  };

  const handleSelectPresetAvatar = async (url: string) => {
    setAvatarUrl(url);
    await updateProfile({ avatarUrl: url });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (!currentUser) {
    return (
      <div className="pb-24 max-w-md mx-auto px-4 pt-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {language === 'ar' ? 'الملف الشخصي والإعدادات' : 'Profile & Settings'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {language === 'ar' ? 'سجل دخولك لتتمكن من إدارة حسابك وتعديل رقم هاتفك.' : 'Sign in to manage your profile and change your phone number.'}
        </p>
        <button
          onClick={() => {
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl cursor-pointer"
        >
          {t('login')}
        </button>
      </div>
    );
  }

  const isProvider = currentUser.role === 'provider';

  const providerCategoryIds = (currentUser?.serviceCategoryIds && currentUser.serviceCategoryIds.length > 0)
    ? currentUser.serviceCategoryIds
    : [currentUser?.tradeCategoryId].filter(Boolean) as string[];

  const availableCategoriesToAdd = categories.filter(c => !providerCategoryIds.includes(c.id));
  const mySuggestions = serviceSuggestions.filter(s => s.providerId === currentUser?.id);

  const handleSuggestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestNameAr.trim() || !suggestDescAr.trim()) {
      setErrorMessage(language === 'ar' ? 'يرجى كتابة اسم الحرفة ووصفها بالعربية' : 'Please enter service name and description');
      return;
    }

    const res = await suggestNewService({
      nameAr: suggestNameAr.trim(),
      nameEn: suggestNameEn.trim() || suggestNameAr.trim(),
      descriptionAr: suggestDescAr.trim(),
      descriptionEn: suggestDescAr.trim(),
      suggestedRateSDG: parseFloat(suggestRate) || 25000,
    });

    if (res.success) {
      setSuggestSuccess(true);
      setTimeout(() => {
        setSuggestSuccess(false);
        setShowSuggestModal(false);
        setSuggestNameAr('');
        setSuggestNameEn('');
        setSuggestDescAr('');
      }, 1500);
    } else {
      setErrorMessage(res.error || 'فشل إرسال الاقتراح');
    }
  };

  // Provider Custom Services Handlers (Instant price & service listing)
  const handleAddCustomService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!customServiceName.trim()) {
      setErrorMessage(language === 'ar' ? 'يرجى كتابة اسم الخدمة' : 'Service name is required');
      return;
    }
    const priceNum = Number(customServicePrice);
    if (!priceNum || priceNum <= 0) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال سعر صحيح للخدمة بالجنيه السوداني' : 'Valid price in SDG is required');
      return;
    }

    const res = await addCustomService(currentUser.id, {
      nameAr: customServiceName.trim(),
      priceSDG: priceNum,
      categoryId: customServiceCategory || currentUser.tradeCategoryId || 'general',
    });

    if (res.success) {
      setCustomServiceName('');
      setCustomServicePrice('');
      setCustomServiceSuccessMsg(language === 'ar' ? 'تمت إضافة الخدمة إلى قائمتك بنجاح!' : 'Service added to your price list!');
      setTimeout(() => setCustomServiceSuccessMsg(null), 3500);
      setErrorMessage(null);
    } else {
      setErrorMessage(res.error || 'فشل إضافة الخدمة');
    }
  };

  const handleStartEditCustomService = (s: { id: string; nameAr: string; priceSDG: number; categoryId?: string }) => {
    setEditingCustomServiceId(s.id);
    setEditServiceName(s.nameAr);
    setEditServicePrice(String(s.priceSDG));
    setEditServiceCategory(s.categoryId || currentUser?.tradeCategoryId || '');
  };

  const handleSaveEditCustomService = async (serviceId: string) => {
    if (!currentUser) return;
    if (!editServiceName.trim()) return;
    const priceNum = Number(editServicePrice);
    if (!priceNum || priceNum <= 0) return;

    const res = await updateCustomService(currentUser.id, serviceId, {
      nameAr: editServiceName.trim(),
      priceSDG: priceNum,
      categoryId: editServiceCategory,
    });

    if (res.success) {
      setEditingCustomServiceId(null);
      setCustomServiceSuccessMsg(language === 'ar' ? 'تم تحديث الخدمة بنجاح!' : 'Service updated successfully!');
      setTimeout(() => setCustomServiceSuccessMsg(null), 3000);
    }
  };

  const handleDeleteCustomService = async (serviceId: string, serviceTitle: string) => {
    if (!currentUser) return;
    const confirmMsg = language === 'ar' 
      ? `هل أنت متأكد من حذف خدمة "${serviceTitle}" من قائمتك؟` 
      : `Are you sure you want to remove "${serviceTitle}"?`;
    if (window.confirm(confirmMsg)) {
      const res = await deleteCustomService(currentUser.id, serviceId);
      if (res.success) {
        setCustomServiceSuccessMsg(language === 'ar' ? 'تم حذف الخدمة من قائمتك' : 'Service removed');
        setTimeout(() => setCustomServiceSuccessMsg(null), 2500);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim() || !phone.trim()) {
      setErrorMessage(t('fillRequired'));
      return;
    }

    // Enforce Sudanese phone validation
    const phoneVal = validateSudanPhone(phone);
    if (!phoneVal.isValid) {
      setErrorMessage(language === 'ar' ? phoneVal.errorMessageAr! : phoneVal.errorMessageEn!);
      return;
    }
    const cleanPhone = phoneVal.cleanPhone;

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage(t('passwordMismatch'));
      return;
    }

    // Check phone uniqueness if changed
    if (cleanPhone !== currentUser.phone) {
      const exists = allUsers.some(u => u.id !== currentUser.id && u.phone === cleanPhone);
      if (exists) {
        setErrorMessage(language === 'ar' ? 'رقم الهاتف الجديد مسجل لمستخدم آخر بالفعل' : 'Phone number is already in use');
        return;
      }
    }

    // Validate and check email uniqueness if entered
    const trimmedEmail = email.trim();
    let cleanEmail: string | undefined;
    if (trimmedEmail !== '') {
      const emailVal = validateEmail(trimmedEmail);
      if (!emailVal.isValid) {
        setErrorMessage(language === 'ar' ? emailVal.errorMessageAr! : emailVal.errorMessageEn!);
        return;
      }
      cleanEmail = emailVal.cleanEmail;
      const emailExists = allUsers.some(
        u => u.id !== currentUser.id && u.email && normalizeEmail(u.email) === cleanEmail
      );
      if (emailExists) {
        setErrorMessage(language === 'ar' ? 'البريد الإلكتروني مسجل لمستخدم آخر بالفعل' : 'Email address is already in use');
        return;
      }
    } else if (currentUser.email) {
      setErrorMessage(
        language === 'ar'
          ? 'لا يمكن إزالة البريد الإلكتروني المسجل؛ يمكنك تغييره إلى بريد إلكتروني آخر'
          : 'Registered email cannot be cleared; you may replace it with another email'
      );
      return;
    }

    const selectedMainCategory = isProvider
      ? categories.find(c => c.id === (mainCategoryId || currentUser.tradeCategoryId))
      : undefined;

    const res = await updateProfile({
      name: name.trim(),
      phone: cleanPhone,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      avatarUrl: avatarUrl.trim() || currentUser.avatarUrl,
      ...(newPassword ? { password: newPassword } : {}),
      ...(isProvider ? {
        basePriceSDG: parseFloat(basePrice) || 25000,
        bioAr: bio.trim(),
        ...(selectedMainCategory ? {
          tradeCategoryId: selectedMainCategory.id,
          tradeTitleAr: selectedMainCategory.nameAr,
          tradeTitleEn: selectedMainCategory.nameEn,
        } : {}),
      } : {}),
    });

    if (res && !res.success) {
      setErrorMessage(res.error || 'فشل حفظ التغييرات');
      return;
    }

    hasUnsavedEditsRef.current = false;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddPortfolioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioTitle.trim()) return;

    await addPortfolioItem(currentUser.id, {
      titleAr: portfolioTitle.trim(),
      titleEn: portfolioTitle.trim(),
      imageUrl: portfolioImgUrl,
      descriptionAr: portfolioDesc.trim(),
    });

    setPortfolioTitle('');
    setPortfolioDesc('');
    setShowAddPortfolio(false);
  };

  const handlePortfolioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.75 });
        setPortfolioImgUrl(compressed);
      } catch (err) {
        console.error('Failed to compress portfolio image', err);
      }
    }
  };

  return (
    <div className="pb-28 max-w-3xl mx-auto px-4 pt-3 space-y-6">
      
      {/* Top Navigation Back Button Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للرئيسية' : 'Back to Home'}
        >
          <BackArrowIcon className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Header and User Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-start">
        <div className="relative group shrink-0">
          <img
            src={avatarUrl || currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 shadow-2xs"
            referrerPolicy="no-referrer"
          />
          {currentUser.nidNumber && (
            <div className="absolute -top-1 -start-1 bg-teal-600 text-white rounded-full p-1 shadow-xs" title={t('verifiedNIDBadge')}>
              <ShieldCheck className="w-3 h-3" />
            </div>
          )}
          {/* Quick Camera Upload Button */}
          <label 
            className="absolute -bottom-1.5 -end-1.5 p-1.5 rounded-full bg-slate-900 dark:bg-slate-800 hover:bg-teal-700 text-white shadow-md cursor-pointer border-2 border-white dark:border-slate-900 transition-all hover:scale-110 flex items-center justify-center"
            title={t('changeProfilePhoto')}
          >
            <Camera className="w-3.5 h-3.5 text-teal-300" />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{currentUser.name}</h1>
          <p className="text-xs text-teal-700 dark:text-teal-400 font-semibold">
            {isProvider
              ? (language === 'ar'
                  ? (currentUser.tradeTitleAr || 'مقدم خدمة حرفي')
                  : (currentUser.tradeTitleEn || currentUser.tradeTitleAr || 'Service Provider'))
              : t('customerRole')}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="flex items-center gap-1 font-mono">
              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {currentUser.phone}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span dir="ltr" className={currentUser.email ? 'text-slate-700 dark:text-slate-200' : 'text-amber-700 dark:text-amber-400 font-medium'}>
                {currentUser.email || (language === 'ar' ? 'أضف بريدك لاستعادة كلمة المرور' : 'Add email for password reset')}
              </span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {currentUser.city} · {currentUser.neighborhood}
            </span>
          </div>
        </div>

        {/* Action Buttons: Admin Dashboard shown ONLY to users with admin role */}
        <div className="sm:ms-auto shrink-0 flex flex-col sm:flex-row gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('adminDashboard')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Success feedback when provider re-uploads document */}
      {reuploadSuccessMsg && (
        <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 text-xs flex items-start gap-3 shadow-sm animate-in fade-in duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <span className="font-extrabold text-sm block text-emerald-900 dark:text-emerald-200">
              {language === 'ar' ? 'تم إرسال المستند الجديد بنجاح!' : 'New Document Submitted Successfully!'}
            </span>
            <p className="text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed">
              {language === 'ar'
                ? 'تم استلام وتحديث صورة الرقم الوطني أو جواز السفر بنجاح وهي قيد التدقيق والمراجعة الآن من قِبل إدارة المنصة. ستصلك الموافقة وتفعيل الحساب فور الاعتماد.'
                : 'Your updated National ID or Passport document has been submitted and is currently being audited by administrators. You will be activated once verified.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. Urgent NID Re-upload Card if Admin requested correction or Provider requested to update */}
      {isProvider && (currentUser.nidStatus === 'reupload_requested' || showReuploadForm) && (
        <div className="p-5 rounded-3xl bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-700/70 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm text-amber-950 dark:text-amber-100">
                  {currentUser.nidStatus === 'reupload_requested'
                    ? (language === 'ar' ? 'مطلوب إعادة إرفاق مستند الرقم الوطني أو الجواز' : 'National ID / Passport Re-upload Required')
                    : (language === 'ar' ? 'إعادة إرفاق وتحديث صورة الرقم الوطني أو الجواز' : 'Update National ID / Passport Document')}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200/90 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-extrabold text-[10px]">
                    {currentUser.nidStatus === 'reupload_requested' 
                      ? (language === 'ar' ? 'طلب مراجعة وتصحيح من الإدارة' : 'Action Required')
                      : (language === 'ar' ? 'تحديث المستند' : 'Document Update')}
                  </span>
                  {showReuploadForm && currentUser.nidStatus !== 'reupload_requested' && (
                    <button
                      type="button"
                      onClick={() => setShowReuploadForm(false)}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                {currentUser.nidStatus === 'reupload_requested'
                  ? (language === 'ar'
                      ? 'قامت إدارة المنصة بمراجعة مستند الهوية المرفق وطلبت منك إعادة إرفاق صورة بديلة وواضحة لتتمكن من اعتماد وتفعيل حسابك.'
                      : 'Platform admins audited your uploaded ID and requested a clearer replacement document to verify your account.')
                  : (language === 'ar'
                      ? 'قم برفع صورة واضحة للرقم الوطني أو جواز السفر ليتم اعتماد وتدقيق بياناتك.'
                      : 'Upload a clear photo of your National ID or passport for verification.')}
              </p>
            </div>
          </div>

          {/* Admin Feedback Box */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 space-y-1 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              {language === 'ar' ? 'ملاحظة ومبرر إدارة المنصة للرفض:' : 'Admin Audit Feedback / Reason:'}
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-amber-50/60 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/60">
              {currentUser.nidRejectionReason || currentUser.deactivatedReason || (language === 'ar' ? 'المستند المرفق غير واضح أو غير مطابق، يرجى إعادة رفع صورة واضحة ومقروءة.' : 'Uploaded document is unreadable. Please re-upload a clear copy.')}
            </p>
          </div>

          {/* Previous rejected document thumbnail */}
          {currentUser.nidUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-amber-100 dark:border-amber-800/50 text-[11px] text-slate-600 dark:text-slate-300">
              <img
                src={currentUser.nidUrl}
                alt="Previous document"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 opacity-70"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 leading-snug">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'المستند الحالي المرفوض (للمقارنة)' : 'Current Rejected Document'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {currentUser.nidNumber ? `الرقم المسجل: ${currentUser.nidNumber}` : 'صورة مستند مرفقة'}
                </span>
              </div>
            </div>
          )}

          {/* New Document Upload / Correction Area */}
          <div className="space-y-3 pt-1">
            <span className="text-xs font-bold text-amber-950 dark:text-amber-100 block">
              {language === 'ar' ? 'قم بإرفاق صورة جديدة واضحة للرقم الوطني أو جواز السفر:' : 'Upload Clear New Photo of National ID or Passport:'}
            </span>

            {isCompressingReplacementNid ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 className="w-6 h-6 text-teal-600 dark:text-teal-400 animate-spin" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {language === 'ar' ? 'جاري معالجة وضغط الصورة لتناسب الهاتف...' : 'Compressing image for mobile...'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {language === 'ar' ? 'نظام الضغط الذكي يحمي الهاتف وسرعة التطبيق' : 'Optimizing file size'}
                </span>
              </div>
            ) : newNidReplacementUrl ? (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-teal-500/40 dark:border-teal-600/60 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'ar' ? 'تم اختيار الصورة وجاهزة للإرسال' : 'Image ready for submission'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNidReplacementUrl('');
                      setNewNidReplacementName('');
                    }}
                    className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء واختيار صورة أخرى' : 'Change photo'}
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-48 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <img
                    src={newNidReplacementUrl}
                    alt="New replacement document"
                    className="w-full h-full object-contain max-h-48"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    {language === 'ar' ? 'الرقم الوطني المكتوب (اختياري لتعديله إن كان به خطأ):' : 'National ID Number (Optional correction):'}
                  </label>
                  <input
                    type="text"
                    value={newNidReplacementNumber}
                    onChange={(e) => setNewNidReplacementNumber(e.target.value)}
                    placeholder={currentUser.nidNumber || '109-1990-12345'}
                    className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmReuploadNid}
                    className="flex-1 py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{language === 'ar' ? 'إرسال المستند الجديد للمراجعة والاعتماد' : 'Submit New Document for Audit'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-2xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 hover:border-teal-500 cursor-pointer transition-all text-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/60 flex items-center justify-center text-amber-700 dark:text-amber-300 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors mb-2">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    {language === 'ar' ? 'التقاط صورة بالهاتف أو اختيار ملف المستند' : 'Snap photo or select ID file'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    {language === 'ar' ? 'يرجى التقاط صورة واضحة في إضاءة جيدة مع إبراز الاسم والرقم الوطني وكامل حواف البطاقة' : 'Ensure clear lighting and legible numbers'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReplacementNidFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Standard Account Status Notice (when not reupload_requested) */}
      {currentUser.isActive === false && currentUser.nidStatus !== 'reupload_requested' && !reuploadSuccessMsg && (
        <div className="p-4 rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm block text-amber-950 dark:text-amber-100">
                {currentUser.deactivatedReason?.includes('المحدثة')
                  ? (language === 'ar' ? 'تم استلام المستند المحدث وهو قيد التدقيق' : 'Updated NID Received — Pending Audit')
                  : (language === 'ar' ? 'حسابك معطل مؤقتاً بانتظار مراجعة واعتماد الهوية' : 'Account Pending Admin NID Review')}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-bold text-[10px]">
                {currentUser.deactivatedReason?.includes('المحدثة') ? 'قيد التدقيق' : t('accountDeactivated')}
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              {currentUser.deactivatedReason || t('providerPendingNotice')}
            </p>
            {currentUser.nidNumber && (
              <div className="pt-1 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2 flex-wrap">
                <span>{language === 'ar' ? 'الرقم الوطني المرفق:' : 'National ID:'} <strong>{currentUser.nidNumber}</strong></span>
                {currentUser.nidUrl && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">· تم إرفاق صورة الرقم الوطني أو الجواز بنجاح</span>
                )}
                {currentUser.nidSubmittedAt && (
                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                    · آخر إرسال: {new Date(currentUser.nidSubmittedAt).toLocaleDateString('ar-SD')}
                  </span>
                )}
              </div>
            )}

            {/* Explanatory note that deactivated provider profile and services are hidden from clients */}
            <div className="pt-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100 bg-amber-100/70 dark:bg-amber-900/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
              {language === 'ar' 
                ? '🔒 تنبيه الخصوصية والظهور: ملفك الشخصي وخدماتك محجوبة ومخفية بالكامل عن العملاء ولن تظهر في نتائج البحث حتى يتم تدقيق واعتماد الهوية وتفعيل الحساب من قِبل الإدارة.' 
                : '🔒 Privacy Notice: Your profile and services are currently hidden from clients and will not appear in search until your account is approved and activated.'}
            </div>

            {!showReuploadForm && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowReuploadForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إعادة رفع / تحديث صورة الرقم الوطني أو الجواز' : 'Re-upload / Update National ID or Passport'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* General Settings Form: Name, Phone (Required feature), City, Password */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <span>{t('editProfile')}</span>
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'تعديل البيانات الأساسية والصورة ورقم الهاتف' : 'Update photo, phone and info'}
          </span>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{language === 'ar' ? 'تم حفظ التعديلات بنجاح!' : 'Profile updated successfully!'}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">

          {/* Profile Photo Selector: Upload Custom or Choose Preset Avatars */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>{t('changeProfilePhoto')}</span>
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'رفع صورة من جهازك أو اختيار نموذج' : 'Upload or pick an avatar'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                <img
                  src={avatarUrl || currentUser.avatarUrl}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-600 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Upload custom button */}
              <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t('uploadPhoto')}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>

              {/* Preset Avatars Grid */}
              <div className="flex-1 w-full space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">{t('choosePresetAvatar')}</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(av.url)}
                      className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        avatarUrl === av.url ? 'border-teal-600 ring-2 ring-teal-200 dark:ring-teal-800 scale-105' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                      title={language === 'ar' ? av.labelAr : av.labelEn}
                    >
                      <img
                        src={av.url}
                        alt={language === 'ar' ? av.labelAr : av.labelEn}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('name')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  hasUnsavedEditsRef.current = true;
                  setName(e.target.value);
                }}
                required
                className="w-full px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Phone Number (Explicit prompt requirement: change user phone number) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t('changePhone')} *
                </label>
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
                onChange={(e) => {
                  hasUnsavedEditsRef.current = true;
                  setPhone(e.target.value);
                }}
                placeholder="0912345678"
                required
                className="w-full px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                {language === 'ar' 
                  ? 'رقم سوداني 10 أرقام (زين: 090, 091, 096 | إم تي إن: 092, 093, 099 | سوداني: 010, 011, 012)'
                  : '10-digit Sudanese number (Zain: 090/091/096, MTN: 092/093/099, Sudani: 010/011/012)'}
              </span>
            </div>

            {/* Email Address (for password recovery) */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('email')} {currentUser.email ? '*' : `(${language === 'ar' ? 'اختياري للحسابات السابقة - موصى به' : 'optional for legacy accounts'})`}
              </label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => {
                  hasUnsavedEditsRef.current = true;
                  setEmail(e.target.value);
                }}
                placeholder={t('emailPlaceholder')}
                required={Boolean(currentUser.email)}
                className="w-full px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                {language === 'ar'
                  ? 'يُستخدم هذا البريد الإلكتروني لاستعادة كلمة المرور عند نسيانها ولا يمكن تكراره مع حساب آخر'
                  : 'Used for password reset recovery and must be unique across all accounts'}
              </span>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('state')}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  hasUnsavedEditsRef.current = true;
                  setCity(e.target.value);
                }}
                className="w-full px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* Neighborhood */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('neighborhood')}
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => {
                  hasUnsavedEditsRef.current = true;
                  setNeighborhood(e.target.value);
                }}
                className="w-full px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* If Provider: Main Category & Bio */}
          {isProvider && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>{t('mainCategory')} *</span>
                </label>
                <select
                  value={mainCategoryId || currentUser.tradeCategoryId || ''}
                  onChange={(e) => {
                    hasUnsavedEditsRef.current = true;
                    setMainCategoryId(e.target.value);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {language === 'ar' ? cat.nameAr : cat.nameEn}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  {language === 'ar'
                    ? 'يظهر هذا التخصص كحرفتك الرئيسية أسفل اسمك في البحث وصفحة الملف الشخصي.'
                    : 'Shown as your primary trade below your name in search results and profile.'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t('bio')}
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => {
                    hasUnsavedEditsRef.current = true;
                    setBio(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Change Password Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{t('changePassword')}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({language === 'ar' ? 'اتركه فارغاً إذا كنت لا ترغب بتغييره' : 'leave blank to keep current'})</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative" dir="ltr">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('password')}
                  className="w-full ps-3 pe-10 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative" dir="ltr">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('passwordConfirm')}
                  className="w-full ps-3 pe-10 py-2.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}</span>
          </button>
        </form>
      </div>

      {/* If Provider: Manage Specific Services & Pricing (Itemized Menu with Custom Prices) */}
      {isProvider && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'قائمة الخدمات والأسعار المحددة (سعر كل خدمة)' : 'Itemized Services & Specific Pricing Menu'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'ar'
                  ? 'أضف خدماتك المتخصصة وأسعارها بالجنيه السوداني لتظهر فوراً للعملاء للاختيار منها عند الحجز دون انتظار موافقة الإدارة.'
                  : 'List your specific services and custom prices in SDG. Published immediately without waiting for admin approval.'}
              </p>
            </div>

            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 px-3 py-1 rounded-xl shrink-0">
              {(currentUser.customServices || []).length} {language === 'ar' ? 'خدمات محددة' : 'services'}
            </span>
          </div>

          {/* Clarity Notice on Instant Free Pricing vs Official Macro Categories */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">
                {language === 'ar' ? 'تسعير مباشر وفوري بدون انتظار موافقة' : 'Instant Pricing Flexibility'}
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                {language === 'ar'
                  ? 'خدماتك وقائمة أسعارك المحددة تنشر وتتحدث في حسابك فوراً. (إذا كنت تقدم خدمة تتبع لتصنيف حرفي عام جديد بالكامل غير موجود بقائمة المنصة، يمكنك رفعه للإدارة عبر زر الاقتراح أدناه).'
                  : 'Your specific services and prices update instantly. High-level general categories require admin moderation to keep the marketplace organized.'}
              </p>
            </div>
          </div>

          {customServiceSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold">{customServiceSuccessMsg}</span>
            </div>
          )}

          {/* Fast Entry Form with Text Boxes */}
          <form onSubmit={handleAddCustomService} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>{language === 'ar' ? 'إضافة خدمة جديدة وسعرها المحدد:' : 'Add a Specific Service & Price:'}</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Text Box 1: Service Name */}
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  {language === 'ar' ? 'اسم الخدمة المحددة *' : 'Service Title *'}
                </label>
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: صيانة مكيف اسبلت 1.5 طن' : 'e.g., Split AC 1.5 Ton Maintenance'}
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Text Box 2: Price in SDG */}
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  {language === 'ar' ? 'السعر المحدد (ج.س) *' : 'Price in SDG *'}
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={customServicePrice}
                  onChange={(e) => setCustomServicePrice(e.target.value)}
                  placeholder="25000"
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono font-bold"
                />
              </div>

              {/* Category Picker */}
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  {language === 'ar' ? 'التصنيف الحرفي التابع له' : 'Category'}
                </label>
                <select
                  value={customServiceCategory || currentUser.tradeCategoryId || ''}
                  onChange={(e) => setCustomServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {language === 'ar' ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'تنشر الخدمة مباشرة في صفحتك ويراها العملاء فوراً.' : 'Services are published immediately in your public profile.'}
              </span>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إضافة إلى قائمتي فوراً' : 'Add to My Price List'}</span>
              </button>
            </div>
          </form>

          {/* Current Custom Services List */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {language === 'ar' ? 'الخدمات المحددة في ملفك حالياً:' : 'Your Specific Services Menu:'}
            </span>

            {(!currentUser.customServices || currentUser.customServices.length === 0) ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <Banknote className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {language === 'ar'
                    ? 'لم تقم بإضافة خدمات محددة بعد. اكتب اسم الخدمة وسعرها في المربعين أعلاه لتظهر لعملائك.'
                    : 'No itemized services added yet. Fill the text boxes above to set your menu.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentUser.customServices.map((service) => {
                  const isEditingThis = editingCustomServiceId === service.id;
                  const cat = categories.find(c => c.id === service.categoryId);

                  if (isEditingThis) {
                    return (
                      <div key={service.id} className="p-3.5 rounded-2xl border-2 border-teal-500 bg-teal-50/40 dark:bg-teal-950/30 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-5">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              {language === 'ar' ? 'اسم الخدمة' : 'Title'}
                            </label>
                            <input
                              type="text"
                              value={editServiceName}
                              onChange={(e) => setEditServiceName(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none"
                              placeholder={language === 'ar' ? 'اسم الخدمة' : 'Service title'}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              {language === 'ar' ? 'السعر بـ ج.س' : 'Price in SDG'}
                            </label>
                            <input
                              type="number"
                              min="500"
                              step="500"
                              value={editServicePrice}
                              onChange={(e) => setEditServicePrice(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none font-mono font-bold"
                              placeholder="25000"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                              {language === 'ar' ? 'التصنيف' : 'Category'}
                            </label>
                            <select
                              value={editServiceCategory}
                              onChange={(e) => setEditServiceCategory(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none"
                            >
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {language === 'ar' ? c.nameAr : c.nameEn}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCustomServiceId(null)}
                            className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditCustomService(service.id)}
                            className="px-3.5 py-1 text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'حفظ التعديل' : 'Save'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={service.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {service.nameAr}
                          </h4>
                          {cat && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {language === 'ar' ? cat.nameAr : cat.nameEn}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-sm font-extrabold text-teal-800 dark:text-teal-300 font-mono tabular-nums">
                          {service.priceSDG.toLocaleString()} <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{t('sdg')}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomService(service)}
                            className="p-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                            title={language === 'ar' ? 'تعديل السعر أو الاسم' : 'Edit item'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomService(service.id, service.nameAr)}
                            className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title={language === 'ar' ? 'حذف من قائمتي' : 'Delete item'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* If Provider: Manage Offered Services & Trades (Add / Remove / Suggest) */}
      {isProvider && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'إدارة الحرف والخدمات المقدمة' : 'My Offered Services & Trades'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'ar' 
                  ? 'يمكنك إضافة أكثر من خدمة لحسابك، مع ضرورة الاحتفاظ بخدمة واحدة على الأقل نشطة.' 
                  : 'You can offer multiple services. You must have at least 1 active service.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuggestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{language === 'ar' ? 'اقترح حرفة جديدة غير مدرجة' : 'Suggest New Service'}</span>
            </button>
          </div>

          {mainCatSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold">{mainCatSuccessMsg}</span>
            </div>
          )}

          {/* Current Active Services List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {language === 'ar' ? 'الخدمات المسجلة في ملفك الشخصي حالياً:' : 'Active Services in Your Profile:'}
              </span>
              <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                {providerCategoryIds.length} {language === 'ar' ? 'خدمات' : 'services'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providerCategoryIds.map(catId => {
                const cat = categories.find(c => c.id === catId);
                const isOnlyOne = providerCategoryIds.length <= 1;
                const isPrimary = catId === (currentUser.tradeCategoryId || providerCategoryIds[0]);

                return (
                  <div 
                    key={catId}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2.5 ${
                      isPrimary
                        ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/35'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPrimary ? 'bg-teal-700 text-white' : 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300'
                      }`}>
                        <CategoryIcon iconName={cat?.iconName || 'Wrench'} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : catId}
                          </h4>
                          {isPrimary && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-700 text-white shrink-0">
                              {t('primaryCategoryBadge')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                          {cat ? (language === 'ar' ? `متوسط: ${cat.averageRateSDG.toLocaleString()} ج.س` : `Avg: ${cat.averageRateSDG} SDG`) : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isPrimary && (
                        <button
                          type="button"
                          disabled={isUpdatingMainCat !== null}
                          onClick={async () => {
                            setIsUpdatingMainCat(catId);
                            setErrorMessage(null);
                            const res = await setPrimaryProviderService(currentUser.id, catId);
                            setIsUpdatingMainCat(null);
                            if (res.success) {
                              setMainCategoryId(catId);
                              setMainCatSuccessMsg(t('mainCategoryUpdated'));
                              setTimeout(() => setMainCatSuccessMsg(null), 3000);
                            } else {
                              setErrorMessage(res.error || 'فشل تغيير التخصص الرئيسي');
                            }
                          }}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {isUpdatingMainCat === catId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          <span>{t('setAsMainCategory')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isOnlyOne}
                        onClick={async () => {
                          const res = await removeProviderService(currentUser.id, catId);
                          if (!res.success) {
                            setErrorMessage(res.error || 'فشل حذف الخدمة');
                          } else {
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 2500);
                          }
                        }}
                        className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isOnlyOne
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60'
                        }`}
                        title={isOnlyOne ? (language === 'ar' ? 'لا يمكن الحذف (يجب أن يكون لديك خدمة واحدة على الأقل)' : 'At least 1 service required') : undefined}
                      >
                        {language === 'ar' ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add a Service from Platform Catalog */}
          <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/25 border border-teal-100 dark:border-teal-800/60 space-y-2">
            <span className="text-xs font-bold text-teal-950 dark:text-teal-200 block">
              {language === 'ar' ? '+ إضافة خدمة أخرى من قائمة المنصة المعتمدة:' : '+ Add Another Service from Catalog:'}
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedServiceToAdd}
                onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                className="flex-1 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 font-medium"
              >
                <option value="">{language === 'ar' ? '-- اختر الخدمة المراد إضافتها --' : '-- Choose Service to Add --'}</option>
                {availableCategoriesToAdd.map(c => (
                  <option key={c.id} value={c.id}>
                    {language === 'ar' ? c.nameAr : c.nameEn} (متوسط: {c.averageRateSDG.toLocaleString()} ج.س)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedServiceToAdd}
                onClick={async () => {
                  if (!selectedServiceToAdd) return;
                  const res = await addProviderService(currentUser.id, selectedServiceToAdd);
                  if (res.success) {
                    setSelectedServiceToAdd('');
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2500);
                  } else {
                    setErrorMessage(res.error || 'فشل إضافة الخدمة');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shrink-0"
              >
                {language === 'ar' ? 'إضافة إلى خدماتي' : 'Add to My Services'}
              </button>
            </div>
          </div>

          {/* Suggestions Status Section for this provider */}
          {mySuggestions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {language === 'ar' ? 'الحرف المقترحة من قبلك وحالتها لدى الإدارة:' : 'Your Suggested Services Status:'}
              </span>
              <div className="space-y-1.5">
                {mySuggestions.map(sug => (
                  <div key={sug.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{sug.nameAr}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{sug.descriptionAr}</span>
                      {sug.rejectionReason && (
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">سبب الرفض: {sug.rejectionReason}</span>
                      )}
                    </div>
                    <div>
                      {sug.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          ⏳ {language === 'ar' ? 'بانتظار مراجعة الإدارة' : 'Pending Review'}
                        </span>
                      )}
                      {sug.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                          ✅ {language === 'ar' ? 'تم الاعتماد وإضافتها لخدماتك' : 'Approved & Added'}
                        </span>
                      )}
                      {sug.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                          ❌ {language === 'ar' ? 'مرفوضة' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* If Provider: Manage Past Work Portfolio */}
      {isProvider && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('portfolioTitle')}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'عرض صور أعمالك وحرفتك للزبائن' : 'Showcase your work to clients'}
              </span>
            </div>
            <button
              onClick={() => setShowAddPortfolio(!showAddPortfolio)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-950/70 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addWorkPhoto')}</span>
            </button>
          </div>

          {/* Add Work Sample Form */}
          {showAddPortfolio && (
            <form onSubmit={handleAddPortfolioSubmit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('addWorkPhoto')}</h3>
              
              <div className="space-y-1">
                <input
                  type="text"
                  value={portfolioTitle}
                  onChange={(e) => setPortfolioTitle(e.target.value)}
                  placeholder={language === 'ar' ? 'عنوان العمل (مثال: تفصيل جلابية بيضاء فاخرة)' : 'Work title'}
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  value={portfolioDesc}
                  onChange={(e) => setPortfolioDesc(e.target.value)}
                  placeholder={language === 'ar' ? 'وصف مختصر للعمل' : 'Description'}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Upload image */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>{language === 'ar' ? 'اختيار صورة العمل' : 'Select Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePortfolioFileChange}
                    className="hidden"
                  />
                </label>

                {portfolioImgUrl && (
                  <img
                    src={portfolioImgUrl}
                    alt="Preview"
                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPortfolio(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'إضافة إلى المعرض' : 'Add to Portfolio'}
                </button>
              </div>
            </form>
          )}

          {/* Current Portfolio Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentUser.portfolio?.map((item) => (
              <div key={item.id} className="relative rounded-2xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700">
                <img
                  src={item.imageUrl}
                  alt={item.titleAr}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] truncate">
                  {item.titleAr}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Language, Appearance, App Info & Logout */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{language === 'ar' ? 'لغة التطبيق' : 'Application Language'}</span>
          </div>
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
          >
            {language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
          </button>
        </div>

        {/* Appearance (Light / Dark Mode) */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            {isDark ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span>{t('appearance')}</span>
          </div>
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                !isDark
                  ? 'bg-white text-teal-800 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>{t('lightMode')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-900 text-teal-300 shadow-2xs border border-slate-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>{t('darkMode')}</span>
            </button>
          </div>
        </div>

        {/* Privacy Policy & Account Deletion Controls */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{t('privacyPolicy')}</span>
            </span>
            <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
              {language === 'ar' ? 'عرض السياسة' : 'View'}
            </span>
          </button>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span>{isLoggingOut ? t('loggingOut') : t('logout')}</span>
            </span>
            <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
              {language === 'ar' ? 'خروج آمن' : 'Sign out'}
            </span>
          </button>

          {currentUser.role !== 'admin' && (
            <button
              type="button"
              onClick={() => {
                setDeletePassword('');
                setDeleteConfirmed(false);
                setDeleteAccountError(null);
                setShowDeleteAccountModal(true);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>{t('deleteAccount')}</span>
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {language === 'ar' ? 'مسح كامل للبيانات' : 'Erase all data'}
              </span>
            </button>
          )}
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* Modal: Self-Service Permanent Account Deletion */}
      {showDeleteAccountModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!isDeletingAccount) setShowDeleteAccountModal(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'تأكيد حذف الحساب نهائياً' : 'Confirm Permanent Account Deletion'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {language === 'ar'
                    ? 'سيؤدي هذا الإجراء إلى حذف ملفك الشخصي ورقم هاتفك ووثائقك وخدماتك وإشعاراتك نهائياً ولا يمكن التراجع عنه (يشترط إكمال الطلبات الجارية وتسوية أي عمولات أو غرامات أولاً)، ويمكنك لاحقاً إنشاء حساب جديد بشكل طبيعي.'
                    : 'This permanently erases your profile, phone number, ID documents, services, and notifications (active bookings and unsettled commissions or penalties must be resolved first). You may create a new account normally in the future.'}
                </p>
              </div>
            </div>

            {deleteAccountError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{deleteAccountError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDeleteAccountError(null);
                if (!deletePassword) {
                  setDeleteAccountError(
                    language === 'ar' ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter your current password'
                  );
                  return;
                }
                if (!deleteConfirmed) {
                  setDeleteAccountError(
                    language === 'ar' ? 'يرجى تأكيد الموافقة على الحذف النهائي' : 'Please check the confirmation box'
                  );
                  return;
                }
                setIsDeletingAccount(true);
                try {
                  const res = await deleteAccount(deletePassword);
                  if (!res.success) {
                    setDeleteAccountError(
                      res.error || (language === 'ar' ? 'تعذر حذف الحساب' : 'Failed to delete account')
                    );
                    return;
                  }
                  setShowDeleteAccountModal(false);
                  setActiveTab('home');
                } finally {
                  setIsDeletingAccount(false);
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'أدخل كلمة المرور الحالية للتأكيد *' : 'Enter Current Password to Confirm *'}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-rose-600"
                />
                <span>
                  {language === 'ar'
                    ? 'أفهم أن جميع بياناتي وحسابي في مهني سيتم حذفها نهائياً.'
                    : 'I understand my Mehani account and personal data will be permanently deleted.'}
                </span>
              </label>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === 'ar' ? 'جاري الحذف...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>{language === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Permanently'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Graceful Logout Confirmation */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!isLoggingOut) setShowLogoutConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {t('logoutConfirmTitle')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t('logoutConfirmMessage')}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {t('keepSignedIn')}
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={async () => {
                  await logout();
                  setShowLogoutConfirm(false);
                }}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('loggingOut')}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>{t('logoutConfirmAction')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Suggest New Service to Admin */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'اقتراح حرفة أو خدمة جديدة للإدارة' : 'Suggest New Service to Admins'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestModal(false)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'ar'
                ? 'إذا كانت لديك حرفة أو تخصص غير متوفر في قائمة مهني، يمكنك اقتراحه هنا. سيقوم مدير النظام بمراجعته واعتماده وإضافته فوراً لحسابك.'
                : 'Suggest an unlisted trade. System admins will review, approve, and add it to your profile.'}
            </p>

            {suggestSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{language === 'ar' ? 'تم إرسال الاقتراح للإدارة بنجاح، ستتم مراجعته قريباً!' : 'Suggestion submitted for review!'}</span>
              </div>
            )}

            <form onSubmit={handleSuggestSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'اسم الحرفة أو الخدمة (بالعربية) *' : 'Service Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  value={suggestNameAr}
                  onChange={(e) => setSuggestNameAr(e.target.value)}
                  placeholder="مثال: تركيب شبكات وإنترنت منزلي"
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'اسم الحرفة بالإنجليزية (اختياري)' : 'Service Name (English)'}
                </label>
                <input
                  type="text"
                  value={suggestNameEn}
                  onChange={(e) => setSuggestNameEn(e.target.value)}
                  placeholder="e.g. Home Networking & Wi-Fi"
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'وصف الخدمة ونطاق العمل *' : 'Description & Scope *'}
                </label>
                <textarea
                  rows={3}
                  value={suggestDescAr}
                  onChange={(e) => setSuggestDescAr(e.target.value)}
                  placeholder="اكتب وصفاً لطبيعة الخدمة والمعدات المستخدمة..."
                  required
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {language === 'ar' ? 'متوسط السعر المقترح (ج.س)' : 'Suggested Average Price (SDG)'}
                </label>
                <input
                  type="number"
                  value={suggestRate}
                  onChange={(e) => setSuggestRate(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSuggestModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
                >
                  {language === 'ar' ? 'إرسال الاقتراح للإدارة' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
