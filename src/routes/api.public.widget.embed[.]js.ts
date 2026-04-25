import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Loader script that website owners drop into their site:
//   <script src="https://...lovable.app/api/public/widget/embed.js?agent=AGENT_ID" async></script>
//
// It injects a floating chat bubble + an iframe pointing at /widget/AGENT_ID.
function buildScript(origin: string): string {
  return `(function(){
  try {
    var currentScript = document.currentScript || (function(){var s=document.getElementsByTagName('script');return s[s.length-1];})();
    var src = currentScript && currentScript.src ? currentScript.src : '';
    var url = new URL(src, window.location.href);
    var agentId = url.searchParams.get('agent') || currentScript.getAttribute('data-agent');
    if (!agentId) { console.warn('[AgentFactory widget] missing ?agent= parameter'); return; }
    if (window.__AF_WIDGET_LOADED__) return;
    window.__AF_WIDGET_LOADED__ = true;

    var ORIGIN = ${JSON.stringify(origin)};
    var IFRAME_URL = ORIGIN + '/widget/' + encodeURIComponent(agentId);

    // Container
    var container = document.createElement('div');
    container.id = 'af-widget-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    document.body.appendChild(container);

    // Iframe (hidden initially)
    var iframe = document.createElement('iframe');
    iframe.src = IFRAME_URL;
    iframe.title = 'Chat';
    iframe.allow = 'clipboard-write';
    iframe.style.cssText = 'position:fixed;bottom:90px;right:20px;width:380px;height:560px;max-width:calc(100vw - 40px);max-height:calc(100vh - 120px);border:none;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.25);background:#fff;display:none;';
    container.appendChild(iframe);

    // Bubble
    var bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.setAttribute('aria-label','Open chat');
    bubble.style.cssText = 'width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#b8893a,#d4a857);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:transform .2s ease;';
    bubble.onmouseover = function(){ bubble.style.transform='scale(1.05)'; };
    bubble.onmouseout = function(){ bubble.style.transform='scale(1)'; };
    bubble.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    container.appendChild(bubble);

    var open = false;
    function toggle(forceOpen){
      open = typeof forceOpen === 'boolean' ? forceOpen : !open;
      iframe.style.display = open ? 'block' : 'none';
      bubble.innerHTML = open
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    }
    bubble.onclick = function(){ toggle(); };

    // Allow iframe to request close
    window.addEventListener('message', function(ev){
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'af-widget:close') toggle(false);
    });
  } catch (e) {
    console.error('[AgentFactory widget] init error', e);
  }
})();`;
}

export const Route = createFileRoute("/api/public/widget/embed.js")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        return new Response(buildScript(origin), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
