import logoUrl from "@/assets/ask-janice-logo.png";

export function AgentFactoryLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={logoUrl}
        alt="Ask Janice — Your AI Receptionist"
        className="h-28 w-auto object-contain"
      />
    </div>
  );
}
