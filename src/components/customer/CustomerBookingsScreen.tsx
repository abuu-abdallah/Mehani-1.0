import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  MessageSquare, 
  MapPin, 
  Calendar, 
  Banknote, 
  CreditCard, 
  AlertTriangle, 
  ShieldAlert,
  Play,
  Check,
  Building,
  UserCheck,
  Star,
  Send,
  Tag,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ServiceRequest, ServiceStatus } from '../../types';

export const CustomerBookingsScreen: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { currentUser, allUsers } = useAuth();
  const { 
    requests, 
    cancelService, 
    updateRequestStatus, 
    submitServiceRating,
    getProviderActiveServicesCount,
    setAuthModalMode,
    setShowAuthModal,
    goBack
  } = useApp();

  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [paymentModalReq, setPaymentModalReq] = useState<ServiceRequest | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'bankak' | 'fawry'>('bankak');

  // Star Rating state on completed bookings
  const [ratingStars, setRatingStars] = useState<Record<string, number>>({});
  const [hoverStars, setHoverStars] = useState<Record<string, number>>({});
  const [ratingComments, setRatingComments] = useState<Record<string, string>>({});
  const [submittingRatingId, setSubmittingRatingId] = useState<string | null>(null);
  const [ratingSuccessId, setRatingSuccessId] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div className="pb-24 max-w-lg mx-auto px-4 pt-12 text-center space-y-4">
        <Clock className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {language === 'ar' ? 'سجل الطلبات والمتابعة' : 'Track Your Service Requests'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {language === 'ar' 
            ? 'يرجى تسجيل الدخول أو إنشاء حساب لعرض طلباتك والخدمات الجارية.' 
            : 'Please sign in or create an account to view your requests.'}
        </p>
        <button
          onClick={() => {
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
        >
          {t('login')}
        </button>
      </div>
    );
  }

  const isProvider = currentUser.role === 'provider';

  // Requests filtered for current user
  const userRequests = requests.filter(r => 
    isProvider ? r.providerId === currentUser.id : r.clientId === currentUser.id
  );

  const displayedRequests = userRequests.filter(r => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress';
    if (filterStatus === 'completed') return r.status === 'completed';
    if (filterStatus === 'cancelled') return r.status === 'cancelled';
    return true;
  });

  const activeJobsCount = isProvider ? getProviderActiveServicesCount(currentUser.id) : 0;

  const handleCancelClick = async (request: ServiceRequest) => {
    const confirmMsg = `${t('confirmCancelAlert')}\n\n${language === 'ar' ? `قيمة الغرامة 5%: ${Math.round(request.agreedPriceSDG * 0.05)} ج.س` : `5% Penalty: ${Math.round(request.agreedPriceSDG * 0.05)} SDG`}`;
    if (window.confirm(confirmMsg)) {
      await cancelService(request.id, language === 'ar' ? 'تم الإلغاء بواسطة العميل' : 'Cancelled by customer');
    }
  };

  const handleCompleteService = async () => {
    if (!paymentModalReq) return;
    await updateRequestStatus(paymentModalReq.id, 'completed', selectedPaymentMethod);
    setPaymentModalReq(null);
  };

  const handleRatingSubmit = async (requestId: string) => {
    const stars = ratingStars[requestId] || 5;
    const comment = ratingComments[requestId] || '';
    setSubmittingRatingId(requestId);
    try {
      const res = await submitServiceRating(requestId, stars, comment);
      if (res.success) {
        setRatingSuccessId(requestId);
        setTimeout(() => setRatingSuccessId(null), 4000);
      }
    } finally {
      setSubmittingRatingId(null);
    }
  };

  return (
    <div className="pb-28 max-w-4xl mx-auto px-4 pt-3 space-y-5">
      
      {/* Top Navigation Back Button Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للرئيسية' : 'Back to Home'}
        >
          <BackArrowIcon className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Header and Capacity Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {isProvider ? (language === 'ar' ? 'لوحة تحكم الطلبات والمهام' : 'Provider Jobs Dashboard') : t('navBookings')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isProvider 
              ? (language === 'ar' ? 'إدارة الطلبات الواردة وسداد العمولات' : 'Manage incoming inquiries & jobs')
              : (language === 'ar' ? 'متابعة حالة خدماتك والتواصل مع المهنيين' : 'Track your bookings & communicate')}
          </p>
        </div>

        {/* If Provider, show 3-Service Capacity Pill */}
        {isProvider && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 border border-transparent dark:border-slate-700 text-white text-xs font-semibold w-fit">
            <span>{language === 'ar' ? 'طاقة الخدمات الجارية:' : 'Active Jobs:'}</span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
              activeJobsCount >= 3 ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-white'
            }`}>
              {activeJobsCount} / 3
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterStatus === 'all'
              ? 'bg-slate-900 dark:bg-teal-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {language === 'ar' ? 'الكل' : 'All'} ({userRequests.length})
        </button>
        <button
          onClick={() => setFilterStatus('active')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterStatus === 'active'
              ? 'bg-teal-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {language === 'ar' ? 'النشطة والجارية' : 'Active'}
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterStatus === 'completed'
              ? 'bg-emerald-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {language === 'ar' ? 'المكتملة' : 'Completed'}
        </button>
        <button
          onClick={() => setFilterStatus('cancelled')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap ${
            filterStatus === 'cancelled'
              ? 'bg-rose-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {language === 'ar' ? 'الملغية' : 'Cancelled'}
        </button>
      </div>

      {/* Requests List */}
      {displayedRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            {language === 'ar' ? 'لا توجد طلبات في هذا القسم' : 'No requests in this view'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'الطلبات الجديدة ستظهر هنا فور إرسالها.' : 'New bookings will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((request) => {
            const isPending = request.status === 'pending';
            const isAccepted = request.status === 'accepted';
            const isInProgress = request.status === 'in_progress';
            const isCompleted = request.status === 'completed';
            const isCancelled = request.status === 'cancelled';

            const hideWorkerContact = !isProvider && (isCompleted || isCancelled);
            const contactPhone = hideWorkerContact ? '' : (isProvider ? request.clientPhone : request.providerPhone);
            const contactName = isProvider ? request.clientName : request.providerName;
            const cleanPhone = (contactPhone || '').replace(/^0/, '249');

            return (
              <div
                key={request.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4"
              >
                {/* Top Status & Date Strip */}
                <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 dark:text-slate-500 font-medium">#{request.id}</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{request.createdAt}</span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                        {t('statusPending')}
                      </span>
                    )}
                    {isAccepted && (
                      <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800">
                        {t('statusAccepted')}
                      </span>
                    )}
                    {isInProgress && (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                        {t('statusInProgress')}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                        {t('statusCompleted')}
                      </span>
                    )}
                    {isCancelled && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                        {t('statusCancelled')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Counterparty & Problem Details */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base text-slate-900 dark:text-white">
                        {request.problemDescription}
                      </h2>
                    </div>

                    {/* Selected Itemized Services Tags */}
                    {request.selectedServiceNames && request.selectedServiceNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          <span>{language === 'ar' ? 'الخدمات المحددة:' : 'Selected Services:'}</span>
                        </span>
                        {request.selectedServiceNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-[11px] font-semibold"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {isProvider ? `${language === 'ar' ? 'العميل' : 'Client'}: ${contactName}` : `${language === 'ar' ? 'المهني' : 'Worker'}: ${contactName}`}
                      </span>
                      {!isProvider && allUsers.find(u => u.id === request.providerId)?.isActive === false && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {language === 'ar' ? 'معطل حالياً' : 'Deactivated'}
                        </span>
                      )}
                      <span>·</span>
                      <span className="text-slate-500 dark:text-slate-400">{request.providerTradeAr}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        {request.city} - {request.neighborhood} ({request.addressDetails})
                      </span>
                    </div>

                    {/* Scheduled Note (Agreement) */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-100">
                          {language === 'ar' ? 'الموعد المنسق بالتراضي:' : 'Scheduled Timing (Mutual Agreement):'}
                        </span>
                        <span>{request.scheduledTimeNote}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Price Column */}
                  <div className="sm:text-end shrink-0 bg-slate-50 dark:bg-slate-800/60 sm:bg-transparent dark:sm:bg-transparent p-3 sm:p-0 rounded-2xl w-full sm:w-auto text-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 block">{language === 'ar' ? 'قيمة الخدمة' : 'Service Fee'}</span>
                    <div className="text-lg font-extrabold text-teal-800 dark:text-teal-400 font-mono">
                      {request.agreedPriceSDG.toLocaleString()}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ms-1">{t('sdg')}</span>
                    </div>

                    {/* Prior cancellation penalty indication (hidden on cancelled or exempted bookings) */}
                    {!isCancelled && (request.cancellationFeePenaltySDG || 0) > 0 && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                        +{request.cancellationFeePenaltySDG.toLocaleString()} {t('sdg')}{' '}
                        {isProvider
                          ? (language === 'ar' ? '(غرامة إلغاء محصلة تُورد الخميس)' : '(Collected penalty — deposit Thursday)')
                          : (language === 'ar' ? '(5% غرامة سابقة)' : '(5% prior cancellation fee)')}
                      </div>
                    )}

                    {/* Provider Commission Note */}
                    {isProvider && !isCancelled && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {language === 'ar'
                          ? `توريد الخميس: ${(request.commissionFeeSDG + (request.cancellationFeePenaltySDG || 0)).toLocaleString()} ${t('sdg')}`
                          : `Thursday due: ${(request.commissionFeeSDG + (request.cancellationFeePenaltySDG || 0)).toLocaleString()} ${t('sdg')}`}
                        {(request.cancellationFeePenaltySDG || 0) > 0 && (
                          <span className="block text-[10px] text-amber-700 dark:text-amber-400">
                            ({request.commissionFeeSDG.toLocaleString()} عمولة 8% + {request.cancellationFeePenaltySDG.toLocaleString()} غرامة)
                          </span>
                        )}
                      </div>
                    )}

                    {request.paymentMethod && (
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800 text-[10px] font-bold">
                        {request.paymentMethod === 'bankak' ? 'مدفوع بنكك' : 'مدفوع كاش'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Communication and Workflow Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  
                  {/* Direct Contact triggers (hidden from client once completed or cancelled) */}
                  {contactPhone && !hideWorkerContact ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${contactPhone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>{t('callNow')}</span>
                      </a>

                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{t('whatsappChat')}</span>
                      </a>
                    </div>
                  ) : hideWorkerContact ? (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {language === 'ar'
                        ? 'تم إخفاء رقم الهاتف وواتساب المهني بعد انتهاء أو إلغاء الخدمة'
                        : 'Worker contact info hidden after service completion/cancellation'}
                    </span>
                  ) : null}

                  {/* Role Specific Actions */}
                  <div className="flex items-center gap-2 ms-auto">
                    
                    {/* Customer cancel button (with 5% penalty notice) */}
                    {!isProvider && !isCompleted && !isCancelled && (
                      <button
                        onClick={() => handleCancelClick(request)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t('cancelService')}</span>
                      </button>
                    )}

                    {/* Provider Workflow Progression: Accept -> In Progress -> Complete */}
                    {isProvider && (
                      <>
                        {isPending && (
                          <button
                            onClick={async () => {
                              const res = await updateRequestStatus(request.id, 'accepted');
                              if (!res.success && res.error) alert(res.error);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'قبول الطلب' : 'Accept Request'}</span>
                          </button>
                        )}

                        {isAccepted && (
                          <button
                            onClick={async () => {
                              const res = await updateRequestStatus(request.id, 'in_progress');
                              if (!res.success && res.error) alert(res.error);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold transition-colors cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'بدء تنفيذ الخدمة' : 'Start Job'}</span>
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            onClick={() => setPaymentModalReq(request)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('completeService')}</span>
                          </button>
                        )}
                      </>
                    )}

                  </div>
                </div>

                {/* 1-to-5 Star Rating Section on Completed Bookings */}
                {isCompleted && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* If request is already rated */}
                    {request.clientRating ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                              {language === 'ar' ? '⭐ تقييم الخدمة:' : '⭐ Service Rating:'}
                            </span>
                            <div className="flex items-center text-amber-500">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= (request.clientRating || 5)
                                      ? 'fill-amber-400 text-amber-500'
                                      : 'text-slate-200 dark:text-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300 font-mono">
                              ({request.clientRating} / 5)
                            </span>
                          </div>
                          {request.clientReviewComment && (
                            <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed italic">
                              "{request.clientReviewComment}"
                            </p>
                          )}
                        </div>

                        <div className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-xl border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                          {language === 'ar' ? 'تم التقييم بنجاح' : 'Rated Successfully'}
                        </div>
                      </div>
                    ) : (
                      /* Not rated yet: If client is viewing, show interactive 1-to-5 star rating widget */
                      (!isProvider && currentUser.id === request.clientId) ? (
                        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                                {language === 'ar' ? '⭐ قيّم جودة الخدمة وأداء المهني:' : '⭐ Rate Service Quality & Performance:'}
                              </span>
                              <span className="text-[10px] text-amber-800 dark:text-amber-300/80">
                                {language === 'ar' ? 'انقر على النجوم لاختيار تقييمك (من 1 إلى 5 نجوم)' : 'Click on the stars to rate (1 to 5 stars)'}
                              </span>
                            </div>

                            {/* Interactive Star strip */}
                            <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/90 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const currentRating = ratingStars[request.id] || 5;
                                const isHovered = (hoverStars[request.id] || 0) >= star;
                                const isFilled = isHovered || (!hoverStars[request.id] && currentRating >= star);

                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setHoverStars(prev => ({ ...prev, [request.id]: star }))}
                                    onMouseLeave={() => setHoverStars(prev => ({ ...prev, [request.id]: 0 }))}
                                    onClick={() => setRatingStars(prev => ({ ...prev, [request.id]: star }))}
                                    className="p-1 rounded-lg hover:scale-120 transition-transform cursor-pointer"
                                    title={`${star} ${language === 'ar' ? 'نجوم' : 'stars'}`}
                                  >
                                    <Star
                                      className={`w-5 h-5 transition-colors ${
                                        isFilled
                                          ? 'fill-amber-400 text-amber-500 drop-shadow-xs'
                                          : 'text-slate-300 dark:text-slate-600'
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                              <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300 ms-1.5 font-mono">
                                {ratingStars[request.id] || 5} / 5
                              </span>
                            </div>
                          </div>

                          {/* Optional comment input */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={ratingComments[request.id] || ''}
                              onChange={(e) => setRatingComments(prev => ({ ...prev, [request.id]: e.target.value }))}
                              placeholder={language === 'ar' ? 'اكتب كلمة شكر أو رأيك في التزام المهني (اختياري)...' : 'Add feedback note (optional)...'}
                              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-amber-300 dark:border-amber-800 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={submittingRatingId === request.id}
                              onClick={() => handleRatingSubmit(request.id)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{submittingRatingId === request.id ? (language === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (language === 'ar' ? 'إرسال التقييم' : 'Submit Rating')}</span>
                            </button>
                          </div>

                          {ratingSuccessId === request.id && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                              {language === 'ar' ? '✅ شكراً لك! تم تسجيل تقييمك بنجاح وتحديث سمعة المهني.' : 'Thank you! Rating saved successfully.'}
                            </span>
                          )}
                        </div>
                      ) : (
                        /* Provider or Admin viewing unrated completed booking */
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{language === 'ar' ? 'بانتظار تقييم العميل للخدمة المكتملة.' : 'Awaiting client rating for this completed service.'}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Completion & Payment Method Modal */}
      {paymentModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl border border-transparent dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('completeService')}</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'ar'
                ? `يرجى تحديد طريقة الدفع التي استلمت بها المبلغ الإجمالي من العميل (${(paymentModalReq.agreedPriceSDG + (paymentModalReq.cancellationFeePenaltySDG || 0)).toLocaleString()} ج.س${paymentModalReq.cancellationFeePenaltySDG > 0 ? ` — يشمل ${paymentModalReq.cancellationFeePenaltySDG.toLocaleString()} ج.س غرامة إلغاء محصلة` : ''}):`
                : `Select the payment method received from client (${(paymentModalReq.agreedPriceSDG + (paymentModalReq.cancellationFeePenaltySDG || 0)).toLocaleString()} SDG${paymentModalReq.cancellationFeePenaltySDG > 0 ? ` incl. ${paymentModalReq.cancellationFeePenaltySDG.toLocaleString()} SDG penalty` : ''}):`}
            </p>

            <div className="space-y-2">
              <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                selectedPaymentMethod === 'bankak' ? 'border-teal-600 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/40' : 'border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={selectedPaymentMethod === 'bankak'}
                    onChange={() => setSelectedPaymentMethod('bankak')}
                    className="text-teal-600"
                  />
                  <span>{t('payBankak')}</span>
                </div>
                <CreditCard className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                selectedPaymentMethod === 'cash' ? 'border-teal-600 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/40' : 'border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={selectedPaymentMethod === 'cash'}
                    onChange={() => setSelectedPaymentMethod('cash')}
                    className="text-teal-600"
                  />
                  <span>{t('payCash')}</span>
                </div>
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </label>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <div>
                {t('commissionNotice')} ({Math.round(paymentModalReq.agreedPriceSDG * 0.08).toLocaleString()} {t('sdg')})
              </div>
              {paymentModalReq.cancellationFeePenaltySDG > 0 && (
                <div className="font-bold text-amber-950 dark:text-amber-100">
                  {language === 'ar'
                    ? `+ غرامة الإلغاء المحصلة من العميل (${paymentModalReq.cancellationFeePenaltySDG.toLocaleString()} ج.س) تُورد أيضاً مع عمولة الخميس — الإجمالي المطلوب توريده: ${(Math.round(paymentModalReq.agreedPriceSDG * 0.08) + paymentModalReq.cancellationFeePenaltySDG).toLocaleString()} ج.س`
                    : `+ Collected client penalty (${paymentModalReq.cancellationFeePenaltySDG.toLocaleString()} SDG) is also due Thursday — Total to deposit: ${(Math.round(paymentModalReq.agreedPriceSDG * 0.08) + paymentModalReq.cancellationFeePenaltySDG).toLocaleString()} SDG`}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setPaymentModalReq(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCompleteService}
                className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد السداد والإنهاء' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
