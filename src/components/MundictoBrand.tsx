import { useId } from 'react';

interface MundictoBrandProps {
  compact?: boolean;
  centered?: boolean;
}

export function MundictoMark({ compact = false }: { compact?: boolean }) {
  const gradientId = useId();
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-[0.9rem] border border-[#41f4c2]/25 bg-[#07131b] shadow-[0_10px_30px_rgba(18,212,154,0.18)] ${compact ? 'h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]' : 'h-16 w-16'}`}>
      <div className="absolute inset-[3px] rounded-[0.72rem] border border-white/[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(216,255,241,0.17),transparent_35%),linear-gradient(145deg,rgba(18,212,154,0.16),rgba(4,12,20,0)_62%)]" />
      <svg viewBox="0 0 64 64" aria-hidden="true" className="relative h-full w-full">
        <path d="M14 45V19l18 16 18-16v26" fill="none" stroke={`url(#${gradientId})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="7.5" />
        <path d="M21 25v18M43 25v18" fill="none" stroke="rgba(216,255,241,0.2)" strokeLinecap="round" strokeWidth="3" />
        <circle cx="32" cy="44" r="3.5" fill="#41f4c2" />
        <circle cx="32" cy="44" r="7" fill="none" stroke="rgba(65,244,194,0.18)" strokeWidth="2" />
        <defs>
          <linearGradient id={gradientId} x1="12" x2="52" y1="16" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#effff9" />
            <stop offset="0.48" stopColor="#7fffd4" />
            <stop offset="1" stopColor="#12d49a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function MundictoBrand({ compact = false, centered = false }: MundictoBrandProps) {
  return (
    <div className={`flex min-w-0 items-center ${centered ? 'justify-center' : ''} ${compact ? 'gap-3 sm:gap-4' : 'gap-4'}`}>
      <div className="relative shrink-0">
        <div className="absolute inset-1 rounded-2xl bg-[#12d49a]/25 blur-xl" />
        <MundictoMark compact={compact} />
      </div>
      <div className="min-w-0 border-l border-white/10 pl-3 sm:pl-4">
        <div aria-label="Mundicto" className={`brand-wordmark flex items-center uppercase leading-[0.9] text-white ${compact ? 'text-[1.35rem] sm:text-[1.65rem]' : 'text-3xl'}`}>
          <span aria-hidden="true" className="brand-wordmark-text">MUNDICT</span>
          <span aria-hidden="true" className="brand-target-o"><span /></span>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <span className="h-px w-4 shrink-0 bg-gradient-to-r from-[#41f4c2] to-[#41f4c2]/20 sm:w-6" />
          <p className={`truncate font-bold uppercase tracking-[0.2em] text-white/45 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'}`}>World Cup Predictor</p>
        </div>
      </div>
    </div>
  );
}
