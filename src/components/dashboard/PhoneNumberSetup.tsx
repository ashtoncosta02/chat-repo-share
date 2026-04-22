import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  searchNumbersByPostalCode,
  purchasePhoneNumber,
  releasePhoneNumber,
  type AvailableNumber,
} from "@/server/twilio-numbers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Search, Check, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OwnedNumber {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
}

interface Props {
  agentId: string;
}

function formatPhone(e164: string): string {
  // +14155551234 -> +1 (415) 555-1234
  const m = e164.match(/^\+(\d)(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

export function PhoneNumberSetup({ agentId }: Props) {
  const search = useServerFn(searchNumbersByPostalCode);
  const purchase = useServerFn(purchasePhoneNumber);
  const release = useServerFn(releasePhoneNumber);

  const [owned, setOwned] = useState<OwnedNumber[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(true);
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState<"US" | "CA">("US");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [searched, setSearched] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);

  const loadOwned = async () => {
    setLoadingOwned(true);
    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, friendly_name, locality, region, postal_code")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setOwned((data || []) as OwnedNumber[]);
    }
    setLoadingOwned(false);
  };

  useEffect(() => {
    loadOwned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postalCode.trim()) return;
    setSearching(true);
    setSearched(false);
    setResults([]);
    try {
      const res = await search({
        data: { postalCode: postalCode.trim(), country, voiceEnabled: true },
      });
      setSearched(true);
      if (!res.success) {
        toast.error(res.error);
      }
      setResults(res.numbers ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async (n: AvailableNumber) => {
    setBuying(n.phoneNumber);
    try {
      const res = await purchase({
        data: {
          phoneNumber: n.phoneNumber,
          agentId,
          postalCode: postalCode.trim() || undefined,
        },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${formatPhone(n.phoneNumber)} is yours!`);
      setResults((prev) => prev.filter((x) => x.phoneNumber !== n.phoneNumber));
      await loadOwned();
    } finally {
      setBuying(null);
    }
  };

  const handleRelease = async (id: string) => {
    if (!confirm("Release this number? It will be permanently disconnected.")) return;
    setReleasing(id);
    try {
      const res = await release({ data: { phoneNumberId: id } });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Number released.");
      await loadOwned();
    } finally {
      setReleasing(null);
    }
  };

  return (
    <div className="border border-border rounded-2xl bg-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Phone className="h-4 w-4 text-[var(--gold)]" />
        <h2 className="font-display text-lg font-bold text-foreground">Phone Number</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Give your agent a real phone number so customers can call or text it directly.
      </p>

      {/* Owned numbers */}
      {loadingOwned ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : owned.length > 0 ? (
        <div className="space-y-2 mb-4">
          {owned.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
            >
              <div>
                <div className="font-mono text-base font-semibold text-foreground">
                  {formatPhone(p.phone_number)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[p.locality, p.region, p.postal_code].filter(Boolean).join(", ") ||
                    "Active"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={releasing === p.id}
                onClick={() => handleRelease(p.id)}
              >
                {releasing === p.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Search form — always visible so users can add more numbers */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 min-w-0">
          <Label htmlFor="postal" className="text-xs font-bold uppercase tracking-wider">
            {country === "US" ? "ZIP Code" : "Postal Code"}
          </Label>
          <Input
            id="postal"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder={country === "US" ? "e.g. 90210" : "e.g. M5V 3A8"}
            maxLength={10}
            required
          />
        </div>
        <div>
          <Label htmlFor="country" className="text-xs font-bold uppercase tracking-wider">
            Country
          </Label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value as "US" | "CA")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </div>
        <Button type="submit" disabled={searching || !postalCode.trim()}>
          {searching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Searching…
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5 mr-1.5" /> Find numbers
            </>
          )}
        </Button>
      </form>

      {/* Results */}
      {searched && !searching && (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No numbers found near that area. Try a nearby postal code.
            </p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {results.length} numbers available near {postalCode.toUpperCase()}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                {results.map((n) => (
                  <div
                    key={n.phoneNumber}
                    className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-foreground truncate">
                        {formatPhone(n.phoneNumber)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[n.locality, n.region].filter(Boolean).join(", ") || n.isoCountry}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={buying === n.phoneNumber}
                      onClick={() => handleBuy(n)}
                    >
                      {buying === n.phoneNumber ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" /> Choose
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
