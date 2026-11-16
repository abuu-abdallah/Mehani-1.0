import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLanguage } from '../../context/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { language } = useLanguage();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] start-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg border border-amber-400">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {language === 'ar'
          ? 'وضع عدم الاتصال — يتم عرض البيانات المحفوظة'
          : 'Offline Mode — Showing cached content'}
      </span>
    </div>
  );
};
