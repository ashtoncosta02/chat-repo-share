import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Mail, MessageSquare, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateAgentNotifications,
  sendTestTranscriptEmail,
  sendTestTranscriptSms,
} from "@/lib/notifications.functions";

interface Props {
  agentId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  email: string | null;
  phone: string | null;
  accountEmail: string | null;
  onChange: (next: {
    notify_email_transcript: boolean;
    notify_sms_transcript: boolean;
    notify_email: string | null;
    notify_phone: string | null;
  }) => void;
}

export function NotificationsCard({
  emailEnabled,
  smsEnabled,
  email,
  phone,
  accountEmail,
  onChange,
}: Props) {
  const updateFn = useServerFn(updateAgentNotifications);
  const sendTestFn = useServerFn(sendTestTranscriptEmail);
  const sendTestSmsFn = useServerFn(sendTestTranscriptSms);

  const [emailDraft, setEmailDraft] = useState(email ?? accountEmail ?? "");
  const [phoneDraft, setPhoneDraft] = useState(phone ?? "");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingTestSms, setSendingTestSms] = useState(false);

  useEffect(() => {
    setEmailDraft(email ?? accountEmail ?? "");
  }, [email, accountEmail]);
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
    try {
      await updateFn({ data: patch });
      onChange({
        notify_email_transcript: emailEnabled,
        notify_sms_transcript: smsEnabled,
        notify_email: email,
        notify_phone: phone,
        ...patch,
      });
      toast.success("Saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save.";
      toast.error(msg);
      console.error(e);
    }
  };

  const toggleEmail = (next: boolean) => {
    // When turning email on for the first time, also persist the prefilled address
    if (next && !email && emailDraft.trim()) {
      void persist({
        notify_email_transcript: true,
        notify_email: emailDraft.trim(),
      });
    } else {
      void persist({ notify_email_transcript: next });
    }
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

  const sendTest = async () => {
    const target = (emailDraft.trim() || email || accountEmail || "").trim();
    if (!target) {
      toast.error("Enter an email address first.");
      return;
    }
    setSendingTest(true);
    try {
      await sendTestFn({ data: { to: target } });
      toast.success(`Test email sent to ${target}. Check your inbox (and spam).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test email failed.";
      toast.error(msg);
    } finally {
      setSendingTest(false);
    }
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
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground text-sm">Email transcript</div>
              <p className="text-xs text-muted-foreground">
                Send a full transcript to your inbox after every call.
              </p>
              {emailEnabled && (
                <div className="mt-3 space-y-2">
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
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={sendTest}
                    disabled={sendingTest}
                    className="h-8"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {sendingTest ? "Sending…" : "Send test email"}
                  </Button>
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
        Emails are sent from <span className="font-medium">hello@askjanice.net</span> right
        after each call. SMS delivery is coming soon — your preference is saved.
      </p>
    </div>
  );
}
