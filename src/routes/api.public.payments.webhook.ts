import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, type StripeEnv } from '@/lib/stripe.server';

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function sendWelcomeEmail(userId: string) {
  try {
    const { data } = await getSupabase().auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return;

    const { sendEmail } = await import('@/server/email.server');
    await sendEmail({
      to: email,
      subject: 'Welcome to Ask Janice — your receptionist is live',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h1 style="font-size:22px;margin:0 0 12px">Welcome aboard 🎉</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px">
            Your Ask Janice subscription is active. Your AI receptionist is ready to answer calls,
            capture leads and book appointments 24/7.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px">
            Head to your dashboard to fine-tune your greeting, FAQs and scenarios:
          </p>
          <p style="margin:0 0 20px">
            <a href="https://askjanice.net/dashboard"
               style="background:#6b21a8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:15px;display:inline-block">
              Open my dashboard
            </a>
          </p>
          <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
            Questions? Just reply to this email — we answer fast.
          </p>
        </div>`,
    });
  } catch (e) {
    console.error('welcome email failed', e);
  }
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function readItem(subscription: any) {
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  return { priceId, productId, periodStart, periodEnd };
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }
  const { priceId, productId, periodStart, periodEnd } = readItem(subscription);

  const { data: existing } = await getSupabase()
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  await getSupabase().from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );

  // Unlock the account.
  await getSupabase()
    .from('profiles')
    .update({ billing_status: 'active' })
    .eq('user_id', userId);

  if (!existing) await sendWelcomeEmail(userId);
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const { priceId, productId, periodStart, periodEnd } = readItem(subscription);

  await getSupabase()
    .from('subscriptions')
    .update({
      status: subscription.status,
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
    .eq('environment', env);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  // Access continues until current_period_end; has_active_subscription honours that.
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id)
    .eq('environment', env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log('Unhandled payment event:', event.type);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          console.error('Webhook received with invalid env:', rawEnv);
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
