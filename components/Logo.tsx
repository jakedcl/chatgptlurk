export function Logo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-900/40">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <path d="M3 9.5h18M8 3v3M16 3v3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
