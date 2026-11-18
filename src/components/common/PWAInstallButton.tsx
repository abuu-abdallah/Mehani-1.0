import React, { useState } from 'react';
import { Download, Smartphone, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../context/LanguageContext';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { language } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-colors cursor-pointer shrink-0"
        title={language === 'ar' ? 'تثبيت تطبيق مهني على جهازك' : 'Install Mehani App'}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden md:inline">
          {language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
          title={language === 'ar' ? 'إضافة للشاشة الرئيسية' : 'Add to Home Screen'}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {language === 'ar' ? 'تثبيت' : 'Install'}
          </span>
        </button>

        {showIOSGuide && (
          <div
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h3 className="text-base font-extrabold">
                    {language === 'ar' ? 'تثبيت مهني على iPhone / iPad' : 'Install Mehani on iPhone / iPad'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    {language === 'ar' ? (
                      <>
                        اضغط على زر <strong>المشاركة (Share)</strong>{' '}
                        <Share className="w-3.5 h-3.5 inline text-teal-700 dark:text-teal-400" /> في شريط متصفح Safari بالأسفل.
                      </>
                    ) : (
                      <>
                        Tap the <strong>Share</strong> button{' '}
                        <Share className="w-3.5 h-3.5 inline text-teal-700 dark:text-teal-400" /> in Safari&apos;s toolbar.
                      </>
                    )}
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    {language === 'ar' ? (
                      <>
                        مرر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                      </>
                    ) : (
                      <>
                        Scroll down and tap <strong>Add to Home Screen</strong>.
                      </>
                    )}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                {language === 'ar' ? 'فهمت' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
