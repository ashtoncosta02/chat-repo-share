import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as UserIcon, Mail, KeyRound, CreditCard, LogOut } from "lucide-react";

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: businessName } = useQuery({
    queryKey: ["account-menu-business-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("business_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.business_name?.trim() || null;
    },
  });
  if (!user) return null;

  const label = businessName || "Profile";
  const initial = (businessName || user.email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 hover:bg-muted transition-colors"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[oklch(0.96_0.04_290)] text-[var(--gold-foreground)] text-xs font-semibold">
          {initial}
        </span>
        <span className="hidden sm:inline text-sm text-foreground max-w-[200px] truncate">
          {label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <span className="text-sm font-medium truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard/account" className="flex items-center gap-2 cursor-pointer">
            <UserIcon className="h-4 w-4" /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/account" hash="email" className="flex items-center gap-2 cursor-pointer">
            <Mail className="h-4 w-4" /> Change email
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/account" hash="password" className="flex items-center gap-2 cursor-pointer">
            <KeyRound className="h-4 w-4" /> Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/account" hash="billing" className="flex items-center gap-2 cursor-pointer">
            <CreditCard className="h-4 w-4" /> Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
