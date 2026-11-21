import React from 'react';
import { ShieldCheck, X, ExternalLink, Lock, EyeOff, Bell, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const { language, dir } = useLanguage();

  if (!isOpen) return null;

  const isAr = language === 'ar';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      dir={dir}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 dark:bg-slate-950 border-b border-slate-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                {isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Data Protection'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAr ? 'تطبيق ومنصة مهني (Mehani)' : 'Mehani Sudan Platform'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                {isAr ? '1. البيانات التي يتم جمعها' : '1. Information We Collect'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'نجمع الاسم الكامل، رقم الهاتف السوداني، البريد الإلكتروني (لاستعادة كلمة المرور)، والولاية/الحي المدخل يدوياً لتسهيل مطابقة الحرفيين القريبين. لمقدمي الخدمة، نطلب صورة الرقم الوطني أو جواز السفر للتحقق الإداري فقط.'
                  : 'We collect your full name, Sudanese phone number, email address (for password recovery), and manually selected city/neighborhood to match nearby workers. Providers upload a National ID or Passport copy solely for admin identity verification.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <EyeOff className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                {isAr ? '2. سرية أرقام الهواتف والوثائق' : '2. Phone & Document Privacy'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'لا نبيع بياناتك لأي طرف ثالث. يظهر رقم الهاتف بين العميل والحرفي فقط أثناء سريان الطلب، ويُخفى تلقائياً بعد الإكمال أو الإلغاء. وثائق الهوية خاصة بالإدارة وصاحب الحساب فقط.'
                  : 'We never sell your data. Phone numbers are shared between matched customer and provider only during an active booking and automatically hidden once completed or cancelled. ID documents remain strictly private.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                {isAr ? '3. الإشعارات والعمل بالخلفية' : '3. Notifications & Background Sync'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'يستخدم تطبيق أندرويد خدمة الإشعارات لإيصال تنبيهات الطلبات الفورية حتى عند إغلاق التطبيق، وتتوقف فوراً عند تسجيل الخروج.'
                  : 'The Android app uses a foreground messaging sync solely to deliver real-time booking alerts while closed. Signing out immediately stops background sync.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white mb-1">
                {isAr ? '4. حذف الحساب ومنع إعادة التسجيل' : '4. Account Deletion & Re-Registration Prevention'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'يمكنك حذف حسابك في أي وقت من إعدادات الملف الشخصي أو عبر الرابط العام. تُمسح بياناتك ونشاطك فوراً، مع الاحتفاظ برقم الهاتف لمنع استخدامه مجدداً وحفظ نسخة سرية من وثيقة الهوية لمقدمي الخدمة لمراجعتها إدارياً ومنع الحسابات البديلة.'
                  : 'You can delete your account anytime from Profile Settings or our web portal. Profile and activity are erased immediately, while your phone number is permanently blocked from future sign-ups and provider ID copies stay in an admin-only anti-fraud archive.'}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <a
              href={`/privacy-policy.html?lang=${language}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400 hover:underline"
            >
              <span>{isAr ? 'فتح النسخة الكاملة على الويب' : 'Open Full Web Policy'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ahmedmostafaomer02@gmail.com
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
