import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Briefcase, 
  Clock, 
  Wallet, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Filter, 
  TrendingUp, 
  Banknote, 
  Building2, 
  AlertCircle,
  Eye,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Power,
  PowerOff,
  FileText,
  CreditCard,
  Calendar,
  MapPin,
  ZoomIn,
  AlertTriangle, 
  Play, 
  FileCheck,
  Upload,
  Camera,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  XCircle
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { User, ServiceCategory, ServiceRequest, UserRole, ServiceStatus, ThursdayCommissionDeposit, ServiceSuggestion } from '../../types';
import { CategoryIcon } from '../common/CategoryIcon';
import { SUDAN_STATES_CITIES } from '../../data/mockData';
import { validateSudanPhone, detectSudanOperator } from '../../utils/phoneValidation';
import { validateEmail } from '../../utils/emailValidation';
import { PRESET_AVATARS, DEFAULT_AVATAR_URL } from '../../config/avatars';

type AdminTab = 'overview' | 'users' | 'services' | 'requests' | 'deposits';
type RequestFilterMode = 'all' | 'ongoing' | 'completed' | 'cancelled';
type DepositFilterMode = 'all' | 'not_uploaded' | 'pending_verification' | 'rejected' | 'verified';

export const AdminDashboardScreen: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { 
    currentUser, 
    allUsers, 
    adminAddUser, 
    adminUpdateUser, 
    adminDeleteUser, 
    adminToggleUserActive, 
    adminRequestNidReupload,
    switchUserRole 
  } = useAuth();
  
  const { 
    categories, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    requests, 
    deposits, 
    verifyDeposit, 
    deleteDeposit, 
    adminDeleteRequest,
    adminCancelRequest,
    adminWaiveFine,
    updateRequestStatus,
    getProviderActiveServicesCount,
    serviceSuggestions,
    approveServiceSuggestion,
    rejectServiceSuggestion,
    goBack
  } = useApp();

  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('overview');
  const [fineActionFeedback, setFineActionFeedback] = useState<string | null>(null);

  // Search & Filter States for Users
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'provider' | 'admin'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'deactivated' | 'pending_nid' | 'has_fine'>('all');

  // Search & Filter States for Services/Categories
  const [serviceSearch, setServiceSearch] = useState('');

  // Filter States for Requests (Ongoing vs Completed vs All)
  const [requestFilterMode, setRequestFilterMode] = useState<RequestFilterMode>('all');
  const [requestSearch, setRequestSearch] = useState('');

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    password: string;
    role: UserRole;
    city: string;
    neighborhood: string;
    isActive: boolean;
    deactivatedReason: string;
    tradeCategoryId: string;
    tradeTitleAr: string;
    tradeTitleEn: string;
    basePriceSDG: string;
    nidNumber: string;
    nidUrl: string;
    bioAr: string;
    avatarUrl: string;
    unpaidCancellationFeeSDG: string;
  }>({
    name: '',
    phone: '',
    email: '',
    password: 'password123',
    role: 'provider',
    city: 'الخرطوم',
    neighborhood: 'الرياض',
    isActive: true,
    deactivatedReason: '',
    tradeCategoryId: 'tailor',
    tradeTitleAr: 'ترزي ماهر',
    tradeTitleEn: 'Master Tailor',
    basePriceSDG: '25000',
    nidNumber: '102-1988-12345',
    nidUrl: '/src/assets/images/tailor_embroidery_craft_1791698438179.jpg',
    bioAr: '',
    avatarUrl: DEFAULT_AVATAR_URL,
    unpaidCancellationFeeSDG: '0',
  });

  // Service Category Add/Edit Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<{
    nameAr: string;
    nameEn: string;
    iconName: string;
    descriptionAr: string;
    descriptionEn: string;
    averageRateSDG: string;
    popularLocations: string;
  }>({
    nameAr: '',
    nameEn: '',
    iconName: 'Wrench',
    descriptionAr: '',
    descriptionEn: '',
    averageRateSDG: '25000',
    popularLocations: 'الخرطوم، أم درمان، بحري',
  });

  // Lightbox / Proof inspection modals
  const [inspectDeposit, setInspectDeposit] = useState<ThursdayCommissionDeposit | null>(null);
  const [inspectNidUser, setInspectNidUser] = useState<User | null>(null);
  const [showNidReuploadPrompt, setShowNidReuploadPrompt] = useState(false);
  const [nidReuploadReasonText, setNidReuploadReasonText] = useState('');

  // Deposits Tab Filter & Reject Reason Modal State
  const [depositFilterMode, setDepositFilterMode] = useState<DepositFilterMode>('all');
  const [depositSearch, setDepositSearch] = useState('');
  const [rejectDepositTarget, setRejectDepositTarget] = useState<ThursdayCommissionDeposit | null>(null);
  const [rejectDepositReason, setRejectDepositReason] = useState('');
  const [isRejectingDeposit, setIsRejectingDeposit] = useState(false);

  // Admin Complete Service & Record Payment Modal
  const [completeServiceModalReq, setCompleteServiceModalReq] = useState<ServiceRequest | null>(null);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'cash' | 'bankak'>('bankak');

  // Pending NID Providers
  const pendingNidProviders = useMemo(() => {
    return allUsers.filter(u => u.role === 'provider' && u.isActive === false);
  }, [allUsers]);

  // Users with unpaid cancellation fines
  const usersWithFines = useMemo(() => {
    return allUsers.filter(u => (u.unpaidCancellationFeeSDG || 0) > 0);
  }, [allUsers]);

  const totalUnpaidFinesSDG = useMemo(() => {
    return usersWithFines.reduce((sum, u) => sum + (u.unpaidCancellationFeeSDG || 0), 0);
  }, [usersWithFines]);

  // Pending service suggestions from providers
  const pendingSuggestions = useMemo(() => {
    return (serviceSuggestions || []).filter(s => s.status === 'pending');
  }, [serviceSuggestions]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      // Role filter
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;

      // Status filter (active vs deactivated vs pending_nid vs has_fine)
      const isActive = u.isActive !== false;
      if (userStatusFilter === 'active' && !isActive) return false;
      if (userStatusFilter === 'deactivated' && isActive) return false;
      if (userStatusFilter === 'pending_nid' && (u.role !== 'provider' || isActive)) return false;
      if (userStatusFilter === 'has_fine' && (u.unpaidCancellationFeeSDG || 0) <= 0) return false;

      // Search query
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(q);
        const matchPhone = u.phone.includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q) || false;
        const matchCity = u.city?.toLowerCase().includes(q) || false;
        const matchTrade = u.tradeTitleAr?.toLowerCase().includes(q) || false;
        const matchNid = u.nidNumber?.includes(q) || false;
        if (!matchName && !matchPhone && !matchEmail && !matchCity && !matchTrade && !matchNid) return false;
      }
      return true;
    });
  }, [allUsers, userRoleFilter, userStatusFilter, userSearch]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      if (serviceSearch.trim()) {
        const q = serviceSearch.toLowerCase().trim();
        return c.nameAr.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q);
      }
      return true;
    });
  }, [categories, serviceSearch]);

  // Filtered Requests (Audit ongoing vs completed)
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Mode filter
      if (requestFilterMode === 'ongoing') {
        const isOngoing = r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress';
        if (!isOngoing) return false;
      } else if (requestFilterMode === 'completed') {
        if (r.status !== 'completed') return false;
      } else if (requestFilterMode === 'cancelled') {
        if (r.status !== 'cancelled') return false;
      }

      // Search query
      if (requestSearch.trim()) {
        const q = requestSearch.toLowerCase().trim();
        const matchClient = r.clientName.toLowerCase().includes(q) || r.clientPhone.includes(q);
        const matchProvider = r.providerName.toLowerCase().includes(q) || r.providerPhone.includes(q);
        const matchDesc = r.problemDescription.toLowerCase().includes(q);
        const matchCity = r.city.toLowerCase().includes(q) || r.neighborhood.toLowerCase().includes(q);
        if (!matchClient && !matchProvider && !matchDesc && !matchCity) return false;
      }

      return true;
    });
  }, [requests, requestFilterMode, requestSearch]);

  // Overall Metrics Calculation
  const totalUsersCount = allUsers.length;
  const activeUsersCount = allUsers.filter(u => u.isActive !== false).length;
  const deactivatedUsersCount = allUsers.filter(u => u.isActive === false).length;
  const customersCount = allUsers.filter(u => u.role === 'customer').length;
  const providersCount = allUsers.filter(u => u.role === 'provider').length;

  const ongoingRequests = requests.filter(r => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress');
  const completedRequests = requests.filter(r => r.status === 'completed');
  const cancelledRequests = requests.filter(r => r.status === 'cancelled');

  const totalVolumeSDG = completedRequests.reduce((sum, r) => sum + r.agreedPriceSDG, 0);
  const totalCommissionSDG = Math.round(totalVolumeSDG * 0.08);
  const pendingDepositsCount = deposits.filter(d => d.status === 'pending_verification').length;
  const rejectedDepositsCount = deposits.filter(d => d.status === 'rejected').length;

  // Compute all Thursday deposit obligations & breakdown
  const unuploadedDueProviders = useMemo(() => {
    return allUsers
      .filter(u => u.role === 'provider')
      .map(u => {
        const providerCompletedReqs = requests.filter(
          r => r.providerId === u.id && r.status === 'completed'
        );
        const completedCommissionTotal = providerCompletedReqs.reduce(
          (sum, r) => sum + (r.commissionFeeSDG || Math.round(r.agreedPriceSDG * 0.08)),
          0
        );
        const providerDeposits = deposits.filter(d => d.providerId === u.id);
        const verifiedSum = providerDeposits
          .filter(d => d.status === 'verified')
          .reduce((sum, d) => sum + d.amountSDG, 0);
        const pendingReviewSum = providerDeposits
          .filter(d => d.status === 'pending_verification')
          .reduce((sum, d) => sum + d.amountSDG, 0);
        const rejectedList = providerDeposits.filter(d => d.status === 'rejected');

        const rawDue =
          u.pendingCommissionDueSDG !== undefined
            ? u.pendingCommissionDueSDG
            : Math.max(0, completedCommissionTotal - verifiedSum);
        const uncoveredDue = Math.max(0, rawDue - pendingReviewSum);

        return {
          provider: u,
          completedCount: providerCompletedReqs.length,
          completedCommissionTotal,
          verifiedSum,
          pendingReviewSum,
          rawDue,
          uncoveredDue,
          awaitingReupload: rejectedList.length > 0,
          latestRejected: rejectedList[0] || null,
        };
      })
      .filter(item => item.uncoveredDue > 0)
      .sort((a, b) => b.uncoveredDue - a.uncoveredDue);
  }, [allUsers, requests, deposits]);

  const filteredUnuploadedDueProviders = useMemo(() => {
    if (!depositSearch.trim()) return unuploadedDueProviders;
    const q = depositSearch.toLowerCase().trim();
    return unuploadedDueProviders.filter(item => {
      const p = item.provider;
      return (
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.tradeTitleAr || '').toLowerCase().includes(q)
      );
    });
  }, [unuploadedDueProviders, depositSearch]);

  const filteredDeposits = useMemo(() => {
    return deposits.filter(dep => {
      if (
        depositFilterMode !== 'all' &&
        depositFilterMode !== 'not_uploaded' &&
        dep.status !== depositFilterMode
      ) {
        return false;
      }
      if (depositSearch.trim()) {
        const q = depositSearch.toLowerCase().trim();
        const providerUser = allUsers.find(u => u.id === dep.providerId);
        return (
          dep.providerName.toLowerCase().includes(q) ||
          dep.bankakReferenceNumber.toLowerCase().includes(q) ||
          dep.depositDate.toLowerCase().includes(q) ||
          (providerUser?.phone || '').includes(q)
        );
      }
      return true;
    });
  }, [deposits, depositFilterMode, depositSearch, allUsers]);

  const depositSummary = useMemo(() => {
    const pendingList = deposits.filter(d => d.status === 'pending_verification');
    const rejectedList = deposits.filter(d => d.status === 'rejected');
    const verifiedList = deposits.filter(d => d.status === 'verified');
    return {
      notUploadedCount: unuploadedDueProviders.length,
      notUploadedSDG: unuploadedDueProviders.reduce((s, item) => s + item.uncoveredDue, 0),
      pendingCount: pendingList.length,
      pendingSDG: pendingList.reduce((s, d) => s + d.amountSDG, 0),
      rejectedCount: rejectedList.length,
      rejectedSDG: rejectedList.reduce((s, d) => s + d.amountSDG, 0),
      verifiedCount: verifiedList.length,
      verifiedSDG: verifiedList.reduce((s, d) => s + d.amountSDG, 0),
    };
  }, [deposits, unuploadedDueProviders]);

  // Handlers for User Modal
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      phone: '',
      email: '',
      password: 'password123',
      role: 'provider',
      city: 'الخرطوم',
      neighborhood: 'الرياض',
      isActive: true,
      deactivatedReason: '',
      tradeCategoryId: categories[0]?.id || 'tailor',
      tradeTitleAr: categories[0]?.nameAr || 'ترزي ماهر',
      tradeTitleEn: categories[0]?.nameEn || 'Skilled Craftsman',
      basePriceSDG: '25000',
      nidNumber: '102-1988-12345',
      nidUrl: '/src/assets/images/tailor_embroidery_craft_1791698438179.jpg',
      bioAr: '',
      avatarUrl: DEFAULT_AVATAR_URL,
      unpaidCancellationFeeSDG: '0',
    });
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      password: user.password || '',
      role: user.role,
      city: user.city || 'الخرطوم',
      neighborhood: user.neighborhood || 'الرياض',
      isActive: user.isActive !== false,
      deactivatedReason: user.deactivatedReason || '',
      tradeCategoryId: user.tradeCategoryId || categories[0]?.id || 'tailor',
      tradeTitleAr: user.tradeTitleAr || '',
      tradeTitleEn: user.tradeTitleEn || '',
      basePriceSDG: user.basePriceSDG ? String(user.basePriceSDG) : '25000',
      nidNumber: user.nidNumber || '',
      nidUrl: user.nidUrl || '',
      bioAr: user.bioAr || '',
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      unpaidCancellationFeeSDG: String(user.unpaidCancellationFeeSDG || 0),
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.phone.trim()) {
      alert(t('fillRequired'));
      return;
    }

    // Enforce Sudanese phone validation
    const phoneVal = validateSudanPhone(userFormData.phone);
    if (!phoneVal.isValid) {
      alert(language === 'ar' ? phoneVal.errorMessageAr : phoneVal.errorMessageEn);
      return;
    }
    const cleanPhone = phoneVal.cleanPhone;

    // Validate optional email if provided
    let cleanEmail: string | undefined;
    if (userFormData.email.trim() !== '') {
      const emailVal = validateEmail(userFormData.email);
      if (!emailVal.isValid) {
        alert(language === 'ar' ? emailVal.errorMessageAr : emailVal.errorMessageEn);
        return;
      }
      cleanEmail = emailVal.cleanEmail;
    }

    if (editingUser) {
      // Update existing user
      const parsedFine = Math.max(0, parseInt(userFormData.unpaidCancellationFeeSDG, 10) || 0);
      const res = await adminUpdateUser(editingUser.id, {
        name: userFormData.name.trim(),
        phone: cleanPhone,
        email: cleanEmail || '',
        role: userFormData.role,
        city: userFormData.city,
        neighborhood: userFormData.neighborhood,
        avatarUrl: userFormData.avatarUrl.trim() || undefined,
        isActive: userFormData.isActive,
        deactivatedReason: userFormData.isActive ? undefined : (userFormData.deactivatedReason || 'معطل بواسطة إدارة النظام'),
        unpaidCancellationFeeSDG: parsedFine,
        ...(userFormData.password ? { password: userFormData.password } : {}),
        tradeCategoryId: userFormData.role === 'provider' ? userFormData.tradeCategoryId : undefined,
        tradeTitleAr: userFormData.role === 'provider' ? userFormData.tradeTitleAr : undefined,
        tradeTitleEn: userFormData.role === 'provider' ? userFormData.tradeTitleEn : undefined,
        basePriceSDG: userFormData.role === 'provider' ? parseFloat(userFormData.basePriceSDG) || 25000 : undefined,
        nidNumber: userFormData.role === 'provider' ? userFormData.nidNumber : undefined,
        nidUrl: userFormData.role === 'provider' ? userFormData.nidUrl : undefined,
        bioAr: userFormData.role === 'provider' ? userFormData.bioAr : undefined,
      });
      if (res && !res.success) {
        alert(res.error || 'فشل تحديث بيانات المستخدم');
        return;
      }
    } else {
      // Add new user
      const res = await adminAddUser({
        name: userFormData.name.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        password: userFormData.password || 'password123',
        role: userFormData.role,
        city: userFormData.city,
        neighborhood: userFormData.neighborhood,
        avatarUrl: userFormData.avatarUrl.trim() || undefined,
        isActive: userFormData.isActive,
        deactivatedReason: userFormData.isActive ? undefined : (userFormData.deactivatedReason || 'معطل بواسطة إدارة النظام'),
        tradeCategoryId: userFormData.role === 'provider' ? userFormData.tradeCategoryId : undefined,
        tradeTitleAr: userFormData.role === 'provider' ? userFormData.tradeTitleAr : undefined,
        tradeTitleEn: userFormData.role === 'provider' ? userFormData.tradeTitleEn : undefined,
        basePriceSDG: userFormData.role === 'provider' ? parseFloat(userFormData.basePriceSDG) || 25000 : undefined,
        nidNumber: userFormData.role === 'provider' ? userFormData.nidNumber : undefined,
        nidUrl: userFormData.role === 'provider' ? userFormData.nidUrl : undefined,
        bioAr: userFormData.role === 'provider' ? userFormData.bioAr : undefined,
      });

      if (!res.success) {
        alert(res.error || 'فشلت إضافة المستخدم');
        return;
      }
    }

    setUserModalOpen(false);
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`${t('confirmDeleteUser')} (${user.name} - ${user.phone})`)) {
      await adminDeleteUser(user.id);
    }
  };

  const handleToggleUserActiveStatus = async (user: User) => {
    const isCurrentlyActive = user.isActive !== false;
    if (isCurrentlyActive) {
      const reason = prompt(
        language === 'ar' 
          ? `يرجى تحديد سبب تعطيل حساب (${user.name}):` 
          : `Reason for deactivating (${user.name}):`,
        'مخالفة معايير وشروط الخدمة'
      );
      if (reason !== null) {
        await adminToggleUserActive(user.id, reason);
      }
    } else {
      if (confirm(language === 'ar' ? `هل ترغب بإعادة تفعيل حساب (${user.name})؟` : `Reactivate account for (${user.name})?`)) {
        await adminToggleUserActive(user.id);
      }
    }
  };

  // Handlers for Category Modal
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      nameAr: '',
      nameEn: '',
      iconName: 'Wrench',
      descriptionAr: '',
      descriptionEn: '',
      averageRateSDG: '25000',
      popularLocations: 'الخرطوم، أم درمان، بحري',
    });
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setCategoryFormData({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      iconName: cat.iconName,
      descriptionAr: cat.descriptionAr,
      descriptionEn: cat.descriptionEn,
      averageRateSDG: String(cat.averageRateSDG),
      popularLocations: cat.popularLocations.join('، '),
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.nameAr.trim() || !categoryFormData.nameEn.trim()) {
      alert(t('fillRequired'));
      return;
    }

    const avgRate = parseFloat(categoryFormData.averageRateSDG) || 25000;
    const locs = categoryFormData.popularLocations.split('،').map(s => s.trim()).filter(Boolean);

    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        nameAr: categoryFormData.nameAr.trim(),
        nameEn: categoryFormData.nameEn.trim(),
        iconName: categoryFormData.iconName,
        descriptionAr: categoryFormData.descriptionAr.trim(),
        descriptionEn: categoryFormData.descriptionEn.trim(),
        averageRateSDG: avgRate,
        popularLocations: locs,
      });
    } else {
      await addCategory({
        nameAr: categoryFormData.nameAr.trim(),
        nameEn: categoryFormData.nameEn.trim(),
        iconName: categoryFormData.iconName,
        descriptionAr: categoryFormData.descriptionAr.trim(),
        descriptionEn: categoryFormData.descriptionEn.trim(),
        averageRateSDG: avgRate,
        popularLocations: locs,
      });
    }

    setCategoryModalOpen(false);
  };

  const handleDeleteCategory = async (cat: ServiceCategory) => {
    if (confirm(`${t('confirmDeleteCategory')} (${cat.nameAr})`)) {
      await deleteCategory(cat.id);
    }
  };

  // Handlers for Managing Ongoing Services
  const handleAdminAdvanceStatus = async (req: ServiceRequest) => {
    if (req.status === 'pending') {
      const res = await updateRequestStatus(req.id, 'accepted');
      if (!res.success && res.error) alert(res.error);
    } else if (req.status === 'accepted') {
      const res = await updateRequestStatus(req.id, 'in_progress');
      if (!res.success && res.error) alert(res.error);
    } else if (req.status === 'in_progress') {
      setCompleteServiceModalReq(req);
    }
  };

  const handleAdminCancelRequest = async (req: ServiceRequest) => {
    const reason = prompt(
      language === 'ar' ? 'سبب إلغاء الخدمة من قِبل الإدارة:' : 'Cancellation reason by Admin:',
      'تم الإلغاء بتدخل إداري مباشر'
    );
    if (reason !== null) {
      await adminCancelRequest(req.id, reason);
    }
  };

  const handleConfirmAdminComplete = async () => {
    if (!completeServiceModalReq) return;
    await updateRequestStatus(completeServiceModalReq.id, 'completed', selectedPayMethod);
    setCompleteServiceModalReq(null);
  };

  const handleWaiveUserFine = async (user: User) => {
    const fineAmount = user.unpaidCancellationFeeSDG || 0;
    if (fineAmount <= 0) return;
    const msg =
      language === 'ar'
        ? `هل ترغب في إعفاء (${user.name}) من غرامة الإلغاء المستحقة (${fineAmount.toLocaleString()} ج.س) وتصفيرها؟`
        : `Waive unpaid cancellation fine of ${fineAmount.toLocaleString()} SDG for ${user.name}?`;
    if (!window.confirm(msg)) return;

    const res = await adminWaiveFine({ userId: user.id });
    if (!res.success) {
      alert(res.error || 'تعذر إعفاء الغرامة');
      return;
    }
    setFineActionFeedback(
      language === 'ar'
        ? `تم إعفاء ${user.name} من غرامة ${fineAmount.toLocaleString()} ج.س بنجاح.`
        : `Waived ${fineAmount.toLocaleString()} SDG fine for ${user.name}.`
    );
    setTimeout(() => setFineActionFeedback(null), 4000);
  };

  const handleWaiveRequestFine = async (req: ServiceRequest) => {
    const fineAmount = req.cancellationFeePenaltySDG || 0;
    if (fineAmount <= 0) return;
    const msg =
      language === 'ar'
        ? `هل ترغب في إعفاء غرامة الإلغاء (${fineAmount.toLocaleString()} ج.س) المضافة على الطلب #${req.id} للعميل (${req.clientName})؟`
        : `Waive ${fineAmount.toLocaleString()} SDG cancellation fine attached to booking #${req.id} for ${req.clientName}?`;
    if (!window.confirm(msg)) return;

    const res = await adminWaiveFine({ requestId: req.id });
    if (!res.success) {
      alert(res.error || 'تعذر إعفاء الغرامة');
      return;
    }
    setFineActionFeedback(
      language === 'ar'
        ? `تم إعفاء الغرامة (${fineAmount.toLocaleString()} ج.س) من الطلب #${req.id} بنجاح.`
        : `Waived ${fineAmount.toLocaleString()} SDG fine on request #${req.id}.`
    );
    setTimeout(() => setFineActionFeedback(null), 4000);
  };

  return (
    <div className="pb-28 max-w-6xl mx-auto px-4 pt-3 space-y-6">
      
      {/* Top Navigation Back Button Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للمنصة الرئيسية' : 'Back to Platform'}
        >
          <BackArrowIcon className="w-4 h-4 text-teal-600 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'الرجوع للمنصة الرئيسية' : 'Back to Platform'}</span>
        </button>
      </div>

      {/* Admin Header with Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-teal-500 text-slate-950 text-[10px] font-extrabold uppercase">
              Admin Control Panel
            </span>
            <span className="text-xs text-slate-400">
              {currentUser?.name || 'مدير المنصة'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {t('adminDashboard')}
          </h1>
          <p className="text-xs text-slate-300">
            {language === 'ar'
              ? 'التحكم الشامل في المستخدمين وتفعيلهم/تعطيلهم، إدارة الخدمات الجارية، ومراجعة إثباتات عمولات الخميس للخدمات المكتملة'
              : 'Comprehensive administration of users, deactivation, ongoing services, and Thursday commission proofs'}
          </p>
        </div>

      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveAdminTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            activeAdminTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'نظرة عامة وإحصائيات' : 'Overview & KPIs'}</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            activeAdminTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t('adminManageUsers')} ({allUsers.length})</span>
          {deactivatedUsersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
              {deactivatedUsersCount} معطل
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('services')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            activeAdminTab === 'services'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>{t('adminManageServices')} ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('requests')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            activeAdminTab === 'requests'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'إدارة الخدمات والطلبات' : 'Services & Bookings'} ({requests.length})</span>
          {ongoingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold">
              {ongoingRequests.length} جارية
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('deposits')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors ${
            activeAdminTab === 'deposits'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>
            {t('adminManageDeposits')} ({deposits.length + unuploadedDueProviders.length})
          </span>
          {(pendingDepositsCount > 0 || unuploadedDueProviders.length > 0 || rejectedDepositsCount > 0) && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold tabular-nums">
              {pendingDepositsCount + unuploadedDueProviders.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('totalUsers')}</span>
              <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalUsersCount}</div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-emerald-700 font-bold">{activeUsersCount} نشط</span>
                <span>·</span>
                <span className="text-rose-700 font-bold">{deactivatedUsersCount} معطل</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('totalProviders')}</span>
              <div className="text-2xl font-extrabold text-teal-800 tabular-nums">{providersCount}</div>
              <span className="text-[10px] text-slate-500">{customersCount} عميل مسجل</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{language === 'ar' ? 'الخدمات الجارية' : 'Ongoing Jobs'}</span>
              <div className="text-2xl font-extrabold text-amber-600 tabular-nums">{ongoingRequests.length}</div>
              <span className="text-[10px] text-slate-500">{language === 'ar' ? 'قيد التنفيذ والمتابعة' : 'Underway'}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{language === 'ar' ? 'الخدمات المكتملة' : 'Completed Jobs'}</span>
              <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">{completedRequests.length}</div>
              <span className="text-[10px] text-slate-500">{cancelledRequests.length} ملغية</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('totalVolume')}</span>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums">{totalVolumeSDG.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400">{t('sdg')}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block">{t('totalCommission')}</span>
              <div className="text-xl font-extrabold text-teal-700 tabular-nums">{totalCommissionSDG.toLocaleString()}</div>
              <span className="text-[10px] text-slate-400">{t('sdg')} (8%)</span>
            </div>
          </div>

          {/* Pending NID Providers Approval Alert Card in Overview */}
          {pendingNidProviders.length > 0 && (
            <div className="p-4 rounded-3xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs font-bold text-sm">
                  {pendingNidProviders.length}
                </div>
                <div>
                  <span className="font-extrabold text-sm block">
                    {language === 'ar' ? `يوجد ${pendingNidProviders.length} مقدم خدمة جديد بانتظار مراجعة واعتماد الرقم الوطني أو جواز السفر` : `${pendingNidProviders.length} New Providers Awaiting NID / Passport Approval`}
                  </span>
                  <span className="text-xs text-amber-800">
                    {language === 'ar' ? 'حسابات المهنيين معطلة افتراضياً حتى تقوم الإدارة بفحص صورة الرقم الوطني أو جواز السفر وتفعيل الحساب.' : 'Provider accounts remain deactivated until admin reviews NID/Passport and activates.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserRoleFilter('provider');
                  setUserStatusFilter('pending_nid');
                  setActiveAdminTab('users');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {language === 'ar' ? 'تدقيق واعتماد الحسابات الآن' : 'Review & Approve NIDs Now'}
              </button>
            </div>
          )}

          {/* Pending Service Suggestions Alert Card in Overview */}
          {pendingSuggestions.length > 0 && (
            <div className="p-4 rounded-3xl bg-teal-500/10 border-2 border-teal-500/60 text-teal-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-700 shrink-0 shadow-2xs font-bold text-sm">
                  {pendingSuggestions.length}
                </div>
                <div>
                  <span className="font-extrabold text-sm block">
                    {language === 'ar' ? `يوجد ${pendingSuggestions.length} حرف وخدمات جديدة مقترحة من الحرفيين بانتظار الاعتماد` : `${pendingSuggestions.length} New Service Suggestions Awaiting Approval`}
                  </span>
                  <span className="text-xs text-teal-800">
                    {language === 'ar' ? 'يمكنك فحص الحرف المقترحة واعتمادها لإضافتها فوراً لدليل المنصة وتعيينها للحرفي.' : 'Review proposed services and approve them to add them to catalog.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('services');
                }}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {language === 'ar' ? 'مراجعة مقترحات الخدمات' : 'Review Suggestions'}
              </button>
            </div>
          )}

          {/* Unpaid Cancellation Fines Alert Card in Overview */}
          {usersWithFines.length > 0 && (
            <div className="p-4 rounded-3xl bg-rose-500/10 border-2 border-rose-300 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs font-bold text-sm">
                  {usersWithFines.length}
                </div>
                <div>
                  <span className="font-extrabold text-sm block">
                    {language === 'ar'
                      ? `يوجد ${usersWithFines.length} مستخدم عليهم غرامات إلغاء مستحقة (${totalUnpaidFinesSDG.toLocaleString()} ج.س)`
                      : `${usersWithFines.length} users have unpaid cancellation fines (${totalUnpaidFinesSDG.toLocaleString()} SDG)`}
                  </span>
                  <span className="text-xs text-rose-800">
                    {language === 'ar'
                      ? 'يمكن للإدارة مراجعة الغرامات وإعفاء أي مستخدم منها مباشرة.'
                      : 'Admins can review unpaid fines and waive them for any user.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserRoleFilter('all');
                  setUserStatusFilter('has_fine');
                  setActiveAdminTab('users');
                }}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {language === 'ar' ? 'عرض وإعفاء الغرامات' : 'Review & Waive Fines'}
              </button>
            </div>
          )}

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Users & Deactivation */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-700" />
                    <span>{language === 'ar' ? 'إدارة وتفعيل الحسابات' : 'Users & Accounts'}</span>
                  </h3>
                  <button
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addUser')}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'ar'
                    ? 'التحكم في تفعيل أو تجميد/تعطيل حسابات المستخدمين والمهنيين المخالفين، وفحص وثائق الهوية الوطنية الخاصة.'
                    : 'Activate or deactivate users, verify private NIDs, and manage profile credentials.'}
                </p>
              </div>
              <button
                onClick={() => setActiveAdminTab('users')}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إدارة المستخدمين والحسابات' : 'Manage User Accounts'}
              </button>
            </div>

            {/* Box 2: Ongoing & Completed Services */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>{language === 'ar' ? 'الخدمات الجارية والمكتملة' : 'Ongoing & Completed'}</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                    {ongoingRequests.length} جارية
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'ar'
                    ? 'متابعة مسار الخدمات النشطة (قبول، بدء، إنهاء، أو إلغاء)، ومراجعة إثباتات توريد العمولات للخدمات المكتملة.'
                    : 'Manage active jobs lifecycle, complete jobs with payment methods, and inspect commission receipts.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setRequestFilterMode('ongoing');
                  setActiveAdminTab('requests');
                }}
                className="w-full py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'متابعة الخدمات الجارية الآن' : 'View Ongoing Services'}
              </button>
            </div>

            {/* Box 3: Thursday Deposits */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'ar' ? 'توريدات عمولات الخميس' : 'Thursday Settlements'}</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                    بنكك 2334155
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'ar'
                    ? 'تدقيق إشعارات التحويل البنكية المرفوعة من الحرفيين كل خميس واعتمادها بعد التأكد من الرقم المرجعي.'
                    : 'Audit uploaded Bankak transfer receipts and verify Thursday commission payments.'}
                </p>
              </div>
              <button
                onClick={() => setActiveAdminTab('deposits')}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'فحص واعتماد التوريدات' : 'Audit Thursday Deposits'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT (ADD, UPDATE, REMOVE, DEACTIVATE/REACTIVATE, PRIVATE NID) */}
      {activeAdminTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          
          {/* Header & Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('adminManageUsers')}</h2>
              <span className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'إضافة وتعديل وحذف الحسابات، تعطيل وتفعيل المستخدمين، وتدقيق وثائق الهوية الوطنية (خاص بالإدارة)' 
                  : 'Add, update, remove users, deactivate/reactivate accounts, and inspect private NID'}
              </span>
            </div>

            <button
              onClick={handleOpenAddUser}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addUser')}</span>
            </button>
          </div>

          {/* Pending NID Providers Verification Alert Banner */}
          {pendingNidProviders.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800 shrink-0 font-bold">
                  {pendingNidProviders.length}
                </div>
                <div>
                  <span className="font-bold block">
                    {language === 'ar' 
                      ? `يوجد ${pendingNidProviders.length} مقدم خدمة بانتظار مراجعة واعتماد الرقم الوطني أو جواز السفر` 
                      : `${pendingNidProviders.length} providers awaiting National ID / Passport verification`}
                  </span>
                  <span className="text-[11px] text-amber-700">
                    {language === 'ar' ? 'حسابات المهنيين الجدد معطلة افتراضياً حتى تعتمدها الإدارة بعد تدقيق الهوية' : 'New provider accounts are deactivated by default until verified by admin'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserRoleFilter('provider');
                  setUserStatusFilter('pending_nid');
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer shrink-0"
              >
                {language === 'ar' ? 'عرض طلبات الاعتماد فقط' : 'Filter Pending Only'}
              </button>
            </div>
          )}

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200">
              <Search className="w-4 h-4 text-slate-400 ms-3 shrink-0" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث بالاسم، رقم الهاتف، الحي، أو الرقم الوطني...' : 'Search by name, phone, or NID...'}
                className="w-full px-3 py-2 bg-transparent text-slate-900 focus:outline-none"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'جميع الأدوار (الكل)' : 'All Roles'}</option>
              <option value="customer">{t('totalCustomers')}</option>
              <option value="provider">{t('totalProviders')}</option>
              <option value="admin">{t('adminRole')}</option>
            </select>

            {fineActionFeedback && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{fineActionFeedback}</span>
              </div>
            )}

            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">{language === 'ar' ? 'كل حالات الحساب (نشط ومعطل)' : 'All Statuses'}</option>
              <option value="pending_nid">
                ⏳ {language === 'ar' ? `بانتظار تدقيق واعتماد الهوية (${pendingNidProviders.length})` : `Pending NID Review (${pendingNidProviders.length})`}
              </option>
              <option value="has_fine">
                💸 {language === 'ar' ? `عليهم غرامات إلغاء (${usersWithFines.length})` : `With Unpaid Fines (${usersWithFines.length})`}
              </option>
              <option value="active">{language === 'ar' ? 'الحسابات النشطة فقط' : 'Active Accounts Only'}</option>
              <option value="deactivated">{language === 'ar' ? 'الحسابات المعطلة/المجمدة فقط' : 'Deactivated Accounts Only'}</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-start">المستخدم</th>
                  <th className="p-3 text-start">الدور</th>
                  <th className="p-3 text-start">حالة الحساب</th>
                  <th className="p-3 text-start">رقم الهاتف</th>
                  <th className="p-3 text-start">الموقع</th>
                  <th className="p-3 text-start">التفاصيل الحرفية والهوية (خاص)</th>
                  <th className="p-3 text-end">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isProv = user.role === 'provider';
                  const activeCount = isProv ? getProviderActiveServicesCount(user.id) : 0;
                  const isActive = user.isActive !== false;

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50/80 transition-colors ${!isActive ? 'bg-rose-50/30' : ''}`}>
                      {/* Name & Avatar */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className={`w-9 h-9 rounded-xl object-cover border ${!isActive ? 'border-rose-300 opacity-60' : 'border-slate-200'}`}
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{user.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {user.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3">
                        {user.role === 'admin' && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold border border-purple-200 text-[10px]">
                            {t('adminRole')}
                          </span>
                        )}
                        {user.role === 'provider' && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200 text-[10px]">
                            {t('totalProviders')}
                          </span>
                        )}
                        {user.role === 'customer' && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[10px]">
                            {t('totalCustomers')}
                          </span>
                        )}
                      </td>

                      {/* Account Status Badge & Deactivation Toggle */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{t('accountActive')}</span>
                            </span>
                          ) : (
                            <div>
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold border border-rose-200 text-[10px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>{t('accountDeactivated')}</span>
                              </span>
                              {user.deactivatedReason && (
                                <span className="text-[9px] text-rose-600 block mt-0.5 max-w-[120px] truncate" title={user.deactivatedReason}>
                                  {user.deactivatedReason}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Quick Toggle Button */}
                          <button
                            onClick={() => handleToggleUserActiveStatus(user)}
                            className={`p-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              isActive 
                                ? 'hover:bg-rose-100 text-rose-700' 
                                : 'hover:bg-emerald-100 text-emerald-700'
                            }`}
                            title={isActive ? t('deactivateAccount') : t('reactivateAccount')}
                          >
                            {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Phone Number & Email */}
                      <td className="p-3 font-mono font-medium text-slate-800">
                        <div>{user.phone}</div>
                        {user.email && (
                          <div className="text-[10px] font-sans text-slate-500 mt-0.5 truncate max-w-[160px]" dir="ltr" title={user.email}>
                            {user.email}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="p-3 text-slate-600">
                        {user.city} · {user.neighborhood}
                      </td>

                      {/* Provider Details, Private NID & Cancellation Fines */}
                      <td className="p-3">
                        <div className="space-y-1.5">
                          {isProv ? (
                            <div className="space-y-1">
                              <span className="text-teal-700 font-semibold block">{user.tradeTitleAr || 'حرفي'}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="tabular-nums font-bold text-slate-700">{user.basePriceSDG?.toLocaleString()} ج.س</span>
                                <span>·</span>
                                <span className={activeCount >= 2 ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                                  {activeCount}/2 طلبات جارية
                                </span>
                              </div>

                              {/* Private NID for Admin & Verification status */}
                              <div className="flex items-center gap-1.5 text-[10px] pt-0.5 flex-wrap">
                                {user.nidNumber ? (
                                  <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                    {user.nidNumber}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">بدون NID</span>
                                )}
                                {user.nidStatus === 'reupload_requested' && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[9px] font-bold">
                                    بانتظار إعادة الرفع
                                  </span>
                                )}
                                {!isActive && (user.deactivatedReason?.includes('المحدثة') || (user.nidStatus === 'pending' && user.nidSubmittedAt)) && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold">
                                    ✨ مستند محدث
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setInspectNidUser(user);
                                    setShowNidReuploadPrompt(false);
                                    setNidReuploadReasonText('');
                                  }}
                                  className={`font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                    user.nidStatus === 'reupload_requested'
                                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300'
                                      : !isActive && user.deactivatedReason?.includes('المحدثة')
                                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                                      : !isActive 
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300' 
                                      : 'text-teal-700 hover:text-teal-800 underline'
                                  }`}
                                  title="عرض وتدقيق مستند الهوية المرفوع"
                                >
                                  {user.nidStatus === 'reupload_requested' 
                                    ? 'طلب إعادة الرفع'
                                    : !isActive && user.deactivatedReason?.includes('المحدثة')
                                    ? '✨ تدقيق المستند المحدث'
                                    : !isActive 
                                    ? '⚠️ تدقيق واعتماد NID' 
                                    : t('viewNIDDocument')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            (user.unpaidCancellationFeeSDG || 0) <= 0 && (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )
                          )}

                          {/* Unpaid Cancellation Fine Badge & Waive Action */}
                          {(user.unpaidCancellationFeeSDG || 0) > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold tabular-nums">
                                {language === 'ar'
                                  ? `غرامة إلغاء: ${(user.unpaidCancellationFeeSDG || 0).toLocaleString()} ج.س`
                                  : `Fine: ${(user.unpaidCancellationFeeSDG || 0).toLocaleString()} SDG`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleWaiveUserFine(user)}
                                className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                {t('waiveFine')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions: Edit, Delete */}
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditUser(user)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            title={t('editUser')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.phone === '0900000000'}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              user.phone === '0900000000'
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'hover:bg-rose-50 text-rose-600 hover:text-rose-700'
                            }`}
                            title={t('deleteUser')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SERVICES & TRADES MANAGEMENT (ADD, UPDATE, REMOVE & REVIEW SUGGESTIONS) */}
      {activeAdminTab === 'services' && (
        <div className="space-y-6">
          {/* Section A: Provider Service Suggestions Review Board */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'ar' ? 'مقترحات الحرف والخدمات الجديدة من مقدمي الخدمات' : 'Provider Service Suggestions'}
                  </h2>
                  {pendingSuggestions.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {pendingSuggestions.length} {language === 'ar' ? 'بانتظار المراجعة' : 'pending'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ar'
                    ? 'الخدمات التي يقترحها الحرفيون غير المتوفرة بالمنصة؛ يمكنك مراجعة تفاصيلها واعتمادها لإضافتها تلقائياً كمهنة رسمية وتعيينها للحرفي فوراً.'
                    : 'Review trade suggestions submitted by providers. Approving creates the category and assigns it to the provider.'}
                </p>
              </div>
            </div>

            {serviceSuggestions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد مقترحات خدمات حالياً.' : 'No service suggestions yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceSuggestions.map((sug) => {
                  const operator = detectSudanOperator(sug.providerPhone);
                  return (
                    <div
                      key={sug.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        sug.status === 'pending'
                          ? 'border-amber-300 bg-amber-50/40'
                          : sug.status === 'approved'
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">{sug.nameAr}</h3>
                            {sug.nameEn && (
                              <span className="text-xs text-slate-400 font-normal">({sug.nameEn})</span>
                            )}
                          </div>
                          <span className="text-[11px] text-teal-700 font-semibold block mt-0.5">
                            مقدم الاقتراح: {sug.providerName}
                            <span className="font-mono text-slate-600 ms-1.5" dir="ltr">{sug.providerPhone}</span>
                            {operator && (
                              <span className={`ms-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${operator.badgeBg}`}>
                                {operator.nameAr}
                              </span>
                            )}
                          </span>
                        </div>

                        <div>
                          {sug.status === 'pending' && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-300">
                              ⏳ قيد الانتظار
                            </span>
                          )}
                          {sug.status === 'approved' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                              ✅ معتمدة بالمنصة
                            </span>
                          )}
                          {sug.status === 'rejected' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-300">
                              ❌ مرفوضة
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                        {sug.descriptionAr}
                      </p>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 text-[11px]">
                          السعر المقترح: <strong className="text-slate-900">{sug.suggestedRateSDG?.toLocaleString()} ج.س</strong>
                        </span>
                        <span className="text-[10px] text-slate-400">{sug.createdAt}</span>
                      </div>

                      {sug.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await approveServiceSuggestion(sug.id);
                              if (res.success) {
                                alert(`تم اعتماد الخدمة "${sug.nameAr}" بنجاح وإضافتها لدليل المنصة وحساب مقدم الخدمة!`);
                              } else if (res.error) {
                                alert(res.error);
                              }
                            }}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                          >
                            ✓ اعتماد وإضافة للمنصة
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const reason = prompt('يرجى تحديد سبب رفض الاقتراح (اختياري):');
                              await rejectServiceSuggestion(sug.id, reason || undefined);
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer transition-colors"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: Official Categories Catalog */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('adminManageServices')}</h2>
                <span className="text-xs text-slate-500">
                  {language === 'ar' ? 'إضافة تصنيفات حرفية جديدة، وتحديث الأسعار التقديرية، وحذف المهن' : 'Add, update, or remove trades and services'}
                </span>
              </div>

              <button
                onClick={handleOpenAddCategory}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('addCategory')}</span>
              </button>
            </div>

          {/* Search Field */}
          <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 ms-3 shrink-0" />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث عن مهنة أو تصنيف...' : 'Search category...'}
              className="w-full px-3 py-2 text-xs bg-transparent text-slate-900 focus:outline-none"
            />
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCategories.map((cat) => {
              const assignedWorkersCount = allUsers.filter(u => u.tradeCategoryId === cat.id).length;

              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <CategoryIcon iconName={cat.iconName} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">
                          {cat.nameAr}
                          <span className="text-slate-400 font-normal text-xs ms-1.5">({cat.nameEn})</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-snug">
                          {cat.descriptionAr}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                        title={t('editCategory')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                        title={t('deleteCategory')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Footer stats: Workers count & Avg Rate */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      <span>المهنيون المسجلون: </span>
                      <span className="font-bold text-slate-900 tabular-nums">{assignedWorkersCount}</span>
                    </div>

                    <div>
                      <span>متوسط السعر: </span>
                      <span className="font-extrabold text-teal-700 tabular-nums">{cat.averageRateSDG.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 ms-1">{t('sdg')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

      {/* TAB 4: REQUESTS MANAGEMENT & COMMISSION AUDIT (ONGOING & COMPLETED SERVICES) */}
      {activeAdminTab === 'requests' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {language === 'ar' ? 'إدارة ومتابعة الخدمات والحجوزات' : 'Manage Services & Bookings'}
              </h2>
              <span className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'متابعة وإدارة الخدمات الجارية، وتدقيق الخدمات المكتملة وإثباتات عمولات الخميس (8%)' 
                  : 'Manage ongoing jobs and inspect commission payment proofs for completed jobs'}
              </span>
            </div>

            {/* Sub-Filters: All, Ongoing, Completed, Cancelled */}
            <div className="flex gap-1.5 text-xs">
              <button
                onClick={() => setRequestFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  requestFilterMode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {language === 'ar' ? 'الكل' : 'All'} ({requests.length})
              </button>

              <button
                onClick={() => setRequestFilterMode('ongoing')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  requestFilterMode === 'ongoing'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('ongoingServices')} ({ongoingRequests.length})</span>
              </button>

              <button
                onClick={() => setRequestFilterMode('completed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  requestFilterMode === 'completed'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('completedServices')} ({completedRequests.length})</span>
              </button>

              <button
                onClick={() => setRequestFilterMode('cancelled')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  requestFilterMode === 'cancelled'
                    ? 'bg-rose-700 text-white'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200'
                }`}
              >
                {language === 'ar' ? 'الملغية' : 'Cancelled'} ({cancelledRequests.length})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center bg-slate-50 rounded-xl border border-slate-200 max-w-sm text-xs">
            <Search className="w-4 h-4 text-slate-400 ms-3 shrink-0" />
            <input
              type="text"
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث باسم العميل أو المهني أو التفاصيل...' : 'Search by client or worker...'}
              className="w-full px-3 py-2 bg-transparent text-slate-900 focus:outline-none"
            />
          </div>

          {/* Table of Requests */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-start">رقم الطلب</th>
                  <th className="p-3 text-start">العميل</th>
                  <th className="p-3 text-start">المهني والمهنة</th>
                  <th className="p-3 text-start">الخدمة والتنسيق</th>
                  <th className="p-3 text-start">المبلغ والعمولة (8%)</th>
                  <th className="p-3 text-start">حالة الخدمة</th>
                  <th className="p-3 text-start">إثبات سداد العمولة</th>
                  <th className="p-3 text-end">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isAccepted = req.status === 'accepted';
                  const isInProgress = req.status === 'in_progress';
                  const isCompleted = req.status === 'completed';
                  const isCancelled = req.status === 'cancelled';
                  const isOngoing = isPending || isAccepted || isInProgress;

                  // Find matching Thursday deposit for this provider if completed
                  const providerDeposit = isCompleted 
                    ? deposits.find(d => d.providerId === req.providerId)
                    : null;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Request ID */}
                      <td className="p-3 font-mono font-medium text-slate-500">
                        #{req.id}
                      </td>

                      {/* Client */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{req.clientName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{req.clientPhone}</span>
                      </td>

                      {/* Provider */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{req.providerName}</span>
                        <span className="text-[10px] text-teal-700 font-medium">{req.providerTradeAr}</span>
                      </td>

                      {/* Details & Scheduled Note */}
                      <td className="p-3">
                        <span className="text-slate-800 font-medium block truncate max-w-xs">{req.problemDescription}</span>
                        <span className="text-[10px] text-slate-400 block">{req.city} - {req.neighborhood}</span>
                        {req.scheduledTimeNote && (
                          <span className="text-[9px] text-teal-800 bg-teal-50 px-1 py-0.5 rounded border border-teal-100 block mt-0.5 w-fit">
                            الموعد: {req.scheduledTimeNote}
                          </span>
                        )}
                      </td>

                      {/* Financial Price & Commission */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 tabular-nums">{req.agreedPriceSDG.toLocaleString()} ج.س</span>
                        <span className="text-[10px] text-amber-700 font-semibold block">عمولة المنصة: {req.commissionFeeSDG} ج.س</span>
                        {(req.cancellationFeePenaltySDG || 0) > 0 && (
                          <span className="text-[10px] text-rose-700 font-bold block tabular-nums">
                            + غرامة إلغاء: {req.cancellationFeePenaltySDG.toLocaleString()} ج.س
                          </span>
                        )}
                        {req.paymentMethod && (
                          <span className="text-[9px] text-slate-500 block">
                            سداد العميل: {req.paymentMethod === 'bankak' ? 'بنكك' : 'كاش'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {isPending && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {t('statusPending')}
                          </span>
                        )}
                        {isAccepted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            {t('statusAccepted')}
                          </span>
                        )}
                        {isInProgress && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {t('statusInProgress')}
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {t('statusCompleted')}
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            {t('statusCancelled')}
                          </span>
                        )}
                      </td>

                      {/* Commission Payment Proof for Completed Services */}
                      <td className="p-3">
                        {isCompleted ? (
                          providerDeposit ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  providerDeposit.status === 'verified' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {providerDeposit.status === 'verified' ? 'عمولة معتمدة' : 'بانتظار الاعتماد'}
                                </span>
                                <span className="font-mono text-[9px] text-slate-500">
                                  {providerDeposit.bankakReferenceNumber}
                                </span>
                              </div>
                              <button
                                onClick={() => setInspectDeposit(providerDeposit)}
                                className="text-[10px] text-teal-700 hover:text-teal-900 font-bold underline flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{t('viewCommissionProof')}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                              <span>{t('noCommissionProofYet')}</span>
                              <span className="block font-bold text-[9px]">مستحق: {req.commissionFeeSDG} ج.س</span>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Admin Management Actions */}
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ongoing Service Management Buttons */}
                          {isOngoing && (
                            <>
                              {isPending && (
                                <button
                                  onClick={() => handleAdminAdvanceStatus(req)}
                                  className="px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                  title="قبول الخدمة نيابة عن المهني"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>قبول</span>
                                </button>
                              )}
                              {isAccepted && (
                                <button
                                  onClick={() => handleAdminAdvanceStatus(req)}
                                  className="px-2 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                  title="بدء تنفيذ الخدمة"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>بدء</span>
                                </button>
                              )}
                              {isInProgress && (
                                <button
                                  onClick={() => handleAdminAdvanceStatus(req)}
                                  className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                  title="إنهاء الخدمة وتوثيق السداد"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>إنهاء</span>
                                </button>
                              )}
                              {isOngoing && (req.cancellationFeePenaltySDG || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleWaiveRequestFine(req)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                  title={t('waiveFine')}
                                >
                                  <span>{t('waiveFine')}</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleAdminCancelRequest(req)}
                                className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-[10px] cursor-pointer"
                                title="إلغاء الطلب"
                              >
                                <span>إلغاء</span>
                              </button>
                            </>
                          )}

                          {/* Delete Request record */}
                          <button
                            onClick={() => {
                              if (confirm('هل أنت متأكد من حذف هذا الطلب نهائياً من سجلات النظام؟')) {
                                adminDeleteRequest(req.id);
                              }
                            }}
                            className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                            title="حذف السجل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: THURSDAY COMMISSION DEPOSITS AUDITING (ALL TYPES: NOT UPLOADED, PENDING REVIEW, REJECTED, VERIFIED) */}
      {activeAdminTab === 'deposits' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-5 p-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('adminManageDeposits')}</h2>
              <span className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'متابعة جميع توريدات عمولات الـ 8%: المستحقات التي لم تُرفع بعد، الإشعارات قيد المراجعة، المرفوضة، والمعتمدة لحساب بنكك (2334155)'
                  : 'Audit all 8% Thursday deposits: unuploaded obligations, pending reviews, rejected slips, and verified Bankak transfers (2334155)'}
              </span>
            </div>
          </div>

          {/* 4-Card Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setDepositFilterMode('not_uploaded')}
              className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                depositFilterMode === 'not_uploaded'
                  ? 'border-orange-400 bg-orange-50/70 ring-1 ring-orange-300'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-orange-50/40'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-orange-800">
                <span>{language === 'ar' ? 'مطلوبة ولم تُرفع بعد' : 'Due (Not Uploaded)'}</span>
                <Clock className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {depositSummary.notUploadedSDG.toLocaleString()}{' '}
                <span className="text-[11px] font-semibold text-slate-500">{t('sdg')}</span>
              </div>
              <span className="text-[10px] text-orange-700 font-semibold tabular-nums">
                {depositSummary.notUploadedCount}{' '}
                {language === 'ar' ? 'مهني مطلوب منه توريد' : 'providers owing'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepositFilterMode('pending_verification')}
              className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                depositFilterMode === 'pending_verification'
                  ? 'border-amber-400 bg-amber-50/70 ring-1 ring-amber-300'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-amber-50/40'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-800">
                <span>{language === 'ar' ? 'بانتظار الاعتماد' : 'Pending Review'}</span>
                <FileCheck className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {depositSummary.pendingSDG.toLocaleString()}{' '}
                <span className="text-[11px] font-semibold text-slate-500">{t('sdg')}</span>
              </div>
              <span className="text-[10px] text-amber-700 font-semibold tabular-nums">
                {depositSummary.pendingCount}{' '}
                {language === 'ar' ? 'إشعار مرفوع للمراجعة' : 'uploaded receipts'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepositFilterMode('rejected')}
              className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                depositFilterMode === 'rejected'
                  ? 'border-rose-400 bg-rose-50/70 ring-1 ring-rose-300'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-rose-50/40'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-800">
                <span>{language === 'ar' ? 'مرفوضة / غير صالحة' : 'Rejected / Invalid'}</span>
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {depositSummary.rejectedSDG.toLocaleString()}{' '}
                <span className="text-[11px] font-semibold text-slate-500">{t('sdg')}</span>
              </div>
              <span className="text-[10px] text-rose-700 font-semibold tabular-nums">
                {depositSummary.rejectedCount}{' '}
                {language === 'ar' ? 'بانتظار إعادة الرفع' : 'awaiting re-upload'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepositFilterMode('verified')}
              className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                depositFilterMode === 'verified'
                  ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                <span>{language === 'ar' ? 'توريدات معتمدة' : 'Verified'}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {depositSummary.verifiedSDG.toLocaleString()}{' '}
                <span className="text-[11px] font-semibold text-slate-500">{t('sdg')}</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold tabular-nums">
                {depositSummary.verifiedCount}{' '}
                {language === 'ar' ? 'تحويل مؤكد' : 'confirmed transfers'}
              </span>
            </button>
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { id: 'all', labelAr: `الكل (${deposits.length + unuploadedDueProviders.length})`, labelEn: `All (${deposits.length + unuploadedDueProviders.length})` },
                  { id: 'not_uploaded', labelAr: `لم تُرفع بعد (${depositSummary.notUploadedCount})`, labelEn: `Not Uploaded (${depositSummary.notUploadedCount})` },
                  { id: 'pending_verification', labelAr: `قيد المراجعة (${depositSummary.pendingCount})`, labelEn: `Pending Review (${depositSummary.pendingCount})` },
                  { id: 'rejected', labelAr: `مرفوضة (${depositSummary.rejectedCount})`, labelEn: `Rejected (${depositSummary.rejectedCount})` },
                  { id: 'verified', labelAr: `معتمدة (${depositSummary.verifiedCount})`, labelEn: `Verified (${depositSummary.verifiedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDepositFilterMode(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    depositFilterMode === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {language === 'ar' ? tab.labelAr : tab.labelEn}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={depositSearch}
                onChange={(e) => setDepositSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث باسم المهني، الهاتف، أو رقم بنكك...' : 'Search provider, phone, or ref...'}
                className="w-full ps-9 pe-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 1: UNUPLOADED / DUE OBLIGATIONS */}
          {(depositFilterMode === 'all' || depositFilterMode === 'not_uploaded') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-orange-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <span>
                    {language === 'ar'
                      ? 'مستحقات مطلوب رفع إشعارها (لم تُرفع بعد أو بانتظار إعادة الرفع)'
                      : 'Due Commissions Requiring Upload (Not Uploaded / Awaiting Re-upload)'}
                  </span>
                </h3>
                <span className="text-[11px] font-bold text-orange-700 tabular-nums">
                  {filteredUnuploadedDueProviders.length}{' '}
                  {language === 'ar' ? 'حالة' : 'items'}
                </span>
              </div>

              {filteredUnuploadedDueProviders.length === 0 ? (
                <div className="p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  {language === 'ar'
                    ? 'لا توجد مستحقات عمولة غير مرفوعة حالياً — جميع المهنيين قاموا برفع إشعاراتهم أو تمت تسويتها.'
                    : 'No unuploaded Thursday commission obligations at the moment.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredUnuploadedDueProviders.map(({ provider, completedCount, verifiedSum, pendingReviewSum, uncoveredDue, awaitingReupload, latestRejected }) => {
                    const cleanDigits = provider.phone.replace(/\D/g, '').replace(/^0/, '');
                    const waPhone = cleanDigits.startsWith('249') ? cleanDigits : `249${cleanDigits}`;
                    const waText = encodeURIComponent(
                      language === 'ar'
                        ? `مرحباً ${provider.name}، تذكير من إدارة منصة مهني بتوريد عمولة المنصة (8%) المستحقة بمبلغ ${uncoveredDue.toLocaleString()} ج.س عبر بنكك للحساب رقم 2334155 (Ahmed Almostafa Omer - احمدالمصطفى عمر) ورفع صورة الإشعار من محفظتك في التطبيق.`
                        : `Hello ${provider.name}, reminder from Mehani to deposit your due 8% commission of ${uncoveredDue.toLocaleString()} SDG to Bankak 2334155 (Ahmed Almostafa Omer - احمدالمصطفى عمر) and upload the receipt in your wallet.`
                    );

                    return (
                      <div
                        key={`due-${provider.id}`}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          awaitingReupload
                            ? 'border-rose-200 bg-rose-50/40'
                            : 'border-orange-200 bg-orange-50/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-extrabold text-slate-700 text-sm shrink-0 overflow-hidden">
                            {provider.avatarUrl ? (
                              <img
                                src={provider.avatarUrl}
                                alt={provider.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              provider.name.charAt(0)
                            )}
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-sm">{provider.name}</h4>
                              {awaitingReupload ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>
                                    {language === 'ar'
                                      ? 'إشعار سابق مرفوض — بانتظار إعادة الرفع'
                                      : 'Previous Slip Rejected — Awaiting Re-upload'}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {language === 'ar'
                                      ? 'لم يرفع إشعار بعد'
                                      : 'Receipt Not Uploaded Yet'}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
                              <span className="font-mono">{provider.phone}</span>
                              {provider.city && <span>· {provider.city}</span>}
                              <span>
                                · {completedCount}{' '}
                                {language === 'ar' ? 'خدمة مكتملة' : 'completed jobs'}
                              </span>
                              {verifiedSum > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  · {language === 'ar' ? 'مورّد سابقاً:' : 'Verified:'}{' '}
                                  {verifiedSum.toLocaleString()} {t('sdg')}
                                </span>
                              )}
                              {pendingReviewSum > 0 && (
                                <span className="text-amber-700 font-semibold">
                                  · {language === 'ar' ? 'قيد المراجعة:' : 'Pending:'}{' '}
                                  {pendingReviewSum.toLocaleString()} {t('sdg')}
                                </span>
                              )}
                            </div>

                            {awaitingReupload && latestRejected?.rejectionReason && (
                              <p className="text-[11px] text-rose-700 bg-white/80 border border-rose-200 rounded-lg px-2.5 py-1 inline-block">
                                <strong>{language === 'ar' ? 'سبب الرفض السابق:' : 'Last rejection:'}</strong>{' '}
                                {latestRejected.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-end">
                            <span className="text-[11px] text-slate-500 block">
                              {language === 'ar' ? 'المطلوب رفعه الآن' : 'Amount Due'}
                            </span>
                            <span className="text-base font-extrabold text-orange-700 tabular-nums">
                              {uncoveredDue.toLocaleString()} {t('sdg')}
                            </span>
                          </div>

                          <a
                            href={`https://wa.me/${waPhone}?text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs shrink-0 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'تذكير واتساب' : 'WhatsApp'}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: UPLOADED DEPOSIT RECEIPTS (PENDING, REJECTED, VERIFIED) */}
          {depositFilterMode !== 'not_uploaded' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-teal-700" />
                  <span>
                    {language === 'ar'
                      ? 'الإشعارات المرفوعة من المهنيين'
                      : 'Uploaded Deposit Receipts'}
                  </span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                  {filteredDeposits.length} {language === 'ar' ? 'إشعار' : 'receipts'}
                </span>
              </div>

              {filteredDeposits.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  {language === 'ar'
                    ? 'لا توجد إشعارات توريد مطابقة لهذا التصنيف حالياً.'
                    : 'No uploaded deposit receipts match the selected filter.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDeposits.map((dep) => {
                    const statusBadge =
                      dep.status === 'verified'
                        ? {
                            cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                            icon: <CheckCircle2 className="w-3 h-3" />,
                            label: language === 'ar' ? 'توريد معتمد' : 'Verified',
                          }
                        : dep.status === 'rejected'
                          ? {
                              cls: 'bg-rose-100 text-rose-800 border-rose-200',
                              icon: <XCircle className="w-3 h-3" />,
                              label: language === 'ar' ? 'إشعار مرفوض — غير صالح' : 'Rejected / Invalid',
                            }
                          : {
                              cls: 'bg-amber-100 text-amber-800 border-amber-200',
                              icon: <Clock className="w-3 h-3" />,
                              label: language === 'ar' ? 'بانتظار الاعتماد' : 'Pending Review',
                            };

                    return (
                      <div
                        key={dep.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          dep.status === 'rejected'
                            ? 'border-rose-200 bg-rose-50/30'
                            : dep.status === 'pending_verification'
                              ? 'border-amber-200 bg-amber-50/30'
                              : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {dep.receiptFileUrl && (
                            <img
                              src={dep.receiptFileUrl}
                              alt="Deposit receipt"
                              onClick={() => setInspectDeposit(dep)}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-90"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm">{dep.providerName}</h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${statusBadge.cls}`}
                              >
                                {statusBadge.icon}
                                <span>{statusBadge.label}</span>
                              </span>
                            </div>

                            <div className="font-mono text-slate-500 text-[11px] tabular-nums">
                              {language === 'ar' ? 'رقم العملية:' : 'Ref:'} {dep.bankakReferenceNumber} ·{' '}
                              {language === 'ar' ? 'التاريخ:' : 'Date:'} {dep.depositDate}
                            </div>

                            {dep.notes && (
                              <p className="text-slate-600 text-xs">{dep.notes}</p>
                            )}

                            {dep.status === 'rejected' && dep.rejectionReason && (
                              <div className="p-2 rounded-xl bg-rose-100/70 border border-rose-200 text-rose-900 text-[11px] flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span>
                                  <strong>{language === 'ar' ? 'سبب الرفض:' : 'Rejection reason:'}</strong>{' '}
                                  {dep.rejectionReason}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setInspectDeposit(dep)}
                              className="text-teal-700 font-bold underline text-[11px] flex items-center gap-1 cursor-pointer pt-0.5"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{t('viewCommissionProof')}</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-end">
                            <span className="text-xs text-slate-400 block">{t('depositAmount')}</span>
                            <span className="text-base font-extrabold text-teal-800 tabular-nums">
                              {dep.amountSDG.toLocaleString()} {t('sdg')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {dep.status !== 'verified' && (
                              <button
                                type="button"
                                onClick={() => verifyDeposit(dep.id, 'verified')}
                                className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('approveDeposit')}</span>
                              </button>
                            )}

                            {dep.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectDepositTarget(dep);
                                  setRejectDepositReason(
                                    'صورة إشعار بنكك غير واضحة أو الرقم المرجعي غير مطابق لكشف الحساب، يرجى إعادة رفع إشعار صحيح'
                                  );
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{t('rejectDeposit')}</span>
                              </button>
                            )}

                            {dep.status === 'verified' && (
                              <button
                                type="button"
                                onClick={() => verifyDeposit(dep.id, 'pending_verification')}
                                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                              >
                                {language === 'ar' ? 'إلغاء الاعتماد' : 'Unverify'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(language === 'ar' ? 'حذف هذا الإشعار نهائياً؟' : 'Delete this receipt permanently?')) {
                                  deleteDeposit(dep.id);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                              title={language === 'ar' ? 'حذف الإشعار' : 'Delete receipt'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT USER */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingUser ? t('editUser') : t('addUser')}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Profile Photo: Upload or choose presets */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-teal-700" />
                    <span>صورة الملف الشخصي (Profile Photo)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">تعديل فوري</span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={userFormData.avatarUrl}
                    alt="User avatar preview"
                    className="w-12 h-12 rounded-xl object-cover border-2 border-teal-600 shadow-2xs shrink-0"
                  />
                  <div className="flex-1 space-y-1.5">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-medium cursor-pointer w-fit shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>رفع صورة من الجهاز</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setUserFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {PRESET_AVATARS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setUserFormData(prev => ({ ...prev, avatarUrl: av.url }))}
                          title={language === 'ar' ? av.labelAr : av.labelEn}
                          className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition-transform cursor-pointer shrink-0 ${
                            userFormData.avatarUrl === av.url ? 'border-teal-600 ring-2 ring-teal-200 scale-105' : 'border-slate-200'
                          }`}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('name')} *</label>
                  <input
                    type="text"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 block">{t('phone')} *</label>
                    {detectSudanOperator(userFormData.phone) && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${detectSudanOperator(userFormData.phone)?.badgeBg}`}>
                        📶 {detectSudanOperator(userFormData.phone)?.nameAr}
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={userFormData.phone}
                    maxLength={14}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="0912345678"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                  <span className="text-[9px] text-slate-400 block">
                    10 أرقام (زين: 090, 091, 096 | MTN: 092, 093, 099 | سوداني: 010, 011, 012)
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">
                  {t('email')} <span className="text-[10px] text-slate-400 font-normal">({language === 'ar' ? 'اختياري - فريد بدون تكرار' : 'optional - unique'})</span>
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder={t('emailPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('role')} *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white font-medium"
                  >
                    <option value="customer">{t('customerRole')}</option>
                    <option value="provider">{t('providerRole')}</option>
                    <option value="admin">{t('adminRole')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('password')}</label>
                  <input
                    type="text"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Status Switch (Active / Deactivated) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">حالة الحساب والتفعيل:</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUserFormData({ ...userFormData, isActive: true, deactivatedReason: '' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        userFormData.isActive 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {t('accountActive')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserFormData({ ...userFormData, isActive: false })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        !userFormData.isActive 
                          ? 'bg-rose-600 text-white' 
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {t('accountDeactivated')}
                    </button>
                  </div>
                </div>

                {!userFormData.isActive && (
                  <div className="space-y-1 pt-1">
                    <label className="font-semibold text-rose-800 text-[11px] block">سبب التعطيل / التجميد:</label>
                    <input
                      type="text"
                      value={userFormData.deactivatedReason}
                      onChange={(e) => setUserFormData({ ...userFormData, deactivatedReason: e.target.value })}
                      placeholder="مثال: مخالفة شروط الاستخدام أو عدم سداد العمولات"
                      className="w-full px-3 py-1.5 text-xs border border-rose-200 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('state')}</label>
                  <input
                    type="text"
                    value={userFormData.city}
                    onChange={(e) => setUserFormData({ ...userFormData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('neighborhood')}</label>
                  <input
                    type="text"
                    value={userFormData.neighborhood}
                    onChange={(e) => setUserFormData({ ...userFormData, neighborhood: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Unpaid Cancellation Fine (Edit User & Waive Option) */}
              {editingUser && (
                <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-bold text-slate-800">
                      {t('unpaidFines')} ({t('sdg')}):
                    </label>
                    {Number(userFormData.unpaidCancellationFeeSDG) > 0 && (
                      <button
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, unpaidCancellationFeeSDG: '0' })}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {t('waiveFine')} (0)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={userFormData.unpaidCancellationFeeSDG}
                    onChange={(e) => setUserFormData({ ...userFormData, unpaidCancellationFeeSDG: e.target.value })}
                    className="w-full px-3 py-2 border border-rose-200 rounded-xl bg-white font-mono"
                  />
                </div>
              )}

              {/* Provider Specific Inputs */}
              {userFormData.role === 'provider' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-teal-800 block">بيانات الحرفة والمهنة:</span>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">{t('selectCategory')}</label>
                    <select
                      value={userFormData.tradeCategoryId}
                      onChange={(e) => {
                        const sel = categories.find(c => c.id === e.target.value);
                        setUserFormData({
                          ...userFormData,
                          tradeCategoryId: e.target.value,
                          tradeTitleAr: sel?.nameAr || userFormData.tradeTitleAr,
                          tradeTitleEn: sel?.nameEn || userFormData.tradeTitleEn,
                        });
                      }}
                      className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.nameAr}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">{t('servicePrice')} ({t('sdg')})</label>
                      <input
                        type="number"
                        value={userFormData.basePriceSDG}
                        onChange={(e) => setUserFormData({ ...userFormData, basePriceSDG: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">{t('nationalId')} (خاص)</label>
                      <input
                        type="text"
                        value={userFormData.nidNumber}
                        onChange={(e) => setUserFormData({ ...userFormData, nidNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">رابط وثيقة الهوية (NID Doc URL):</label>
                    <input
                      type="text"
                      value={userFormData.nidUrl}
                      onChange={(e) => setUserFormData({ ...userFormData, nidUrl: e.target.value })}
                      placeholder="/src/assets/images/..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">{t('bio')}</label>
                    <textarea
                      rows={2}
                      value={userFormData.bioAr}
                      onChange={(e) => setUserFormData({ ...userFormData, bioAr: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'حفظ البيانات' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SERVICE CATEGORY */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingCategory ? t('editCategory') : t('addCategory')}
              </h3>
              <button onClick={() => setCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('categoryNameAr')} *</label>
                  <input
                    type="text"
                    value={categoryFormData.nameAr}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, nameAr: e.target.value })}
                    placeholder="مثال: صيانة غسالات ومجففات"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('categoryNameEn')} *</label>
                  <input
                    type="text"
                    value={categoryFormData.nameEn}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, nameEn: e.target.value })}
                    placeholder="e.g. Washing Machines Repair"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('categoryAverageRate')} *</label>
                  <input
                    type="number"
                    value={categoryFormData.averageRateSDG}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, averageRateSDG: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">{t('categoryIcon')}</label>
                  <select
                    value={categoryFormData.iconName}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, iconName: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Wrench">مفتاح صيانة (Wrench)</option>
                    <option value="Zap">كهرباء وطاقة (Zap)</option>
                    <option value="Scissors">مقص وخياطة (Scissors)</option>
                    <option value="Sparkles">تجميل وحناء (Sparkles)</option>
                    <option value="Hammer">بناء ومحارة (Hammer)</option>
                    <option value="Axe">نجارة وأخشاب (Axe)</option>
                    <option value="Paintbrush">دهانات وديكور (Paintbrush)</option>
                    <option value="BookOpen">تعليم وتدريس (BookOpen)</option>
                    <option value="Utensils">طبخ ومناسبات (Utensils)</option>
                    <option value="ShieldCheck">نظافة وتعقيم (ShieldCheck)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">{t('categoryDescAr')}</label>
                <textarea
                  rows={2}
                  value={categoryFormData.descriptionAr}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, descriptionAr: e.target.value })}
                  placeholder="وصف مختصر للخدمة..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">{t('categoryDescEn')}</label>
                <textarea
                  rows={2}
                  value={categoryFormData.descriptionEn}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, descriptionEn: e.target.value })}
                  placeholder="Short description in English..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">مناطق التغطية الشائعة</label>
                <input
                  type="text"
                  value={categoryFormData.popularLocations}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, popularLocations: e.target.value })}
                  placeholder="الخرطوم، أم درمان، بحري، بورتسودان"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'حفظ التصنيف' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COMMISSION DEPOSIT PROOF INSPECTION LIGHTBOX */}
      {inspectDeposit && (
        <div 
          onClick={() => setInspectDeposit(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 text-white shadow-2xl p-6 space-y-4 my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-400" />
                <h3 className="font-extrabold text-base text-white">
                  {language === 'ar' ? 'إشعار سداد عمولة الخميس (8%)' : 'Thursday Commission Deposit Proof'}
                </h3>
              </div>
              <button 
                onClick={() => setInspectDeposit(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div>
                  <span className="text-slate-400 block">{language === 'ar' ? 'مقدم الخدمة (الحرفي)' : 'Service Provider'}</span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-bold text-white text-sm">{inspectDeposit.providerName}</span>
                    {inspectDeposit.status === 'verified' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === 'ar' ? 'توريد معتمد' : 'Verified'}</span>
                      </span>
                    ) : inspectDeposit.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                        <XCircle className="w-3 h-3" />
                        <span>{language === 'ar' ? 'مرفوض — غير صالح' : 'Rejected'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{language === 'ar' ? 'قيد المراجعة' : 'Pending Review'}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  <span className="text-slate-400 block">{language === 'ar' ? 'المبلغ المورد' : 'Amount Deposited'}</span>
                  <span className="font-extrabold text-teal-400 text-base tabular-nums">
                    {inspectDeposit.amountSDG.toLocaleString()} {t('sdg')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'الرقم المرجعي (بنكك)' : 'Bankak Ref'}</span>
                  <span className="font-mono font-bold">{inspectDeposit.bankakReferenceNumber}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'تاريخ التوريد' : 'Deposit Date'}</span>
                  <span>{inspectDeposit.depositDate}</span>
                </div>
              </div>

              {inspectDeposit.notes && (
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
                  <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'ملاحظات المهني' : 'Notes'}</span>
                  <span>{inspectDeposit.notes}</span>
                </div>
              )}

              {inspectDeposit.status === 'rejected' && inspectDeposit.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-rose-300 block">
                      {language === 'ar' ? 'سبب الرفض المسجل:' : 'Recorded rejection reason:'}
                    </span>
                    <span>{inspectDeposit.rejectionReason}</span>
                  </div>
                </div>
              )}

              {/* Receipt Image */}
              <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black max-h-[50vh] flex items-center justify-center">
                {inspectDeposit.receiptFileUrl ? (
                  <img
                    src={inspectDeposit.receiptFileUrl}
                    alt="Receipt"
                    className="w-full h-full object-contain max-h-[45vh]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    {language === 'ar' ? 'لا توجد صورة إشعار مرفقة' : 'No receipt image uploaded'}
                  </div>
                )}
              </div>

              {/* Approval status actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {inspectDeposit.status !== 'verified' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await verifyDeposit(inspectDeposit.id, 'verified');
                      setInspectDeposit({
                        ...inspectDeposit,
                        status: 'verified',
                        rejectionReason: null,
                      });
                    }}
                    className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{t('approveDeposit')}</span>
                  </button>
                )}

                {inspectDeposit.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectDepositTarget(inspectDeposit);
                      setRejectDepositReason(
                        'صورة إشعار بنكك غير واضحة أو الرقم المرجعي غير مطابق لكشف الحساب، يرجى إعادة رفع إشعار صحيح'
                      );
                    }}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{language === 'ar' ? 'رفض وطلب إعادة رفع' : 'Reject & Request Re-upload'}</span>
                  </button>
                )}

                {inspectDeposit.status === 'verified' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await verifyDeposit(inspectDeposit.id, 'pending_verification');
                      setInspectDeposit({
                        ...inspectDeposit,
                        status: 'pending_verification',
                      });
                    }}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                  >
                    <span>{language === 'ar' ? 'إلغاء الاعتماد (قيد المراجعة)' : 'Return to Pending Review'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRIVATE NID INSPECTION (FOR ADMIN ONLY) */}
      {inspectNidUser && (
        <div 
          onClick={() => setInspectNidUser(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {language === 'ar' ? 'وثيقة الرقم الوطني أو جواز السفر (بيانات خاصة)' : 'National ID / Passport Document (Private)'}
                  </h3>
                  <span className="text-[10px] text-amber-700 font-semibold block">
                    {t('nidPrivateNotice')}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setInspectNidUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">اسم صاحب الحساب:</span>
                  <span className="font-bold text-slate-900 text-sm">{inspectNidUser.name}</span>
                </div>
                <div className="text-end">
                  <span className="text-slate-500 block">الرقم الوطني (NID):</span>
                  <span className="font-mono font-extrabold text-teal-800 text-sm">
                    {inspectNidUser.nidNumber || 'غير مدخل'}
                  </span>
                </div>
              </div>

              {inspectNidUser.nidSubmittedAt && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <span>تاريخ رفع المستند الحالي:</span>
                  <span className="font-mono font-medium">
                    {new Date(inspectNidUser.nidSubmittedAt).toLocaleString('ar-SD')}
                  </span>
                </div>
              )}

              {inspectNidUser.nidStatus === 'pending' && inspectNidUser.nidRejectionReason && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>تم تحديث وإعادة رفع المستند من قِبل المهني</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    الملاحظة السابقة: <em>{inspectNidUser.nidRejectionReason}</em>
                  </p>
                </div>
              )}

              {/* NID Document / Card Image */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-[50vh] flex items-center justify-center">
                {inspectNidUser.nidUrl ? (
                  <img
                    src={inspectNidUser.nidUrl}
                    alt="National ID"
                    className="w-full h-full object-contain max-h-[45vh]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    {language === 'ar' ? 'لم يتم إرفاق ملف الرقم الوطني أو جواز السفر' : 'No ID / Passport document attached'}
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>
                  {language === 'ar' 
                    ? 'هذه البيانات مشفرة ولا تظهر لأي عميل أو مستخدم آخر حفاظاً على الخصوصية التامة.' 
                    : 'This document is confidential and strictly invisible to clients.'}
                </span>
              </div>

              {inspectNidUser.nidStatus === 'reupload_requested' && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تم طلب إعادة رفع الهوية من المهني مسبقاً</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    الملاحظة الموجهة للمهني: <strong>{inspectNidUser.nidRejectionReason || inspectNidUser.deactivatedReason}</strong>
                  </p>
                </div>
              )}

              {/* Request Re-upload Form Prompt */}
              {showNidReuploadPrompt ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-amber-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>طلب إعادة رفع الهوية وإرسال ملاحظة للمهني</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNidReuploadPrompt(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    سيتم إشعار المهني في ملفه الشخصي وإتاحة خيار إعادة الرفع مع إرفاق الملاحظة التالية:
                  </p>

                  {/* Preset quick reasons */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-semibold">اختر سبباً جاهزاً أو اكتب ملاحظة مخصصة:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'صورة المستند غير واضحة وباهتة ولا يمكن قراءة الاسم أو الرقم الوطني',
                        'المستند المرفق لا يطابق الرقم الوطني الرسمي أو جواز السفر',
                        'أطراف المستند مقصوصة والبيانات غير مكتملة'
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNidReuploadReasonText(preset)}
                          className="px-2.5 py-1 rounded-lg text-[10px] bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 text-slate-700 transition-colors cursor-pointer text-start"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={nidReuploadReasonText}
                    onChange={(e) => setNidReuploadReasonText(e.target.value)}
                    placeholder="اكتب سبب رفض المستند الحالي ليعرف المهني المطلوب..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNidReuploadPrompt(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = nidReuploadReasonText.trim() || 'صورة المستند المرفقة غير واضحة أو غير مطابقة، يرجى إعادة رفع صورة واضحة للبطاقة القومية';
                        await adminRequestNidReupload(inspectNidUser.id, reason);
                        setInspectNidUser(prev => prev ? {
                          ...prev,
                          isActive: false,
                          nidStatus: 'reupload_requested',
                          nidRejectionReason: reason,
                          deactivatedReason: reason,
                        } : null);
                        setShowNidReuploadPrompt(false);
                        setNidReuploadReasonText('');
                      }}
                      className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      تأكيد وإرسال طلب إعادة الرفع
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Admin Actions: Approve NID & Activate Provider / Request Re-upload / Deactivate */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                {inspectNidUser.isActive === false ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminUpdateUser(inspectNidUser.id, { 
                          isActive: true, 
                          nidStatus: 'approved',
                          deactivatedReason: undefined,
                          nidRejectionReason: undefined 
                        });
                        setInspectNidUser(prev => prev ? { 
                          ...prev, 
                          isActive: true, 
                          nidStatus: 'approved',
                          deactivatedReason: undefined,
                          nidRejectionReason: undefined 
                        } : null);
                      }}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === 'ar' ? 'اعتماد وتفعيل الحساب' : 'Approve & Activate'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowNidReuploadPrompt(true);
                        setNidReuploadReasonText('صورة المستند غير واضحة أو باهتة ولا يمكن قراءة الاسم أو الرقم الوطني');
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{language === 'ar' ? 'طلب إعادة رفع الهوية' : 'Request Re-upload'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await adminToggleUserActive(inspectNidUser.id, 'تم تعليق الحساب مؤقتاً لمراجعة إضافية للبيانات');
                      setInspectNidUser(prev => prev ? { ...prev, isActive: false, deactivatedReason: 'تم تعليق الحساب مؤقتاً لمراجعة إضافية للبيانات' } : null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <PowerOff className="w-4 h-4" />
                    <span>{language === 'ar' ? 'تعطيل الحساب وتجميده' : 'Deactivate Account'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setInspectNidUser(null);
                    setShowNidReuploadPrompt(false);
                  }}
                  className="py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADMIN COMPLETE ONGOING SERVICE & RECORD CLIENT PAYMENT */}
      {completeServiceModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{language === 'ar' ? 'إنهاء الخدمة وتوثيق السداد الإداري' : 'Complete Job & Record Payment'}</span>
            </h3>

            <p className="text-xs text-slate-600">
              {language === 'ar'
                ? `يرجى تحديد طريقة الدفع التي سدد بها العميل مبلغ الخدمة (${completeServiceModalReq.agreedPriceSDG.toLocaleString()} ج.س) للمهني (${completeServiceModalReq.providerName}):`
                : `Select the payment method used by client for this completed service:`}
            </p>

            <div className="space-y-2">
              <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                selectedPayMethod === 'bankak' ? 'border-teal-600 bg-teal-50/50' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <input
                    type="radio"
                    name="adminPayMethod"
                    checked={selectedPayMethod === 'bankak'}
                    onChange={() => setSelectedPayMethod('bankak')}
                    className="text-teal-600"
                  />
                  <span>{t('payBankak')}</span>
                </div>
                <CreditCard className="w-4 h-4 text-teal-600" />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                selectedPayMethod === 'cash' ? 'border-teal-600 bg-teal-50/50' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <input
                    type="radio"
                    name="adminPayMethod"
                    checked={selectedPayMethod === 'cash'}
                    onChange={() => setSelectedPayMethod('cash')}
                    className="text-teal-600"
                  />
                  <span>{t('payCash')}</span>
                </div>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </label>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
              <span>سيتم احتساب عمولة المنصة 8% ({Math.round(completeServiceModalReq.agreedPriceSDG * 0.08).toLocaleString()} {t('sdg')}) على المهني لتوريدها يوم الخميس القادم.</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setCompleteServiceModalReq(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmAdminComplete}
                className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد الإنهاء والتوثيق' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: REJECT THURSDAY DEPOSIT PROOF WITH REASON */}
      {rejectDepositTarget && (
        <div
          onClick={() => {
            if (!isRejectingDeposit) setRejectDepositTarget(null);
          }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-rose-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  {language === 'ar' ? 'رفض إشعار التوريد وطلب إعادة الرفع' : 'Reject Receipt & Request Re-upload'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectDepositTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">{rejectDepositTarget.providerName}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {rejectDepositTarget.bankakReferenceNumber} · {rejectDepositTarget.depositDate}
                </span>
              </div>
              <span className="font-extrabold text-teal-800 tabular-nums">
                {rejectDepositTarget.amountSDG.toLocaleString()} {t('sdg')}
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 block">
                {language === 'ar' ? 'أسباب رفض سريعة (اختر أو عدّل):' : 'Quick rejection reasons:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  language === 'ar'
                    ? 'صورة إشعار بنكك غير واضحة أو مقصوصة، يرجى رفع صورة كاملة وواضحة'
                    : 'Bankak screenshot is blurry or cropped; please upload a clear full image',
                  language === 'ar'
                    ? 'الرقم المرجعي للعملية غير مطابق لكشف حساب بنكك (2334155)'
                    : 'Bankak reference number does not match our statement for account 2334155',
                  language === 'ar'
                    ? 'المبلغ المحول غير مكتمل أو لا يطابق قيمة الإشعار المرفق'
                    : 'Transferred amount is incomplete or does not match the submitted amount',
                  language === 'ar'
                    ? 'تم إرفاق إيصال قديم أو مكرر لعملية سابقة'
                    : 'Duplicate or previously used transfer receipt uploaded',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectDepositReason(preset)}
                    className="px-2.5 py-1 rounded-lg text-[10px] bg-slate-50 border border-slate-200 hover:border-rose-400 hover:text-rose-700 text-slate-700 transition-colors cursor-pointer text-start"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {language === 'ar' ? 'سبب الرفض الذي سيظهر للمهني:' : 'Rejection message shown to provider:'}
              </label>
              <textarea
                rows={3}
                value={rejectDepositReason}
                onChange={(e) => setRejectDepositReason(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'اكتب سبب عدم صلاحية الإشعار ليعيد المهني رفعه بشكل صحيح...'
                    : 'Explain why this proof is invalid so the provider can re-upload...'
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectDepositTarget(null)}
                disabled={isRejectingDeposit}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isRejectingDeposit}
                onClick={async () => {
                  const finalReason =
                    rejectDepositReason.trim() ||
                    (language === 'ar'
                      ? 'إشعار التوريد غير صالح، يرجى إعادة رفع إشعار صحيح وواضح'
                      : 'Invalid deposit receipt, please re-upload a valid screenshot');
                  setIsRejectingDeposit(true);
                  try {
                    await verifyDeposit(rejectDepositTarget.id, 'rejected', finalReason);
                    if (inspectDeposit && inspectDeposit.id === rejectDepositTarget.id) {
                      setInspectDeposit({
                        ...inspectDeposit,
                        status: 'rejected',
                        rejectionReason: finalReason,
                      });
                    }
                    setRejectDepositTarget(null);
                    setRejectDepositReason('');
                  } finally {
                    setIsRejectingDeposit(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isRejectingDeposit
                  ? language === 'ar'
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : language === 'ar'
                    ? 'تأكيد الرفض وإشعار المهني'
                    : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
