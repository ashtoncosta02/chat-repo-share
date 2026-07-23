import { Check, X } from "lucide-react";
import { checkPassword } from "@/lib/password-strength";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = checkPassword(password);
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {checks.map((c) => (
        <li
          key={c.label}
          className={c.passed ? "flex items-center gap-1.5 text-green-600" : "flex items-center gap-1.5 text-muted-foreground"}
        >
          {c.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
