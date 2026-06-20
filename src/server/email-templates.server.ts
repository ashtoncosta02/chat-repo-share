// Branded HTML email templates. Keep styles inline — most email clients
// strip <style> blocks. Server-only.

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(opts: { preheader: string; title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escape(opts.preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f3ef;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <tr><td style="padding:24px 32px;border-bottom:1px solid #eee;">
        <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#1a1a1a;">Ask Janice</div>
      </td></tr>
      <tr><td style="padding:28px 32px 32px 32px;font-size:15px;line-height:1.55;color:#1a1a1a;">
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #eee;font-size:12px;color:#888;">
        Sent by your Ask Janice AI receptionist · <a href="https://askjanice.net" style="color:#888;text-decoration:underline;">askjanice.net</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-call transcript (to business owner)
// ─────────────────────────────────────────────────────────────────────────────

export interface TranscriptEmailInput {
  businessName: string;
  callerNumber: string | null;
  startedAt: Date;
  durationSeconds: number;
  summary: string | null;
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  conversationDashboardUrl?: string | null;
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
}

export function renderTranscriptEmail(input: TranscriptEmailInput): {
  subject: string;
  html: string;
} {
  const dur = formatDuration(input.durationSeconds);
  const when = input.startedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Caller details block — at the very top so the owner sees who called
  // before scrolling through the transcript.
  const leadName = input.lead?.name?.trim() || null;
  const leadEmail = input.lead?.email?.trim() || null;
  const leadPhone = input.lead?.phone?.trim() || input.callerNumber || null;
  const leadAddress = input.lead?.address?.trim() || null;
  const hasLeadInfo = !!(leadName || leadEmail || leadPhone || leadAddress);

  const leadRows: string[] = [];
  if (leadName) leadRows.push(row("Name", leadName));
  if (leadPhone) leadRows.push(row("Phone", leadPhone));
  if (leadEmail) leadRows.push(row("Email", leadEmail));
  if (leadAddress) leadRows.push(row("Address", leadAddress));

  const leadBlock = hasLeadInfo
    ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:0 0 10px 0;">Caller details</div>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f5f3ef;border-radius:8px;overflow:hidden;margin:0 0 20px 0;">
         ${leadRows.join("")}
       </table>`
    : "";

  const headerLine = hasLeadInfo
    ? `${escape(when)} · ${escape(dur)}`
    : `${input.callerNumber ? `from <strong>${escape(input.callerNumber)}</strong>` : "from an unknown number"} · ${escape(when)} · ${escape(dur)}`;

  const turnsHtml = input.turns
    .map((t) => {
      const who = t.role === "assistant" ? "Janice" : "Caller";
      const color = t.role === "assistant" ? "#1a1a1a" : "#374151";
      const bg = t.role === "assistant" ? "#f5f3ef" : "#ffffff";
      const border = t.role === "assistant" ? "transparent" : "#eee";
      return `<div style="margin:0 0 10px 0;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:4px;">${who}</div>
        <div style="color:${color};white-space:pre-wrap;">${escape(t.content)}</div>
      </div>`;
    })
    .join("");

  const summaryBlock = input.summary
    ? `<div style="margin:0 0 20px 0;padding:14px 16px;background:#f5f3ef;border-radius:8px;">
         <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:6px;">Summary</div>
         <div>${escape(input.summary)}</div>
       </div>`
    : "";

  const dashboardBtn = input.conversationDashboardUrl
    ? `<div style="margin:24px 0 8px 0;">
         <a href="${escape(input.conversationDashboardUrl)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500;">Open conversation</a>
       </div>`
    : "";

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;letter-spacing:-0.01em;">New call transcript</h1>
    <p style="margin:0 0 20px 0;color:#666;">${headerLine}</p>
    ${leadBlock}
    ${summaryBlock}
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:0 0 10px 0;">Transcript</div>
    ${turnsHtml || `<p style="color:#888;">No transcript captured.</p>`}
    ${dashboardBtn}
  `;

  const subject = `Call transcript · ${leadName ? leadName + " · " : ""}${input.businessName} · ${when}`;
  return {
    subject,
    html: shell({
      preheader: input.summary ?? `New call transcript (${dur})`,
      title: subject,
      bodyHtml: body,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking confirmation (to client and/or owner)
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingEmailInput {
  businessName: string;
  customerName: string;
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
  eventLink?: string | null;
  ownerCopy?: boolean; // changes wording for the owner notification
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export function renderBookingEmail(input: BookingEmailInput): {
  subject: string;
  html: string;
} {
  const when = input.startsAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const dur = formatDuration(
    Math.round((input.endsAt.getTime() - input.startsAt.getTime()) / 1000),
  );

  const detailRows: string[] = [];
  detailRows.push(row("When", when));
  detailRows.push(row("Duration", dur));
  if (input.reason) detailRows.push(row("Reason", input.reason));
  if (input.ownerCopy) {
    detailRows.push(row("Customer", input.customerName));
    if (input.customerEmail) detailRows.push(row("Email", input.customerEmail));
    if (input.customerPhone) detailRows.push(row("Phone", input.customerPhone));
  }

  const calBtn = input.eventLink
    ? `<div style="margin:24px 0 8px 0;">
         <a href="${escape(input.eventLink)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500;">View in calendar</a>
       </div>`
    : "";

  let heading: string;
  let intro: string;
  let subject: string;
  if (input.ownerCopy) {
    heading = "New appointment booked";
    intro = `A new appointment with <strong>${escape(input.customerName)}</strong> was just booked through your AI receptionist.`;
    subject = `New booking · ${input.customerName} · ${when}`;
  } else {
    heading = "Your appointment is confirmed";
    intro = `Hi ${escape(input.customerName.split(" ")[0] || "there")}, your appointment with <strong>${escape(input.businessName)}</strong> is confirmed. Reply to this email if you need to reschedule.`;
    subject = `Appointment confirmed · ${input.businessName} · ${when}`;
  }

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;letter-spacing:-0.01em;">${heading}</h1>
    <p style="margin:0 0 20px 0;color:#444;">${intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f5f3ef;border-radius:8px;overflow:hidden;">
      ${detailRows.join("")}
    </table>
    ${calBtn}
  `;

  return {
    subject,
    html: shell({
      preheader: `${heading} — ${when}`,
      title: subject,
      bodyHtml: body,
    }),
  };
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 14px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#888;width:110px;vertical-align:top;">${escape(label)}</td>
    <td style="padding:10px 14px;color:#1a1a1a;">${escape(value)}</td>
  </tr>`;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m} min`;
  return `${m}m ${sec}s`;
}
