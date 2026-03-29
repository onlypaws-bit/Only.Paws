// create-creator-plan-checkout

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://onlypaws-psi.vercel.app").replace(/\/+$/, "");

const PRICE_ID = "price_1StS6zLpyDgdWu8HPqemX38v";

function toForm(params: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, v);
  return body;
}

async function stripePOST(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toForm(params),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? JSON.stringify(j));
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const auth = req.headers.get("Authorization") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // ✅ Use SITE_URL, not Origin (Origin can be null on server-to-server calls)
    const successUrl = `${SITE_URL}/html/app/creators/creator-dash.html?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${SITE_URL}/html/app/creators/creator-dash.html?canceled=1`;

    const session = await stripePOST("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": PRICE_ID,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Session-level metadata (for checkout.session.completed)
      "metadata[user_id]": user.id,
      "metadata[key]": "creator_plan",

      // ✅ CRITICAL: subscription_data.metadata is what lands on the subscription object.
      // isCreatorPlanSubscription() checks sub.metadata.key === "creator_plan" — without
      // this, every customer.subscription.* event gets silently ignored.
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][key]": "creator_plan",  // ← THE FIX

      "subscription_data[trial_period_days]": "14",

      customer_email: user.email ?? "",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-creator-plan-checkout error:", e);
    return new Response(
      JSON.stringify({ error: (e as any)?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
