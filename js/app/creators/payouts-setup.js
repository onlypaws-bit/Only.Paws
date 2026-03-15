"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/creators/payouts-setup.js
   Purpose: Stripe onboarding / monetization setup for creators
   Dependencies:
   - window.onlypawsClient
   - window.OPAuth
   - window.OPCreatorPlan
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPNav
   - window.OPPartials
   ========================================================= */

(function () {

  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const lockIcon = document.getElementById("lockIcon");
  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");

  const startBtn = document.getElementById("startBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const submittedLine = document.getElementById("submittedLine");

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }

    window.location.replace(PATHS?.home || "/index.html");
  }

  function creatorsLoginHref() {
    if (ROUTES?.get) {
      return ROUTES.get("marketing.creators") || "creators.html";
    }

    return PATHS?.marketing?.creators || "/html/marketing/creators.html";
  }

  function creatorDashHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "creator-dash.html";
    }

    return PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html";
  }

  function payoutsSetupHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.payoutsSetup") || "payouts-setup.html";
    }

    return PATHS?.app?.creators?.payoutsSetup || "/html/app/creators/payouts-setup.html";
  }

  function setUI({ enabled, title, text }) {

    if (enabled) {
      lockIcon.textContent = "✅";

      statusTitle.textContent =
        title || "Monetization enabled";

      statusText.textContent =
        text || "Stripe is ready. Monetization and payouts are enabled.";

      startBtn.disabled = true;
      startBtn.textContent = "Stripe onboarding completed";
      return;
    }

    lockIcon.textContent = "🔒";

    statusTitle.textContent =
      title || "Monetization not enabled";

    statusText.textContent =
      text || "Complete Stripe onboarding to enable monetization and payouts.";

    startBtn.disabled = false;
    startBtn.textContent = "Start Stripe onboarding";
  }

  async function requireCreatorPlanSession() {

    const session = await window.OPAuth.getSession();

    if (!session) {
      window.location.replace(creatorsLoginHref());
      return null;
    }

    const profile = await window.OPAuth.getProfile(session.user.id);

    if (!profile || profile.role !== "creator") {
      goHome();
      return null;
    }

    const ent = await window.OPCreatorPlan.getCreatorPlanEntitlement(session.user.id);

    const creatorPlanActive =
      window.OPCreatorPlan.isCreatorPlanActive(ent);

    if (!creatorPlanActive) {
      window.location.replace(creatorDashHref());
      return null;
    }

    return { session, profile, ent };
  }

  async function fetchConnectStatus() {

    const { data, error } =
      await client.functions.invoke("connect-status", { body: {} });

    if (error) throw error;

    return data;
  }

  async function checkNow() {

    refreshBtn.disabled = true;
    refreshBtn.textContent = "Checking…";

    try {

      const status = await fetchConnectStatus();

      if (status?.payouts_enabled) {

        setUI({
          enabled: true,
          title: "Monetization enabled",
          text: "Stripe is ready. Go back to the dashboard to manage payouts and monetization.",
        });

      } else {

        const reason = status?.reason || null;

        const extra =
          status?.requirements?.currently_due?.length
            ? "Missing: " + status.requirements.currently_due.join(", ")
            : reason
            ? "Reason: " + reason
            : null;

        setUI({
          enabled: false,
          title: "Monetization not enabled",
          text:
            extra ||
            "Complete Stripe onboarding to enable monetization and payouts.",
        });

      }

    } catch (error) {

      console.warn("connect-status failed:", error);

      setUI({
        enabled: false,
        title: "Monetization not enabled",
        text: "Complete Stripe onboarding to enable monetization and payouts.",
      });

    } finally {

      refreshBtn.disabled = false;
      refreshBtn.textContent = "I've completed setup — Refresh";

    }
  }

  async function startSetup() {

    startBtn.disabled = true;
    startBtn.textContent = "Opening Stripe…";

    try {

      const base = window.location.origin + payoutsSetupHref();

      const returnUrl = `${base}?done=1`;
      const refreshUrl = `${base}?retry=1`;

      const { data, error } =
        await client.functions.invoke("connect-update", {
          body: {
            return_url: returnUrl,
            refresh_url: refreshUrl,
          },
        });

      if (error) {

        const ctxBody = error?.context?.body;

        const extra =
          ctxBody
            ? typeof ctxBody === "string"
              ? ctxBody
              : JSON.stringify(ctxBody)
            : "";

        throw new Error(
          (error.message || "Edge Function error") +
            (extra ? " — " + extra : "")
        );
      }

      if (!data?.url) {
        throw new Error("Missing Stripe URL");
      }

      window.location.href = data.url;

    } catch (error) {

      alert(
        "❌ Stripe onboarding failed: " +
          (error?.message || String(error))
      );

      startBtn.disabled = false;
      startBtn.textContent = "Start Stripe onboarding";
    }
  }

  function bindEvents() {
    startBtn.addEventListener("click", startSetup);
    refreshBtn.addEventListener("click", checkNow);
  }

  async function initPage() {

    if (!client) {
      alert("❌ onlypawsClient not found. Check onlypawsClient.js.");
      return;
    }

    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    bindEvents();

    const auth = await requireCreatorPlanSession();
    if (!auth) return;

    const query = new URLSearchParams(window.location.search);

    if (query.get("done") === "1" || query.get("retry") === "1") {
      submittedLine.style.display = "flex";
    }

    await checkNow();
  }

  window.OPCreatorPayoutSetup = {
    initPage,
    checkNow,
    startSetup,
    fetchConnectStatus,
  };

  window.addEventListener("DOMContentLoaded", initPage);

})();