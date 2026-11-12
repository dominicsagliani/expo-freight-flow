export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" className="fill-teal" />
      <path d="M8 9h9.5a7 7 0 0 1 0 14H8z" className="fill-navy" />
      <path d="M12 13h5.2a3 3 0 0 1 0 6H12z" className="fill-teal" />
      <rect x="20.5" y="21" width="5" height="2" rx="1" className="fill-navy" />
    </svg>
  );
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span
        className={`font-display text-lg font-bold tracking-tight ${inverse ? "text-sidebar-accent-foreground" : "text-foreground"}`}
      >
        DrayFlow
      </span>
    </div>
  );
}
