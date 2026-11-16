export interface EmailValidationResult {
  isValid: boolean;
  cleanEmail: string;
  errorMessageAr?: string;
  errorMessageEn?: string;
}

export const normalizeEmail = (raw: string): string => {
  return raw.trim().toLowerCase();
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateEmail = (raw: string): EmailValidationResult => {
  const cleanEmail = normalizeEmail(raw);

  if (!cleanEmail) {
    return {
      isValid: false,
      cleanEmail: '',
      errorMessageAr: 'يرجى إدخال البريد الإلكتروني',
      errorMessageEn: 'Please enter your email address',
    };
  }

  if (cleanEmail.length > 191 || !EMAIL_REGEX.test(cleanEmail)) {
    return {
      isValid: false,
      cleanEmail,
      errorMessageAr: 'صيغة البريد الإلكتروني غير صحيحة (مثال: name@example.com)',
      errorMessageEn: 'Invalid email address format (e.g. name@example.com)',
    };
  }

  return {
    isValid: true,
    cleanEmail,
  };
};
