import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startOutboundCall } from "@/lib/dialer.functions";
import { Phone, Delete, Loader2, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const CALLBACK_KEY = "askkira.dialer.callback";

interface DialerPanelProps {
  onClose?: () => void;
}

export function DialerPanel({ onClose }: DialerPanelProps) {
  const [number, setNumber] = useState("");
  const [callback, setCallback] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [calling, setCalling] = useState(false);
  const callFn = useServerFn(startOutboundCall);

  useEffect(() => {
    const saved = localStorage.getItem(CALLBACK_KEY);
    if (saved) setCallback(saved);
    else setShowSettings(true);
  }, []);

  const press = (k: string) => setNumber((n) => (n + k).slice(0, 18));
  const backspace = () => setNumber((n) => n.slice(0, -1));

  const handleCall = async () => {
    const target = number.trim();
    if (!target) {
      toast.error("Enter a number to dial.");
      return;
    }
    if (!callback.trim()) {
      setShowSettings(true);
      toast.error("Set your callback number first.");
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Please sign in again.");
      return;
    }
    setCalling(true);
    try {
      const res = await callFn({ data: { accessToken: token, to: target, myPhone: callback.trim() } });
      if (res.success) {
        toast.success(`Ringing your phone — pick up to connect to ${res.dialed}`);
        setNumber("");
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Call failed.");
    } finally {
      setCalling(false);
    }
  };

  const saveCallback = () => {
    localStorage.setItem(CALLBACK_KEY, callback.trim());
    setShowSettings(false);
    toast.success("Callback number saved.");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dialer</span>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dialer settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {showSettings && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Your phone (we ring you first)
          </label>
          <Input
            value={callback}
            onChange={(e) => setCallback(e.target.value)}
            placeholder="+1 555 123 4567"
            className="h-9 text-sm"
          />
          <button
            onClick={saveCallback}
            className="w-full text-xs font-medium bg-foreground text-background rounded-md py-2 hover:opacity-90"
          >
            Save
          </button>
        </div>
      )}

      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value.slice(0, 18))}
        placeholder="Number to dial"
        className="text-center font-mono text-lg h-12"
      />

      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="aspect-square rounded-full bg-[oklch(0.96_0.04_290)] text-[var(--gold-foreground)] font-display text-xl font-semibold hover:opacity-80 active:scale-95 transition"
          >
            {k}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleCall}
          disabled={calling || !number}
          className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white font-medium text-base py-3 hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {calling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
          Call
        </button>
        <button
          onClick={backspace}
          disabled={!number}
          className="rounded-full bg-muted text-foreground p-3 hover:bg-muted/70 disabled:opacity-40"
          aria-label="Backspace"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
