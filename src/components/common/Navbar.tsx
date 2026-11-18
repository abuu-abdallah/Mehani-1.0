import React from 'react';
import { 
  Home, 
  Search, 
  Clock, 
  Wallet, 
  User as UserIcon, 
  Globe, 
  LogIn,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Bell,
  Sun,
  Moon
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationInboxModal } from './NotificationInboxModal';

export const Navbar: React.FC = () => {
  const { t, language, dir, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, isGuest } = useAuth();
  const { 
    activeTab, 
    setActiveTab, 
    selectedProviderId, 
    setSelectedProviderId, 
    canGoBack,
    goBack,
    requests,
    deposits,
    unreadNotificationsCount,
    showNotificationInbox,
    setShowNotificationInbox,
    setShowAuthModal,
    setAuthModalMode
  } = useApp();

  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const rejectedDepositsCount = currentUser?.role === 'provider'
    ? deposits.filter(d => d.providerId === currentUser.id && d.status === 'rejected').length
    : 0;

  // Active requests counter for badge
  const pendingRequestsCount = currentUser
    ? requests.filter(r => 
        (currentUser.role === 'customer' && r.clientId === currentUser.id && (r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress')) ||
        (currentUser.role === 'provider' && r.providerId === currentUser.id && (r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress'))
      ).length
    : 0;

  const handleTabChange = (tab: typeof activeTab) => {
    setSelectedProviderId(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 shadow-sm transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          
          {/* Zone 1: Navigation Back Button & Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3">
            {canGoBack && (
              <button 
                onClick={goBack}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 font-bold text-xs border border-slate-700/80 transition-all cursor-pointer shadow-xs shrink-0 group"
                title={language === 'ar' ? 'الرجوع للخلف' : 'Go Back'}
                aria-label={language === 'ar' ? 'الرجوع للخلف' : 'Go Back'}
              >
                <BackArrowIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
                <span className="hidden sm:inline font-bold">{language === 'ar' ? 'الرجوع' : 'Back'}</span>
              </button>
            )}

            <button 
              onClick={() => handleTabChange('home')}
              className="flex items-center gap-2.5 text-left rtl:text-right focus:outline-none group cursor-pointer"
            >
              <BrandLogo size="sm" className="group-hover:opacity-90 transition-opacity" />
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white block leading-none">
                  {t('appName')}
                </span>
                <span className="text-[10px] text-teal-300 font-medium tracking-wide block mt-0.5">
                  {language === 'ar' ? 'سوق الحرفيين في السودان' : 'Sudan Crafts Platform'}
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Middle quick action / Status info */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300">
            {currentUser ? (
              <span className="text-slate-200 font-medium">
                {currentUser.name} 
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-teal-400 font-bold">
                  {currentUser.role === 'admin' 
                    ? t('adminRole') 
                    : currentUser.role === 'provider' 
                    ? (language === 'ar'
                        ? (currentUser.tradeTitleAr || 'مقدم خدمة')
                        : (currentUser.tradeTitleEn || currentUser.tradeTitleAr || 'Service Provider'))
                    : t('customerRole').split(' ')[0]}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">
                {language === 'ar' ? 'تصفح خدمات وحرفيي السودان' : 'Browse Sudanese Trades'}
              </span>
            )}
          </div>

          {/* Zone 3: Install PWA, Language Toggle & User Action */}
          <div className="flex items-center gap-2">
            
            <PWAInstallButton />

            {/* If Admin, show direct Admin Dashboard button in header */}
            {isAdmin && (
              <button
                onClick={() => handleTabChange('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700/60'
                }`}
                title={t('navAdmin')}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('navAdmin')}</span>
              </button>
            )}

            {/* Theme Switcher (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
              title={isDark ? t('switchToLight') : t('switchToDark')}
              aria-label={isDark ? t('switchToLight') : t('switchToDark')}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-teal-300" />
              )}
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700 cursor-pointer"
              title="تغيير اللغة / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>{language === 'ar' ? 'English' : 'عربي'}</span>
            </button>

            {/* Notification Inbox Bell Icon (signed-in users) */}
            {currentUser && !isGuest && (
              <button
                type="button"
                onClick={() => setShowNotificationInbox(true)}
                className="relative w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                title={t('notificationsInbox')}
                aria-label={t('notificationsInbox')}
              >
                <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? 'text-teal-300' : 'text-slate-300'}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs tabular-nums border border-slate-900">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* If Guest, show quick login button */}
            {(!currentUser || isGuest) ? (
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('login')}</span>
              </button>
            ) : (
              <button
                onClick={() => handleTabChange('profile')}
                className="w-8 h-8 rounded-full bg-slate-800 border border-teal-500/50 overflow-hidden flex items-center justify-center text-xs font-bold text-teal-300 cursor-pointer"
                title={currentUser.name}
              >
                {currentUser.avatarUrl ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <NotificationInboxModal
        isOpen={showNotificationInbox}
        onClose={() => setShowNotificationInbox(false)}
      />

      {/* Persistent Bottom Tab Bar (Ergonomic Thumb-Zone) */}
      <nav 
        aria-label="Bottom Navigation" 
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.45)] transition-colors"
      >
        <div className={`max-w-md mx-auto grid ${isAdmin || currentUser?.role === 'provider' ? 'grid-cols-5' : 'grid-cols-4'} items-center h-16 px-1`}>
          
          {/* Tab 1: Home */}
          <button
            onClick={() => handleTabChange('home')}
            className={`flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'home'
                ? 'text-teal-700 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
              {t('navHome')}
            </span>
          </button>

          {/* Tab 2: Search */}
          <button
            onClick={() => handleTabChange('search')}
            className={`flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'search'
                ? 'text-teal-700 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <Search className={`w-5 h-5 ${activeTab === 'search' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
              {t('navSearch')}
            </span>
          </button>

          {/* Tab 3: Bookings */}
          <button
            onClick={() => handleTabChange('bookings')}
            className={`relative flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'bookings'
                ? 'text-teal-700 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Clock className={`w-5 h-5 ${activeTab === 'bookings' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1.5 -end-2 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                  {pendingRequestsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
              {t('navBookings')}
            </span>
          </button>

          {/* Tab 4: ONLY for Providers (Thursday Wallet) or Admins (Admin Dashboard). Never shown to clients! */}
          {isAdmin ? (
            <button
              onClick={() => handleTabChange('admin')}
              className={`flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
                activeTab === 'admin'
                  ? 'text-teal-700 dark:text-teal-400 font-bold'
                  : 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 ${activeTab === 'admin' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
                {t('navAdmin')}
              </span>
            </button>
          ) : currentUser?.role === 'provider' ? (
            <button
              onClick={() => handleTabChange('commission')}
              className={`flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
                activeTab === 'commission'
                  ? 'text-teal-700 dark:text-teal-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Wallet className={`w-5 h-5 ${activeTab === 'commission' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {rejectedDepositsCount > 0 ? (
                  <span className="absolute -top-1.5 -end-2 w-4 h-4 bg-rose-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                    !
                  </span>
                ) : (currentUser.pendingCommissionDueSDG || 0) > 0 ? (
                  <span className="absolute -top-1 -end-1 w-2 h-2 bg-amber-500 rounded-full" />
                ) : null}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
                {t('navCommission')}
              </span>
            </button>
          ) : null}

          {/* Tab 5 / Final Tab: Profile & Settings */}
          <button
            onClick={() => handleTabChange('profile')}
            className={`flex flex-col items-center justify-center h-full py-1 min-h-[44px] cursor-pointer transition-colors ${
              activeTab === 'profile'
                ? 'text-teal-700 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
              {t('navProfile')}
            </span>
          </button>

        </div>
      </nav>
    </>
  );
};
