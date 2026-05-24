import logoUrl from "@/assets/ask-kira-logo.png";

export function AgentFactoryLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={logoUrl}
        alt="Ask Kira"
        className="h-12 w-12 object-contain shrink-0"
      />
      <div>
        <h1 className="font-display text-2xl leading-none">
          <span className="text-foreground font-semibold">Ask</span>{" "}
          <span className="text-[var(--gold)] italic font-semibold">Kira</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground tracking-wide">
          Your AI Receptionist
        </p>
      </div>
    </div>
  );
}
