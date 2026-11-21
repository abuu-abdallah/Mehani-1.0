import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole } from '../types';
import { validateSudanPhone, normalizePhoneForLookup, normalizeNumerals } from '../utils/phoneValidation';
import { validateEmail, normalizeEmail } from '../utils/emailValidation';
import { safeStorage } from '../utils/safeStorage';
import {
  BootstrapResponse,
  canUseLocalFallback,
  describeUnavailableApiError,
  getAuthToken,
  maharaApi,
  setAuthToken,
  tryTopLevelChallengeReloadOnce,
} from '../services/api';
import { useLanguage } from './LanguageContext';
import { clearBackgroundNotificationSession, setRealtimeCutoffMs } from '../services/nativeNotifications';

interface AuthContextType {
  currentUser: User | null;
  isGuest: boolean;
  isRemoteApi: boolean;
  latestBootstrap: BootstrapResponse | null;
  refreshFromServer: () => Promise<BootstrapResponse | null>;
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  registerCustomer: (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    state: string;
    city: string;
    neighborhood: string;
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  registerProvider: (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    state: string;
    city: string;
    neighborhood: string;
    tradeCategoryId: string;
    serviceCategoryIds?: string[];
    tradeTitleAr: string;
    tradeTitleEn: string;
    bioAr: string;
    basePriceSDG: number;
    nidUrl: string;
    nidNumber?: string;
    coveredNeighborhoods: string[];
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string; user?: User; isPendingApproval?: boolean }>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ success: boolean; error?: string; message?: string; devPreviewCode?: string }>;
  resetPassword: (data: {
    email: string;
    code: string;
    newPassword: string;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>;
  isLoggingOut: boolean;
  logoutSuccessVisible: boolean;
  dismissLogoutSuccess: () => void;
  continueAsGuest: () => void;
  switchUserRole: (newRole: UserRole) => void;
  adminAddUser: (user: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  adminUpdateUser: (id: string, updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  adminDeleteUser: (id: string) => Promise<void>;
  adminToggleUserActive: (id: string, reason?: string) => Promise<void>;
  providerReuploadNid: (
    userId: string,
    newNidUrl: string,
    newNidNumber?: string
  ) => Promise<{ success: boolean; error?: string }>;
  adminRequestNidReupload: (
    userId: string,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  allUsers: User[];
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  name: 'إدارة مهني - مدير النظام العام',
  phone: '0900000000',
  password: 'admin123',
  role: 'admin',
  avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
  state: 'الخرطوم',
  city: 'الخرطوم',
  neighborhood: 'المقرن',
  createdAt: '2025-01-01',
  isActive: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [isRemoteApi, setIsRemoteApi] = useState<boolean>(false);
  const [latestBootstrap, setLatestBootstrap] = useState<BootstrapResponse | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [logoutSuccessVisible, setLogoutSuccessVisible] = useState<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);
  const logoutBannerTimerRef = useRef<number | null>(null);

  const dismissLogoutSuccess = useCallback(() => {
    setLogoutSuccessVisible(false);
    if (logoutBannerTimerRef.current !== null) {
      window.clearTimeout(logoutBannerTimerRef.current);
      logoutBannerTimerRef.current = null;
    }
  }, []);

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    try {
      const parsed = safeStorage.getJSON<User[] | null>('mahara_users', null);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        let users = parsed;
        if (!users.some(u => u.role === 'admin' || u.phone === '0900000000')) {
          users = [DEFAULT_ADMIN, ...users];
        }
        return users;
      }
    } catch (e) {
      console.error('Failed to parse users', e);
    }
    // Seed only the default admin account cleanly (matching MySQL seed)
    return [DEFAULT_ADMIN];
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedId = safeStorage.getItem('mahara_current_user_id');
      const hasExplicitSession = safeStorage.getItem('mahara_session_authenticated') === 'true';
      if (savedId && hasExplicitSession) {
        const found = allUsers.find(u => u.id === savedId);
        if (found) return found;
      }
    } catch (e) {
      console.error('Failed to read saved user', e);
    }
    return null;
  });

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return safeStorage.getItem('mahara_is_guest') === 'true';
  });

  const applyBootstrapSnapshot = useCallback((data: BootstrapResponse) => {
    setLatestBootstrap(data);
    if (Array.isArray(data.users)) {
      setAllUsers(data.users);
    }
    if (data.currentUser) {
      setCurrentUser(data.currentUser);
      setIsGuest(false);
    } else if (getAuthToken()) {
      // Token expired or invalid on server -> clear stale token & prompt sign in
      setAuthToken(null);
      setCurrentUser(null);
    }
  }, []);

  const refreshFromServer = useCallback(async (): Promise<BootstrapResponse | null> => {
    const res = await maharaApi.bootstrap();
    if (res.available) {
      setIsRemoteApi(true);
      if (res.ok) {
        applyBootstrapSnapshot(res.data);
        return res.data;
      }
    } else if (res.error === 'HTML_CHALLENGE_OR_ERROR' && res.canAttemptCookieRefresh) {
      // Background bootstrap still saw a challenge even after hidden-iframe refresh;
      // fall back to a loop-guarded top-level page reload so WebView/browser refreshes __test.
      tryTopLevelChallengeReloadOnce();
    }
    return null;
  }, [applyBootstrapSnapshot]);

  // Hydrate from InfinityFree MySQL PHP bridge on initial mount
  useEffect(() => {
    void refreshFromServer();
  }, [refreshFromServer]);

  // Background polling while signed in so real-time status, cancellation, completion,
  // NID re-upload, and deposit re-upload notifications trigger automatically
  const isPollingRef = useRef<boolean>(false);
  useEffect(() => {
    if (!currentUser || isGuest) return;

    const safePoll = async () => {
      if (isPollingRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      isPollingRef.current = true;
      try {
        await refreshFromServer();
      } finally {
        isPollingRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void safePoll();
    }, 12000);

    const handleVisibilityOrOnline = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void safePoll();
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    };
  }, [currentUser?.id, isGuest, refreshFromServer]);

  useEffect(() => {
    // Only cache users locally when not in strict remote mode, or cache sanitized list
    if (!isRemoteApi) {
      safeStorage.setJSON('mahara_users', allUsers);
    }
  }, [allUsers, isRemoteApi]);

  useEffect(() => {
    if (currentUser) {
      safeStorage.setItem('mahara_current_user_id', currentUser.id);
      safeStorage.setItem('mahara_session_authenticated', 'true');
      safeStorage.setItem('mahara_is_guest', 'false');
      setIsGuest(false);
    } else {
      safeStorage.removeItem('mahara_current_user_id');
      safeStorage.removeItem('mahara_session_authenticated');
    }
  }, [currentUser]);

  const login = async (phone: string, password: string) => {
    const rawTrimmed = normalizeNumerals(phone).trim();
    const res = await maharaApi.login(rawTrimmed, password);

    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || (language === 'ar' ? 'فشل تسجيل الدخول' : 'Sign in failed') };
      }
      setAuthToken(res.data.token);
      dismissLogoutSuccess();
      setRealtimeCutoffMs(res.data.user.id, res.data.serverNowMs || Date.now());
      safeStorage.setItem('mahara_session_authenticated', 'true');
      setCurrentUser(res.data.user);
      setIsGuest(false);
      await refreshFromServer();
      return { success: true, user: res.data.user };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local fallback (only when Vite dev/preview serves raw api.php without PHP)
    const normalizedPhone = normalizePhoneForLookup(rawTrimmed);
    const normalizedEmail = rawTrimmed.includes('@') ? normalizeEmail(rawTrimmed) : '';
    const user = allUsers.find(u => {
      if (normalizedEmail && u.email && normalizeEmail(u.email) === normalizedEmail) {
        return true;
      }
      const uNorm = normalizePhoneForLookup(u.phone);
      return (normalizedPhone && uNorm === normalizedPhone) || u.phone === rawTrimmed;
    });

    if (!user) {
      return {
        success: false,
        error: normalizedEmail ? 'البريد الإلكتروني غير مسجل في مهني' : 'رقم الهاتف غير مسجل في مهني',
      };
    }

    if (user.password && user.password !== password) {
      return { success: false, error: 'كلمة المرور غير صحيحة' };
    }

    setRealtimeCutoffMs(user.id, Date.now());
    safeStorage.setItem('mahara_session_authenticated', 'true');
    setCurrentUser(user);
    setIsGuest(false);
    return { success: true, user };
  };

  const registerCustomer = async (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    state: string;
    city: string;
    neighborhood: string;
    avatarUrl?: string;
  }) => {
    const phoneValidation = validateSudanPhone(data.phone);
    if (!phoneValidation.isValid) {
      return { success: false, error: phoneValidation.errorMessageAr };
    }
    const cleanPhone = phoneValidation.cleanPhone;

    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.errorMessageAr };
    }
    const cleanEmail = emailValidation.cleanEmail;

    const res = await maharaApi.registerCustomer({ ...data, phone: cleanPhone, email: cleanEmail });
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || (language === 'ar' ? 'فشل التسجيل' : 'Registration failed') };
      }
      setAuthToken(res.data.token);
      setRealtimeCutoffMs(res.data.user.id, res.data.serverNowMs || Date.now());
      safeStorage.setItem('mahara_session_authenticated', 'true');
      setCurrentUser(res.data.user);
      setIsGuest(false);
      await refreshFromServer();
      return { success: true };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local fallback (dev/preview without PHP only)
    if (allUsers.some(u => u.phone === cleanPhone)) {
      return { success: false, error: 'رقم الهاتف مسجل بالفعل مسبقاً' };
    }
    if (allUsers.some(u => u.email && normalizeEmail(u.email) === cleanEmail)) {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل مسبقاً في حساب آخر' };
    }

    const newUser: User = {
      id: `c-${Date.now()}`,
      name: data.name,
      phone: cleanPhone,
      email: cleanEmail,
      password: data.password,
      role: 'customer',
      avatarUrl:
        data.avatarUrl ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true,
      unpaidCancellationFeeSDG: 0,
    };

    setRealtimeCutoffMs(newUser.id, Date.now());
    setAllUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    setIsGuest(false);
    return { success: true };
  };

  const registerProvider = async (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    state: string;
    city: string;
    neighborhood: string;
    tradeCategoryId: string;
    serviceCategoryIds?: string[];
    tradeTitleAr: string;
    tradeTitleEn: string;
    bioAr: string;
    basePriceSDG: number;
    nidUrl: string;
    nidNumber?: string;
    coveredNeighborhoods: string[];
    avatarUrl?: string;
  }) => {
    const phoneValidation = validateSudanPhone(data.phone);
    if (!phoneValidation.isValid) {
      return { success: false, error: phoneValidation.errorMessageAr };
    }
    const cleanPhone = phoneValidation.cleanPhone;

    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.errorMessageAr };
    }
    const cleanEmail = emailValidation.cleanEmail;

    const res = await maharaApi.registerProvider({ ...data, phone: cleanPhone, email: cleanEmail });
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || (language === 'ar' ? 'فشل تسجيل الحساب' : 'Account registration failed') };
      }
      setAuthToken(res.data.token);
      setRealtimeCutoffMs(res.data.user.id, res.data.serverNowMs || Date.now());
      safeStorage.setItem('mahara_session_authenticated', 'true');
      setCurrentUser(res.data.user);
      setIsGuest(false);
      await refreshFromServer();
      return {
        success: true,
        user: res.data.user,
        isPendingApproval: res.data.isPendingApproval ?? true,
      };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local fallback (dev/preview without PHP only)
    if (allUsers.some(u => u.phone === cleanPhone)) {
      return { success: false, error: 'رقم الهاتف مسجل بالفعل مسبقاً' };
    }
    if (allUsers.some(u => u.email && normalizeEmail(u.email) === cleanEmail)) {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل مسبقاً في حساب آخر' };
    }

    const assignedCategories =
      data.serviceCategoryIds && data.serviceCategoryIds.length > 0
        ? data.serviceCategoryIds
        : [data.tradeCategoryId].filter(Boolean);

    const newProvider: User = {
      id: `p-${Date.now()}`,
      name: data.name,
      phone: cleanPhone,
      email: cleanEmail,
      password: data.password,
      role: 'provider',
      avatarUrl:
        data.avatarUrl ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      createdAt: new Date().toISOString().split('T')[0],
      isActive: false,
      deactivatedReason: 'بانتظار مراجعة واعتماد الرقم الوطني أو جواز السفر من قبل إدارة المنصة',
      tradeCategoryId: data.tradeCategoryId,
      serviceCategoryIds: assignedCategories,
      tradeTitleAr: data.tradeTitleAr,
      tradeTitleEn: data.tradeTitleEn,
      bioAr: data.bioAr,
      basePriceSDG: data.basePriceSDG,
      pricingType: 'fixed',
      isAvailable: false,
      activeServicesCount: 0,
      rating: 5.0,
      reviewCount: 0,
      nidUrl: data.nidUrl,
      nidNumber: data.nidNumber || 'نسخة مستند مرفقة',
      nidStatus: 'pending',
      nidSubmittedAt: new Date().toISOString(),
      coveredNeighborhoods: data.coveredNeighborhoods,
      portfolio: [],
      totalEarningsSDG: 0,
      pendingCommissionDueSDG: 0,
    };

    setRealtimeCutoffMs(newProvider.id, Date.now());
    setAllUsers(prev => [...prev, newProvider]);
    setCurrentUser(newProvider);
    setIsGuest(false);
    return { success: true, user: newProvider, isPendingApproval: true };
  };

  const requestPasswordReset = async (email: string) => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.errorMessageAr };
    }
    const cleanEmail = emailValidation.cleanEmail;

    const res = await maharaApi.requestPasswordReset(cleanEmail);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || (language === 'ar' ? 'تعذر إرسال رمز الاستعادة' : 'Failed to send reset code') };
      }
      return { success: true, message: res.data.message };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local dev preview fallback when PHP bridge is unavailable
    const matchedUser = allUsers.find(
      u => u.email && normalizeEmail(u.email) === cleanEmail
    );
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (matchedUser) {
      safeStorage.setJSON(`mahara_dev_reset_${cleanEmail}`, {
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
        attempts: 0,
      });
    }
    return {
      success: true,
      message: 'تم إنشاء رمز تحقق مكون من 6 أرقام صالح لمدة 15 دقيقة.',
      devPreviewCode: matchedUser ? code : undefined,
    };
  };

  const resetPassword = async (data: { email: string; code: string; newPassword: string }) => {
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
      return { success: false, error: emailValidation.errorMessageAr };
    }
    const cleanEmail = emailValidation.cleanEmail;
    const cleanCode = data.code.replace(/\s+/g, '');
    if (!/^[0-9]{6}$/.test(cleanCode)) {
      return { success: false, error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام' };
    }
    if (data.newPassword.length < 6) {
      return { success: false, error: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل' };
    }

    const res = await maharaApi.resetPassword({
      email: cleanEmail,
      code: cleanCode,
      newPassword: data.newPassword,
    });
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || (language === 'ar' ? 'تعذر تحديث كلمة المرور' : 'Failed to update password') };
      }
      return { success: true, message: res.data.message };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local dev preview fallback
    const key = `mahara_dev_reset_${cleanEmail}`;
    const stored = safeStorage.getJSON<{ code: string; expiresAt: number; attempts: number } | null>(key, null);
    if (!stored) {
      return { success: false, error: 'لا يوجد رمز تحقق نشط لهذا البريد الإلكتروني' };
    }
    if (Date.now() > stored.expiresAt) {
      safeStorage.removeItem(key);
      return { success: false, error: 'انتهت صلاحية رمز التحقق (15 دقيقة). يرجى طلب رمز جديد.' };
    }
    if (stored.attempts >= 5) {
      return { success: false, error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد.' };
    }
    if (stored.code !== cleanCode) {
      safeStorage.setJSON(key, { ...stored, attempts: stored.attempts + 1 });
      return { success: false, error: 'رمز التحقق غير صحيح، يرجى التأكد والمحاولة مرة أخرى' };
    }

    setAllUsers(prev =>
      prev.map(u =>
        u.email && normalizeEmail(u.email) === cleanEmail
          ? { ...u, password: data.newPassword }
          : u
      )
    );
    safeStorage.removeItem(key);
    return {
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول برقم الهاتف وكلمة المرور الجديدة.',
    };
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return { success: false, error: 'غير مصرح' };

    const normalizedUpdates: Partial<User> = { ...updates };
    if (updates.email !== undefined) {
      const trimmedEmail = (updates.email || '').trim();
      if (trimmedEmail !== '') {
        const emailValidation = validateEmail(trimmedEmail);
        if (!emailValidation.isValid) {
          return { success: false, error: emailValidation.errorMessageAr };
        }
        normalizedUpdates.email = emailValidation.cleanEmail;
      } else if (currentUser.email) {
        return {
          success: false,
          error: 'لا يمكن إزالة البريد الإلكتروني المسجل؛ يمكنك تغييره إلى بريد إلكتروني آخر',
        };
      } else {
        delete normalizedUpdates.email;
      }
    }

    const res = await maharaApi.updateProfile(normalizedUpdates);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل تحديث الملف الشخصي' };
      }
      setCurrentUser(res.data.user);
      setAllUsers(prev => prev.map(u => (u.id === res.data.user.id ? res.data.user : u)));
      return { success: true };
    }

    if (
      normalizedUpdates.email &&
      allUsers.some(
        u =>
          u.id !== currentUser.id &&
          u.email &&
          normalizeEmail(u.email) === normalizedUpdates.email
      )
    ) {
      return { success: false, error: 'البريد الإلكتروني مسجل لمستخدم آخر بالفعل' };
    }

    const updated: User = { ...currentUser, ...normalizedUpdates };
    if (updated.role === 'provider' && normalizedUpdates.tradeCategoryId) {
      const existingIds = updated.serviceCategoryIds && updated.serviceCategoryIds.length > 0
        ? updated.serviceCategoryIds
        : [];
      if (!existingIds.includes(normalizedUpdates.tradeCategoryId)) {
        updated.serviceCategoryIds = [normalizedUpdates.tradeCategoryId, ...existingIds];
      }
    }
    setCurrentUser(updated);
    setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
    return { success: true };
  };

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);

    try {
      clearBackgroundNotificationSession();
      const token = getAuthToken();
      if (token && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        try {
          await maharaApi.logout();
        } catch {
          // Proceed with local session teardown regardless of network state
        }
      }
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setIsGuest(false);
      safeStorage.removeItem('mahara_current_user_id');
      safeStorage.removeItem('mahara_session_authenticated');
      safeStorage.removeItem('mahara_is_guest');

      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
      setLogoutSuccessVisible(true);
      if (logoutBannerTimerRef.current !== null) {
        window.clearTimeout(logoutBannerTimerRef.current);
      }
      logoutBannerTimerRef.current = window.setTimeout(() => {
        setLogoutSuccessVisible(false);
        logoutBannerTimerRef.current = null;
      }, 4500);

      if (isRemoteApi) {
        void refreshFromServer();
      }
    }
  }, [isRemoteApi, refreshFromServer]);

  const deleteAccount = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return {
        success: false,
        error: language === 'ar' ? 'لا يوجد حساب مسجل حالياً' : 'No signed-in account found',
      };
    }

    const res = await maharaApi.deleteOwnAccount(password);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return {
          success: false,
          error: res.error || (language === 'ar' ? 'تعذر حذف الحساب' : 'Failed to delete account'),
        };
      }

      clearBackgroundNotificationSession();
      setAuthToken(null);
      setAllUsers(prev => prev.filter(u => u.id !== currentUser.id));
      setCurrentUser(null);
      setIsGuest(false);
      safeStorage.removeItem('mahara_current_user_id');
      safeStorage.removeItem('mahara_session_authenticated');
      safeStorage.removeItem('mahara_is_guest');
      void refreshFromServer();
      return { success: true };
    }

    if (!canUseLocalFallback(res.error, isRemoteApi)) {
      return { success: false, error: describeUnavailableApiError(res.error, language) };
    }

    // Local preview fallback
    if (currentUser.role === 'admin') {
      return {
        success: false,
        error: language === 'ar' ? 'لا يمكن حذف حساب مدير النظام العام' : 'Admin account cannot be self-deleted',
      };
    }
    if (currentUser.password && currentUser.password !== password) {
      return {
        success: false,
        error: language === 'ar' ? 'كلمة المرور غير صحيحة' : 'Incorrect password',
      };
    }
    if ((currentUser.unpaidCancellationFeeSDG || 0) > 0 || (currentUser.pendingCommissionDueSDG || 0) > 0) {
      return {
        success: false,
        error:
          language === 'ar'
            ? 'توجد مستحقات مالية أو عمولات أو غرامات إلغاء غير مسددة على الحساب. يرجى تسويتها قبل الحذف.'
            : 'Unsettled commissions or cancellation penalties must be resolved before deleting your account.',
      };
    }

    clearBackgroundNotificationSession();
    setAuthToken(null);
    setAllUsers(prev => prev.filter(u => u.id !== currentUser.id));
    setCurrentUser(null);
    setIsGuest(false);
    safeStorage.removeItem('mahara_current_user_id');
    safeStorage.removeItem('mahara_session_authenticated');
    safeStorage.removeItem('mahara_is_guest');
    return { success: true };
  }, [currentUser, isRemoteApi, language, refreshFromServer]);

  const continueAsGuest = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setIsGuest(true);
    safeStorage.removeItem('mahara_current_user_id');
    safeStorage.removeItem('mahara_session_authenticated');
    safeStorage.setItem('mahara_is_guest', 'true');
  };

  const switchUserRole = (newRole: UserRole) => {
    if (!currentUser) return;
    const updates: Partial<User> = {
      role: newRole,
      ...(newRole === 'provider' && !currentUser.tradeCategoryId
        ? {
            tradeCategoryId: 'electrician_ac',
            tradeTitleAr: 'فني كهرباء وصيانة منزلية',
            tradeTitleEn: 'Home Electrical Technician',
            basePriceSDG: 20000,
            activeServicesCount: 0,
            pendingCommissionDueSDG: 0,
            totalEarningsSDG: 0,
            nidNumber: '109-1990-11223',
            coveredNeighborhoods: [currentUser.neighborhood || 'الرياض'],
          }
        : {}),
    };
    const updated: User = { ...currentUser, ...updates };
    setCurrentUser(updated);
    setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
  };

  const adminAddUser = async (userData: Partial<User>) => {
    const phoneValidation = validateSudanPhone(userData.phone || '');
    if (!phoneValidation.isValid) {
      return { success: false, error: phoneValidation.errorMessageAr };
    }
    const cleanPhone = phoneValidation.cleanPhone;

    let cleanEmail: string | undefined;
    if (userData.email && userData.email.trim() !== '') {
      const emailValidation = validateEmail(userData.email);
      if (!emailValidation.isValid) {
        return { success: false, error: emailValidation.errorMessageAr };
      }
      cleanEmail = emailValidation.cleanEmail;
    }

    const res = await maharaApi.adminAddUser({ ...userData, phone: cleanPhone, email: cleanEmail });
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || 'فشلت إضافة المستخدم' };
      }
      setAllUsers(prev => [res.data.user, ...prev]);
      return { success: true };
    }

    if (allUsers.some(u => u.phone === cleanPhone)) {
      return { success: false, error: 'رقم الهاتف مسجل بالفعل مسبقاً' };
    }
    if (cleanEmail && allUsers.some(u => u.email && normalizeEmail(u.email) === cleanEmail)) {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل مسبقاً في حساب آخر' };
    }

    const assignedCategories =
      userData.serviceCategoryIds && userData.serviceCategoryIds.length > 0
        ? userData.serviceCategoryIds
        : userData.tradeCategoryId
        ? [userData.tradeCategoryId]
        : [];

    const newUser: User = {
      id:
        userData.role === 'provider'
          ? `p-${Date.now()}`
          : userData.role === 'admin'
          ? `admin-${Date.now()}`
          : `c-${Date.now()}`,
      name: userData.name || 'مستخدم جديد',
      phone: cleanPhone,
      email: cleanEmail,
      password: userData.password || 'password123',
      role: userData.role || 'customer',
      avatarUrl:
        userData.avatarUrl ||
        (userData.role === 'provider'
          ? '/src/assets/images/mahara_trades_hero_1791698414128.jpg'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'),
      state: userData.state || 'الخرطوم',
      city: userData.city || 'الخرطوم',
      neighborhood: userData.neighborhood || 'الرياض',
      createdAt: new Date().toISOString().split('T')[0],
      tradeCategoryId: userData.tradeCategoryId,
      serviceCategoryIds: assignedCategories,
      tradeTitleAr: userData.tradeTitleAr,
      tradeTitleEn: userData.tradeTitleEn,
      bioAr: userData.bioAr,
      basePriceSDG: userData.basePriceSDG || (userData.role === 'provider' ? 25000 : undefined),
      pricingType: 'fixed',
      isAvailable: userData.isAvailable ?? true,
      activeServicesCount: 0,
      rating: userData.rating || 5.0,
      reviewCount: userData.reviewCount || 0,
      nidUrl: userData.nidUrl,
      nidNumber: userData.nidNumber,
      coveredNeighborhoods: userData.coveredNeighborhoods || [userData.neighborhood || 'الرياض'],
      portfolio: userData.portfolio || [],
      totalEarningsSDG: 0,
      pendingCommissionDueSDG: 0,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      deactivatedReason: userData.deactivatedReason,
    };

    setAllUsers(prev => [newUser, ...prev]);
    return { success: true };
  };

  const adminUpdateUser = async (id: string, updates: Partial<User>) => {
    const normalizedUpdates: Partial<User> = { ...updates };
    if (updates.email !== undefined) {
      const trimmedEmail = (updates.email || '').trim();
      if (trimmedEmail !== '') {
        const emailValidation = validateEmail(trimmedEmail);
        if (!emailValidation.isValid) {
          return { success: false, error: emailValidation.errorMessageAr };
        }
        normalizedUpdates.email = emailValidation.cleanEmail;
      } else {
        normalizedUpdates.email = undefined;
      }
    }

    const res = await maharaApi.adminUpdateUser(id, normalizedUpdates);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل تحديث المستخدم' };
      }
      setAllUsers(prev => prev.map(u => (u.id === id ? res.data.user : u)));
      if (currentUser?.id === id) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    if (
      normalizedUpdates.email &&
      allUsers.some(
        u => u.id !== id && u.email && normalizeEmail(u.email) === normalizedUpdates.email
      )
    ) {
      return { success: false, error: 'البريد الإلكتروني مسجل لمستخدم آخر بالفعل' };
    }

    setAllUsers(prev => prev.map(u => (u.id === id ? { ...u, ...normalizedUpdates } : u)));
    if (currentUser?.id === id) {
      setCurrentUser(prev => (prev ? { ...prev, ...normalizedUpdates } : null));
    }
    return { success: true };
  };

  const adminDeleteUser = async (id: string) => {
    const res = await maharaApi.adminDeleteUser(id);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) return;
    }
    setAllUsers(prev => prev.filter(u => u.id !== id));
    if (currentUser?.id === id) {
      void logout();
    }
  };

  const adminToggleUserActive = async (id: string, reason?: string) => {
    const res = await maharaApi.adminToggleUserActive(id, reason);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) return;
    }

    setAllUsers(prev =>
      prev.map(u => {
        if (u.id === id) {
          const isCurrentlyActive = u.isActive !== false;
          const nextActive = !isCurrentlyActive;
          return {
            ...u,
            isActive: nextActive,
            deactivatedReason: nextActive
              ? undefined
              : reason || 'تم تعطيل الحساب من قِبل إدارة المنصة',
          };
        }
        return u;
      })
    );

    if (currentUser?.id === id) {
      setCurrentUser(prev => {
        if (!prev) return null;
        const isCurrentlyActive = prev.isActive !== false;
        const nextActive = !isCurrentlyActive;
        return {
          ...prev,
          isActive: nextActive,
          deactivatedReason: nextActive
            ? undefined
            : reason || 'تم تعطيل الحساب من قِبل إدارة المنصة',
        };
      });
    }
  };

  const adminRequestNidReupload = async (userId: string, reason: string) => {
    const cleanReason =
      reason.trim() ||
      'المستند المرفق غير واضح أو غير مطابق، يرجى إعادة رفع صورة واضحة للرقم الوطني أو جواز السفر';

    const res = await maharaApi.adminRequestNidReupload(userId, cleanReason);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إرسال طلب إعادة الرفع' };
      }
    }

    setAllUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            isActive: false,
            nidStatus: 'reupload_requested',
            nidRejectionReason: cleanReason,
            deactivatedReason: cleanReason,
          };
        }
        return u;
      })
    );

    if (currentUser?.id === userId) {
      setCurrentUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          isActive: false,
          nidStatus: 'reupload_requested',
          nidRejectionReason: cleanReason,
          deactivatedReason: cleanReason,
        };
      });
    }

    return { success: true };
  };

  const providerReuploadNid = async (
    userId: string,
    newNidUrl: string,
    newNidNumber?: string
  ) => {
    if (!newNidUrl) {
      return { success: false, error: 'يرجى إرفاق صورة المستند الجديد' };
    }

    const res = await maharaApi.providerReuploadNid(userId, newNidUrl, newNidNumber);
    if (res.available) {
      setIsRemoteApi(true);
      if (!res.ok) {
        return { success: false, error: res.error || 'فشل إرسال المستند الجديد' };
      }
      setAllUsers(prev => prev.map(u => (u.id === userId ? res.data.user : u)));
      if (currentUser?.id === userId) {
        setCurrentUser(res.data.user);
      }
      return { success: true };
    }

    setAllUsers(prev =>
      prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            nidUrl: newNidUrl,
            nidNumber: newNidNumber || u.nidNumber || 'مستند هوية محدث',
            nidStatus: 'pending',
            nidSubmittedAt: new Date().toISOString(),
            isActive: false,
            deactivatedReason: 'تم استلام صورة الرقم الوطني / جواز السفر المحدثة وهي قيد مراجعة وتدقيق الإدارة',
          };
        }
        return u;
      })
    );

    if (currentUser?.id === userId) {
      setCurrentUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          nidUrl: newNidUrl,
          nidNumber: newNidNumber || prev.nidNumber || 'مستند هوية محدث',
          nidStatus: 'pending',
          nidSubmittedAt: new Date().toISOString(),
          isActive: false,
          deactivatedReason: 'تم استلام صورة الرقم الوطني / جواز السفر المحدثة وهي قيد مراجعة وتدقيق الإدارة',
        };
      });
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isGuest,
        isRemoteApi,
        latestBootstrap,
        refreshFromServer,
        login,
        registerCustomer,
        registerProvider,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        logout,
        deleteAccount,
        isLoggingOut,
        logoutSuccessVisible,
        dismissLogoutSuccess,
        continueAsGuest,
        switchUserRole,
        adminAddUser,
        adminUpdateUser,
        adminDeleteUser,
        adminToggleUserActive,
        adminRequestNidReupload,
        providerReuploadNid,
        allUsers,
        setAllUsers,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
