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
      subject: 'Welcome to Ask Janice — your trial has started',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
          <h1 style="font-size:22px;margin:0 0 12px">Welcome aboard 🎉</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px">
            Your Ask Janice free trial or subscription has started. The next step is setting up
            your AI receptionist — add your business details, greeting and phone number so it can
            start answering calls, capturing leads and booking appointments.
          </p>
          <p style="margin:0 0 20px">
            <a href="https://askjanice.net/dashboard"
               style="background:#6b21a8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:15px;display:inline-block">
              Finish setting up
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

async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await getSupabase().auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

function billingButton(label: string) {
  return `<p style="margin:0 0 20px"><a href="https://askjanice.net/dashboard/account"
    style="background:#6b21a8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:15px;display:inline-block">${label}</a></p>`;
}

async function sendTrialEndingEmail(subscription: any) {
  try {
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    const email = await emailForUser(userId);
    if (!email) return;
    const { planForPrice } = await import('@/lib/plans');
    const plan = planForPrice(readItem(subscription).priceId);
    const planText = plan ? `${plan.name} plan ($${plan.monthlyPrice}/month)` : 'your plan';
    const endDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'soon';
    const { sendEmail } = await import('@/server/email.server');
    await sendEmail({
      to: email,
      subject: `Your Ask Janice trial ends ${endDate}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <p style="font-size:15px;line-height:1.6">Your free trial ends on <strong>${endDate}</strong>.</p>
        <p style="font-size:15px;line-height:1.6">After that, your subscription to the ${planText} renews automatically unless you cancel before the trial ends.</p>
        ${billingButton('Manage my plan')}
      </div>`,
    });
  } catch (e) {
    console.error('trial ending email failed', e);
  }
}

async function sendPaymentFailedEmail(invoice: any, env: StripeEnv) {
  try {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const { data: sub } = await getSupabase()
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const email = (sub?.user_id && (await emailForUser(sub.user_id))) || invoice.customer_email;
    if (!email) return;
    const { sendEmail } = await import('@/server/email.server');
    await sendEmail({
      to: email,
      subject: 'Action needed: your Ask Janice payment failed',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
        <p style="font-size:15px;line-height:1.6">We couldn't process your latest payment for Ask Janice.</p>
        <p style="font-size:15px;line-height:1.6">Please update your card so your AI receptionist keeps answering calls.</p>
        ${billingButton('Update my card')}
      </div>`,
    });
  } catch (e) {
    console.error('payment failed email failed', e);
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
  await syncPlanConfiguration(userId);
}

async function syncPlanConfiguration(userId: string) {
  const { data: agent } = await getSupabase().from('agents').select('id').eq('user_id',userId).maybeSingle();
  if (!agent) return;
  const { resyncReceptionistById } = await import('@/server/elevenlabs-agent-resync.server');
  const result = await resyncReceptionistById(agent.id);
  if (!result.success) throw new Error(result.error);
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
  const { data: saved } = await getSupabase().from('subscriptions').select('user_id').eq('stripe_subscription_id',subscription.id).eq('environment',env).maybeSingle();
  if (saved) await syncPlanConfiguration(saved.user_id);
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
    case 'customer.subscription.trial_will_end':
      await sendTrialEndingEmail(event.data.object);
      break;
    case 'invoice.payment_failed':
      await sendPaymentFailedEmail(event.data.object, env);
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
