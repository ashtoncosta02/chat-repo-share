import { createMiddleware, createStart } from '@tanstack/react-start';
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher';

const PRODUCTION_HOSTS = new Set(['askjanice.net', 'www.askjanice.net']);

// Anti-framing + permissions headers on the production domain only. The
// embeddable chat (/widget/*, /api/public/widget/*) must stay frameable and
// lovable.app preview hosts are left alone.
const securityHeaders = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return result;
  }
  const host = (request.headers.get('x-forwarded-host') ?? url.hostname).split(':')[0].toLowerCase();
  if (!PRODUCTION_HOSTS.has(host)) return result;
  if (url.pathname.startsWith('/widget/') || url.pathname.startsWith('/api/public/widget/')) return result;

  const headers = new Headers(result.response.headers);
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  return {
    ...result,
    response: new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
  functionMiddleware: [attachSupabaseAuth],
}));
