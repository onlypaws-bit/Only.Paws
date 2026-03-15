"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/fans/purchased-posts.js
   Purpose: fan purchased posts page
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  const els = {
    msg: document.getElementById("msg"),
    list: document.getElementById("purchasesList"),
    userPill: document.getElementById("userPill"),
  };

  if (!client) {
    console.error("onlypawsClient missing");
    if (els.msg) {
      els.msg.textContent = "❌ onlypawsClient missing.";
    }
    return;
  }

  function goHome() {
    window.location.href =
      PATHS?.index ||
      PATHS?.home ||
      "index.html";
  }

  function goFansLanding() {
    const fans =
      PATHS?.marketing?.fans ||
      "fans.html";

    const dash =
      PATHS?.app?.fans?.purchasedPosts ||
      "purchased-posts.html";

    window.location.href =
      `${fans}?next=${encodeURIComponent(dash)}`;
  }

  async function requireSession() {
    const { data } = await client.auth.getSession();

    if (!data?.session) {
      goFansLanding();
      return null;
    }

    return data.session;
  }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function hydrateUserPill() {
    if (!els.userPill) return;

    try {
      const { data: sess } = await client.auth.getSession();
      const session = sess?.session;

      if (!session) {
        els.userPill.textContent = "Guest";
        return;
      }

      const uid = session.user.id;

      const { data: profile } = await client
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", uid)
        .maybeSingle();

      const uname = (profile?.username || "").trim();
      const dname = (profile?.display_name || "").trim();

      if (uname) els.userPill.textContent = `@${uname}`;
      else if (dname) els.userPill.textContent = dname;
      else els.userPill.textContent = "User";
    } catch (_) {}
  }

  function renderEmptyState() {
    if (!els.list) return;

    els.list.innerHTML = `
      <div class="item">
        <div class="left">
          <div>
            <div class="title">No purchases yet</div>
            <div class="meta">When you unlock a paid post it will appear here.</div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadPurchasedPosts() {
    if (els.msg) {
      els.msg.textContent =
        "Coming next: connect wallet_transactions / post_unlocks 🐾";
    }

    renderEmptyState();
  }

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goHome();
    }
  });

  async function initPage() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    const session = await requireSession();
    if (!session) return;

    await hydrateUserPill();
    await loadPurchasedPosts();
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();