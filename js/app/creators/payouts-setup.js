"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/creators/payouts-setup.js
   Purpose: Stripe onboarding / payouts setup for creators
   Dependencies:
   - window.onlypawsClient
   - window.OPAuth
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
  const backToDashboardBtn = document.getElementById("backToDashboardBtn");

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }

    window.location.replace(PATHS?.home || "/index.html");
  }

  function creatorsLoginHref() {
    if (ROUTES?.href) {
      return ROUTES.href("marketing.creators", {
        next: payoutsSetupHref(),
      });
    }

    const base = PATHS?.marketing?.creators || "/html/marketing/creators.html";
    const url = new URL(base, window.location.origin);
    url.searchParams.set("next", payoutsSetupHref());
    return url.pathname + url.search + url.hash;
  }

  function creatorDashHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "/html/app/creators/creator-dash.html";
    }

    return PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html";
  }

  function payoutsSetupHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.payoutsSetup") || "/html/app/creators/payouts-setup.html";
    }

    return PATHS?.app?.creators?.payoutsSetup || "/html/app/creators/payouts-setup.html";
  }

  function setUI({ enabled, title, text }) {
    if (enabled) {
      lockIcon.textContent = "✅";

      statusTitle.textContent =
        title || "Payouts enabled";

      statusText.textContent =
        text || "Stripe is ready. You can withdraw from the dashboard.";

      startBtn.disabled = true;
      startBtn.textContent = "Payouts already enabled";
      return;
    }

    lockIcon.textContent = "🔒";

    statusTitle.textContent =
      title || "Payouts not enabled";

    statusText.textContent =
      text || "Start setup to enable withdrawals.";

    startBtn.disabled = false;
    startBtn.textContent = "Start payout setup";
  }

  async function requireCreatorSession() {
    const session = await window.OPAuth?.getSession?.();

    if (!session) {
      window.location.replace(creatorsLoginHref());
      return null;
    }

    const profile = await window.OPAuth?.getProfile?.(session.user.id);

    if (!profile || profile.role !== "creator") {
      goHome();
      return null;
    }

    return { session, profile };
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
          title: "Payouts enabled",
          text: "Stripe is ready. Go back to the dashboard to withdraw.",
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
          title: "Payouts not enabled",
          text: extra || "Start setup to enable withdrawals.",
        });
      }
    } catch (error) {
      console.warn("connect-status failed:", error);

      setUI({
        enabled: false,
        title: "Payouts not enabled",
        text: "Start setup to enable withdrawals.",
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
        "❌ Payout setup failed: " +
        (error?.message || String(error))
      );

      startBtn.disabled = false;
      startBtn.textContent = "Start payout setup";
    }
  }

  function bindStaticLinks() {
    if (backToDashboardBtn) {
      backToDashboardBtn.href = creatorDashHref();
    }
  }

  function bindEvents() {
    startBtn?.addEventListener("click", startSetup);
    refreshBtn?.addEventListener("click", checkNow);
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

    bindStaticLinks();
    bindEvents();

    const auth = await requireCreatorSession();
    if (!auth) return;

    const query = new URLSearchParams(window.location.search);

    if (query.get("done") === "1" || query.get("retry") === "1") {
      submittedLine?.classList.remove("op-hidden");
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
