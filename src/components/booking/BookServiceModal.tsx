import React, { useState } from 'react';
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
  const { currentUser } = useAuth();
  const { bookService, setActiveTab, setSelectedProviderId } = useApp();

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
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6"
      >
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
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
                {provider.name} · {provider.tradeTitleAr}
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Itemized Services Selection (Client picks 1 or more from provider price list) */}
          {customServicesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-700" />
                  <span>{language === 'ar' ? 'اختر الخدمة أو الخدمات المطلوبة من قائمة المهني:' : 'Select Services from Provider Menu:'}</span>
                </label>
                <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
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
                          ? 'border-teal-600 bg-teal-50/70 shadow-2xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-teal-700 border-teal-700 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`truncate ${isSelected ? 'text-teal-950 font-bold' : 'text-slate-800'}`}>
                          {service.nameAr}
                        </span>
                      </div>

                      <span className="font-mono font-bold text-teal-800 shrink-0 text-xs">
                        {service.priceSDG.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{t('sdg')}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pricing & Fee Breakdown */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium text-slate-700">
              <span>{language === 'ar' ? 'سعر الخدمات المختارة' : 'Selected Services Fee'}:</span>
              <span className="font-bold text-slate-900 font-mono">{activeBasePrice.toLocaleString()} {t('sdg')}</span>
            </div>

            {/* If 5% cancellation penalty applies */}
            {priorCancellationPenalty > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('cancellationPenaltyNote')} (5%)</span>
                </div>
                <span className="font-bold">+{priorCancellationPenalty.toLocaleString()} {t('sdg')}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-slate-900">
              <span>{language === 'ar' ? 'المجموع المستحق عند الإتمام' : 'Total Due upon Completion'}:</span>
              <span className="text-teal-800 text-base font-mono">{totalPrice.toLocaleString()} {t('sdg')}</span>
            </div>

            <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'يتم الدفع للمهني مباشرة بعد انتهاء العمل: كاش أو عبر تطبيق بنكك' : 'Pay worker upon completion: Cash or Bankak'}</span>
            </div>
          </div>

          {/* Problem / Work Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {language === 'ar' ? 'تفاصيل الخدمة أو العطل المطلوب *' : 'Service / Work Details *'}
            </label>
            <textarea
              rows={3}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder={t('problemDescPlaceholder')}
              required
              className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Time Arrangement Note (Mutual agreement) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {language === 'ar' ? 'الموعد المقترح (تنسيق متبادل)' : 'Proposed Schedule (Mutual Agreement)'}
            </label>
            <input
              type="text"
              value={scheduledTimeNote}
              onChange={(e) => setScheduledTimeNote(e.target.value)}
              placeholder={t('scheduledNotePlaceholder')}
              className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 block">
              {t('scheduleAgreementNote')}
            </span>
          </div>

          {/* Location / Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 block">{t('state')}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 block">{t('neighborhood')}</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          {/* Detailed Street Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {language === 'ar' ? 'العنوان بالتفصيل ورقم المنزل أو المعلم *' : 'Detailed Address & Landmark *'}
            </label>
            <input
              type="text"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder={t('addressPlaceholder')}
              required
              className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Cancellation Notice */}
          <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-600 leading-relaxed border border-slate-200">
            {t('clientCancellationNotice')}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
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
