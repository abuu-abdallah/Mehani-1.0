import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Star, 
  X, 
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Tag,
  Briefcase,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';
import { SUDAN_STATES_CITIES } from '../../data/mockData';
import { CategoryIcon } from '../common/CategoryIcon';
import { User, ProviderCustomService } from '../../types';

export const SearchScreen: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { 
    providers, 
    categories,
    selectedCategoryId, 
    setSelectedCategoryId, 
    selectedCity,
    setSelectedCity,
    searchQuery,
    setSearchQuery,
    setSelectedProviderId,
    getProviderActiveServicesCount,
    openBookingModal,
    goBack
  } = useApp();

  const BackArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'rating' | 'price_asc' | 'price_desc'>('rating');
  const [viewMode, setViewMode] = useState<'services' | 'workers'>('services');

  // Filtered providers
  const filteredProviders = useMemo(() => {
    return providers.filter(provider => {
      // Category filter (support both primary and additional categories)
      if (selectedCategoryId) {
        const matchesPrimary = provider.tradeCategoryId === selectedCategoryId;
        const matchesAdditional = provider.serviceCategoryIds?.includes(selectedCategoryId);
        const matchesInCustom = provider.customServices?.some(s => s.categoryId === selectedCategoryId);
        if (!matchesPrimary && !matchesAdditional && !matchesInCustom) {
          return false;
        }
      }

      // City filter
      if (selectedCity !== 'all' && provider.city !== selectedCity && provider.state !== selectedCity) {
        return false;
      }

      // Search query (name, trade, bio, neighborhood)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = provider.name.toLowerCase().includes(q);
        const tradeArMatch = provider.tradeTitleAr?.toLowerCase().includes(q) || false;
        const tradeEnMatch = provider.tradeTitleEn?.toLowerCase().includes(q) || false;
        const neighborhoodMatch = provider.neighborhood.toLowerCase().includes(q);
        const cityMatch = provider.city.toLowerCase().includes(q);
        const serviceMatch = provider.customServices?.some(s => 
          s.nameAr.toLowerCase().includes(q) || (s.nameEn && s.nameEn.toLowerCase().includes(q))
        );

        if (!nameMatch && !tradeArMatch && !tradeEnMatch && !neighborhoodMatch && !cityMatch && !serviceMatch) {
          return false;
        }
      }

      // Concurrency availability filter: worker can have up to 3 ongoing services (< 3 is available)
      if (onlyAvailable) {
        const activeCount = getProviderActiveServicesCount(provider.id);
        if (activeCount >= 3) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.rating || 5) - (a.rating || 5);
      }
      return 0;
    });
  }, [providers, selectedCategoryId, selectedCity, searchQuery, onlyAvailable, sortBy, getProviderActiveServicesCount]);

  // Flattened individual services from all workers under matching categories
  const categoryServices = useMemo(() => {
    const list: {
      service: ProviderCustomService;
      provider: User;
      isAtMaxCapacity: boolean;
      activeJobs: number;
    }[] = [];

    filteredProviders.forEach(provider => {
      const activeJobs = getProviderActiveServicesCount(provider.id);
      const isAtMaxCapacity = activeJobs >= 3;

      const services = provider.customServices || [];
      services.forEach(svc => {
        // If a category is selected, filter services to this category
        if (selectedCategoryId) {
          const svcCat = svc.categoryId || provider.tradeCategoryId;
          if (svcCat !== selectedCategoryId && !provider.serviceCategoryIds?.includes(selectedCategoryId)) {
            return;
          }
        }

        // Search term filter on service name or provider name
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = svc.nameAr.toLowerCase().includes(q) || (svc.nameEn ? svc.nameEn.toLowerCase().includes(q) : false);
          const matchProv = provider.name.toLowerCase().includes(q) || (provider.tradeTitleAr ? provider.tradeTitleAr.toLowerCase().includes(q) : false);
          if (!matchTitle && !matchProv) return;
        }

        list.push({
          service: svc,
          provider,
          isAtMaxCapacity,
          activeJobs
        });
      });
    });

    // Sort individual services
    return list.sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.provider.rating || 5) - (a.provider.rating || 5);
      }
      if (sortBy === 'price_asc') {
        return a.service.priceSDG - b.service.priceSDG;
      }
      if (sortBy === 'price_desc') {
        return b.service.priceSDG - a.service.priceSDG;
      }
      return 0;
    });
  }, [filteredProviders, selectedCategoryId, searchQuery, sortBy, getProviderActiveServicesCount]);

  const activeCategoryObj = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="pb-24 max-w-5xl mx-auto px-4 pt-3 space-y-4">
      
      {/* Top Navigation Back Button Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title={language === 'ar' ? 'الرجوع للرئيسية' : 'Back to Home'}
        >
          <BackArrowIcon className="w-4 h-4 text-teal-600 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
          <span>{language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </button>

        {selectedCategoryId && (
          <button
            onClick={() => setSelectedCategoryId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إلغاء تصفية التصنيف' : 'Clear Category'}</span>
          </button>
        )}
      </div>

      {/* Header and Search Field */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {activeCategoryObj 
                ? (language === 'ar' ? `خدمات تصنيف: ${activeCategoryObj.nameAr}` : `Services: ${activeCategoryObj.nameEn}`)
                : t('navSearch')}
            </h1>
            <p className="text-xs text-slate-500">
              {language === 'ar' 
                ? 'استعرض جميع الخدمات والأسعار المحددة من مختلف الحرفيين مع إمكانية الحجز الفردي المباشر'
                : 'Browse all individual trade services and prices with instant itemized booking'}
            </p>
          </div>

          {/* Mode Switcher: View Services vs View Workers */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-200/80 w-fit text-xs font-bold">
            <button
              onClick={() => setViewMode('services')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'services'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'الخدمات والأسعار' : 'All Services & Prices'}</span>
              <span className="ms-0.5 text-[10px] px-1.5 py-0.2 bg-teal-100 text-teal-900 rounded-md">
                {categoryServices.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('workers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'workers'
                  ? 'bg-white text-teal-800 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'الحرفيون والمهنيون' : 'Trade Workers'}</span>
              <span className="ms-0.5 text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded-md">
                {filteredProviders.length}
              </span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xs focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500/20">
          <Search className="w-5 h-5 text-slate-400 ms-3.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث عن خدمة محددة (صيانة مكيف، تفصيل جلابية، سباكة، حناء...)' : 'Search specific service or worker...'}
            className="w-full px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2 text-slate-400 hover:text-slate-600 me-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Scroller */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            selectedCategoryId === null
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {language === 'ar' ? 'جميع التصنيفات' : 'All Categories'}
        </button>

        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategoryId(category.id === selectedCategoryId ? null : category.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedCategoryId === category.id
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CategoryIcon iconName={category.iconName} className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? category.nameAr : category.nameEn}</span>
          </button>
        ))}
      </div>

      {/* Filters Bar: City, Sort, Concurrency Toggle */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* City Select */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">{language === 'ar' ? 'جميع المدن السودانية' : 'All Sudanese Cities'}</option>
            {Object.keys(SUDAN_STATES_CITIES).map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="rating">{language === 'ar' ? 'الأعلى تقييماً' : 'Highest Rated'}</option>
            <option value="price_asc">{language === 'ar' ? 'الأقل سعراً للخدمة' : 'Lowest Price'}</option>
            <option value="price_desc">{language === 'ar' ? 'الأعلى سعراً للخدمة' : 'Highest Price'}</option>
          </select>
        </div>

        {/* Availability Toggle: Only Available Now (< 3 ongoing jobs) */}
        <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span>{language === 'ar' ? 'المتاحون الآن فقط' : 'Available Now'}</span>
        </label>
      </div>

      {/* VIEW 1: All Individual Services & Prices Under Categories */}
      {viewMode === 'services' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              {language === 'ar' 
                ? `عرض ${categoryServices.length} خدمة محددة جاهزة للحجز الفردي` 
                : `Showing ${categoryServices.length} specific services`}
            </span>
            <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-semibold">
              {language === 'ar' ? 'الدفع مباشرة للمهني كاش أو بنكك' : 'Direct cash or Bankak pay'}
            </span>
          </div>

          {categoryServices.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'لا توجد خدمات مطابقة في هذا التصنيف حالياً' : 'No services found matching this criteria'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {language === 'ar' 
                  ? 'جرب البحث بكلمات أخرى أو اختر تصنيفاً آخر أو قم بإلغاء الفلتر.'
                  : 'Try searching with different terms or reset your filters.'}
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId(null);
                  setSelectedCity('all');
                  setOnlyAvailable(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {categoryServices.map(({ service, provider, isAtMaxCapacity }) => {
                const cat = categories.find(c => c.id === (service.categoryId || provider.tradeCategoryId));
                return (
                  <div
                    key={`${provider.id}-${service.id}`}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-teal-500/50 hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      {/* Top: Service Title & Price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                            {service.nameAr}
                          </h3>
                          {cat && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                              <CategoryIcon iconName={cat.iconName} className="w-3 h-3" />
                              <span>{language === 'ar' ? cat.nameAr : cat.nameEn}</span>
                            </span>
                          )}
                        </div>

                        {/* Price Tag in SDG */}
                        <div className="text-end shrink-0">
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {language === 'ar' ? 'سعر الخدمة' : 'Service Rate'}
                          </span>
                          <span className="text-base sm:text-lg font-black text-teal-800 font-mono tabular-nums">
                            {service.priceSDG.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 ms-1 font-normal">{t('sdg')}</span>
                        </div>
                      </div>

                      {/* Provider info row */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <button
                          onClick={() => setSelectedProviderId(provider.id)}
                          className="flex items-center gap-2 group text-start cursor-pointer min-w-0"
                        >
                          <img
                            src={provider.avatarUrl}
                            alt={provider.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-teal-700 truncate block text-xs">
                              {provider.name}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{provider.city} · {provider.neighborhood}</span>
                            </span>
                          </div>
                        </button>

                        {/* Status (Only Available or Busy) & Rating */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{provider.rating?.toFixed(1) || '5.0'}</span>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isAtMaxCapacity 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isAtMaxCapacity ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <span>{isAtMaxCapacity ? (language === 'ar' ? 'مشغول' : 'Busy') : (language === 'ar' ? 'متاح' : 'Available')}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Service Booking Action Row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedProviderId(provider.id)}
                        className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        {language === 'ar' ? 'الملف ومعرض الأعمال' : 'View Profile'}
                      </button>

                      <button
                        disabled={isAtMaxCapacity}
                        onClick={() => {
                          if (isAtMaxCapacity) {
                            alert(t('capacityReached'));
                            return;
                          }
                          openBookingModal(provider, service.id);
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                          isAtMaxCapacity
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-teal-700 hover:bg-teal-600 active:scale-[0.99] text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isAtMaxCapacity ? (language === 'ar' ? 'مشغول حالياً' : 'Busy') : (language === 'ar' ? 'طلب هذه الخدمة' : 'Book this Service')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Workers & Providers List (No Book Now button on card, only View Services & Profile) */}
      {viewMode === 'workers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              {language === 'ar' 
                ? `تم العثور على ${filteredProviders.length} مهني وحرفي` 
                : `Found ${filteredProviders.length} workers`}
            </span>
          </div>

          {filteredProviders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'لم يتم العثور على نتائج تطابق هذا البحث' : 'No service providers found'}
              </h3>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId(null);
                  setSelectedCity('all');
                  setOnlyAvailable(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProviders.map(provider => {
                const activeJobs = getProviderActiveServicesCount(provider.id);
                const isAtMaxCapacity = activeJobs >= 3;
                const previewWork = provider.portfolio && provider.portfolio.length > 0 ? provider.portfolio[0] : null;
                const servicesList = provider.customServices || [];

                return (
                  <div
                    key={provider.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      
                      {/* Top: Avatar, Name, Rating, Availability */}
                      <div className="flex items-start gap-3">
                        <img
                          src={provider.avatarUrl}
                          alt={provider.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {provider.name}
                            </h2>
                            <div className="flex items-center gap-1 text-xs text-amber-600 font-bold shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>{provider.rating?.toFixed(1) || '5.0'}</span>
                              <span className="text-[10px] text-slate-400">({provider.reviewCount})</span>
                            </div>
                          </div>

                          <p className="text-xs text-teal-700 font-semibold truncate mt-0.5">
                            {provider.tradeTitleAr}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {provider.city} · {provider.neighborhood}
                            </span>

                            {/* Clean Status badge: Only Available or Busy */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isAtMaxCapacity 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isAtMaxCapacity ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              <span>{isAtMaxCapacity ? (language === 'ar' ? 'مشغول' : 'Busy') : (language === 'ar' ? 'متاح' : 'Available')}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bio Preview */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {provider.bioAr}
                      </p>

                      {/* Services Menu Preview Tags */}
                      {servicesList.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-teal-700" />
                              <span>{language === 'ar' ? 'الخدمات المتاحة:' : 'Services:'}</span>
                            </span>
                            <span className="text-[10px] text-teal-700 font-bold">
                              {servicesList.length} {language === 'ar' ? 'خدمات معتمدة' : 'services'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {servicesList.slice(0, 3).map(svc => (
                              <span
                                key={svc.id}
                                className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-medium"
                              >
                                {svc.nameAr} ({svc.priceSDG.toLocaleString()} {t('sdg')})
                              </span>
                            ))}
                            {servicesList.length > 3 && (
                              <span className="text-[10px] text-slate-400 self-center">
                                +{servicesList.length - 3} {language === 'ar' ? 'المزيد' : 'more'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Past Work Sample */}
                      {previewWork && (
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                          <img
                            src={previewWork.imageUrl}
                            alt={previewWork.titleAr}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                              {language === 'ar' ? 'عينة أعمال' : 'Work Sample'}
                            </span>
                            <span className="text-xs font-medium text-slate-800 truncate block">
                              {previewWork.titleAr}
                            </span>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Card Action Button: REQUIREMENT 4: Remove "Book Service Now" button from workers cards.
                        Single clear button: "View Services & Price List" */}
                    <div className="bg-slate-50 border-t border-slate-100 p-3">
                      <button
                        onClick={() => setSelectedProviderId(provider.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-300" />
                        <span>{language === 'ar' ? 'عرض الخدمات والأسعار والملف' : 'View Services & Prices'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
