import {
  PortfolioItem,
  ProviderCustomService,
  ServiceCategory,
  ServiceRequest,
  ServiceStatus,
  ServiceSuggestion,
  ThursdayCommissionDeposit,
  User,
} from '../types';
import { safeStorage } from '../utils/safeStorage';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api.php';
const TOKEN_STORAGE_KEY = 'mahara_auth_token';

export interface PublicReviewRecord {
  id: string;
  provider_id: string;
  client_name: string;
  client_rating: number;
  client_review_comment: string | null;
  rated_at: string | null;
}

export interface BootstrapResponse {
  ok: boolean;
  currentUser: User | null;
  users: User[];
  categories: ServiceCategory[];
  requests: ServiceRequest[];
  deposits: ThursdayCommissionDeposit[];
  serviceSuggestions: ServiceSuggestion[];
  activeCountsByProvider: Record<string, number>;
  publicReviews: PublicReviewRecord[];
}

export type ApiCallResult<T> =
  | { available: true; ok: true; data: T; status: number }
  | { available: true; ok: false; error: string; status: number }
  | { available: false; error?: string };

export const getAuthToken = (): string | null => {
  return safeStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setAuthToken = (token: string | null): void => {
  if (token) {
    safeStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    safeStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

/**
 * Local storage fallback is strictly limited to non-PHP dev/preview environments
 * (e.g. localhost Vite dev server or AI Studio *.run.app preview).
 * On production domains like mehani.gt.tc and in Capacitor APKs, MySQL via api.php is authoritative.
 */
export function isLocalPreviewOnlyEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (isCapacitor) return false;
  const host = (window.location.hostname || '').toLowerCase();
  if (!host || host === 'mehani.gt.tc' || host.endsWith('.mehani.gt.tc')) {
    return false;
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.run.app')
  );
}

export function canUseLocalFallback(
  apiError?: string,
  isRemoteAlreadyConfirmed?: boolean
): boolean {
  if (isRemoteAlreadyConfirmed) return false;
  return apiError === 'PHP_NOT_EXECUTING' && isLocalPreviewOnlyEnvironment();
}

export function describeUnavailableApiError(
  apiError?: string,
  language: 'ar' | 'en' = 'ar'
): string {
  if (language === 'en') {
    switch (apiError) {
      case 'HTML_CHALLENGE_OR_ERROR':
        return 'The server returned an unexpected page instead of database data. Please reload the page and try again.';
      case 'NETWORK_UNREACHABLE':
        return 'Unable to reach the Mehani database server. Please check your internet connection and try again.';
      default:
        return 'Database server connection failed temporarily. Please verify your connection or try again in a moment.';
    }
  }

  switch (apiError) {
    case 'HTML_CHALLENGE_OR_ERROR':
      return 'استجاب الخادم بصفحة غير متوقعة بدلاً من قاعدة البيانات (قد يكون فحص حماية أو ملف api.php غير محدث). يرجى تحديث الصفحة والمحاولة مرة أخرى.';
    case 'NETWORK_UNREACHABLE':
      return 'تعذر الاتصال بخادم قاعدة بيانات مهني. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
    default:
      return 'تعذر التحقق من الحساب عبر خادم قاعدة البيانات حالياً. يرجى تحديث الصفحة أو المحاولة بعد لحظات.';
  }
}

async function executeApiFetch<T>(
  action: string,
  payload?: unknown
): Promise<ApiCallResult<T>> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
    }

    const url = `${API_BASE_URL}?action=${encodeURIComponent(action)}`;
    const response = await fetch(url, {
      method: payload !== undefined ? 'POST' : 'GET',
      headers,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (trimmed.startsWith('<?php')) {
      return { available: false, error: 'PHP_NOT_EXECUTING' };
    }

    if (trimmed === '') {
      return { available: false, error: 'EMPTY_RESPONSE' };
    }

    // Detect InfinityFree anti-bot HTML challenge (aes.js / __test) or HTML error pages
    if (
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html') ||
      trimmed.includes('aes.js') ||
      trimmed.includes('__test') ||
      (!contentType.includes('application/json') && !trimmed.startsWith('{'))
    ) {
      return { available: false, error: 'HTML_CHALLENGE_OR_ERROR' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { available: false, error: 'INVALID_JSON_RESPONSE' };
    }

    if (!parsed || typeof parsed.ok !== 'boolean') {
      return { available: false, error: 'UNEXPECTED_RESPONSE_FORMAT' };
    }

    if (!response.ok || !parsed.ok) {
      return {
        available: true,
        ok: false,
        error: parsed.error || 'حدث خطأ أثناء تنفيذ العملية',
        status: response.status,
      };
    }

    return {
      available: true,
      ok: true,
      data: parsed as T,
      status: response.status,
    };
  } catch {
    return { available: false, error: 'NETWORK_UNREACHABLE' };
  }
}

export async function callApi<T = Record<string, any>>(
  action: string,
  payload?: unknown
): Promise<ApiCallResult<T>> {
  const firstAttempt = await executeApiFetch<T>(action, payload);
  if (firstAttempt.available || firstAttempt.error === 'PHP_NOT_EXECUTING') {
    return firstAttempt;
  }

  // Retry once after a short delay to recover from transient InfinityFree / mobile network hiccups
  await new Promise(resolve => setTimeout(resolve, 400));
  return executeApiFetch<T>(action, payload);
}

export const maharaApi = {
  bootstrap: () => callApi<BootstrapResponse>('bootstrap'),

  login: (phone: string, password: string) =>
    callApi<{ ok: true; token: string; user: User }>('auth_login', { phone, password }),

  registerCustomer: (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    state: string;
    city: string;
    neighborhood: string;
    avatarUrl?: string;
  }) =>
    callApi<{ ok: true; token: string; user: User }>('auth_register_customer', data),

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
  }) =>
    callApi<{ ok: true; token: string; isPendingApproval: boolean; user: User }>(
      'auth_register_provider',
      data
    ),

  requestPasswordReset: (email: string) =>
    callApi<{ ok: true; message: string }>('auth_request_password_reset', { email }),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    callApi<{ ok: true; message: string }>('auth_reset_password', data),

  updateProfile: (updates: Partial<User>) =>
    callApi<{ ok: true; user: User }>('update_profile', updates),

  providerReuploadNid: (userId: string, newNidUrl: string, newNidNumber?: string) =>
    callApi<{ ok: true; user: User }>('provider_reupload_nid', {
      userId,
      newNidUrl,
      newNidNumber,
    }),

  toggleAvailability: (providerId: string) =>
    callApi<{ ok: true; user: User }>('toggle_availability', { providerId }),

  addPortfolio: (providerId: string, item: Omit<PortfolioItem, 'id'>) =>
    callApi<{ ok: true; id: string }>('add_portfolio', { providerId, ...item }),

  addProviderService: (providerId: string, categoryId: string) =>
    callApi<{ ok: true; user: User }>('add_provider_service', { providerId, categoryId }),

  removeProviderService: (providerId: string, categoryId: string) =>
    callApi<{ ok: true; user: User }>('remove_provider_service', { providerId, categoryId }),

  addCustomService: (
    providerId: string,
    service: { nameAr: string; nameEn?: string; priceSDG: number; categoryId?: string }
  ) =>
    callApi<{ ok: true; id: string; user: User }>('add_custom_service', {
      providerId,
      ...service,
    }),

  updateCustomService: (
    providerId: string,
    serviceId: string,
    updates: Partial<ProviderCustomService>
  ) =>
    callApi<{ ok: true; user: User }>('update_custom_service', {
      providerId,
      serviceId,
      ...updates,
    }),

  deleteCustomService: (providerId: string, serviceId: string) =>
    callApi<{ ok: true; user: User }>('delete_custom_service', { providerId, serviceId }),

  bookService: (data: {
    providerId: string;
    scheduledTimeNote: string;
    addressDetails: string;
    city: string;
    neighborhood: string;
    problemDescription: string;
    agreedPriceSDG: number;
    selectedServiceItemIds?: string[];
    selectedServiceNames?: string[];
  }) => callApi<{ ok: true; request: ServiceRequest }>('book_service', data),

  cancelService: (requestId: string, reason: string) =>
    callApi<{ ok: true; penaltyAmount: number }>('cancel_service', { requestId, reason }),

  updateRequestStatus: (
    requestId: string,
    newStatus: ServiceStatus,
    paymentMethod?: 'cash' | 'bankak' | 'fawry'
  ) =>
    callApi<{ ok: true }>('update_request_status', {
      requestId,
      newStatus,
      paymentMethod,
    }),

  submitRating: (requestId: string, rating: number, comment?: string) =>
    callApi<{ ok: true; rating: number; reviewCount: number }>('submit_rating', {
      requestId,
      rating,
      comment,
    }),

  submitDeposit: (data: {
    amountSDG: number;
    depositDate: string;
    bankakReferenceNumber: string;
    receiptFileUrl: string;
    notes?: string;
    resubmitDepositId?: string;
  }) => callApi<{ ok: true; id: string }>('submit_deposit', data),

  suggestService: (data: {
    nameAr: string;
    nameEn?: string;
    descriptionAr: string;
    descriptionEn?: string;
    suggestedRateSDG: number;
    iconName?: string;
  }) => callApi<{ ok: true; id: string }>('suggest_service', data),

  // Admin endpoints
  adminAddUser: (user: Partial<User>) =>
    callApi<{ ok: true; user: User }>('admin_add_user', user),

  adminUpdateUser: (id: string, updates: Partial<User>) =>
    callApi<{ ok: true; user: User }>('admin_update_user', { id, updates }),

  adminDeleteUser: (id: string) =>
    callApi<{ ok: true }>('admin_delete_user', { id }),

  adminToggleUserActive: (id: string, reason?: string) =>
    callApi<{ ok: true }>('admin_toggle_user_active', { id, reason }),

  adminRequestNidReupload: (userId: string, reason: string) =>
    callApi<{ ok: true }>('admin_request_nid_reupload', { userId, reason }),

  addCategory: (category: Omit<ServiceCategory, 'id'>) =>
    callApi<{ ok: true; id: string }>('add_category', category),

  updateCategory: (id: string, updates: Partial<ServiceCategory>) =>
    callApi<{ ok: true }>('update_category', { id, updates }),

  deleteCategory: (id: string) =>
    callApi<{ ok: true }>('delete_category', { id }),

  verifyDeposit: (
    id: string,
    status: 'verified' | 'pending_verification' | 'rejected',
    rejectionReason?: string
  ) => callApi<{ ok: true }>('verify_deposit', { id, status, rejectionReason }),

  deleteDeposit: (id: string) =>
    callApi<{ ok: true }>('delete_deposit', { id }),

  adminDeleteRequest: (id: string) =>
    callApi<{ ok: true }>('admin_delete_request', { id }),

  adminCancelRequest: (id: string, reason: string) =>
    callApi<{ ok: true }>('admin_cancel_request', { id, reason }),

  approveSuggestion: (suggestionId: string) =>
    callApi<{ ok: true; categoryId: string }>('approve_suggestion', { suggestionId }),

  rejectSuggestion: (suggestionId: string, reason?: string) =>
    callApi<{ ok: true }>('reject_suggestion', { suggestionId, reason }),
};
