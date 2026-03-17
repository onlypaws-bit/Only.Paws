"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/fans/subscriptions.js
   Purpose: fan subscription page logic
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

  const CREATOR_ID = new URLSearchParams(window.location.search).get("creator");

  const els = {
    subline: document.getElementById("subline"),
    subscribeBtn: document.getElementById("subscribeBtn"),
    toast: document.getElementById("toast"),
    planName: document.getElementById("planName"),
    planDesc: document.getElementById("planDesc"),
    planPrice: document.getElementById("planPrice"),
    planTag: document.getElementById("planTag"),
    planMicro: document.getElementById("planMicro"),
  };

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg || "";
    els.toast.classList.add("show");
    clearTimeout(els.toast._t);
    els.toast._t = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function goHome() {
    window.location.href =
      PATHS?.index ||
      PATHS?.home ||
      "index.html";
  }

  function goFansLanding() {
    const fansPath =
      PATHS?.marketing?.fans ||
      "fans.html";

    const subscriptionsPath =
      PATHS?.app?.fans?.subscriptions ||
      "subscriptions.html";

    window.location.href =
      `${fansPath}?next=${encodeURIComponent(`${subscriptionsPath}?creator=${CREATOR_ID || ""}`)}`;
  }

  function setButtonBusy(isBusy, text) {
    if (!els.subscribeBtn) return;
    els.subscribeBtn.disabled = !!isBusy;
    if (text) {
      els.subscribeBtn.textContent = text;
    }
  }

  function shortId(id) {
    if (!id) return "";
    return id.length > 10
      ? `${id.slice(0, 6)}…${id.slice(-4)}`
      : id;
  }

  async function getSession() {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  }

  async function getCreatorLabel() {
    const { data, error } = await client
      .from("profiles")
      .select("username, display_name")
      .eq("user_id", CREATOR_ID)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    return {
      username: (data?.username || "").trim(),
      displayName: (data?.display_name || "").trim(),
    };
  }

  async function loadPlan() {
    const { data, error } = await client
      .from("creator_plans")
      .select("id, name, description, price_cents, currency, billing_period, is_active, created_at")
      .eq("creator_id", CREATOR_ID)
      .eq("is_active", true)
      .eq("billing_period", "monthly")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function createCheckout() {
    const session = await getSession();

    if (!session) {
      showToast("Please login first");
      goFansLanding();
      return;
    }

    const creator = await getCreatorLabel();
    const creatorTarget = creator?.username || CREATOR_ID;

    const creatorProfilePath =
      PATHS?.app?.fans?.creatorProfile ||
      PATHS?.app?.creators?.creatorProfile ||
      "creator-profile.html";

    const successUrl = new URL(
      `${window.location.origin}${creatorProfilePath.startsWith("/") ? "" : "/"}${creatorProfilePath}`
    );
    successUrl.searchParams.set("u", creatorTarget);
    successUrl.searchParams.set("success", "1");

    const cancelUrl = new URL(window.location.href);

    const { data, error } = await client.functions.invoke(
      "create-fan-subscription",
      {
        body: {
          creator_id: CREATOR_ID,
          success_url: successUrl.toString(),
          cancel_url: cancelUrl.toString(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) throw error;

    const action = String(data?.action || "");
    const checkoutUrl =
      data?.url ||
      data?.checkout_url ||
      data?.sessionUrl;

    if (action === "resumed") {
      showToast("Subscription resumed ✅");
      return;
    }

    if (!checkoutUrl) {
      throw new Error("Missing checkout url");
    }

    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  }

  async function initPage() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    if (!CREATOR_ID) {
      setButtonBusy(true, "Unavailable");
      if (els.subline) els.subline.textContent = "Missing creator";
      showToast("Missing creator");
      return;
    }

    const session = await getSession();

    if (!session) {
      setButtonBusy(false, "Login to subscribe");
      if (els.subline) els.subline.textContent = "Please login to subscribe";

      if (els.subscribeBtn) {
        els.subscribeBtn.addEventListener("click", goFansLanding, { once: false });
      }
      return;
    }

    const creator = await getCreatorLabel();
    const creatorLabel =
      creator?.username
        ? `@${creator.username}`
        : creator?.displayName || shortId(CREATOR_ID);

    if (els.subline) {
      els.subline.textContent = `Creator: ${creatorLabel}`;
    }

    let plan = null;

    try {
      plan = await loadPlan();
    } catch (e) {
      console.error(e);
      showToast(e?.message || "Plan load error");
    }

    if (!plan) {
      setButtonBusy(true, "Unavailable");
      showToast("Creator has no active plan yet");
      return;
    }

    if (els.planName) {
      els.planName.textContent = plan.name || "VIPaws";
    }

    if (els.planDesc) {
      els.planDesc.textContent =
        plan.description || "Extra content, more interaction, real influence 🐶✨";
    }

    const cents = Number.isFinite(plan.price_cents) ? plan.price_cents : 500;
    const symbol = String(plan.currency || "eur").toLowerCase() === "eur" ? "€" : `${String(plan.currency || "").toUpperCase()} `;
    const amount = (cents / 100).toFixed(2).replace(".00", "");

    if (els.planPrice) {
      els.planPrice.textContent = `${symbol}${amount} / month`;
    }

    if (els.planTag) {
      els.planTag.textContent = "best value 🐾";
    }

    if (els.planMicro) {
      els.planMicro.textContent = "best value 🐾";
    }

    setButtonBusy(false, "Subscribe");

    if (els.subscribeBtn) {
      els.subscribeBtn.addEventListener("click", async () => {
        try {
          setButtonBusy(true, "Opening checkout…");
          await createCheckout();
          setButtonBusy(false, "Subscribe");
        } catch (e) {
          console.error(e);
          showToast(e?.message || "Checkout error");
          setButtonBusy(false, "Subscribe");
        }
      });
    }
  }

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goHome();
    }
  });

  window.addEventListener("DOMContentLoaded", initPage);
})();
