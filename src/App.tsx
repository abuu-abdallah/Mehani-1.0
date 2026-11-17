import React from 'react';
import { Capacitor } from '@capacitor/core';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { HomeScreen } from './components/home/HomeScreen';
import { SearchScreen } from './components/search/SearchScreen';
import { ProviderDetailScreen } from './components/provider/ProviderDetailScreen';
import { ThursdayCommissionScreen } from './components/provider/ThursdayCommissionScreen';
import { CustomerBookingsScreen } from './components/customer/CustomerBookingsScreen';
import { ProfileSettingsScreen } from './components/profile/ProfileSettingsScreen';
import { AdminDashboardScreen } from './components/admin/AdminDashboardScreen';
import { AuthModal } from './components/auth/AuthModal';
import { BookServiceModal } from './components/booking/BookServiceModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SwipeBackGesture } from './components/common/SwipeBackGesture';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { CapacitorNativeBridge } from './components/common/CapacitorNativeBridge';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { AlertTriangle, WifiOff } from 'lucide-react';

const MainContent: React.FC = () => {
  const { dir, language } = useLanguage();
  const { currentUser } = useAuth();
  const isOnline = useOnlineStatus();
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const {
    activeTab,
    setActiveTab,
    selectedProviderId,
    setSelectedProviderId,
    bookingModalProvider,
    bookingModalPreSelectedServiceId,
    closeBookingModal,
    goBack
  } = useApp();

  // In the Android app, when offline nothing should load and a top message should appear
  if (isNativeAndroid && !isOnline) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="ltr">
        <header
          role="alert"
          className="w-full bg-rose-700 text-white px-4 py-3.5 pt-[calc(env(safe-area-inset-top,0px)+14px)] shadow-md border-b border-rose-600"
        >
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-rose-100" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold leading-snug">
                  We can&apos;t reach our network right now. Please check your connection
                </p>
                {language === 'ar' && (
                  <p className="text-[11px] text-rose-100 mt-0.5 text-right" dir="rtl">
                    تعذر الوصول إلى الشبكة حالياً. يرجى التحقق من اتصال الإنترنت
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg bg-white/15 active:bg-white/25 border border-white/30 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans" dir={dir}>
      {/* Mobile Edge Swipe Back Navigation Gesture Handler */}
      <SwipeBackGesture />
      <CapacitorNativeBridge />

      {/* Top Offline Connectivity Banner */}
      <OfflineIndicator />

      {/* Persistent Navbar across all screens */}
      <Navbar />

      {/* Top Urgent Alert Banner for Providers whose NID requires re-upload or whose account is inactive */}
      {currentUser?.role === 'provider' && (currentUser?.nidStatus === 'reupload_requested' || currentUser?.isActive === false) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold shadow-xs flex items-center justify-between z-30">
          <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-start">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                {currentUser.nidStatus === 'reupload_requested'
                  ? (language === 'ar'
                      ? `ملاحظة إدارة المنصة: يرجى إعادة إرفاق صورة الرقم الوطني أو جواز السفر (${currentUser.nidRejectionReason || 'صورة غير واضحة'})`
                      : `Admin Notice: National ID or Passport re-upload requested (${currentUser.nidRejectionReason || 'Unclear photo'})`)
                  : (language === 'ar'
                      ? `حسابك كمهني معطل حالياً: ${currentUser.deactivatedReason || 'بانتظار مراجعة وتدقيق صورة الرقم الوطني أو جواز السفر'}`
                      : `Provider account inactive: ${currentUser.deactivatedReason || 'Pending National ID or Passport audit'}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProviderId(null);
                setActiveTab('profile');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              {language === 'ar' ? 'إعادة رفع الرقم الوطني الآن' : 'Re-upload NID / Passport Now'}
            </button>
          </div>
        </div>
      )}

      {/* Main Screen Content Area */}
      <main className="flex-1 w-full">
        {selectedProviderId ? (
          <ProviderDetailScreen
            providerId={selectedProviderId}
            onBack={goBack}
          />
        ) : (
          <>
            {activeTab === 'home' && <HomeScreen />}
            {activeTab === 'search' && <SearchScreen />}
            {activeTab === 'bookings' && <CustomerBookingsScreen />}
            {activeTab === 'commission' && <ThursdayCommissionScreen />}
            {activeTab === 'profile' && <ProfileSettingsScreen />}
            {activeTab === 'admin' && currentUser?.role === 'admin' && <AdminDashboardScreen />}
          </>
        )}
      </main>

      {/* Global Booking Request Modal */}
      {bookingModalProvider && (
        <BookServiceModal
          provider={bookingModalProvider}
          preSelectedServiceId={bookingModalPreSelectedServiceId}
          onClose={closeBookingModal}
        />
      )}

      {/* Global Authentication Modal (Login / Register Customer / Register Worker) */}
      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <AppProvider>
            <MainContent />
          </AppProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
