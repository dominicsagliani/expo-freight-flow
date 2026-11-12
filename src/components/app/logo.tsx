import iconSrc from "@/assets/expohaul-icon.png";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return <img src={iconSrc} alt="" aria-hidden="true" width={256} height={256} className={`rounded-[22%] ${className}`} />;
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="ExpoHaul">
      <LogoMark />
      <span
        className={`font-display text-lg tracking-tight ${inverse ? "text-sidebar-accent-foreground" : "text-foreground"}`}
      >
        <span className="font-bold">Expo</span>
        <span className="font-normal">Haul</span>
      </span>
    </div>
  );
}
