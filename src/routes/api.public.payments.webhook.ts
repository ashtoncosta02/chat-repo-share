import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, EventName, type PaddleEnv } from '@/lib/paddle.server';

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

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }

  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }

  const { data: existing } = await getSupabase()
    .from('subscriptions')
    .select('id')
    .eq('paddle_subscription_id', id)
    .maybeSingle();

  await getSupabase().from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'paddle_subscription_id' },
  );

  // Unlock the account.
  await getSupabase()
    .from('profiles')
    .update({ billing_status: 'active' })
    .eq('user_id', userId);

  if (!existing) await sendWelcomeEmail(userId);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;

  const priceId = items?.[0]?.price?.importMeta?.externalId;
  const productId = items?.[0]?.product?.importMeta?.externalId;

  await getSupabase()
    .from('subscriptions')
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Access continues until current_period_end; has_active_subscription honours that.
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log('Unhandled payment event:', event.eventType);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
