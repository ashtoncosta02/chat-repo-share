import logoUrl from "@/assets/ask-janice-logo.png";

export function AgentFactoryLogo({
  className = "",
  imgClassName = "h-10 w-auto object-contain",
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img src={logoUrl} alt="Ask Janice — Your AI Receptionist" className={imgClassName} />
    </div>
  );
}
