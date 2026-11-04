export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `body` must be trusted markup; escape any dynamic value with escapeHtml first. */
export function oauthHtmlResponse(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;color:#222}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:32px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.04)}
h1{margin:0 0 12px;font-size:20px}p{color:#555;line-height:1.5}a{color:#b8860b;text-decoration:none;font-weight:600}</style>
</head><body><div class="card">${body}</div>
<script>setTimeout(function(){if(window.opener){window.close()}},2500)</script>
</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
