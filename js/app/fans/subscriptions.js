"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/fans/subscriptions.js
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  if (!client) return;

  const CREATOR_ID = new URLSearchParams(location.search).get("creator");

  const els = {
    subline: document.getElementById("subline"),
    subscribeBtn: document.getElementById("subscribeBtn"),
    toast: document.getElementById("toast"),
    planName: document.getElementById("planName"),
    planDesc: document.getElementById("planDesc"),
    planPrice: document.getElementById("planPrice"),
  };

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function goHome() {
    location.href = PATHS.index || "index.html";
  }

  async function loadPlan() {
    const { data } = await client
      .from("creator_plans")
      .select("*")
      .eq("creator_id", CREATOR_ID)
      .eq("is_active", true)
      .maybeSingle();

    return data;
  }

  async function createCheckout() {
    const { data: s } = await client.auth.getSession();
    const token = s?.session?.access_token;

    const { data, error } = await client.functions.invoke(
      "create-fan-subscription",
      {
        body: { creator_id: CREATOR_ID },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (error) throw error;

    window.open(data.url, "_blank");
  }

  async function init() {
    if (!CREATOR_ID) {
      toast("Missing creator");
      return;
    }

    const plan = await loadPlan();

    if (!plan) {
      toast("No plan available");
      return;
    }

    els.planName.textContent = plan.name;
    els.planDesc.textContent = plan.description;

    els.planPrice.textContent =
      `€${(plan.price_cents / 100).toFixed(0)} / month`;

    els.subscribeBtn.onclick = async () => {
      try {
        await createCheckout();
      } catch (e) {
        console.error(e);
        toast("Checkout error");
      }
    };
  }

  init();
})();
