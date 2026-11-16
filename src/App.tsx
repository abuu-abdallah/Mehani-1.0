import React from 'react';
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
import { AlertTriangle } from 'lucide-react';

const MainContent: React.FC = () => {
  const { dir, language } = useLanguage();
  const { currentUser } = useAuth();
  const { 
    activeTab, 
    setActiveTab,
    selectedProviderId, 
    setSelectedProviderId, 
    bookingModalProvider, 
    setBookingModalProvider,
    bookingModalPreSelectedServiceId,
    closeBookingModal,
    goBack 
  } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans" dir={dir}>
      {/* Mobile Edge Swipe Back Navigation Gesture Handler */}
      <SwipeBackGesture />
      <CapacitorNativeBridge />

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
                      ? `ملاحظة إدارة المنصة: يرجى إعادة إرفاق مستند البطاقة القومية (${currentUser.nidRejectionReason || 'صورة غير واضحة'})`
                      : `Admin Notice: National ID re-upload requested (${currentUser.nidRejectionReason || 'Unclear photo'})`)
                  : (language === 'ar'
                      ? `حسابك كمهني معطل حالياً: ${currentUser.deactivatedReason || 'بانتظار مراجعة وتدقيق صورة البطاقة القومية (NID)'}`
                      : `Provider account inactive: ${currentUser.deactivatedReason || 'Pending NID audit'}`)}
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
              {language === 'ar' ? 'إعادة رفع البطاقة القومية الآن' : 'Re-upload NID Now'}
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

      {/* Global Authentication Modal (Login / Register Customer / Register Worker / Guest) */}
      <AuthModal />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
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
