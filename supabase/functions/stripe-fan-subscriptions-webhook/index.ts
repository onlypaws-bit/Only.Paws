// supabase/functions/stripe-fan-subscriptions-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(...keys: string[]) {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length) return v.trim();
  }
  return "";
}

const STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", "OP_STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = env(
  "STRIPE_FAN_SUB_WEBHOOK_SECRET",
  "OP_STRIPE_FAN_SUB_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET",
  "OP_STRIPE_WEBHOOK_SECRET",
);

const SUPABASE_URL = env("SUPABASE_URL", "OP_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = env(
  "SUPABASE_SERVICE_ROLE_KEY",
  "OP_SUPABASE_SERVICE_ROLE_KEY",
);

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_FAN_SUB_WEBHOOK_SECRET");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sbAdmin(path: string, init: RequestInit) {
  const headers = {
    ...(init.headers || {}),
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  const txt = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase error ${res.status}: ${txt}`);
  }

  return txt ? JSON.parse(txt) : null;
}

function safeStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

function isoFromUnix(sec?: any) {
  if (!sec) return null;
  return new Date(Number(sec) * 1000).toISOString();
}

function mapStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due") return "past_due";
  if (s === "unpaid") return "unpaid";
  if (s === "canceled") return "canceled";
  return s;
}

function parseStripeSigHeader(sigHeader: string) {
  const parts = sigHeader.split(",");
  const t = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  return { t, v1 };
}

async function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string) {
  const { t, v1 } = parseStripeSigHeader(sigHeader);
  if (!t || !v1) return false;

  const payload = `${t}.${rawBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === v1;
}

async function upsertFanSubscription(row: any) {
  await sbAdmin(`fan_subscriptions?on_conflict=provider_subscription_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([row]),
  });
}

async function deleteFanSubscription(subId: string) {
  await sbAdmin(`fan_subscriptions?provider_subscription_id=eq.${subId}`, {
    method: "DELETE",
  });
}

function isCreatorPlan(sub: any) {
  return safeStr(sub?.metadata?.key) === "creator_plan";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  try {
    const ok = await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    if (!ok) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const type = safeStr(event.type);
    const obj = event?.data?.object;

    console.log("FAN SUB EVENT", type);

    // ── customer.subscription.created / updated ───────────────────────────────
    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated"
    ) {
      if (isCreatorPlan(obj)) return new Response("ok");

      const subId = safeStr(obj.id);
      const customerId = safeStr(obj.customer);
      const fanId = safeStr(obj.metadata?.fan_id);
      const creatorId = safeStr(obj.metadata?.creator_id);
      const planId = safeStr(obj.metadata?.plan_id);
      const status = mapStatus(obj.status);
      const cps = isoFromUnix(obj.current_period_start);
      const cpe = isoFromUnix(obj.current_period_end);

      console.log("UPSERT FAN SUB", { subId, fanId, creatorId, status });

      await upsertFanSubscription({
        fan_id: fanId,
        creator_id: creatorId,
        plan_id: planId,
        status,
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        provider_customer_id: customerId,
        provider_subscription_id: subId,
        current_period_start: cps,
        current_period_end: cpe,
        payment_provider: "stripe",
        updated_at: new Date().toISOString(),
      });

      return new Response("ok");
    }

    // ── customer.subscription.deleted ─────────────────────────────────────────
    if (type === "customer.subscription.deleted") {
      if (isCreatorPlan(obj)) return new Response("ok");

      const subId = safeStr(obj.id);
      console.log("DELETE FAN SUB", subId);
      await deleteFanSubscription(subId);

      return new Response("ok");
    }

    // ── invoice.payment_succeeded ─────────────────────────────────────────────
    if (type === "invoice.payment_succeeded") {
      const amountCents = Number(obj?.amount_paid ?? 0);
      const stripeEventId = safeStr(event?.id);
      const subscriptionId = safeStr(obj?.subscription);

      // Skip $0 invoices (trials, free periods)
      if (amountCents <= 0) {
        console.log("FAN INVOICE skipped: zero amount", stripeEventId);
        return new Response("ok");
      }

      // Resolve fan_id and creator_id from the subscription metadata
      // The subscription object is expanded on invoice events
      const subMeta = obj?.lines?.data?.[0]?.metadata ?? obj?.subscription_details?.metadata ?? {};
      const fanId = safeStr(subMeta?.fan_id) || null;
      const creatorId = safeStr(subMeta?.creator_id) || null;
      const planId = safeStr(subMeta?.plan_id) || null;

      if (!creatorId) {
        // Fallback: look up via fan_subscriptions table using subscription id
        if (subscriptionId) {
          const { data: fanSub } = await admin
            .from("fan_subscriptions")
            .select("fan_id, creator_id, plan_id")
            .eq("provider_subscription_id", subscriptionId)
            .maybeSingle();

          if (fanSub?.creator_id) {
            const { error } = await admin.from("wallet_transactions").insert({
              creator_id: fanSub.creator_id,
              fan_id: fanSub.fan_id ?? null,
              type: "subscription",
              amount_cents: amountCents,
              currency: "EUR",
              status: "paid",
              stripe_event_id: stripeEventId,
              stripe_object_id: subscriptionId,
            });

            if (error && error.code !== "23505") {
              console.error("wallet_transactions insert error (fallback):", error);
            } else {
              console.log("FAN INVOICE wallet insert ok (fallback)", stripeEventId);
            }
          } else {
            console.warn("FAN INVOICE: no creator_id resolved for sub", subscriptionId);
          }
        }

        return new Response("ok");
      }

      const { error } = await admin.from("wallet_transactions").insert({
        creator_id: creatorId,
        fan_id: fanId,
        type: "subscription",
        amount_cents: amountCents,
        currency: "EUR",
        status: "paid",
        stripe_event_id: stripeEventId,
        stripe_object_id: subscriptionId,
      });

      if (error && error.code !== "23505") {
        console.error("wallet_transactions insert error:", error);
      } else {
        console.log("FAN INVOICE wallet insert ok", stripeEventId);
      }

      return new Response("ok");
    }

    // ── invoice.payment_failed ────────────────────────────────────────────────
    if (type === "invoice.payment_failed") {
      console.log("FAN INVOICE payment_failed", safeStr(event?.id));
      return new Response("ok");
    }

    return new Response("ok");
  } catch (e) {
    console.error("stripe-fan-subscriptions-webhook error:", e);
    return new Response("ok");
  }
});
