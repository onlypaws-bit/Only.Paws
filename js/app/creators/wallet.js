"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/creators/wallet.js
   Purpose: creator wallet page (Stripe mirror only)
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

  const state = {
    profile: null,
    payoutEnabled: false,
    creatorPlanActive: false,
  };

  const els = {
    walletHint: document.getElementById("walletHint"),
    walletAvailable: document.getElementById("walletAvailable"),
    walletPending: document.getElementById("walletPending"),

    walletMsg: document.getElementById("walletMsg"),
    walletMsgTitle: document.querySelector("#walletMsg b"),
    walletMsgText: document.getElementById("walletMsgText"),

    openStripeBtn: document.getElementById("openStripeBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    historyHint: document.getElementById("historyHint"),
    historyList: document.getElementById("historyList"),
  };

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }

    window.location.replace(PATHS?.home || PATHS?.index || "/index.html");
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

  function esc(value) {
    return (value ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtEUR(cents) {
    const amount = Number(cents || 0);
    return "€" + (amount / 100).toFixed(2);
  }

  function showWalletMsg(title, text) {
    if (!els.walletMsg) return;

    els.walletMsg.hidden = false;

    if (els.walletMsgTitle) {
      els.walletMsgTitle.textContent = title || "";
    }

    if (els.walletMsgText) {
      els.walletMsgText.textContent = text || "";
    }
  }

  function hideWalletMsg() {
    if (!els.walletMsg) return;

    els.walletMsg.hidden = true;

    if (els.walletMsgText) {
      els.walletMsgText.textContent = "";
    }
  }

  function extractInvokeErrorDetails(error) {
    try {
      const message = error?.message || String(error);
      const ctxBody = error?.context?.body;
      const extra = ctxBody
        ? (typeof ctxBody === "string" ? ctxBody : JSON.stringify(ctxBody))
        : "";

      return extra ? `${message} — ${extra}` : message;
    } catch (_) {
      return error?.message || String(error);
    }
  }

  function renderHistoryEmpty() {
    if (!els.historyList) return;

    els.historyList.innerHTML = `
      <div class="locked">
        <b>No wallet activity yet</b>
        <div class="hint">Completed monetization activity will appear here.</div>
      </div>
    `;
  }

  function renderHistoryError(message) {
    if (!els.historyList) return;

    els.historyList.innerHTML = `
      <div class="locked">
        <b>Error</b>
        <div class="hint">${esc(message)}</div>
      </div>
    `;
  }

  function renderHistory(rows) {
    if (!els.historyList) return;

    if (!rows || rows.length === 0) {
      renderHistoryEmpty();
      return;
    }

    els.historyList.innerHTML = rows.map((row) => {
      const typeLabel =
        row.type === "subscription" ? "💜 Subscription"
        : row.type === "post_unlock" ? "🔓 Unlock"
        : row.type === "tip" ? "💰 Tip"
        : row.type === "payout" ? "🏦 Payout"
        : "Payment";

      const amount = fmtEUR(row.amount_cents);
      const date = row.created_at
        ? new Date(row.created_at).toLocaleDateString()
        : "";

      const status = (row.status || "").trim() || "—";

      return `
        <div class="rowCard">
          <div class="postMeta">
            <b>${esc(typeLabel)}</b>
            <div class="small">${esc(status)}${date ? ` • ${esc(date)}` : ""}</div>
          </div>

          <div class="dashboardAmountCol">
            <b>${esc(amount)}</b>
          </div>
        </div>
      `;
    }).join("");
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
    const creatorPlanActive = window.OPCreatorPlan.isCreatorPlanActive(ent);

    if (!creatorPlanActive) {
      window.location.replace(creatorDashHref());
      return null;
    }

    state.profile = profile;
    state.creatorPlanActive = creatorPlanActive;
    state.payoutEnabled = !!(
      profile?.stripe_onboarded ||
      (profile?.payouts_enabled && profile?.charges_enabled)
    );

    return { session, profile, ent };
  }

  async function fetchBalance() {
    const { data, error } = await client.functions.invoke("creator-balance", {
      body: {},
    });

    if (error) throw error;
    return data || {};
  }

  async function fetchHistory(creatorId) {
    const { data, error } = await client
      .from("wallet_transactions")
      .select("id, type, amount_cents, created_at, status")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }

  async function loadWallet() {
    if (els.walletHint) els.walletHint.textContent = "Loading…";
    if (els.walletAvailable) els.walletAvailable.textContent = "—";
    if (els.walletPending) els.walletPending.textContent = "—";

    hideWalletMsg();

    try {
      if (!state.payoutEnabled) {
        if (els.walletHint) {
          els.walletHint.textContent = "Stripe onboarding required.";
        }

        showWalletMsg(
          "Stripe setup required",
          "Complete Stripe onboarding to enable monetization and view your live Stripe balances."
        );

        if (els.openStripeBtn) {
          els.openStripeBtn.hidden = false;
          els.openStripeBtn.textContent = "Complete Stripe onboarding";
        }

        return;
      }

      const balance = await fetchBalance();

      if (els.walletAvailable) {
        els.walletAvailable.textContent = fmtEUR(balance.available_cents || 0);
      }

      if (els.walletPending) {
        els.walletPending.textContent = fmtEUR(balance.pending_cents || 0);
      }

      if (els.walletHint) {
        els.walletHint.textContent = "Loaded ✅";
      }

      if (els.openStripeBtn) {
        els.openStripeBtn.hidden = false;
        els.openStripeBtn.textContent = "Open Stripe";
      }
    } catch (error) {
      if (els.walletHint) {
        els.walletHint.textContent = "Couldn’t load balance";
      }

      showWalletMsg("Balance error", extractInvokeErrorDetails(error));

      if (els.openStripeBtn) {
        els.openStripeBtn.hidden = false;
        els.openStripeBtn.textContent = state.payoutEnabled
          ? "Open Stripe"
          : "Complete Stripe onboarding";
      }
    }
  }

  async function loadHistory() {
    if (els.historyHint) {
      els.historyHint.textContent = "Loading…";
    }

    if (els.historyList) {
      els.historyList.innerHTML = "";
    }

    try {
      const rows = await fetchHistory(state.profile.user_id);
      renderHistory(rows);

      if (els.historyHint) {
        els.historyHint.textContent = rows.length ? "Loaded ✅" : "No activity yet.";
      }
    } catch (error) {
      if (els.historyHint) {
        els.historyHint.textContent = "Couldn’t load history";
      }

      renderHistoryError(error?.message || String(error));
    }
  }

  async function openStripe() {
    const btn = els.openStripeBtn;
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = state.payoutEnabled ? "Opening Stripe…" : "Opening onboarding…";

    try {
      let data;
      let error;

      if (state.payoutEnabled) {
        ({ data, error } = await client.functions.invoke("connect-login", {
          body: {},
        }));
      } else {
        const base = window.location.origin + payoutsSetupHref();

        ({ data, error } = await client.functions.invoke("connect-update", {
          body: {
            return_url: `${base}?done=1`,
            refresh_url: `${base}?retry=1`,
          },
        }));
      }

      if (error) {
        const ctxBody = error?.context?.body;
        const extra = ctxBody
          ? (typeof ctxBody === "string" ? ctxBody : JSON.stringify(ctxBody))
          : "";

        throw new Error(
          (error.message || "Stripe error") + (extra ? " — " + extra : "")
        );
      }

      if (!data?.url) {
        throw new Error("Missing Stripe URL");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert("❌ Stripe open failed: " + (error?.message || String(error)));
    } finally {
      btn.disabled = false;
      btn.textContent = state.payoutEnabled
        ? "Open Stripe"
        : "Complete Stripe onboarding";
    }
  }

  function bindEvents() {
    if (els.openStripeBtn) {
      els.openStripeBtn.addEventListener("click", openStripe);
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", async () => {
        await loadWallet();
        await loadHistory();
      });
    }
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

    await loadWallet();
    await loadHistory();
  }

  window.OPCreatorWallet = {
    initPage,
    loadWallet,
    loadHistory,
    openStripe,
  };

  window.addEventListener("DOMContentLoaded", initPage);
})();