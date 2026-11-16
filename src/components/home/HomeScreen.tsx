import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Star, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Briefcase, 
  Banknote,
  CheckCircle2,
  Clock,
  UserPlus,
  MessageCircle,
  PhoneCall,
  Shield,
  Zap,
  Scissors,
  Wrench,
  Hammer,
  Award,
  Check,
  TrendingUp,
  Compass,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { SUDAN_STATES_CITIES } from '../../data/mockData';
import { CategoryIcon } from '../common/CategoryIcon';
import heroImage from '../../assets/images/mahara_trades_hero_1791698414128.jpg';
import hennaImage from '../../assets/images/henna_beauty_craft_1791698427609.jpg';
import tailorImage from '../../assets/images/tailor_embroidery_craft_1791698438179.jpg';
import electricImage from '../../assets/images/electrician_ac_repair_1791698448062.jpg';
import { ProviderCustomService, User } from '../../types';

// Category color palettes for vibrant, distinctive visual identity
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  tailor: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', glow: 'hover:border-rose-400' },
  henna_beauty: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', glow: 'hover:border-amber-400' },
  electrician_ac: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', glow: 'hover:border-sky-400' },
  plumber: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', glow: 'hover:border-blue-400' },
  builder_mason: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', glow: 'hover:border-orange-400' },
  carpenter: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', glow: 'hover:border-yellow-400' },
  painter: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', glow: 'hover:border-indigo-400' },
  barber: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', glow: 'hover:border-teal-400' },
  tutor: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', glow: 'hover:border-purple-400' },
  cook_catering: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', glow: 'hover:border-red-400' },
  cleaner: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', glow: 'hover:border-emerald-400' },
};

export const HomeScreen: React.FC = () => {
  const { t, language, dir } = useLanguage();
  const { currentUser } = useAuth();
  const { 
    providers, 
    categories,
    setActiveTab, 
    setSelectedProviderId, 
    setSelectedCategoryId,
    selectedCity,
    setSelectedCity,
    searchQuery,
    setSearchQuery,
    getProviderActiveServicesCount,
    openBookingModal,
    setAuthModalMode,
    setShowAuthModal
  } = useApp();

  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch.trim());
    setActiveTab('search');
  };

  const handleQuickTagClick = (tagQuery: string, categoryId?: string) => {
    setLocalSearch(tagQuery);
    setSearchQuery(tagQuery);
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
    setActiveTab('search');
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setActiveTab('search');
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setActiveTab('search');
  };

  const handleProviderClick = (providerId: string) => {
    setSelectedProviderId(providerId);
  };

  // Trending search suggestions
  const trendingTags = [
    { labelAr: 'صيانة مكيف وتعبئة فريون', labelEn: 'AC Repair & Gas Refill', query: 'مكيف', catId: 'electrician_ac', icon: '❄️' },
    { labelAr: 'تفصيل جلابية سودانية', labelEn: 'Custom Jalabiya Tailoring', query: 'جلابية', catId: 'tailor', icon: '✂️' },
    { labelAr: 'نقش حناء عرايسي', labelEn: 'Bridal Henna Art', query: 'حناء', catId: 'henna_beauty', icon: '✨' },
    { labelAr: 'سباكة وموتور مياه', labelEn: 'Plumbing & Water Pump', query: 'سباكة', catId: 'plumber', icon: '🔧' },
    { labelAr: 'كهرباء طبلات وتمديدات', labelEn: 'Electrical Wiring', query: 'كهرباء', catId: 'electrician_ac', icon: '⚡' },
    { labelAr: 'بناء ومحارة وسيراميك', labelEn: 'Masonry & Tiles', query: 'بناء', catId: 'builder_mason', icon: '🧱' },
  ];

  // Curate a set of top individual services for direct booking showcase
  const featuredServices = useMemo(() => {
    const list: { service: ProviderCustomService; provider: User; categoryName: string }[] = [];
    providers.forEach(p => {
      if (p.customServices && p.customServices.length > 0) {
        p.customServices.forEach(s => {
          const cat = categories.find(c => c.id === s.categoryId || c.id === p.tradeCategoryId);
          list.push({
            service: s,
            provider: p,
            categoryName: cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : (p.tradeTitleAr || '')
          });
        });
      }
    });
    // Return top 6 varied services
    return list.slice(0, 6);
  }, [providers, categories, language]);

  return (
    <div className="pb-28 max-w-5xl mx-auto px-4 pt-3 space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Cinematic Hero Section with High Impact Sudanese Presence */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl border border-slate-800">
        
        {/* Subtle Ambient Radial Lighting Glow */}
        <div className="absolute top-0 inset-x-0 h-64 bg-radial from-teal-500/20 via-emerald-600/5 to-transparent pointer-events-none" />
        <div className="absolute -bottom-10 -end-10 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative min-h-[350px] sm:min-h-[390px] flex flex-col justify-between p-6 sm:p-9 z-10">
          {/* Background image calibrated for ultra crisp text hierarchy */}
          <img 
            src={heroImage} 
            alt="Sudanese Craftsmen" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-luminosity scale-105 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-900/60 pointer-events-none" />

          {/* Top Pill Chip */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-teal-500/40 text-teal-300 text-xs font-semibold backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>{language === 'ar' ? 'سوق الحرفيين والمهنيين في السودان' : "Sudan's Trade & Craft Marketplace"}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300 font-bold">{language === 'ar' ? 'كاش وبنكك مباشرة' : 'Direct Cash & Bankak'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{language === 'ar' ? '+1,200 مهني معتمد' : '+1,200 Verified Trades'}</span>
            </div>
          </div>

          {/* Center Main Punchline */}
          <div className="relative z-10 max-w-2xl space-y-3.5 my-auto py-4">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.2] text-white">
              {language === 'ar' ? (
                <>
                  أفضل الحرفيين في حيك{' '}
                  <span className="text-emerald-400">
                    بضغطة زر وتنسيق فوري
                  </span>
                </>
              ) : (
                <>
                  Connect with Sudan's Finest{' '}
                  <span className="text-emerald-400">
                    Tradespeople & Craftsmen
                  </span>
                </>
              )}
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-300 font-normal leading-relaxed max-w-xl">
              {language === 'ar'
                ? 'خياطين، سباكين، فنيين تكييف وكهرباء، حنانات ومصففات شعر، وبنائين بأسعار محددة وتواصل مباشر بدون تعقيد.'
                : 'Verified tailors, electricians, plumbers, henna artists, and carpenters with transparent rates and direct phone contact.'}
            </p>

            {/* Smart Unified Search Bar */}
            <form onSubmit={handleSearchSubmit} className="pt-2">
              <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white/95 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl border border-white/20 gap-1.5 focus-within:ring-2 focus-within:ring-teal-400">
                
                {/* Search Input */}
                <div className="flex items-center flex-1 min-w-0 px-2 py-1">
                  <Search className="w-5 h-5 text-slate-400 ms-2 shrink-0" />
                  <input
                    type="text"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    placeholder={language === 'ar' ? 'ما الخدمة أو الحرفة التي تبحث عنها اليوم؟ (مثال: صيانة مكيف، حناء...)' : 'What service do you need? (e.g. AC repair, Henna, Tailor...)'}
                    className="w-full px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none font-medium"
                  />
                  {localSearch && (
                    <button
                      type="button"
                      onClick={() => setLocalSearch('')}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* City Quick Picker within Search */}
                <div className="hidden md:flex items-center border-s border-slate-200 ps-2 pe-1">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0 me-1" />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent py-2 px-1 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{language === 'ar' ? 'جميع المدن' : 'All Cities'}</option>
                    {Object.keys(SUDAN_STATES_CITIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs sm:text-sm font-black rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Search className="w-4 h-4" />
                  <span>{t('navSearch')}</span>
                </button>
              </div>
            </form>

            {/* Quick Trending Chips */}
            <div className="pt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-teal-300/90 flex items-center gap-1 me-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {language === 'ar' ? 'الأكثر طلباً:' : 'Trending:'}
              </span>
              {trendingTags.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickTagClick(tag.query, tag.catId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-teal-900/60 border border-slate-700/80 hover:border-teal-400 text-[11px] text-slate-200 hover:text-white transition-all cursor-pointer backdrop-blur-xs"
                >
                  <span>{tag.icon}</span>
                  <span>{language === 'ar' ? tag.labelAr : tag.labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4-Item Service & Policy Guarantee Strip */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block leading-tight">
                {language === 'ar' ? 'التزام بالطاقة الاستيعابية' : 'Capacity Guarantee'}
              </span>
              <span className="text-[10px] text-slate-400">
                {language === 'ar' ? 'سقف 3 خدمات نشطة لكل مهني' : 'Max 3 ongoing jobs for quality'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block leading-tight">
                {language === 'ar' ? 'سداد مباشر كاش أو بنكك' : 'Cash & Bankak Ready'}
              </span>
              <span className="text-[10px] text-slate-400">
                {language === 'ar' ? 'تحويل فوري مباشر للمهني' : 'Direct payment, zero hidden fees'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block leading-tight">
                {language === 'ar' ? 'أصحاب مهن معتمدون' : 'Vetted Tradespeople'}
              </span>
              <span className="text-[10px] text-slate-400">
                {language === 'ar' ? 'تدقيق الحسابات وسجل الأعمال' : 'Portfolio & identity checked'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-200 block leading-tight">
                {language === 'ar' ? 'تنسيق وتواصل مباشر' : 'Direct Coordination'}
              </span>
              <span className="text-[10px] text-slate-400">
                {language === 'ar' ? 'اتصال وواتساب فوري' : 'Call or WhatsApp at your pace'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Sudan Regional Cities Filter Bar */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">
              {language === 'ar' ? 'تصفح حسب المدينة أو الولاية' : 'Browse by City & State'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {language === 'ar' ? 'اختر مدينتك لعرض المهنيين الأقرب إليك' : 'Find providers closest to your neighborhood'}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none scroll-smooth">
          <button
            onClick={() => handleCitySelect('all')}
            className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer shadow-2xs ${
              selectedCity === 'all'
                ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {language === 'ar' ? '🇸🇩 جميع المدن' : '🇸🇩 All Cities'}
          </button>
          {Object.keys(SUDAN_STATES_CITIES).map(city => {
            const isSelected = selectedCity === city;
            const count = providers.filter(p => p.city === city || p.state === city).length;

            return (
              <button
                key={city}
                onClick={() => handleCitySelect(city)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-700 text-white ring-2 ring-teal-600 ring-offset-1'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-teal-50 hover:border-teal-200'
                }`}
              >
                <span>{city}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. High-Value Grid of Craft & Service Categories */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-600" />
              <span>{t('allCategories')}</span>
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              {language === 'ar' ? 'اختر التخصص المطلوب وتصفح قائمة الحرفيين وأسعارهم المعتمدة' : 'Select a trade category to view services and transparent starting prices'}
            </p>
          </div>
          <button 
            onClick={() => {
              setSelectedCategoryId(null);
              setActiveTab('search');
            }}
            className="flex items-center gap-1 text-xs font-black text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-colors cursor-pointer"
          >
            <span>{language === 'ar' ? 'عرض كافة الخدمات' : 'View All Services'}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((category) => {
            const style = CATEGORY_STYLES[category.id] || { 
              bg: 'bg-teal-50', 
              text: 'text-teal-700', 
              border: 'border-teal-200', 
              glow: 'hover:border-teal-400' 
            };
            const workerCount = providers.filter(p => 
              p.tradeCategoryId === category.id || 
              p.serviceCategoryIds?.includes(category.id) ||
              p.customServices?.some(s => s.categoryId === category.id)
            ).length;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`flex flex-col justify-between p-4 rounded-2xl bg-white border border-slate-200/90 hover:shadow-lg transition-all text-start group cursor-pointer relative overflow-hidden ${style.glow} hover:-translate-y-0.5 duration-200`}
              >
                {/* Top Badge & Icon */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl ${style.bg} ${style.text} flex items-center justify-center border ${style.border} group-hover:scale-105 transition-transform shadow-2xs`}>
                      <CategoryIcon iconName={category.iconName} className="w-5 h-5" />
                    </div>
                    {workerCount > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {workerCount} {language === 'ar' ? 'مهني' : 'workers'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-teal-800 transition-colors leading-snug">
                    {language === 'ar' ? category.nameAr : category.nameEn}
                  </h3>

                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {language === 'ar' ? category.descriptionAr : category.descriptionEn}
                  </p>
                </div>

                {/* Bottom Starting Price Badge */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between w-full">
                  <div className="text-[11px] font-semibold text-slate-600">
                    <span className="text-[10px] text-slate-400 block leading-tight">{t('priceStarting')}</span>
                    <span className="text-teal-700 font-extrabold text-xs">{category.averageRateSDG.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 ms-1 font-normal">{t('sdg')}</span>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-slate-50 group-hover:bg-teal-50 text-slate-400 group-hover:text-teal-600 flex items-center justify-center transition-colors">
                    <ArrowIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. "Featured Individual Services" Direct Booking Showcase (User constraint: Book individually!) */}
      {featuredServices.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{language === 'ar' ? 'خدمات معتمدة بأسعار ثابتة' : 'Fixed Price Verified Services'}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'احجز خدماتك الفردية مباشرة' : 'Book Individual Services Directly'}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('search')}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              {language === 'ar' ? 'تصفح كل الخدمات' : 'View All Services'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {featuredServices.map(({ service, provider, categoryName }) => {
              const activeCount = getProviderActiveServicesCount(provider.id);
              const isAtMaxCapacity = activeCount >= 3;

              return (
                <div
                  key={service.id}
                  className="rounded-2xl p-4 bg-white border border-slate-200/90 hover:border-teal-400/80 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Category pill & Capacity badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md">
                        {categoryName}
                      </span>
                      {isAtMaxCapacity ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {language === 'ar' ? 'مشغول حالياً' : 'Busy'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {language === 'ar' ? 'متاح للطلب' : 'Available'}
                        </span>
                      )}
                    </div>

                    {/* Service Name */}
                    <h3 className="font-extrabold text-sm text-slate-900 line-clamp-2 leading-snug">
                      {service.nameAr}
                    </h3>

                    {/* Provider mini info */}
                    <div 
                      onClick={() => handleProviderClick(provider.id)}
                      className="flex items-center gap-2 mt-3 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer border border-slate-100"
                    >
                      <img
                        src={provider.avatarUrl}
                        alt={provider.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 truncate block">
                            {provider.name}
                          </span>
                          <div className="flex items-center gap-0.5 text-[10px] text-amber-600 font-bold shrink-0">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{provider.rating?.toFixed(1) || '5.0'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {provider.city} · {provider.neighborhood}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Booking Trigger Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block leading-tight">{language === 'ar' ? 'سعر الخدمة' : 'Fixed Rate'}</span>
                      <div className="text-teal-700 font-black text-sm">
                        {service.priceSDG.toLocaleString()}
                        <span className="text-[10px] text-slate-500 ms-1 font-semibold">{t('sdg')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openBookingModal(provider, service.id)}
                      disabled={isAtMaxCapacity}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                        isAtMaxCapacity
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-teal-600 hover:bg-teal-500 text-white active:scale-98'
                      }`}
                    >
                      <span>{language === 'ar' ? 'احجز الخدمة' : 'Book Service'}</span>
                      <ArrowIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Visual Showcase: Special Sudanese Crafts Highlights */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {language === 'ar' ? 'أعمال وحرف مميزة في مهني' : 'Featured Craft Spotlights'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ar' ? 'أصالة الحرف التراثية وأحدث معايير الصيانة المنزلية' : 'Authentic heritage crafts and top modern domestic maintenance'}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Henna & Beauticians Spotlight */}
          <div 
            onClick={() => handleCategoryClick('henna_beauty')}
            className="group relative rounded-2xl overflow-hidden bg-slate-900 shadow-md cursor-pointer aspect-[4/3] border border-slate-800"
          >
            <img 
              src={hennaImage} 
              alt="Sudanese Henna" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-3.5 start-3.5 end-3.5 text-white">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block bg-amber-500/20 backdrop-blur-md px-2 py-0.5 rounded-md w-fit mb-1 border border-amber-400/30">
                {language === 'ar' ? 'تراث وأعراس' : 'Tradition & Weddings'}
              </span>
              <h3 className="text-base font-extrabold mt-0.5 leading-snug">
                {language === 'ar' ? 'نقش حناء سودانية وتصفيف شعر' : 'Traditional Henna & Styling'}
              </h3>
              <p className="text-[11px] text-slate-200 mt-1 line-clamp-1 opacity-90">
                {language === 'ar' ? 'خدمة منزلية مع حنانات معتمدات بأمان وخصوصية' : 'Home visits by trusted artists with privacy'}
              </p>
            </div>
          </div>

          {/* Tailoring & Embroidery Spotlight */}
          <div 
            onClick={() => handleCategoryClick('tailor')}
            className="group relative rounded-2xl overflow-hidden bg-slate-900 shadow-md cursor-pointer aspect-[4/3] border border-slate-800"
          >
            <img 
              src={tailorImage} 
              alt="Sudanese Tailoring" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-3.5 start-3.5 end-3.5 text-white">
              <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block bg-teal-500/20 backdrop-blur-md px-2 py-0.5 rounded-md w-fit mb-1 border border-teal-400/30">
                {language === 'ar' ? 'خياطة وتطريز فاخر' : 'Custom Tailoring'}
              </span>
              <h3 className="text-base font-extrabold mt-0.5 leading-snug">
                {language === 'ar' ? 'تفصيل جلاليب وتطريز تياب' : 'Jalabiya & Thobe Tailoring'}
              </h3>
              <p className="text-[11px] text-slate-200 mt-1 line-clamp-1 opacity-90">
                {language === 'ar' ? 'دقة في المقاسات وتشطيب سلك يدوي متقن' : 'Precise fittings, Swiss cotton & clean seams'}
              </p>
            </div>
          </div>

          {/* AC & Electrical Tech Spotlight */}
          <div 
            onClick={() => handleCategoryClick('electrician_ac')}
            className="group relative rounded-2xl overflow-hidden bg-slate-900 shadow-md cursor-pointer aspect-[4/3] border border-slate-800"
          >
            <img 
              src={electricImage} 
              alt="AC and Electrical Repair" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-3.5 start-3.5 end-3.5 text-white">
              <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider block bg-sky-500/20 backdrop-blur-md px-2 py-0.5 rounded-md w-fit mb-1 border border-sky-400/30">
                {language === 'ar' ? 'صيانة طوارئ' : 'Emergency Repair'}
              </span>
              <h3 className="text-base font-extrabold mt-0.5 leading-snug">
                {language === 'ar' ? 'فنيين تكييف وكهرباء منازل' : 'AC & Electrical Maintenance'}
              </h3>
              <p className="text-[11px] text-slate-200 mt-1 line-clamp-1 opacity-90">
                {language === 'ar' ? 'كشف فوري، تعبئة غاز وصيانة طبلات' : 'Inspection, parts, and gas refill'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Featured Available Providers List (Adhering to constraints: only Available/Busy status, no Book Service Now on cards, view profile) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {language === 'ar' ? 'حرفيون ومهنيون معتمدون' : 'Vetted Trade Specialists'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ar' ? 'تعرف على المهنيين وتصفح قوائم خدماتهم وأسعارهم المحددة' : 'Explore skilled tradespeople and their individual service catalogs'}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('search')}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
          >
            {language === 'ar' ? 'تصفح جميع المهنيين' : 'Browse All Workers'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.slice(0, 4).map((provider) => {
            const activeJobs = getProviderActiveServicesCount(provider.id);
            const isAtMaxCapacity = activeJobs >= 3;
            const servicesCount = provider.customServices?.length || 0;

            return (
              <div
                key={provider.id}
                onClick={() => handleProviderClick(provider.id)}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-500/60 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="relative shrink-0">
                      <img
                        src={provider.avatarUrl}
                        alt={provider.name}
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-2xs group-hover:scale-102 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-base text-slate-900 truncate group-hover:text-teal-800 transition-colors">
                          {provider.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-amber-600 font-extrabold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{provider.rating?.toFixed(1) || '5.0'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({provider.reviewCount})</span>
                        </div>
                      </div>

                      <p className="text-xs text-teal-700 font-bold truncate mt-0.5">
                        {provider.tradeTitleAr}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-teal-600" />
                          {provider.city} · {provider.neighborhood}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Highlights of their individual services */}
                  {provider.customServices && provider.customServices.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {provider.customServices.slice(0, 2).map(cs => (
                        <span 
                          key={cs.id}
                          className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                        >
                          • {cs.nameAr} ({cs.priceSDG.toLocaleString()} {t('sdg')})
                        </span>
                      ))}
                      {provider.customServices.length > 2 && (
                        <span className="text-[10px] text-slate-400 font-bold self-center">
                          +{provider.customServices.length - 2} {language === 'ar' ? 'خدمات إضافية' : 'more'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Capacity Status (Only Available or Busy) & Profile Navigation */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    {isAtMaxCapacity ? (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-bold text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {language === 'ar' ? 'مشغول حالياً' : 'Busy'}
                      </span>
                    ) : (
                      <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-bold text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {language === 'ar' ? 'متاح للطلب' : 'Available'}
                      </span>
                    )}
                  </div>

                  {/* View services and profile button (No "Book Service Now" on worker cards) */}
                  <div className="flex items-center gap-1.5 text-xs text-teal-800 font-black bg-teal-50 group-hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-colors">
                    <span>{servicesCount} {language === 'ar' ? 'خدمات متوفرة' : 'services'}</span>
                    <ArrowIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Interactive 3-Step "How Mehani Works" Guide */}
      <section className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl border border-slate-800">
        <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
            {language === 'ar' ? 'تجربة سهلة وموثوقة' : 'Simple & Transparent'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {language === 'ar' ? 'كيف تعمل منصة مهني في 3 خطوات؟' : 'How Mehani Works in 3 Steps'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            {language === 'ar'
              ? 'صممنا مهني لتلائم خصوصية وسرعة المعاملات في السودان بكل أمان ووضوح'
              : 'Designed for convenience, speed, and trusted interactions across Sudan'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="relative rounded-2xl p-5 bg-slate-800/60 border border-slate-700/60 flex flex-col items-start space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 font-black text-base flex items-center justify-center">
              1
            </div>
            <h3 className="text-base font-extrabold text-white">
              {language === 'ar' ? 'تصفح الخدمات والأسعار' : 'Browse Services & Rates'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'ar'
                ? 'استعرض قوائم الخدمات المحددة مسبقاً وتعرف على أسعارها وتقييمات العملاء السابقين للمهني في حيك.'
                : 'Check upfront rates, detailed service descriptions, and customer reviews in your neighborhood.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative rounded-2xl p-5 bg-slate-800/60 border border-slate-700/60 flex flex-col items-start space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-black text-base flex items-center justify-center">
              2
            </div>
            <h3 className="text-base font-extrabold text-white">
              {language === 'ar' ? 'احجز الخدمة وتواصل مباشرة' : 'Book & Direct Contact'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'ar'
                ? 'أرسل تفاصيل طلبك وحدد الوقت المناسب، وسيقوم المهني بقبول الطلب والتنسيق معك هاتفياً أو عبر واتساب.'
                : 'Send your service request, set the preferred timing, and communicate directly with the worker.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative rounded-2xl p-5 bg-slate-800/60 border border-slate-700/60 flex flex-col items-start space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-black text-base flex items-center justify-center">
              3
            </div>
            <h3 className="text-base font-extrabold text-white">
              {language === 'ar' ? 'الدفع كاش أو بنكك بعد الرضا' : 'Pay Cash or Bankak'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'ar'
                ? 'بعد إتمام الخدمة ومعاينتك للعمل، ادفع مباشرة للحرفي نقداً أو عبر تطبيق بنكك مع تقييم تجربتك.'
                : 'Inspect the completed craft, then pay directly to the provider via cash or Bankak transfer.'}
            </p>
          </div>
        </div>
      </section>

      {/* 8. Sudanese Customer Reviews & Trust Showcase */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {language === 'ar' ? 'تجارب وآراء العملاء' : 'Customer Stories & Trust'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ar' ? 'ماذا يقول زبائن مهني في الخرطوم وأم درمان وبورتسودان؟' : 'Real experiences from households across Sudan'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Review 1 */}
          <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'ar'
                  ? '"طلبت فني تكييف لصيانة مكيفين اسبلت في المعمورة، حضر في الموعد المحدد ومعه غاز الفريون وأصلح العطل باحترافية وسددت له عبر بنكك مباشرة."'
                  : '"Booked an AC technician for split units in Al-Mamoura. Arrived on time with refrigerant gas, did a clean job, and I paid smoothly via Bankak."'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-bold text-slate-800">أحمد الفاتح</span>
              <span>الخرطوم · المعمورة</span>
            </div>
          </div>

          {/* Review 2 */}
          <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'ar'
                  ? '"نقش الحناء مع الأستاذة إشراقة كان قمة في الروعة، حناء سودانية أصلية وسواد ثابت لمناسبة زواج أختي، التزام ودقة في المواعيد."'
                  : '"The henna session with Ishraqa was breathtaking! Genuine Sudanese dark henna for my sister\'s wedding, punctual and very respectful."'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-bold text-slate-800">سارة عبد الرحيم</span>
              <span>أم درمان · المهندسين</span>
            </div>
          </div>

          {/* Review 3 */}
          <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'ar'
                  ? '"فصلت جلابيتين سويسريتين عند الترزي عثمان، مقاسات مضبوطة جداً والتشطيب والتطريز في غاية الأناقة، منصة مهني سهلت علينا الكثير."'
                  : '"Tailored two Swiss cotton jalabiyas with Master Osman. Exact measurements and exquisite finishing. Mehani made trade bookings so convenient."'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-bold text-slate-800">محمد تاج الدين</span>
              <span>الخرطوم · الرياض</span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Provider Onboarding Banner (Join Mehani as a Trade Worker) */}
      <section className="rounded-3xl p-6 sm:p-7 bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 text-white shadow-xl border border-teal-800/40 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 text-center sm:text-start relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'انضم لشبكة مهني كمهني مستقل' : 'Join Mehani as a Service Provider'}</span>
          </div>
          <h3 className="text-lg sm:text-2xl font-black text-white">
            {language === 'ar' ? 'هل تمتلك مهنة أو حرفة؟ سجّل الآن واكسب زبائن جدد' : 'Have a Trade? Register & Grow Your Client Base'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            {language === 'ar'
              ? 'أضف قائمة خدماتك وأسعارك ومعرض أعمالك وتلقى طلبات حجز مباشرة من الزبائن في منطقتك مع إدارة سهلة لسقف أعمالك.'
              : 'Add your custom services, prices, and portfolio to reach thousands of clients with transparent booking.'}
          </p>

          <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-teal-200">
            <span className="flex items-center gap-1">✓ {language === 'ar' ? 'تسجيل مجاني' : 'Free Registration'}</span>
            <span className="flex items-center gap-1">✓ {language === 'ar' ? 'استلام مستحقاتك فورياً' : 'Instant Direct Payouts'}</span>
            <span className="flex items-center gap-1">✓ {language === 'ar' ? 'حرية كاملة في تحديد أسعارك' : 'Set Your Own Rates'}</span>
          </div>
        </div>

        <button
          onClick={() => {
            setAuthModalMode('register_provider');
            setShowAuthModal(true);
          }}
          className="px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 text-xs sm:text-sm font-black rounded-2xl transition-all shadow-lg hover:shadow-amber-400/20 shrink-0 cursor-pointer flex items-center gap-2 group relative z-10 active:scale-98"
        >
          <UserPlus className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
          <span>{language === 'ar' ? 'سجّل كصاحب مهنة الآن' : 'Register as Provider'}</span>
        </button>
      </section>

      {/* 10. WhatsApp Official VIP Support Card Section (+249 991 877 454) */}
      <section className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
        {/* Decorative ambient glow */}
        <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -start-16 w-48 h-48 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="space-y-2 text-center md:text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{language === 'ar' ? 'دعم فني مباشر عبر واتساب' : 'Direct WhatsApp Support'}</span>
              <span className="text-emerald-400/60">·</span>
              <span className="font-mono" dir="ltr">+249 991 877 454</span>
            </div>

            <h3 className="text-lg sm:text-2xl font-black text-white">
              {language === 'ar' 
                ? 'هل تحتاج مساعدة في الحجز أو التوثيق أو الاستفسارات؟' 
                : 'Need Help with Booking, Verification or Queries?'}
            </h3>

            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl leading-relaxed">
              {language === 'ar'
                ? 'فريق دعم منصة مهني متواجد للرد السريع على كافة استفسارات الزبائن وأصحاب المهن عبر حساب الواتساب الرسمي.'
                : 'Mehani support team is available on our official WhatsApp account to help clients and trade workers promptly.'}
            </p>
          </div>

          <a
            href={`https://wa.me/249991877454?text=${encodeURIComponent(
              language === 'ar'
                ? 'مرحباً فريق دعم منصة مهني السودان، أود الاستفسار والمساعدة بخصوص المنصة'
                : 'Hello Mehani Sudan Support team, I would like assistance regarding the platform'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/20 shrink-0 cursor-pointer flex items-center gap-2.5 group active:scale-98"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-5 h-5 fill-slate-950 text-slate-950" />
            </div>
            <div className="text-start rtl:text-right">
              <span className="block leading-none">{language === 'ar' ? 'تواصل معنا على واتساب' : 'Chat on WhatsApp'}</span>
              <span className="text-[11px] font-mono font-bold opacity-80 block mt-0.5" dir="ltr">+249 991 877 454</span>
            </div>
          </a>
        </div>
      </section>

      {/* 11. Floating Sticky WhatsApp Button */}
      <a
        href={`https://wa.me/249991877454?text=${encodeURIComponent(
          language === 'ar'
            ? 'مرحباً دعم منصة مهني، أود التواصل معكم'
            : 'Hello Mehani Support, I would like to chat'
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp Support"
        className="fixed bottom-20 end-4 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white/30 group cursor-pointer"
        title={language === 'ar' ? 'الدعم الفني عبر واتساب (+249 991 877 454)' : 'WhatsApp Support (+249 991 877 454)'}
      >
        <MessageCircle className="w-6 h-6 fill-white" />
        <span className="hidden sm:inline text-xs font-extrabold pe-1">
          {language === 'ar' ? 'واتساب الدعم' : 'Support'}
        </span>
      </a>

    </div>
  );
};
