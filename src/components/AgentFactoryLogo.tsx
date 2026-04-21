export function AgentFactoryLogo({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <h1 className="font-display text-2xl leading-none">
        <span className="text-foreground font-semibold">Agent</span>{" "}
        <span className="text-[var(--gold)] italic font-semibold">Factory</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground tracking-wide">AI Voice Platform</p>
    </div>
  );
}
