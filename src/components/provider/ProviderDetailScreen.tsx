import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Star, 
  MapPin, 
  ShieldCheck, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Briefcase, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  X, 
  ZoomIn, 
  Share2,
  Lock,
  ShieldAlert,
  Tag
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { PortfolioItem } from '../../types';

interface Props {
  providerId: string;
  onBack: () => void;
}

export const ProviderDetailScreen: React.FC<Props> = ({ providerId, onBack }) => {
  const { t, language, dir } = useLanguage();
  const { currentUser, allUsers } = useAuth();
  const { 
    categories,
    requests, 
    publicReviews,
    getProviderActiveServicesCount, 
    setBookingModalProvider,
    openBookingModal,
    setActiveTab,
    setSelectedProviderId
  } = useApp();

  const [activePhoto, setActivePhoto] = useState<PortfolioItem | null>(null);

  // Look up provider in allUsers
  const provider = allUsers.find(u => u.id === providerId && u.role === 'provider');
  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (!provider) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">{language === 'ar' ? 'لم يتم العثور على مقدم الخدمة' : 'Provider not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          {language === 'ar' ? 'الرجوع' : 'Back'}
        </button>
      </div>
    );
  }

  // REQUIREMENT 2: Hide deactivated service provider profile and services from clients
  const isDeactivated = provider.isActive === false;
  const isClientViewer = currentUser?.role !== 'admin' && currentUser?.id !== provider.id;

  if (isDeactivated && isClientViewer) {
    return (
      <div className="pb-28 max-w-lg mx-auto px-4 pt-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center mx-auto text-amber-700 shadow-xs border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            {language === 'ar' ? 'الملف الشخصي والخدمات غير متاحة حالياً' : 'Profile & Services Unavailable'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            {language === 'ar'
              ? 'عذراً، تم حجب وإخفاء هذا الملف الشخصي وخدماته عن العملاء نظراً لتعطيل الحساب من قِبل إدارة المنصة لعدم استيفاء شروط التوثيق أو اعتماد مستند الرقم الوطني / جواز السفر.'
              : 'This service provider profile and all associated services are currently hidden from clients because the account is deactivated by platform administration.'}
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'الرجوع إلى قائمة الحرفيين المتاحين' : 'Back to Available Workers'}
          </button>
        </div>
      </div>
    );
  }

  const activeJobs = getProviderActiveServicesCount(provider.id);
  const isAtMaxCapacity = activeJobs >= 3;

  // Contact details visibility rule:
  // Visible to Admin, the provider themselves, or a client with an ACTIVE (non-completed, non-cancelled) request with this provider
  const clientHasActiveRequest = currentUser
    ? requests.some(
        r =>
          r.clientId === currentUser.id &&
          r.providerId === provider.id &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
      )
    : false;
  const hasVisiblePhone = Boolean(provider.phone);
  const canViewContactDetails =
    currentUser?.role === 'admin' ||
    currentUser?.id === provider.id ||
    (clientHasActiveRequest && hasVisiblePhone);

  // WhatsApp link format (Sudan +249)
  const cleanPhone = (provider.phone || '').replace(/^0/, '249');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `السلام عليكم يا ${provider.name}، تواصلت معك عبر منصة مهني بخصوص خدمات: ${provider.tradeTitleAr}`
  )}`;

  return (
    <div className="pb-44 sm:pb-36 max-w-3xl mx-auto px-4 pt-3 space-y-5">
      
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للقائمة السابقة' : 'Back to previous view'}
        >
          <ArrowIcon className="w-4 h-4 text-teal-600 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'الرجوع للقائمة' : 'Back'}</span>
        </button>

        <span className="text-xs text-slate-500 font-semibold">
          {provider.city} · {provider.neighborhood}
        </span>
      </div>

      {/* Deactivation Notice for Admin or Owner */}
      {isDeactivated && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold block">
                {currentUser?.role === 'admin'
                  ? (language === 'ar' ? 'تنبيه إداري: هذا الحساب معطل حالياً ومحجوب بالكامل عن جميع العملاء في المنصة' : 'Admin Alert: This provider account is deactivated and hidden from all clients')
                  : (language === 'ar' ? 'حسابك معطل ومخفي عن العملاء حالياً حتى تدقيق الرقم الوطني أو الجواز واكتمال التفعيل' : 'Your account is currently deactivated and hidden from clients')}
              </span>
              <span className="text-[11px] text-rose-800">
                {provider.deactivatedReason || 'بانتظار مراجعة واعتماد صورة الرقم الوطني أو جواز السفر من الإدارة'}
              </span>
            </div>
          </div>
          {currentUser?.id === provider.id && (
            <button
              onClick={() => {
                onBack();
                setActiveTab('profile');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              {language === 'ar' ? 'إعادة رفع الهوية' : 'Re-upload NID'}
            </button>
          )}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-start">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <img
                src={provider.avatarUrl}
                alt={provider.name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-100 shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {provider.name}
              </h1>
              <p className="text-sm text-teal-700 font-bold">
                {provider.tradeTitleAr}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>{provider.rating?.toFixed(1) || '5.0'}</span>
                  <span className="text-slate-400 font-normal">({provider.reviewCount} {language === 'ar' ? 'تقييم' : 'reviews'})</span>
                </span>

                <span>·</span>

                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{provider.city}، {provider.neighborhood}</span>
                </span>

                {(currentUser?.role === 'admin' || currentUser?.id === provider.id) && provider.nidNumber && (
                  <>
                    <span>·</span>
                    <span className="text-slate-600 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {language === 'ar' ? `رقم الهوية (خاص): ${provider.nidNumber}` : `NID (Private): ${provider.nidNumber}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Simple Availability Status Pill (Rule: Only "Available" or "Busy" to clients) */}
          <div className="shrink-0 flex flex-col items-center sm:items-end gap-1">
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xs ${
              isAtMaxCapacity 
                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAtMaxCapacity ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span>
                {isAtMaxCapacity 
                  ? (language === 'ar' ? 'مشغول حالياً' : 'Busy')
                  : (language === 'ar' ? 'متاح للطلب' : 'Available')}
              </span>
            </span>

            {/* If provider viewing their own profile, show their private capacity count */}
            {currentUser?.id === provider.id && (
              <span className="text-[10px] text-slate-400 font-mono">
                {language === 'ar' ? `(طاقتك: ${activeJobs}/3 خدمات جارية)` : `(Your capacity: ${activeJobs}/3)`}
              </span>
            )}
          </div>
        </div>

        {/* Direct Contact Options: Only visible after a request has been placed (or for Admin / Provider) */}
        {canViewContactDetails ? (
          <div className="space-y-2 pt-1">
            {clientHasActiveRequest && currentUser?.role !== 'admin' && currentUser?.id !== provider.id && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  {language === 'ar'
                    ? 'لديك طلب خدمة نشط حالياً مع هذا المهني — بيانات الاتصال والواتساب متاحة للتنسيق المباشر وتُخفى تلقائياً بعد إنهاء أو إلغاء الخدمة.'
                    : 'You have an active booking request — Direct Phone & WhatsApp are visible until the service ends or is cancelled.'}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('whatsappChat')}</span>
              </a>

              <a
                href={`tel:${provider.phone}`}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>{t('callNow')} ({provider.phone})</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3 pt-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">
                  {language === 'ar' ? 'بيانات الاتصال (الهاتف والواتساب) محمية' : 'Contact Details (Phone & WhatsApp) are Protected'}
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'تظهر أرقام الهاتف ورابط واتساب المباشر للعميل فقط أثناء سريان طلب الخدمة، وتُخفى مجدداً بعد إنهاء أو إلغاء الخدمة حفاظاً على الخصوصية.'
                    : 'Provider phone number and WhatsApp chat are revealed only while a booking request is active, and hidden again once the service is ended or cancelled.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (isAtMaxCapacity) {
                  alert(t('capacityReached'));
                  return;
                }
                openBookingModal(provider);
              }}
              disabled={isAtMaxCapacity}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isAtMaxCapacity
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-700 hover:bg-teal-600 text-white shadow-xs'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>
                {language === 'ar' ? 'أرسل طلب خدمة لإظهار أرقام التواصل' : 'Place Request to Reveal Contact Info'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Bio & Experience Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-teal-700" />
          <span>{language === 'ar' ? 'نبذة عن الخبرة والمهنة' : 'Professional Bio & Trade'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {provider.bioAr}
        </p>

        {/* Offered Services & Trades */}
        {(() => {
          const catIds = provider.serviceCategoryIds && provider.serviceCategoryIds.length > 0 
            ? provider.serviceCategoryIds 
            : (provider.tradeCategoryId ? [provider.tradeCategoryId] : []);
          if (catIds.length === 0) return null;
          return (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 block">
                {language === 'ar' ? 'الخدمات والحرف التي يقدمها:' : 'Offered Services & Trades:'}
              </span>
              <div className="flex flex-wrap gap-2">
                {catIds.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return (
                    <span
                      key={catId}
                      className="px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                      <span>{cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : catId}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Covered Neighborhoods */}
        {provider.coveredNeighborhoods && provider.coveredNeighborhoods.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-xs font-semibold text-slate-500 block">
              {t('coveredAreas')}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {provider.coveredNeighborhoods.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Itemized Services & Specific Pricing Menu (Provider defined & instant) */}
      {provider.customServices && provider.customServices.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'ar' ? 'قائمة الخدمات والأسعار المحددة' : 'Itemized Services & Specific Pricing'}
              </h2>
            </div>
            <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              {provider.customServices.length} {language === 'ar' ? 'خدمات معتمدة' : 'services'}
            </span>
          </div>

          <div className="space-y-2">
            {provider.customServices.map((service) => {
              const cat = categories.find(c => c.id === service.categoryId);
              return (
                <div
                  key={service.id}
                  className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {service.nameAr}
                      </span>
                      {cat && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-700 border border-slate-200">
                          {language === 'ar' ? cat.nameAr : cat.nameEn}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-sm font-extrabold text-teal-800 font-mono tabular-nums">
                      {service.priceSDG.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">{t('sdg')}</span>
                    </div>

                    <button
                      type="button"
                      disabled={isAtMaxCapacity}
                      onClick={() => {
                        if (isAtMaxCapacity) {
                          alert(t('capacityReached'));
                          return;
                        }
                        openBookingModal(provider, service.id);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                    >
                      {language === 'ar' ? 'طلب هذه الخدمة' : 'Book this Service'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Portfolio Gallery Section (Grid Layout) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            {t('portfolioTitle')}
          </h2>
          <span className="text-xs text-slate-400">
            {provider.portfolio?.length || 0} {language === 'ar' ? 'أعمال موثقة' : 'samples'}
          </span>
        </div>

        {(!provider.portfolio || provider.portfolio.length === 0) ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            {language === 'ar' ? 'لم يتم رفع صور أعمال سابقة حتى الآن' : 'No portfolio samples uploaded yet'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {provider.portfolio.map((item) => (
              <div
                key={item.id}
                onClick={() => setActivePhoto(item)}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border border-slate-200 cursor-pointer shadow-2xs"
              >
                <img
                  src={item.imageUrl}
                  alt={item.titleAr}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <ZoomIn className="w-5 h-5" />
                </div>
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                  <span className="text-[11px] font-medium block truncate">
                    {item.titleAr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Star Ratings & Reviews Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'ar' ? 'تقييمات وآراء العملاء' : 'Client Star Ratings & Reviews'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <span className="text-amber-500 font-extrabold text-sm">{provider.rating || 5.0}</span>
            <div className="flex items-center text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= Math.round(provider.rating || 5.0)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-slate-400 font-normal">({provider.reviewCount || 0})</span>
          </div>
        </div>

        {/* List of client reviews from requests & publicReviews */}
        {(() => {
          const ownRated = requests.filter(
            r => r.providerId === provider.id && typeof r.clientRating === 'number'
          );
          const seenIds = new Set(ownRated.map(r => r.id));
          const extraPublic = publicReviews
            .filter(pr => pr.providerId === provider.id && !seenIds.has(pr.id))
            .map(pr => ({
              id: pr.id,
              clientName: pr.clientName,
              clientRating: pr.clientRating,
              clientReviewComment: pr.clientReviewComment,
              ratedAt: pr.ratedAt,
              selectedServiceNames: undefined as string[] | undefined,
              problemDescription: language === 'ar' ? 'تقييم عميل موثق' : 'Verified Client Review',
              completedAt: pr.ratedAt,
            }));

          const ratedRequests = [...ownRated, ...extraPublic];

          if (ratedRequests.length === 0) {
            return (
              <div className="p-5 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">
                  {language === 'ar' ? 'تقييمات ممتازة من العملاء عبر إتمام الخدمات' : 'Great ratings from past clients'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar'
                    ? 'يتمكن العملاء من تقييم الخدمة بالنجوم مباشرة بعد اكتمال تنفيذ طلباتهم.'
                    : 'Clients submit 1 to 5 star ratings directly on completed bookings.'}
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {ratedRequests.map((req) => (
                <div key={req.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{req.clientName}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (req.clientRating || 5)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {req.clientReviewComment && (
                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      "{req.clientReviewComment}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>{req.selectedServiceNames?.join(' + ') || req.problemDescription}</span>
                    <span>{req.ratedAt || req.completedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Booking Terms & Cancellation Policy Banner */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              {language === 'ar' ? 'سياسة الإلغاء الشفافة للمنصة' : 'Transparent Cancellation Policy'}
            </span>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              {t('clientCancellationNotice')}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-amber-200/70 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
          <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span>{t('scheduleAgreementNote')}</span>
        </div>
      </div>

      {/* Sticky Bottom CTA for Booking Request */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] inset-x-0 bg-white border-t border-slate-200 z-30 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          {clientHasActiveRequest ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setSelectedProviderId(null);
                  setActiveTab('bookings');
                }}
                className="h-11 px-3 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap truncate"
              >
                <Clock className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                <span className="truncate">{language === 'ar' ? 'طلباتي والاتصال' : 'My Bookings & Call'}</span>
              </button>
              <button
                onClick={() => {
                  if (isAtMaxCapacity) {
                    alert(t('capacityReached'));
                    return;
                  }
                  openBookingModal(provider);
                }}
                disabled={isAtMaxCapacity}
                className={`h-11 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer whitespace-nowrap truncate ${
                  isAtMaxCapacity
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-teal-700 hover:bg-teal-600 text-white active:scale-[0.99]'
                }`}
              >
                <span className="truncate">{isAtMaxCapacity ? (language === 'ar' ? 'ممتلئ' : 'Full') : t('requestService')}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (isAtMaxCapacity) {
                  alert(t('capacityReached'));
                  return;
                }
                openBookingModal(provider);
              }}
              disabled={isAtMaxCapacity}
              className={`w-full h-11 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap ${
                isAtMaxCapacity
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-teal-700 hover:bg-teal-600 text-white active:scale-[0.99]'
              }`}
            >
              <span className="truncate">
                {isAtMaxCapacity 
                  ? (language === 'ar' ? 'المهني مشغول حالياً' : 'Provider Currently Busy') 
                  : (language === 'ar' ? 'طلب خدمة من قائمة المهني' : 'Book a Service from Menu')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Portfolio Photo Zoom */}
      {activePhoto && (
        <div 
          onClick={() => setActivePhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 text-white shadow-2xl relative"
          >
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-3 end-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.titleAr}
              className="w-full max-h-[70vh] object-contain bg-black"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 space-y-1 bg-slate-900">
              <h3 className="font-bold text-base text-white">{activePhoto.titleAr}</h3>
              {activePhoto.descriptionAr && (
                <p className="text-xs text-slate-300">{activePhoto.descriptionAr}</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
