import logoAsset from "@/assets/janice-logo.png.asset.json";

export function AgentFactoryLogo({
  className = "",
  imgClassName = "h-10 w-auto object-contain",
}: {
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img src={logoAsset.url} alt="Janice — Your AI Receptionist" className={imgClassName} />
    </div>
  );
}
