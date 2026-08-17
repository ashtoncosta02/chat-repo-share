import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface CheckoutOptions {
  priceId: string;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
  trialDays?: number;
}

/**
 * Opens Stripe's embedded checkout inside a modal overlay.
 * Usage: const { openCheckout, checkoutElement } = useStripeCheckout();
 */
export function useStripeCheckout() {
  const [options, setOptions] = useState<CheckoutOptions | null>(null);

  const openCheckout = useCallback((opts: CheckoutOptions) => {
    setOptions(opts);
  }, []);

  const closeCheckout = useCallback(() => setOptions(null), []);

  const checkoutElement = options ? (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative mx-auto my-8 w-full max-w-2xl rounded-2xl bg-background p-4 shadow-xl sm:p-6">
        <button
          type="button"
          onClick={closeCheckout}
          aria-label="Close checkout"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <StripeEmbeddedCheckout {...options} />
      </div>
    </div>
  ) : null;

  return { openCheckout, closeCheckout, isOpen: options !== null, checkoutElement };
}
