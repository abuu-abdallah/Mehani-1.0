import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Banknote, 
  CreditCard,
  ShieldAlert,
  Tag,
  Check
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';

interface Props {
  provider: User;
  onClose: () => void;
  preSelectedServiceId?: string;
}

export const BookServiceModal: React.FC<Props> = ({ provider, onClose, preSelectedServiceId }) => {
  const { t, language } = useLanguage();
  const { currentUser, refreshFromServer } = useAuth();
  const { bookService, setActiveTab, setSelectedProviderId } = useApp();

  useEffect(() => {
    void refreshFromServer();
  }, [refreshFromServer]);

  const customServicesList = provider.customServices || [];

  // Track client selected services from provider price list
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    if (preSelectedServiceId && customServicesList.some(s => s.id === preSelectedServiceId)) {
      return [preSelectedServiceId];
    }
    return customServicesList.length > 0 ? [customServicesList[0].id] : [];
  });

  const selectedItems = customServicesList.filter(s => selectedServiceIds.includes(s.id));
  const itemsSumPrice = selectedItems.reduce((acc, s) => acc + s.priceSDG, 0);

  const [problemDescription, setProblemDescription] = useState(() => {
    if (selectedItems.length > 0) {
      return selectedItems.map(s => s.nameAr).join(' + ');
    }
    return '';
  });

  const [scheduledTimeNote, setScheduledTimeNote] = useState('');
  const [city, setCity] = useState(currentUser?.city || provider.city || 'الخرطوم');
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || provider.neighborhood || 'الرياض');
  const [addressDetails, setAddressDetails] = useState('');
  const [customManualPrice, setCustomManualPrice] = useState<number>(provider.basePriceSDG || 25000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Toggle service selection and update problemDescription preview
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      
      const newSelectedItems = customServicesList.filter(s => next.includes(s.id));
      if (newSelectedItems.length > 0) {
        setProblemDescription(newSelectedItems.map(s => s.nameAr).join(' + '));
      }
      return next;
    });
  };

  // Determine agreed base price
  const activeBasePrice = selectedItems.length > 0 ? itemsSumPrice : customManualPrice;

  // Cancellation penalty from prior service if applicable (5%)
  const priorCancellationPenalty = currentUser?.unpaidCancellationFeeSDG || 0;
  const totalPrice = activeBasePrice + priorCancellationPenalty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const descToSubmit = problemDescription.trim() || (selectedItems.length > 0 
      ? selectedItems.map(s => s.nameAr).join(' + ') 
      : (language === 'ar' ? 'طلب صيانة وخدمة منزلية' : 'Home service request')
    );

    if (!descToSubmit || !addressDetails.trim()) {
      setErrorMessage(t('fillRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bookService({
        provider,
        scheduledTimeNote: scheduledTimeNote.trim() || (language === 'ar' ? 'بالتنسيق المباشر هاتفياً فور تأكيد الطلب' : 'Via direct phone coordination'),
        addressDetails,
        city,
        neighborhood,
        problemDescription: descToSubmit,
        agreedPriceSDG: activeBasePrice,
        selectedServiceItemIds: selectedServiceIds,
        selectedServiceNames: selectedItems.map(s => s.nameAr),
      });

      if (!result.success) {
        setErrorMessage(result.error || 'حدث خطأ أثناء إرسال الطلب');
        return;
      }

      onClose();
      setSelectedProviderId(null);
      setActiveTab('bookings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6"
      >
        
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={provider.avatarUrl}
              alt={provider.name}
              className="w-11 h-11 rounded-xl object-cover border border-slate-700"
              referrerPolicy="no-referrer"
            />
            <div>
              <h2 className="font-bold text-base text-white">{t('confirmBooking')}</h2>
              <span className="text-xs text-teal-300 font-medium block">
                {provider.name} · {language === 'ar' ? provider.tradeTitleAr : (provider.tradeTitleEn || provider.tradeTitleAr)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Itemized Services Selection (Client picks 1 or more from provider price list) */}
          {customServicesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>{language === 'ar' ? 'اختر الخدمة أو الخدمات المطلوبة من قائمة المهني:' : 'Select Services from Provider Menu:'}</span>
                </label>
                <span className="text-[10px] text-teal-800 dark:text-teal-300 font-bold bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/70">
                  {selectedServiceIds.length} {language === 'ar' ? 'مختارة' : 'selected'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {customServicesList.map((service) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleServiceSelection(service.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-teal-600 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/50 shadow-2xs' 
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-teal-700 dark:bg-teal-600 border-teal-700 dark:border-teal-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`truncate ${isSelected ? 'text-teal-950 dark:text-teal-200 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
                          {service.nameAr}
                        </span>
                      </div>

                      <span className="font-mono font-bold text-teal-800 dark:text-teal-400 shrink-0 text-xs">
                        {service.priceSDG.toLocaleString()} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{t('sdg')}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pricing & Fee Breakdown */}
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium text-slate-700 dark:text-slate-300">
              <span>{language === 'ar' ? 'سعر الخدمات المختارة' : 'Selected Services Fee'}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{activeBasePrice.toLocaleString()} {t('sdg')}</span>
            </div>

            {/* If 5% cancellation penalty applies */}
            {priorCancellationPenalty > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 font-medium">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{t('cancellationPenaltyNote')} (5%)</span>
                </div>
                <span className="font-bold">+{priorCancellationPenalty.toLocaleString()} {t('sdg')}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm font-extrabold text-slate-900 dark:text-slate-100">
              <span>{language === 'ar' ? 'المجموع المستحق عند الإتمام' : 'Total Due upon Completion'}:</span>
              <span className="text-teal-800 dark:text-teal-400 text-base font-mono">{totalPrice.toLocaleString()} {t('sdg')}</span>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{language === 'ar' ? 'يتم الدفع للمهني مباشرة بعد انتهاء العمل: كاش أو عبر تطبيق بنكك' : 'Pay worker upon completion: Cash or Bankak'}</span>
            </div>
          </div>

          {/* Problem / Work Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {language === 'ar' ? 'تفاصيل الخدمة أو العطل المطلوب *' : 'Service / Work Details *'}
            </label>
            <textarea
              rows={3}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder={t('problemDescPlaceholder')}
              required
              className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Time Arrangement Note (Mutual agreement) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {language === 'ar' ? 'الموعد المقترح (تنسيق متبادل)' : 'Proposed Schedule (Mutual Agreement)'}
            </label>
            <input
              type="text"
              value={scheduledTimeNote}
              onChange={(e) => setScheduledTimeNote(e.target.value)}
              placeholder={t('scheduledNotePlaceholder')}
              className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              {t('scheduleAgreementNote')}
            </span>
          </div>

          {/* Location / Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('state')}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{t('neighborhood')}</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          {/* Detailed Street Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {language === 'ar' ? 'العنوان بالتفصيل ورقم المنزل أو المعلم *' : 'Detailed Address & Landmark *'}
            </label>
            <input
              type="text"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder={t('addressPlaceholder')}
              required
              className="w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Cancellation Notice */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-700">
            {t('clientCancellationNotice')}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? (language === 'ar' ? 'جاري التأكيد...' : 'Sending...') : t('confirmBooking')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
