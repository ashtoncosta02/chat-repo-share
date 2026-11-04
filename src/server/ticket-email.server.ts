// Support-ticket notification emails. Never throws: email failures must not
// fail the ticket action.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { escapeHtml } from "@/server/oauth-html.server";
import { PUBLIC_APP_ORIGIN } from "@/lib/app-origin";

const SUPPORT_INBOX = "hello@askjanice.net";

function nl2br(text: string) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

async function customerEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("email").eq("user_id", userId).maybeSingle();
  return data?.email ?? null;
}

export async function notifySupportOfTicket(opts: {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
  kind: "new" | "reply";
}): Promise<void> {
  try {
    const { sendEmail } = await import("@/server/email.server");
    const from = (await customerEmail(opts.userId)) ?? "unknown customer";
    const link = `${PUBLIC_APP_ORIGIN}/dashboard/admin/tickets/${opts.ticketId}`;
    await sendEmail({
      to: SUPPORT_INBOX,
      subject: `${opts.kind === "new" ? "New support ticket" : "Customer replied"}: ${opts.subject.slice(0, 150)}`,
      html: `<p><strong>${opts.kind === "new" ? "New ticket" : "New reply"}</strong> from ${escapeHtml(from)}</p>
<p><strong>Subject:</strong> ${escapeHtml(opts.subject)}</p>
<blockquote>${nl2br(opts.body)}</blockquote>
<p><a href="${escapeHtml(link)}">Open the ticket</a></p>`,
    });
  } catch (e) {
    console.error("notifySupportOfTicket failed", e);
  }
}

export async function notifyCustomerOfAdminReply(opts: { ticketId: string; body: string }): Promise<void> {
  try {
    const { data: ticket } = await supabaseAdmin.from("tickets").select("user_id, subject").eq("id", opts.ticketId).maybeSingle();
    if (!ticket) return;
    const to = await customerEmail(ticket.user_id);
    if (!to) return;
    const { sendEmail } = await import("@/server/email.server");
    await sendEmail({
      to,
      subject: `Re: ${String(ticket.subject).slice(0, 150)}`,
      html: `<p>Our team replied to your support request <strong>${escapeHtml(ticket.subject)}</strong>:</p>
<blockquote>${nl2br(opts.body)}</blockquote>
<p><a href="${PUBLIC_APP_ORIGIN}/dashboard/help">View the conversation</a></p>`,
    });
  } catch (e) {
    console.error("notifyCustomerOfAdminReply failed", e);
  }
}
