"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/fans/subscriptions.js
   Purpose: fan subscription checkout page
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  if (!client) {
    console.error("onlypawsClient missing");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const CREATOR_ID = (params.get("creator") || "").trim();

  const els = {
    subline: document.getElementById("subline"),
    toast: document.getElementById("toast"),
    logoutBtn: document.getElementById("logoutBtn"),
    subscribeBtn: document.getElementById("subscribeBtn"),
    planName: document.getElementById("planName"),
    planDesc: document.getElementById("planDesc"),
    planPrice: document.getElementById("planPrice"),
  };

  function path(...keys) {
    for (const k of keys) {
      if (!k) continue;

      const resolved =
        PATHS?.app?.fans?.[k] ||
        PATHS?.app?.creators?.[k] ||
        PATHS?.app?.[k] ||
        PATHS?.marketing?.[k] ||
        PATHS?.[k];

      if (resolved) return resolved;
    }

    return "";
  }

  function goHome() {
    window.location.replace(
      PATHS?.index ||
      PATHS?.home ||
      "index.html"
    );
  }

  function goCreatorProfile(target) {
    const base =
      PATHS?.app?.fans?.creatorProfile ||
      PATHS?.app?.creators?.creatorProfile ||
      "creator-profile.html";

    window.location.replace(
      `${base}?u=${encodeURIComponent(target)}`
    );
  }

  function toast(msg) {
    if (!els.toast) return;

    els.toast.textContent = msg || "";
    els.toast.classList.add("show");

    clearTimeout(els.toast._t);

    els.toast._t = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function setButtonBusy(busy, text) {
    if (!els.subscribeBtn) return;

    els.subscribeBtn.disabled = !!busy;

    if (text != null) {
      els.subscribeBtn.textContent = text;
    }
  }

  function shortId(id) {
    if (!id) return "";
    if (id.length < 12) return id;
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }

  function formatPrice(cents, currency) {
    const value = Number(cents || 500);
    const curr = (currency || "eur").toUpperCase();

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: curr,
      }).format(value / 100);
    } catch (_) {
      return `€${(value / 100).toFixed(2)}`;
    }
  }

  async function requireSession() {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  async function getViewerRole(userId) {
    const { data } = await client
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    return (data?.role || "").toString();
  }

  async function getCreatorProfile() {
    const { data, error } = await client
      .from("profiles")
      .select("user_id, username, display_name, role, stripe_onboarding_status, charges_enabled, stripe_connect_account_id")
      .eq("user_id", CREATOR_ID)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function creatorEligible(profile) {
    if (!profile) return false;

    const roleOk = (profile.role || "").toLowerCase() === "creator";
    const onboarding = (profile.stripe_onboarding_status || "").toLowerCase();

    const onboardingOk =
      onboarding === "complete" ||
      onboarding === "completed";

    const chargesEnabled = profile.charges_enabled === true;
    const hasConnect = !!(profile.stripe_connect_account_id || "").trim();

    return roleOk && onboardingOk && chargesEnabled && hasConnect;
  }

  async function loadVipPlan() {
    const { data, error } = await client
      .from("creator_plans")
      .select("id,name,description,price_cents,currency")
      .eq("creator_id", CREATOR_ID)
      .eq("is_active", true)
      .eq("billing_period", "monthly")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function createCheckout({ creatorId, creatorUsername }) {
    const session = await requireSession();

    if (!session) {
      toast("Please login first");
      goHome();
      return null;
    }

    const successTarget = creatorUsername || creatorId;

    const successUrl = new URL(
      `${window.location.origin}/${path("creatorProfile","creator-profile") || "creator-profile.html"}`
    );

    successUrl.searchParams.set("u", successTarget);
    successUrl.searchParams.set("success", "1");

    const cancelUrl = new URL(window.location.href);

    const { data, error } = await client.functions.invoke(
      "create-fan-subscription",
      {
        body: {
          creator_id: creatorId,
          success_url: successUrl.toString(),
          cancel_url: cancelUrl.toString(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) throw error;

    const action = (data?.action || "").toString();
    const url = data?.url || data?.checkout_url;

    if (action === "resumed") {
      toast("Subscription resumed ✅");
      return { action: "resumed" };
    }

    if (!url) throw new Error("Missing checkout URL");

    window.open(url, "_blank", "noopener,noreferrer");
    return { action: "checkout" };
  }

  function bindLogout() {
    if (!els.logoutBtn) return;

    els.logoutBtn.addEventListener("click", async () => {
      try {
        await client.auth.signOut();
      } catch (_) {}

      goHome();
    });
  }

  async function initPage() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    bindLogout();

    if (!CREATOR_ID) {
      toast("Missing creator");
      setButtonBusy(true, "Unavailable");
      return;
    }

    const session = await requireSession();

    if (!session) {
      toast("Please login first");
      setButtonBusy(true, "Login required");
      return;
    }

    let creator;

    try {
      creator = await getCreatorProfile();
    } catch (e) {
      console.error(e);
      toast("Creator unavailable");
      return;
    }

    if (!creator) {
      toast("Creator not found");
      setButtonBusy(true, "Unavailable");
      return;
    }

    const creatorLabel =
      creator.display_name ||
      creator.username ||
      shortId(CREATOR_ID);

    if (els.subline) {
      els.subline.textContent = `Creator: @${creatorLabel}`;
    }

    if (creator.user_id === session.user.id) {
      toast("You can’t subscribe to yourself");
      setButtonBusy(true, "Unavailable");
      return;
    }

    const viewerRole = await getViewerRole(session.user.id);

    if (viewerRole === "creator") {
      toast("Creator → creator subscriptions coming later");
      setButtonBusy(true, "Coming soon");
      return;
    }

    if (!creatorEligible(creator)) {
      toast("Creator not ready for subscriptions");
      setButtonBusy(true, "Unavailable");
      return;
    }

    let plan;

    try {
      plan = await loadVipPlan();
    } catch (e) {
      console.error(e);
    }

    if (!plan) {
      toast("Creator has no active plan");
      setButtonBusy(true, "Unavailable");
      return;
    }

    if (els.planName) els.planName.textContent = plan.name || "VIP";
    if (els.planDesc) els.planDesc.textContent = plan.description || "";
    if (els.planPrice) {
      els.planPrice.textContent =
        `${formatPrice(plan.price_cents, plan.currency)} / month`;
    }

    if (els.subscribeBtn) {
      els.subscribeBtn.addEventListener("click", async () => {
        try {
          setButtonBusy(true, "Opening checkout…");

          const result = await createCheckout({
            creatorId: CREATOR_ID,
            creatorUsername: creator.username,
          });

          if (result?.action === "resumed") {
            setButtonBusy(false, "Subscribe");

            setTimeout(() => {
              goCreatorProfile(
                creator.username || CREATOR_ID
              );
            }, 500);

            return;
          }

          setButtonBusy(false, "Subscribe");
        } catch (e) {
          console.error(e);
          toast(e?.message || String(e));
          setButtonBusy(false, "Subscribe");
        }
      });
    }

    setButtonBusy(false, "Subscribe");
  }

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goHome();
    }
  });

  window.addEventListener("DOMContentLoaded", initPage);
})();