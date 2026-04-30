import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { checkIsAdmin } from "@/server/admin.functions";

export function useIsAdmin() {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session?.access_token) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    checkIsAdmin({ data: { accessToken: session.access_token } })
      .then((res) => {
        if (cancelled) return;
        setIsAdmin(res.isAdmin);
        setChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return { isAdmin, checked };
}
