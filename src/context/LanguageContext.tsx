import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../types/i18n';

import { safeStorage } from '../utils/safeStorage';

interface LanguageContextType {
  language: Language;
  t: (key: keyof typeof translations['ar']) => string;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = safeStorage.getItem('mahara_lang');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
      safeStorage.setItem('mahara_lang', language);
    } catch {
      // Safe fallback
    }
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const t = (key: keyof typeof translations['ar']): string => {
    const dict = translations[language] || translations['ar'];
    return dict[key] || translations['ar'][key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, toggleLanguage, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
