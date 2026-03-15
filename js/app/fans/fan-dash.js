"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/fans/fan-dash.js
   Purpose: fan dashboard page logic
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

  const els = {
    userPill: document.getElementById("userPill"),
    topMsg: document.getElementById("topMsg"),

    subsList: document.getElementById("subsList"),
    subsMsg: document.getElementById("subsMsg"),

    followsList: document.getElementById("followsList"),
    followsMsg: document.getElementById("followsMsg"),

    logoutBtn: document.getElementById("logoutBtn"),
  };

  const state = {
    userId: null,
  };

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function creatorProfileUrl(username) {
    const base =
      PATHS?.app?.fans?.creatorProfile ||
      PATHS?.app?.creators?.creatorProfile ||
      "creator-profile.html";

    return `${base}?u=${encodeURIComponent(username || "")}`;
  }

  function goHome() {
    window.location.href =
      PATHS?.index ||
      PATHS?.home ||
      "index.html";
  }

  function goFansLanding() {
    const dash =
      PATHS?.app?.fans?.fanDash ||
      "fan-dash.html";

    const fans =
      PATHS?.marketing?.fans ||
      "fans.html";

    window.location.href =
      `${fans}?next=${encodeURIComponent(dash)}`;
  }

  function setTopMsg(msg) {
    if (!els.topMsg) return;
    els.topMsg.textContent = msg || "";
  }

  async function requireSession() {
    const { data } = await client.auth.getSession();

    if (!data?.session) {
      goFansLanding();
      return null;
    }

    return data.session;
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

  async function getAccessToken() {
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) throw new Error("No session");

    return token;
  }

  function emptyItem(title, meta) {
    return `
      <div class="item">
        <div class="left">
          <div class="avatar">🐾</div>
          <div style="min-width:0;">
            <div class="title">${esc(title)}</div>
            <div class="meta">${esc(meta)}</div>
          </div>
        </div>
        <span class="badge">—</span>
      </div>
    `;
  }

  async function unfollowCreator(followId, label) {
    if (!followId) return;

    if (!confirm(`Unfollow ${label || "creator"}?`)) return;

    try {
      const { error } = await client
        .from("followers")
        .delete()
        .eq("id", followId)
        .eq("fan_id", state.userId);

      if (error) throw error;

      await loadFollowing(state.userId);
    } catch (e) {
      console.error(e);
      if (els.followsMsg) {
        els.followsMsg.textContent = "❌ Error unfollowing.";
      }
    }
  }

  async function cancelSubscription(creatorId, label) {
    if (!confirm(`Cancel subscription to ${label || "creator"}?`)) return;

    try {
      const token = await getAccessToken();

      const { error } = await client.functions.invoke(
        "cancel-fan-subscription",
        {
          body: { creator_id: creatorId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (error) throw error;

      await loadSubscriptions(state.userId);
    } catch (e) {
      console.error(e);
      if (els.subsMsg) {
        els.subsMsg.textContent = "❌ Error canceling subscription.";
      }
    }
  }

  async function resumeSubscription(creatorId, label) {
    if (!confirm(`Resume subscription to ${label || "creator"}?`)) return;

    try {
      const token = await getAccessToken();

      const { error } = await client.functions.invoke(
        "resume-fan-subscription",
        {
          body: { creator_id: creatorId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (error) throw error;

      await loadSubscriptions(state.userId);
    } catch (e) {
      console.error(e);
      if (els.subsMsg) {
        els.subsMsg.textContent = "❌ Error resuming subscription.";
      }
    }
  }

  async function loadFollowing(userId) {
    if (!els.followsList) return;

    els.followsList.innerHTML = "";

    const { data, error } = await client
      .from("followers")
      .select(`
        id,
        creator:creator_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("fan_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      els.followsList.innerHTML = emptyItem(
        "No follows yet",
        "Follow a creator to see them here."
      );
      return;
    }

    els.followsList.innerHTML = "";

    data.forEach((row) => {
      const c = row.creator || {};

      const uname = (c.username || "").trim();
      const dname =
        (c.display_name || "").trim() ||
        uname ||
        "Creator";

      const avatar = (c.avatar_url || "").trim();

      const el = document.createElement("div");
      el.className = "item";

      el.innerHTML = `
        <div class="left">
          <div class="avatar">
            ${avatar
              ? `<img src="${esc(avatar)}" loading="lazy">`
              : "🐾"}
          </div>
          <div style="min-width:0;">
            <div class="title">${esc(dname)}</div>
            <div class="meta">${uname ? "@" + esc(uname) : ""}</div>
          </div>
        </div>
        <button
          class="ghost danger"
          data-unfollow="${esc(row.id)}"
          data-label="${esc(dname)}"
        >
          Unfollow
        </button>
      `;

      if (uname) {
        el.classList.add("clickable");
        el.addEventListener("click", () => {
          window.location.href = creatorProfileUrl(uname);
        });
      }

      const btn = el.querySelector("[data-unfollow]");
      if (btn) {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();

          unfollowCreator(
            btn.getAttribute("data-unfollow"),
            btn.getAttribute("data-label")
          );
        });
      }

      els.followsList.appendChild(el);
    });
  }

  async function loadSubscriptions(userId) {
    if (!els.subsList) return;

    els.subsList.innerHTML = "";

    const { data, error } = await client
      .from("fan_subscriptions")
      .select("creator_id,status,current_period_end,cancel_at_period_end")
      .eq("fan_id", userId);

    if (error) {
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      els.subsList.innerHTML = emptyItem(
        "No subscriptions",
        "Subscriptions will appear here."
      );
      return;
    }

    els.subsList.innerHTML = "";

    data.forEach((row) => {
      const creatorId = row.creator_id;

      const el = document.createElement("div");
      el.className = "item";

      el.innerHTML = `
        <div class="left">
          <div class="avatar">💜</div>
          <div>
            <div class="title">Subscription</div>
            <div class="meta">${esc(row.status)}</div>
          </div>
        </div>
        <div>
          ${
            row.cancel_at_period_end
              ? `<button class="btn" data-resume="${creatorId}">Resume</button>`
              : `<button class="ghost danger" data-cancel="${creatorId}">Cancel</button>`
          }
        </div>
      `;

      const cancelBtn = el.querySelector("[data-cancel]");
      const resumeBtn = el.querySelector("[data-resume]");

      if (cancelBtn) {
        cancelBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          cancelSubscription(creatorId);
        });
      }

      if (resumeBtn) {
        resumeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          resumeSubscription(creatorId);
        });
      }

      els.subsList.appendChild(el);
    });
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

    const session = await requireSession();
    if (!session) return;

    state.userId = session.user.id;

    await hydrateUserPill();

    try {
      await Promise.all([
        loadFollowing(session.user.id),
        loadSubscriptions(session.user.id),
      ]);

      setTopMsg("");
    } catch (e) {
      console.error(e);
      setTopMsg("❌ Error loading dashboard.");
    }
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();