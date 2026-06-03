import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  agentId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  email: string | null;
  phone: string | null;
  onChange: (next: {
    notify_email_transcript: boolean;
    notify_sms_transcript: boolean;
    notify_email: string | null;
    notify_phone: string | null;
  }) => void;
}

export function NotificationsCard({
  agentId,
  emailEnabled,
  smsEnabled,
  email,
  phone,
  onChange,
}: Props) {
  const [emailDraft, setEmailDraft] = useState(email ?? "");
  const [phoneDraft, setPhoneDraft] = useState(phone ?? "");

  useEffect(() => {
    setEmailDraft(email ?? "");
  }, [email]);
  useEffect(() => {
    setPhoneDraft(phone ?? "");
  }, [phone]);

  const persist = async (
    patch: Partial<{
      notify_email_transcript: boolean;
      notify_sms_transcript: boolean;
      notify_email: string | null;
      notify_phone: string | null;
    }>,
  ) => {
    const { error } = await supabase.from("agents").update(patch).eq("id", agentId);
    if (error) {
      toast.error("Couldn't save notification settings.");
      console.error(error);
      return;
    }
    onChange({
      notify_email_transcript: emailEnabled,
      notify_sms_transcript: smsEnabled,
      notify_email: email,
      notify_phone: phone,
      ...patch,
    });
  };

  const toggleEmail = (next: boolean) => {
    void persist({ notify_email_transcript: next });
  };
  const toggleSms = (next: boolean) => {
    void persist({ notify_sms_transcript: next });
  };

  const saveEmail = () => {
    const trimmed = emailDraft.trim() || null;
    if (trimmed === (email ?? null)) return;
    void persist({ notify_email: trimmed });
  };
  const savePhone = () => {
    const trimmed = phoneDraft.trim() || null;
    if (trimmed === (phone ?? null)) return;
    void persist({ notify_phone: trimmed });
  };

  return (
    <div className="border border-border rounded-2xl bg-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-[var(--gold)]" />
        <h2 className="font-display text-lg font-bold text-foreground">Notifications</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Get a transcript every time your receptionist finishes a call.
      </p>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-start gap-3 min-w-0">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-sm">Email transcript</div>
              <p className="text-xs text-muted-foreground">
                Send a full transcript to your inbox after every call.
              </p>
              {emailEnabled && (
                <div className="mt-3">
                  <Label htmlFor="notify-email" className="text-xs">
                    Send to
                  </Label>
                  <Input
                    id="notify-email"
                    type="email"
                    placeholder="you@example.com"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    onBlur={saveEmail}
                    className="mt-1 h-9"
                  />
                </div>
              )}
            </div>
          </div>
          <Switch checked={emailEnabled} onCheckedChange={toggleEmail} />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-start gap-3 min-w-0">
            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-sm">SMS transcript</div>
              <p className="text-xs text-muted-foreground">
                Text a short transcript to your phone after every call.
              </p>
              {smsEnabled && (
                <div className="mt-3">
                  <Label htmlFor="notify-phone" className="text-xs">
                    Send to
                  </Label>
                  <Input
                    id="notify-phone"
                    type="tel"
                    placeholder="+1 555 123 4567"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    onBlur={savePhone}
                    className="mt-1 h-9"
                  />
                </div>
              )}
            </div>
          </div>
          <Switch checked={smsEnabled} onCheckedChange={toggleSms} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Delivery turns on once we wire up the integration — your preferences are saved.
      </p>
    </div>
  );
}
