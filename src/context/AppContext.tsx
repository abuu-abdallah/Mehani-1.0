import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  ServiceRequest,
  ServiceStatus,
  ThursdayCommissionDeposit,
  PortfolioItem,
  ServiceCategory,
  ServiceSuggestion,
  ProviderCustomService,
} from '../types';
import { SERVICE_CATEGORIES } from '../data/mockData';
import { useAuth } from './AuthContext';
import { safeStorage } from '../utils/safeStorage';
import { maharaApi } from '../services/api';

export type NavigationTab = 'home' | 'search' | 'bookings' | 'commission' | 'profile' | 'admin';

export interface PublicReviewItem {
  id: string;
  providerId: string;
  clientName: string;
  clientRating: number;
  clientReviewComment?: string;
  ratedAt?: string;
}

interface AppContextType {
  providers: User[];
  categories: ServiceCategory[];
  serviceSuggestions: ServiceSuggestion[];
  requests: ServiceRequest[];
  deposits: ThursdayCommissionDeposit[];
  publicReviews: PublicReviewItem[];
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  canGoBack: boolean;
  goBack: () => void;
  selectedProviderId: string | null;
  setSelectedProviderId: (id: string | null) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'register_customer' | 'register_provider' | 'forgot_password';
  setAuthModalMode: (mode: 'login' | 'register_customer' | 'register_provider' | 'forgot_password') => void;
  closeAuthModal: () => void;
  bookingModalProvider: User | null;
  setBookingModalProvider: (provider: User | null) => void;
  bookingModalPreSelectedServiceId?: string;
  setBookingModalPreSelectedServiceId: (serviceId?: string) => void;
  openBookingModal: (provider: User, preSelectedServiceId?: string) => void;
  closeBookingModal: () => void;
  bookService: (data: {
    provider: User;
    scheduledTimeNote: string;
    addressDetails: string;
    city: string;
    neighborhood: string;
    problemDescription: string;
    agreedPriceSDG: number;
    selectedServiceItemIds?: string[];
    selectedServiceNames?: string[];
  }) => Promise<{ success: boolean; error?: string; request?: ServiceRequest }>;
  cancelService: (
    requestId: string,
    reason: string
  ) => Promise<{ success: boolean; penaltyAmount?: number; error?: string }>;
  updateRequestStatus: (
    requestId: string,
    newStatus: ServiceStatus,
    paymentMethod?: 'cash' | 'bankak' | 'fawry'
  ) => Promise<{ success: boolean; error?: string }>;
  submitServiceRating: (
    requestId: string,
    rating: number,
    comment?: string
  ) => Promise<{ success: boolean; error?: string }>;
  submitThursdayDeposit: (data: {
    amountSDG: number;
    depositDate: string;
    bankakReferenceNumber: string;
    receiptFileUrl: string;
    notes?: string;
    resubmitDepositId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  addPortfolioItem: (providerId: string, item: Omit<PortfolioItem, 'id'>) => Promise<void>;
  toggleProviderAvailability: (providerId: string) => Promise<void>;
  getProviderActiveServicesCount: (providerId: string) => number;
  addCategory: (category: Omit<ServiceCategory, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<ServiceCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  verifyDeposit: (
    id: string,
    status: 'verified' | 'pending_verification' | 'rejected',
    rejectionReason?: string
  ) => Promise<void>;
  deleteDeposit: (id: string) => Promise<void>;
  adminDeleteRequest: (id: string) => Promise<void>;
  adminCancelRequest: (id: string, reason: string) => Promise<void>;
  addProviderService: (
    providerId: string,
    categoryId: string
  ) => Promise<{ success: boolean; error?: string }>;
  removeProviderService: (
    providerId: string,
    categoryId: string
  ) => Promise<{ success: boolean; error?: string }>;
  addCustomService: (
    providerId: string,
    service: {
      nameAr: string;
      nameEn?: string;
      priceSDG: number;
      categoryId?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  updateCustomService: (
    providerId: string,
    serviceId: string,
    updates: Partial<ProviderCustomService>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteCustomService: (
    providerId: string,
    serviceId: string
  ) => Promise<{ success: boolean; error?: string }>;
  suggestNewService: (data: {
    nameAr: string;
    nameEn?: string;
    descriptionAr: string;
    descriptionEn?: string;
    suggestedRateSDG: number;
    iconName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  approveServiceSuggestion: (suggestionId: string) => Promise<{ success: boolean; error?: string }>;
  rejectServiceSuggestion: (
    suggestionId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    isGuest,
    isRemoteApi,
    latestBootstrap,
    refreshFromServer,
    allUsers,
    setAllUsers,
    setCurrentUser,
    updateProfile,
    adminUpdateUser,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isAuthRequired = !currentUser && !isGuest;
  const isAuthRequiredRef = useRef<boolean>(isAuthRequired);
  isAuthRequiredRef.current = isAuthRequired;

  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => !currentUser && !isGuest);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register_customer' | 'register_provider' | 'forgot_password'>('login');
  const [bookingModalProvider, setBookingModalProvider] = useState<User | null>(null);
  const [bookingModalPreSelectedServiceId, setBookingModalPreSelectedServiceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!currentUser && !isGuest) {
      setAuthModalMode('login');
      setShowAuthModal(true);
    }
  }, [currentUser, isGuest]);

  // Comprehensive Phone Back Navigation & Browser History Sync
  interface AppHistoryState {
    tab: NavigationTab;
    providerId: string | null;
    modal: 'booking' | 'auth' | null;
    index: number;
  }

  const historyIndexRef = useRef<number>(0);
  const isPopStateActionRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    const currentState = (typeof window !== 'undefined' ? window.history.state : null) as AppHistoryState | null;
    const initialIndex = currentState && typeof currentState.index === 'number' ? currentState.index : 0;
    historyIndexRef.current = initialIndex;

    const initialSnapshot: AppHistoryState = {
      tab: activeTab,
      providerId: selectedProviderId,
      modal: bookingModalProvider ? 'booking' : showAuthModal ? 'auth' : null,
      index: initialIndex,
    };

    if (typeof window !== 'undefined') {
      window.history.replaceState(initialSnapshot, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as AppHistoryState | null;
      isPopStateActionRef.current = true;

      if (!state) {
        historyIndexRef.current = 0;
        setBookingModalProvider(null);
        setShowAuthModal(isAuthRequiredRef.current);
        setSelectedProviderId(null);
        setActiveTab('home');
        return;
      }

      historyIndexRef.current = state.index ?? 0;

      if (!state.modal || state.modal !== 'booking') {
        setBookingModalProvider(null);
      }
      if (isAuthRequiredRef.current) {
        setShowAuthModal(true);
      } else if (!state.modal || state.modal !== 'auth') {
        setShowAuthModal(false);
      }

      setSelectedProviderId(state.providerId ?? null);

      if (state.tab) {
        setActiveTab(state.tab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current || typeof window === 'undefined') return;

    if (isPopStateActionRef.current) {
      isPopStateActionRef.current = false;
      return;
    }

    const currentModal: 'booking' | 'auth' | null = bookingModalProvider
      ? 'booking'
      : showAuthModal
      ? 'auth'
      : null;

    const currentState = window.history.state as AppHistoryState | null;

    if (
      currentState &&
      currentState.tab === activeTab &&
      currentState.providerId === selectedProviderId &&
      currentState.modal === currentModal
    ) {
      return;
    }

    const nextIndex = (historyIndexRef.current ?? 0) + 1;
    historyIndexRef.current = nextIndex;

    const newSnapshot: AppHistoryState = {
      tab: activeTab,
      providerId: selectedProviderId,
      modal: currentModal,
      index: nextIndex,
    };

    window.history.pushState(newSnapshot, '');
  }, [activeTab, selectedProviderId, bookingModalProvider, showAuthModal]);

  const canGoBack =
    !isAuthRequired &&
    (activeTab !== 'home' ||
      selectedProviderId !== null ||
      !!bookingModalProvider ||
      showAuthModal ||
      historyIndexRef.current > 0);

  const goBack = useCallback(() => {
    if (isAuthRequiredRef.current) {
      return;
    }

    if (historyIndexRef.current > 0 && typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }

    isPopStateActionRef.current = true;
    if (bookingModalProvider) {
      setBookingModalProvider(null);
      return;
    }
    if (showAuthModal) {
      setShowAuthModal(false);
      return;
    }
    if (selectedProviderId !== null) {
      setSelectedProviderId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (activeTab !== 'home') {
      setActiveTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }, [bookingModalProvider, showAuthModal, selectedProviderId, activeTab]);

  const closeBookingModal = useCallback(() => {
    if (bookingModalProvider) {
      goBack();
    }
  }, [bookingModalProvider, goBack]);

  const closeAuthModal = useCallback(() => {
    if (isAuthRequiredRef.current) {
      return;
    }
    if (showAuthModal) {
      if (historyIndexRef.current > 0 && typeof window !== 'undefined' && window.history.length > 1) {
        goBack();
      } else {
        setShowAuthModal(false);
      }
    }
  }, [showAuthModal, goBack]);

  const openBookingModal = (provider: User, preSelectedServiceId?: string) => {
    setBookingModalPreSelectedServiceId(preSelectedServiceId);
    setBookingModalProvider(provider);
  };

  // Seed only official categories by default (requests/deposits/suggestions start empty until created)
  const [requests, setRequests] = useState<ServiceRequest[]>(() => {
    return safeStorage.getJSON<ServiceRequest[]>('mahara_requests', []);
  });

  const [deposits, setDeposits] = useState<ThursdayCommissionDeposit[]>(() => {
    return safeStorage.getJSON<ThursdayCommissionDeposit[]>('mahara_deposits', []);
  });

  const [categories, setCategories] = useState<ServiceCategory[]>(() => {
    return safeStorage.getJSON<ServiceCategory[]>('mahara_categories', SERVICE_CATEGORIES);
  });

  const [serviceSuggestions, setServiceSuggestions] = useState<ServiceSuggestion[]>(() => {
    return safeStorage.getJSON<ServiceSuggestion[]>('mahara_service_suggestions', []);
  });

  const [activeCountsByProvider, setActiveCountsByProvider] = useState<Record<string, number>>({});
  const [publicReviews, setPublicReviews] = useState<PublicReviewItem[]>([]);

  // Hydrate AppContext whenever bootstrap snapshot arrives from InfinityFree MySQL PHP API
  useEffect(() => {
    if (!latestBootstrap) return;
    if (Array.isArray(latestBootstrap.categories)) {
      setCategories(latestBootstrap.categories);
    }
    if (Array.isArray(latestBootstrap.requests)) {
      setRequests(latestBootstrap.requests);
    }
    if (Array.isArray(latestBootstrap.deposits)) {
      setDeposits(latestBootstrap.deposits);
    }
    if (Array.isArray(latestBootstrap.serviceSuggestions)) {
      setServiceSuggestions(latestBootstrap.serviceSuggestions);
    }
    if (latestBootstrap.activeCountsByProvider) {
      setActiveCountsByProvider(latestBootstrap.activeCountsByProvider);
    }
    if (Array.isArray(latestBootstrap.publicReviews)) {
      setPublicReviews(
        latestBootstrap.publicReviews.map(r => ({
          id: String(r.id),
          providerId: String(r.provider_id),
          clientName: String(r.client_name),
          clientRating: Number(r.client_rating),
          clientReviewComment: r.client_review_comment ?? undefined,
          ratedAt: r.rated_at ?? undefined,
        }))
      );
    }
  }, [latestBootstrap]);

  // Providers list comes from allUsers filtered by role 'provider' and active status for marketplace
  const providers = allUsers.filter(u => u.role === 'provider' && u.isActive !== false);

  useEffect(() => {
    if (!isRemoteApi) {
      safeStorage.setJSON('mahara_categories', categories);
    }
  }, [categories, isRemoteApi]);

  useEffect(() => {
    if (!isRemoteApi) {
      safeStorage.setJSON('mahara_service_suggestions', serviceSuggestions);
    }
  }, [serviceSuggestions, isRemoteApi]);

  useEffect(() => {
    if (!isRemoteApi) {
      safeStorage.setJSON('mahara_requests', requests);
    }
  }, [requests, isRemoteApi]);

  useEffect(() => {
    if (!isRemoteApi) {
      safeStorage.setJSON('mahara_deposits', deposits);
    }
  }, [deposits, isRemoteApi]);

  // Helper to count active services ('accepted' or 'in_progress') for any provider
  const getProviderActiveServicesCount = (providerId: string): number => {
    const localCount = requests.filter(
      r => r.providerId === providerId && (r.status === 'accepted' || r.status === 'in_progress')
    ).length;
    if (isRemoteApi && typeof activeCountsByProvider[providerId] === 'number') {
      return activeCountsByProvider[providerId];
    }
    return localCount;
  };

  // Uber-like Booking Function
  const bookService = async (data: {
    provider: User;
    scheduledTimeNote: string;
    addressDetails: string;
    city: string;
    neighborhood: string;
    problemDescription: string;
    agreedPriceSDG: number;
    selectedServiceItemIds?: string[];
    selectedServiceNames?: string[];
  }) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return { success: false, error: 'يرجى تسجيل الدخول أولاً لإكمال الطلب' };
    }

    const res = await maharaApi.bookService({
      providerId: data.provider.id,
      scheduledTimeNote: data.scheduledTimeNote,
      addressDetails: data.addressDetails,
      city: data.city,
      neighborhood: data.neighborhood,
      problemDescription: data.problemDescription,
      agreedPriceSDG: data.agreedPriceSDG,
      selectedServiceItemIds: data.selectedServiceItemIds,
      selectedServiceNames: data.selectedServiceNames,
    });

    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'تعذر إرسال الطلب' };
      }
      setRequests(prev => [res.data.request, ...prev]);
      await refreshFromServer();
      return { success: true, request: res.data.request };
    }

    // Local fallback
    if (data.provider.isActive === false) {
      return {
        success: false,
        error: 'عذراً، تم تجميد حساب هذا المهني حالياً بواسطة إدارة المنصة.',
      };
    }

    const currentActiveCount = getProviderActiveServicesCount(data.provider.id);
    if (currentActiveCount >= 3) {
      return {
        success: false,
        error:
          'عذراً، هذا المهني وصل للحد الأقصى المسموح للخدمات الجارية (3 خدمات في نفس الوقت). يرجى اختيار مهني آخر متاح.',
      };
    }

    const clientPenalty = currentUser.unpaidCancellationFeeSDG || 0;
    const commissionFee = Math.round(data.agreedPriceSDG * 0.08);

    const newRequest: ServiceRequest = {
      id: `req-${Date.now()}`,
      clientId: currentUser.id,
      clientName: currentUser.name,
      clientPhone: currentUser.phone,
      providerId: data.provider.id,
      providerName: data.provider.name,
      providerPhone: data.provider.phone,
      providerTradeAr: data.provider.tradeTitleAr || data.provider.tradeCategoryId || 'حرفي',
      providerTradeEn: data.provider.tradeTitleEn || 'Service Provider',
      status: 'pending',
      createdAt: new Date().toLocaleString('ar-SD'),
      scheduledTimeNote: data.scheduledTimeNote,
      addressDetails: data.addressDetails,
      city: data.city,
      neighborhood: data.neighborhood,
      problemDescription: data.problemDescription,
      selectedServiceItemIds: data.selectedServiceItemIds,
      selectedServiceNames: data.selectedServiceNames,
      agreedPriceSDG: data.agreedPriceSDG,
      cancellationFeePenaltySDG: clientPenalty,
      commissionRatePercent: 8,
      commissionFeeSDG: commissionFee,
      isPaidByClient: false,
    };

    setRequests(prev => [newRequest, ...prev]);

    if (clientPenalty > 0) {
      await updateProfile({ unpaidCancellationFeeSDG: 0 });
    }

    return { success: true, request: newRequest };
  };

  // Cancellation function (5% penalty applied to next booking)
  const cancelService = async (requestId: string, reason: string) => {
    const res = await maharaApi.cancelService(requestId, reason);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error };
      }
      await refreshFromServer();
      return { success: true, penaltyAmount: res.data.penaltyAmount };
    }

    const target = requests.find(r => r.id === requestId);
    if (!target) return { success: false };

    const penalty = Math.round(target.agreedPriceSDG * 0.05);

    setRequests(prev =>
      prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            status: 'cancelled',
            cancelledBy: 'client',
            cancelReason: reason,
            cancelledAt: new Date().toLocaleString('ar-SD'),
          };
        }
        return r;
      })
    );

    if (currentUser && currentUser.id === target.clientId) {
      const currentPenalty = currentUser.unpaidCancellationFeeSDG || 0;
      await updateProfile({ unpaidCancellationFeeSDG: currentPenalty + penalty });
    }

    return { success: true, penaltyAmount: penalty };
  };

  const updateRequestStatus = async (
    requestId: string,
    newStatus: ServiceStatus,
    paymentMethod?: 'cash' | 'bankak' | 'fawry'
  ) => {
    const res = await maharaApi.updateRequestStatus(requestId, newStatus, paymentMethod);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error };
      }
      await refreshFromServer();
      return { success: true };
    }

    const target = requests.find(r => r.id === requestId);
    if (!target) return { success: false };

    setRequests(prev =>
      prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            status: newStatus,
            ...(paymentMethod ? { paymentMethod, isPaidByClient: true } : {}),
            ...(newStatus === 'completed' ? { completedAt: new Date().toLocaleString('ar-SD') } : {}),
          };
        }
        return r;
      })
    );

    if (newStatus === 'completed') {
      const provider = providers.find(p => p.id === target.providerId);
      if (provider) {
        const comm = target.commissionFeeSDG || Math.round(target.agreedPriceSDG * 0.08);
        const newDue = (provider.pendingCommissionDueSDG || 0) + comm;
        const newTotalEarnings = (provider.totalEarningsSDG || 0) + target.agreedPriceSDG;

        if (currentUser && currentUser.id === provider.id) {
          await updateProfile({
            pendingCommissionDueSDG: newDue,
            totalEarningsSDG: newTotalEarnings,
          });
        }
      }
    }

    return { success: true };
  };

  const submitThursdayDeposit = async (data: {
    amountSDG: number;
    depositDate: string;
    bankakReferenceNumber: string;
    receiptFileUrl: string;
    notes?: string;
    resubmitDepositId?: string;
  }) => {
    if (!currentUser) return { success: false, error: 'يرجى تسجيل الدخول أولاً' };

    const res = await maharaApi.submitDeposit(data);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إرسال إشعار التوريد' };
      }
      await refreshFromServer();
      return { success: true };
    }

    const nowStr = new Date().toLocaleString('ar-SD');
    if (data.resubmitDepositId) {
      setDeposits(prev =>
        prev.map(d =>
          d.id === data.resubmitDepositId
            ? {
                ...d,
                amountSDG: data.amountSDG,
                depositDate: data.depositDate,
                bankakReferenceNumber: data.bankakReferenceNumber,
                receiptFileUrl: data.receiptFileUrl,
                notes: data.notes,
                status: 'pending_verification',
                rejectionReason: null,
                reviewedAt: null,
                submittedAt: nowStr,
              }
            : d
        )
      );
      return { success: true };
    }

    const newDeposit: ThursdayCommissionDeposit = {
      id: `dep-${Date.now()}`,
      providerId: currentUser.id,
      providerName: currentUser.name,
      amountSDG: data.amountSDG,
      depositDate: data.depositDate,
      bankakReferenceNumber: data.bankakReferenceNumber,
      receiptFileUrl: data.receiptFileUrl,
      notes: data.notes,
      status: 'pending_verification',
      rejectionReason: null,
      reviewedAt: null,
      submittedAt: nowStr,
    };

    setDeposits(prev => [newDeposit, ...prev]);
    return { success: true };
  };

  const addPortfolioItem = async (providerId: string, item: Omit<PortfolioItem, 'id'>) => {
    const res = await maharaApi.addPortfolio(providerId, item);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    const newItem: PortfolioItem = {
      id: `port-${Date.now()}`,
      ...item,
    };

    if (currentUser && currentUser.id === providerId) {
      const updatedPort = [...(currentUser.portfolio || []), newItem];
      await updateProfile({ portfolio: updatedPort });
    }
  };

  const toggleProviderAvailability = async (providerId: string) => {
    const res = await maharaApi.toggleAvailability(providerId);
    if (res.available) {
      if (res.ok) {
        setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
        if (currentUser?.id === providerId) {
          setCurrentUser(res.data.user);
        }
      }
      return;
    }

    if (currentUser && currentUser.id === providerId) {
      await updateProfile({ isAvailable: !currentUser.isAvailable });
    }
  };

  const addCategory = async (categoryData: Omit<ServiceCategory, 'id'>) => {
    const res = await maharaApi.addCategory(categoryData);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    const newCategory: ServiceCategory = {
      id: `cat-${Date.now()}`,
      ...categoryData,
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = async (id: string, updates: Partial<ServiceCategory>) => {
    const res = await maharaApi.updateCategory(id, updates);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCategory = async (id: string) => {
    const res = await maharaApi.deleteCategory(id);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const verifyDeposit = async (
    id: string,
    status: 'verified' | 'pending_verification' | 'rejected',
    rejectionReason?: string
  ) => {
    const res = await maharaApi.verifyDeposit(id, status, rejectionReason);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    const target = deposits.find(d => d.id === id);
    if (!target) return;

    const cleanReason =
      status === 'rejected'
        ? rejectionReason?.trim() ||
          'إشعار التحويل المرفق غير صالح أو غير مطابق، يرجى إعادة رفع إشعار بنكك الصحيح'
        : null;
    const reviewedAt =
      status === 'verified' || status === 'rejected'
        ? new Date().toLocaleString('ar-SD')
        : null;

    setDeposits(prev =>
      prev.map(d =>
        d.id === id
          ? {
              ...d,
              status,
              rejectionReason: cleanReason,
              reviewedAt,
            }
          : d
      )
    );

    const provider = allUsers.find(u => u.id === target.providerId);
    if (provider) {
      const currentDue = provider.pendingCommissionDueSDG || 0;
      if (status === 'verified' && target.status !== 'verified') {
        await adminUpdateUser(provider.id, {
          pendingCommissionDueSDG: Math.max(0, currentDue - target.amountSDG),
          lastThursdayDepositDate: target.depositDate,
        });
      } else if (status !== 'verified' && target.status === 'verified') {
        await adminUpdateUser(provider.id, {
          pendingCommissionDueSDG: currentDue + target.amountSDG,
        });
      }
    }
  };

  const deleteDeposit = async (id: string) => {
    const res = await maharaApi.deleteDeposit(id);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    const target = deposits.find(d => d.id === id);
    setDeposits(prev => prev.filter(d => d.id !== id));
    if (target && target.status === 'verified') {
      const provider = allUsers.find(u => u.id === target.providerId);
      if (provider) {
        await adminUpdateUser(provider.id, {
          pendingCommissionDueSDG: (provider.pendingCommissionDueSDG || 0) + target.amountSDG,
        });
      }
    }
  };

  const adminDeleteRequest = async (id: string) => {
    const res = await maharaApi.adminDeleteRequest(id);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const adminCancelRequest = async (id: string, reason: string) => {
    const res = await maharaApi.adminCancelRequest(id, reason);
    if (res.available) {
      if (res.ok) {
        await refreshFromServer();
      }
      return;
    }

    setRequests(prev =>
      prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            status: 'cancelled' as ServiceStatus,
            cancelledBy: 'provider',
            cancelReason: reason || 'تم الإلغاء بواسطة الإدارة العامة',
            cancelledAt: new Date().toLocaleString('ar-SD'),
          };
        }
        return r;
      })
    );
  };

  const addProviderService = async (
    providerId: string,
    categoryId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.addProviderService(providerId, categoryId);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إضافة الخدمة' };
      }
      setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
      if (currentUser?.id === providerId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    const targetUser = allUsers.find(u => u.id === providerId);
    if (!targetUser) return { success: false, error: 'مقدم الخدمة غير موجود' };

    const currentList =
      targetUser.serviceCategoryIds && targetUser.serviceCategoryIds.length > 0
        ? targetUser.serviceCategoryIds
        : ([targetUser.tradeCategoryId].filter(Boolean) as string[]);

    if (currentList.includes(categoryId)) {
      return { success: false, error: 'هذه الحرفة أو الخدمة مضافة بالفعل في قائمة خدماتك' };
    }

    const updatedList = [...currentList, categoryId];
    await adminUpdateUser(providerId, {
      serviceCategoryIds: updatedList,
      tradeCategoryId: targetUser.tradeCategoryId || categoryId,
    });

    return { success: true };
  };

  const removeProviderService = async (
    providerId: string,
    categoryId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.removeProviderService(providerId, categoryId);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل حذف الخدمة' };
      }
      setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
      if (currentUser?.id === providerId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    const targetUser = allUsers.find(u => u.id === providerId);
    if (!targetUser) return { success: false, error: 'مقدم الخدمة غير موجود' };

    const currentList =
      targetUser.serviceCategoryIds && targetUser.serviceCategoryIds.length > 0
        ? targetUser.serviceCategoryIds
        : ([targetUser.tradeCategoryId].filter(Boolean) as string[]);

    if (currentList.length <= 1) {
      return {
        success: false,
        error: 'لا يمكن حذف هذه الخدمة؛ يجب أن يقدم الحرفي خدمة واحدة على الأقل في حسابه.',
      };
    }

    const updatedList = currentList.filter(id => id !== categoryId);
    const nextPrimaryCategory =
      targetUser.tradeCategoryId === categoryId ? updatedList[0] : targetUser.tradeCategoryId;

    await adminUpdateUser(providerId, {
      serviceCategoryIds: updatedList,
      tradeCategoryId: nextPrimaryCategory,
    });

    return { success: true };
  };

  const suggestNewService = async (data: {
    nameAr: string;
    nameEn?: string;
    descriptionAr: string;
    descriptionEn?: string;
    suggestedRateSDG: number;
    iconName?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'يرجى تسجيل الدخول أولاً' };
    if (!data.nameAr.trim()) return { success: false, error: 'اسم الحرفة أو الخدمة بالعربية مطلوب' };

    const res = await maharaApi.suggestService(data);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إرسال الاقتراح' };
      }
      await refreshFromServer();
      return { success: true };
    }

    const newSuggestion: ServiceSuggestion = {
      id: `sug-${Date.now()}`,
      providerId: currentUser.id,
      providerName: currentUser.name,
      providerPhone: currentUser.phone,
      nameAr: data.nameAr.trim(),
      nameEn: (data.nameEn || data.nameAr).trim(),
      descriptionAr: data.descriptionAr.trim(),
      descriptionEn: (data.descriptionEn || data.descriptionAr).trim(),
      suggestedRateSDG: data.suggestedRateSDG || 25000,
      iconName: data.iconName || 'Wrench',
      status: 'pending',
      createdAt: new Date().toLocaleString('ar-SD'),
    };

    setServiceSuggestions(prev => [newSuggestion, ...prev]);
    return { success: true };
  };

  const approveServiceSuggestion = async (
    suggestionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.approveSuggestion(suggestionId);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل اعتماد الاقتراح' };
      }
      await refreshFromServer();
      return { success: true };
    }

    const suggestion = serviceSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return { success: false, error: 'الطلب المقترح غير موجود' };

    const newCatId = `cat_${Date.now()}`;
    const newCategory: ServiceCategory = {
      id: newCatId,
      nameAr: suggestion.nameAr,
      nameEn: suggestion.nameEn || suggestion.nameAr,
      iconName: suggestion.iconName || 'Wrench',
      descriptionAr: suggestion.descriptionAr,
      descriptionEn: suggestion.descriptionEn || suggestion.descriptionAr,
      averageRateSDG: suggestion.suggestedRateSDG,
      popularLocations: ['الخرطوم', 'أم درمان', 'بورتسودان'],
    };

    setCategories(prev => [...prev, newCategory]);
    await addProviderService(suggestion.providerId, newCatId);

    setServiceSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId
          ? {
              ...s,
              status: 'approved' as const,
              reviewedAt: new Date().toLocaleString('ar-SD'),
            }
          : s
      )
    );

    return { success: true };
  };

  const rejectServiceSuggestion = async (
    suggestionId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.rejectSuggestion(suggestionId, reason);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل رفض الاقتراح' };
      }
      await refreshFromServer();
      return { success: true };
    }

    setServiceSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId
          ? {
              ...s,
              status: 'rejected' as const,
              rejectionReason: reason || 'لم يتم استيفاء معايير التصنيف المعتمدة بالمنصة',
              reviewedAt: new Date().toLocaleString('ar-SD'),
            }
          : s
      )
    );
    return { success: true };
  };

  const addCustomService = async (
    providerId: string,
    serviceData: { nameAr: string; nameEn?: string; priceSDG: number; categoryId?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!serviceData.nameAr.trim()) return { success: false, error: 'اسم الخدمة مطلوب' };
    if (!serviceData.priceSDG || Number(serviceData.priceSDG) <= 0) {
      return { success: false, error: 'يرجى إدخال سعر صحيح للخدمة بالجنيه السوداني' };
    }

    const res = await maharaApi.addCustomService(providerId, serviceData);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إضافة الخدمة' };
      }
      setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
      if (currentUser?.id === providerId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    const targetUser = allUsers.find(u => u.id === providerId);
    if (!targetUser) return { success: false, error: 'مقدم الخدمة غير موجود' };

    const newService: ProviderCustomService = {
      id: `cs-${Date.now()}`,
      nameAr: serviceData.nameAr.trim(),
      nameEn: serviceData.nameEn?.trim() || serviceData.nameAr.trim(),
      priceSDG: Number(serviceData.priceSDG),
      categoryId: serviceData.categoryId || targetUser.tradeCategoryId || 'general',
    };

    const currentServices = targetUser.customServices || [];
    const updatedServices = [...currentServices, newService];

    await adminUpdateUser(providerId, { customServices: updatedServices });
    if (currentUser && currentUser.id === providerId) {
      await updateProfile({ customServices: updatedServices });
    }

    return { success: true };
  };

  const updateCustomService = async (
    providerId: string,
    serviceId: string,
    updates: Partial<ProviderCustomService>
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.updateCustomService(providerId, serviceId, updates);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل تحديث الخدمة' };
      }
      setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
      if (currentUser?.id === providerId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    const targetUser = allUsers.find(u => u.id === providerId);
    if (!targetUser) return { success: false, error: 'مقدم الخدمة غير موجود' };

    const currentServices = targetUser.customServices || [];
    const updatedServices = currentServices.map(s => (s.id === serviceId ? { ...s, ...updates } : s));

    await adminUpdateUser(providerId, { customServices: updatedServices });
    if (currentUser && currentUser.id === providerId) {
      await updateProfile({ customServices: updatedServices });
    }

    return { success: true };
  };

  const deleteCustomService = async (
    providerId: string,
    serviceId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await maharaApi.deleteCustomService(providerId, serviceId);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل حذف الخدمة' };
      }
      setAllUsers(prev => prev.map(u => (u.id === providerId ? res.data.user : u)));
      if (currentUser?.id === providerId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    const targetUser = allUsers.find(u => u.id === providerId);
    if (!targetUser) return { success: false, error: 'مقدم الخدمة غير موجود' };

    const currentServices = targetUser.customServices || [];
    const updatedServices = currentServices.filter(s => s.id !== serviceId);

    await adminUpdateUser(providerId, { customServices: updatedServices });
    if (currentUser && currentUser.id === providerId) {
      await updateProfile({ customServices: updatedServices });
    }

    return { success: true };
  };

  const submitServiceRating = async (
    requestId: string,
    rating: number,
    comment?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'يرجى تسجيل الدخول أولاً للتقييم' };
    if (rating < 1 || rating > 5) return { success: false, error: 'يرجى اختيار عدد النجوم من 1 إلى 5' };

    const res = await maharaApi.submitRating(requestId, rating, comment);
    if (res.available) {
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إرسال التقييم' };
      }
      await refreshFromServer();
      return { success: true };
    }

    const targetReq = requests.find(r => r.id === requestId);
    if (!targetReq) return { success: false, error: 'طلب الخدمة غير موجود' };

    if (targetReq.status !== 'completed') {
      return { success: false, error: 'يمكن تقييم الخدمات المكتملة فقط' };
    }

    const ratedAt = new Date().toLocaleString('ar-SD');

    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          clientRating: rating,
          clientReviewComment: comment?.trim() || undefined,
          ratedAt,
        };
      }
      return r;
    });

    setRequests(updatedRequests);

    const providerRatedRequests = updatedRequests.filter(
      r => r.providerId === targetReq.providerId && typeof r.clientRating === 'number'
    );

    const targetProvider = allUsers.find(u => u.id === targetReq.providerId);
    if (targetProvider) {
      const priorCount = targetProvider.reviewCount || 0;
      const totalStars = providerRatedRequests.reduce((acc, curr) => acc + (curr.clientRating || 0), 0);
      const newAverage = Number((totalStars / providerRatedRequests.length).toFixed(1));
      const newCount = Math.max(priorCount + 1, providerRatedRequests.length);

      await adminUpdateUser(targetReq.providerId, {
        rating: newAverage,
        reviewCount: newCount,
      });
    }

    return { success: true };
  };

  return (
    <AppContext.Provider
      value={{
        providers,
        categories,
        serviceSuggestions,
        requests,
        deposits,
        publicReviews,
        activeTab,
        setActiveTab,
        canGoBack,
        goBack,
        selectedProviderId,
        setSelectedProviderId,
        selectedCategoryId,
        setSelectedCategoryId,
        selectedCity,
        setSelectedCity,
        searchQuery,
        setSearchQuery,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        closeAuthModal,
        bookingModalProvider,
        setBookingModalProvider,
        bookingModalPreSelectedServiceId,
        setBookingModalPreSelectedServiceId,
        openBookingModal,
        closeBookingModal,
        bookService,
        cancelService,
        updateRequestStatus,
        submitServiceRating,
        submitThursdayDeposit,
        addPortfolioItem,
        toggleProviderAvailability,
        getProviderActiveServicesCount,
        addCategory,
        updateCategory,
        deleteCategory,
        verifyDeposit,
        deleteDeposit,
        adminDeleteRequest,
        adminCancelRequest,
        addProviderService,
        removeProviderService,
        addCustomService,
        updateCustomService,
        deleteCustomService,
        suggestNewService,
        approveServiceSuggestion,
        rejectServiceSuggestion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
