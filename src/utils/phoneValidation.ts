/**
 * Sudanese Phone Number Validation and Formatting Utilities
 *
 * Requirements:
 * - Total number of digits must be exactly 10 digits (local format e.g. 09xxxxxxxx or 01xxxxxxxx).
 * - Must begin with one of the authorized Sudanese telecom operator codes:
 *   - Zain (زين): 090, 091, 096
 *   - MTN (إم تي إن): 092, 093, 099
 *   - Sudani (سوداني): 010, 011, 012, 019
 */

export interface SudanOperatorInfo {
  code: 'zain' | 'mtn' | 'sudani';
  nameAr: string;
  nameEn: string;
  badgeBg: string;
  badgeText: string;
  prefixes: string[];
}

export const SUDAN_OPERATORS: Record<'zain' | 'mtn' | 'sudani', SudanOperatorInfo> = {
  zain: {
    code: 'zain',
    nameAr: 'زين (Zain)',
    nameEn: 'Zain',
    badgeBg: 'bg-teal-50 border-teal-200 text-teal-800',
    badgeText: 'text-teal-700',
    prefixes: ['090', '091', '096'],
  },
  mtn: {
    code: 'mtn',
    nameAr: 'إم تي إن (MTN)',
    nameEn: 'MTN',
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
    badgeText: 'text-amber-700',
    prefixes: ['092', '093', '099'],
  },
  sudani: {
    code: 'sudani',
    nameAr: 'سوداني (Sudani)',
    nameEn: 'Sudani',
    badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
    badgeText: 'text-blue-700',
    prefixes: ['010', '011', '012', '019'],
  },
};

/**
 * Normalizes input phone to a pure 10-digit format if it includes +249, 00249, dashes, spaces.
 */
export function normalizeSudanPhone(input: string): string {
  if (!input) return '';
  let cleaned = input.replace(/[\s\-\(\)\.]/g, '');

  // Convert international prefixes +249 or 00249 or 249 to local 0-prefixed
  if (cleaned.startsWith('+249')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('00249')) {
    cleaned = '0' + cleaned.slice(5);
  } else if (cleaned.startsWith('249') && cleaned.length > 9) {
    cleaned = '0' + cleaned.slice(3);
  }

  return cleaned;
}

/**
 * Detects which operator a phone number belongs to based on its prefix.
 */
export function detectSudanOperator(phone: string): SudanOperatorInfo | null {
  const normalized = normalizeSudanPhone(phone);
  if (normalized.length < 3) return null;

  const prefix3 = normalized.slice(0, 3);

  if (SUDAN_OPERATORS.zain.prefixes.includes(prefix3)) {
    return SUDAN_OPERATORS.zain;
  }
  if (SUDAN_OPERATORS.mtn.prefixes.includes(prefix3)) {
    return SUDAN_OPERATORS.mtn;
  }
  if (SUDAN_OPERATORS.sudani.prefixes.includes(prefix3)) {
    return SUDAN_OPERATORS.sudani;
  }

  return null;
}

export interface SudanPhoneValidationResult {
  isValid: boolean;
  cleanPhone: string;
  operator: SudanOperatorInfo | null;
  errorMessageAr?: string;
  errorMessageEn?: string;
}

/**
 * Strict validator for Sudanese 10-digit mobile numbers matching Zain, MTN, or Sudani.
 */
export function validateSudanPhone(input: string): SudanPhoneValidationResult {
  const cleanPhone = normalizeSudanPhone(input);

  if (!cleanPhone) {
    return {
      isValid: false,
      cleanPhone: '',
      operator: null,
      errorMessageAr: 'يرجى إدخال رقم الهاتف',
      errorMessageEn: 'Please enter a phone number',
    };
  }

  // Must only contain digits
  if (!/^\d+$/.test(cleanPhone)) {
    return {
      isValid: false,
      cleanPhone,
      operator: null,
      errorMessageAr: 'رقم الهاتف يجب أن يحتوي على أرقام فقط',
      errorMessageEn: 'Phone number must contain digits only',
    };
  }

  // Check 10-digit length requirement
  if (cleanPhone.length !== 10) {
    return {
      isValid: false,
      cleanPhone,
      operator: detectSudanOperator(cleanPhone),
      errorMessageAr: `يجب أن يتكون رقم الهاتف من 10 أرقام تماماً (المدخل حالياً ${cleanPhone.length} أرقام)`,
      errorMessageEn: `Phone number must be exactly 10 digits (currently ${cleanPhone.length} digits)`,
    };
  }

  // Check operator prefix
  const operator = detectSudanOperator(cleanPhone);
  if (!operator) {
    return {
      isValid: false,
      cleanPhone,
      operator: null,
      errorMessageAr: 'يجب أن يبدأ الرقم بمفتاح مشغل سوداني صالح: زين (090, 091, 096)، إم تي إن (092, 093, 099)، أو سوداني (010, 011, 012, 019)',
      errorMessageEn: 'Phone must start with a valid Sudanese operator: Zain (090, 091, 096), MTN (092, 093, 099), or Sudani (010, 011, 012, 019)',
    };
  }

  return {
    isValid: true,
    cleanPhone,
    operator,
  };
}
