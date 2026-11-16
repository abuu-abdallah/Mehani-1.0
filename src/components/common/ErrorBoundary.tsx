import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = () => {
    safeStorage.clearAllMaharaData();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-white">
                حدث خطأ غير متوقع
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                واجه التطبيق استثناءً غير متوقع، لكن بياناتك محفوظة بأمان. يمكنك إعادة تحميل الصفحة أو إعادة تعيين الذاكرة المؤقتة.
              </p>
              {this.state.error && (
                <div className="p-3 bg-slate-950/60 rounded-xl text-[11px] font-mono text-rose-300 text-start overflow-x-auto max-h-24">
                  {this.state.error.message || 'Error occurred'}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة (Reload)</span>
              </button>

              <button
                onClick={this.handleResetAndReload}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>إعادة تعيين الذاكرة المحلية والبدء من جديد</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
