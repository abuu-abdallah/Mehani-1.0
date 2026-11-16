import React, { useState } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8 rounded-lg text-base',
  md: 'w-9 h-9 rounded-xl text-lg',
  lg: 'w-12 h-12 rounded-2xl text-xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'sm', className = '' }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} bg-teal-500 flex items-center justify-center font-bold text-slate-950 shadow-sm shrink-0 select-none ${className}`}
        aria-label="Mehani logo"
      >
        م
      </div>
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} bg-slate-800 border border-slate-700/70 overflow-hidden flex items-center justify-center shadow-sm shrink-0 ${className}`}
    >
      <img
        src="/logo.png"
        alt="Mehani | مهني"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
