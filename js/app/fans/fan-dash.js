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
    const cleanUsername = String(username || "").replace(/^@/, "").trim();

    const base =
      PATHS?.app?.fans?.creatorProfile ||
      PATHS?.app?.creators?.creatorProfile ||
      "creator-profile.html";

    return `${base}?u=${encodeURIComponent(cleanUsername)}`;
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

    window.location.href = `${fans}?next=${encodeURIComponent(dash)}`;
  }

  function setText(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
  }

  function setTopMsg(msg) {
    setText(els.topMsg, msg);
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
      const email = session.user.email || "";

      const { data: profile } = await client
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", uid)
        .maybeSingle();

      const uname = (profile?.username || "").trim();
      const dname = (profile?.display_name || "").trim();

      if (uname) els.userPill.textContent = `@${uname}`;
      else if (dname) els.userPill.textContent = dname;
      else if (email) els.userPill.textContent = email.split("@")[0];
      else els.userPill.textContent = "User";
    } catch (_) {}
  }

  async function getAccessToken() {
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      throw new Error("No session");
    }

    return token;
  }

  function emptyItem(title, meta) {
    return `
      <div class="fanDashItem">
        <div class="fanDashItemLeft">
          <div class="fanDashAvatar">🐾</div>
          <div style="min-width:0;">
            <div class="fanDashTitle">${esc(title)}</div>
            <div class="fanDashMeta">${esc(meta || "")}</div>
          </div>
        </div>
        <span class="badge">—</span>
      </div>
    `;
  }

  async function unfollowCreator(followId, label) {
    if (!followId || !state.userId) return;

    if (!confirm(`Unfollow ${label || "creator"}?`)) return;

    setText(els.followsMsg, "Unfollowing…");

    try {
      const { error } = await client
        .from("followers")
        .delete()
        .eq("id", followId)
        .eq("fan_id", state.userId);

      if (error) throw error;

      await loadFollowing(state.userId);
      setText(els.followsMsg, "");
    } catch (e) {
      console.error(e);
      setText(els.followsMsg, "❌ Error unfollowing.");
    }
  }

  async function cancelSubscription(creatorId, label) {
    if (!creatorId || !state.userId) return;

    const creatorLabel = label || "creator";
    if (!confirm(`Cancel subscription to ${creatorLabel}? Access remains active until the end of the billing period.`)) {
      return;
    }

    setText(els.subsMsg, "Canceling…");

    try {
      const token = await getAccessToken();

      const { data, error } = await client.functions.invoke(
        "cancel-fan-subscription",
        {
          body: { creator_id: creatorId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (error) throw error;
      if (data && data.ok === false) {
        throw new Error(data.error || "Cancel failed");
      }

      await loadSubscriptions(state.userId);
      setText(els.subsMsg, "Access remains active until period end.");
    } catch (e) {
      console.error(e);
      setText(
        els.subsMsg,
        `❌ ${e?.message || "Error canceling subscription."}`
      );
    }
  }

  async function resumeSubscription(creatorId, label) {
    if (!creatorId || !state.userId) return;

    const creatorLabel = label || "creator";
    if (!confirm(`Resume subscription to ${creatorLabel}?`)) return;

    setText(els.subsMsg, "Resuming…");

    try {
      const token = await getAccessToken();

      const { data, error } = await client.functions.invoke(
        "resume-fan-subscription",
        {
          body: { creator_id: creatorId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (error) throw error;
      if (data && data.ok === false) {
        throw new Error(data.error || "Resume failed");
      }

      await loadSubscriptions(state.userId);
      setText(els.subsMsg, "");
    } catch (e) {
      console.error(e);
      setText(
        els.subsMsg,
        `❌ ${e?.message || "Error resuming subscription."}`
      );
    }
  }

  async function loadFollowing(userId) {
    if (!els.followsList) return;

    setText(els.followsMsg, "Loading…");
    els.followsList.innerHTML = "";

    const { data, error } = await client
      .from("followers")
      .select(`
        id,
        created_at,
        creator:creator_id (
          user_id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("fan_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setText(els.followsMsg, "❌ Error loading follows.");
      return;
    }

    if (!data || data.length === 0) {
      els.followsList.innerHTML = emptyItem(
        "No follows yet",
        "Follow a creator and they will appear here."
      );
      setText(els.followsMsg, "");
      return;
    }

    els.followsList.innerHTML = "";
    setText(els.followsMsg, "");

    data.forEach((row) => {
      const c = row?.creator || {};

      const uname = (c.username || "").trim();
      const dname =
        (c.display_name || "").trim() ||
        uname ||
        "Creator";

      const avatar = (c.avatar_url || "").trim();

      const el = document.createElement("div");
      el.className = "fanDashItem";

      el.innerHTML = `
        <div class="fanDashItemLeft">
          <div class="fanDashAvatar">
            ${avatar
              ? `<img src="${esc(avatar)}" alt="${esc(dname)} avatar" loading="lazy">`
              : "🐾"}
          </div>
          <div style="min-width:0;">
            <div class="fanDashTitle">${esc(dname)}</div>
            <div class="fanDashMeta">${uname ? "@" + esc(uname) : ""}</div>
          </div>
        </div>

        <button
          class="ghost fanDashDangerGhost"
          type="button"
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
          ev.preventDefault();
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

    setText(els.subsMsg, "Loading…");
    els.subsList.innerHTML = "";

    const { data: rows, error } = await client
      .from("fan_subscriptions")
      .select(`
        creator_id,
        status,
        created_at,
        current_period_end,
        cancel_at_period_end,
        provider_subscription_id,
        plan_id
      `)
      .eq("fan_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setText(els.subsMsg, "❌ Error loading subscriptions.");
      return;
    }

    if (!rows || rows.length === 0) {
      els.subsList.innerHTML = emptyItem(
        "No subscriptions yet",
        "When you subscribe to a creator, it will appear here."
      );
      setText(els.subsMsg, "");
      return;
    }

    const creatorIds = Array.from(
      new Set(
        rows
          .map((row) => row.creator_id)
          .filter(Boolean)
      )
    );

    let profileMap = new Map();

    if (creatorIds.length) {
      const { data: profiles, error: profileError } = await client
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", creatorIds);

      if (profileError) {
        console.error(profileError);
      } else if (Array.isArray(profiles)) {
        profileMap = new Map(
          profiles.map((profile) => [profile.user_id, profile])
        );
      }
    }

    els.subsList.innerHTML = "";
    setText(els.subsMsg, "");

    const now = Date.now();

    rows.forEach((row) => {
      const creatorId = row.creator_id;
      const profile = profileMap.get(creatorId) || {};

      const uname = (profile.username || "").trim();
      const dname =
        (profile.display_name || "").trim() ||
        uname ||
        "Creator";

      const avatar = (profile.avatar_url || "").trim();
      const status = String(row.status || "active").toLowerCase();

      const periodEndMs = row.current_period_end
        ? new Date(row.current_period_end).getTime()
        : 0;

      const hasAccess = !!periodEndMs && periodEndMs > now;
      const isCanceling = hasAccess && row.cancel_at_period_end === true;

      let badgeText = "Active";
      if (status === "past_due") badgeText = "Past due";
      else if (isCanceling) badgeText = "Canceling";
      else if (!hasAccess) badgeText = "Expired";

      const until = row.current_period_end
        ? new Date(row.current_period_end).toLocaleDateString()
        : "";

      const metaLine = [
        uname ? `@${uname}` : "",
        until ? `${isCanceling ? "until" : "renews"} ${until}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      const canCancel = hasAccess && !isCanceling;
      const canResume = hasAccess && isCanceling;

      let actionHtml = "";

      if (canCancel) {
        actionHtml = `
          <button
            class="ghost fanDashDangerGhost"
            type="button"
            data-cancel="${esc(creatorId)}"
            data-label="${esc(dname)}"
          >
            Cancel
          </button>
        `;
      } else if (canResume) {
        actionHtml = `
          <button
            class="btn"
            type="button"
            data-resume="${esc(creatorId)}"
            data-label="${esc(dname)}"
          >
            Resume subscription
          </button>
        `;
      }

      const el = document.createElement("div");
      el.className = "fanDashItem";

      el.innerHTML = `
        <div class="fanDashItemLeft">
          <div class="fanDashAvatar">
            ${avatar
              ? `<img src="${esc(avatar)}" alt="${esc(dname)} avatar" loading="lazy">`
              : "🐾"}
          </div>
          <div style="min-width:0;">
            <div class="fanDashTitle">${esc(dname)}</div>
            <div class="fanDashMeta">${esc(metaLine)}</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
          <span class="badge">${esc(badgeText)}</span>
          ${actionHtml}
        </div>
      `;

      if (uname) {
        el.classList.add("clickable");
        el.addEventListener("click", () => {
          window.location.href = creatorProfileUrl(uname);
        });
      }

      const cancelBtn = el.querySelector("[data-cancel]");
      const resumeBtn = el.querySelector("[data-resume]");

      if (cancelBtn) {
        cancelBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          cancelSubscription(
            cancelBtn.getAttribute("data-cancel"),
            cancelBtn.getAttribute("data-label")
          );
        });
      }

      if (resumeBtn) {
        resumeBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          resumeSubscription(
            resumeBtn.getAttribute("data-resume"),
            resumeBtn.getAttribute("data-label")
          );
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
        loadFollowing(state.userId),
        loadSubscriptions(state.userId),
      ]);

      setTopMsg("");
    } catch (e) {
      console.error(e);
      setTopMsg("❌ Error loading dashboard.");
    }
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();
