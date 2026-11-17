import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLanguage } from '../../context/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { language } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-rose-700 text-white px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] shadow-lg border-b border-rose-600"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-rose-100" />
          <div className="min-w-0">
            <p className="text-xs font-bold leading-snug" dir="ltr">
              We can&apos;t reach our network right now. Please check your connection
            </p>
            {language === 'ar' && (
              <p className="text-[11px] text-rose-100 mt-0.5">
                تعذر الوصول إلى الشبكة حالياً. يرجى التحقق من اتصال الإنترنت
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-bold shrink-0 cursor-pointer"
        >
          {language === 'ar' ? 'تحديث' : 'Retry'}
        </button>
      </div>
    </div>
  );
};
