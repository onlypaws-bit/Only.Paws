/* =========================================================
   OnlyPaws
   File: /js/app/creators/fan-profile.js
   Purpose: show a fan profile inside creator area
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPNav
   - window.OPPartials
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }

    window.location.replace(PATHS?.home || PATHS?.index || "/index.html");
  }

  function esc(value) {
    return (value ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      u: (params.get("u") || "").trim(),
    };
  }

  function isUUID(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
  }

  function creatorProfileHref(usernameOrId) {
    const safeValue = String(usernameOrId || "").trim();
    if (!safeValue) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: safeValue });
    }

    const base = PATHS?.app?.fans?.creatorProfile || "/html/app/fans/creator-profile.html";
    return `${base}?u=${encodeURIComponent(safeValue)}`;
  }

  function setFanUI(profile) {
    const name = (profile.display_name || profile.username || "Fan").trim();
    const username = (profile.username || "username").trim();
    const bio = (profile.bio || "").trim();
    const avatarUrl = (profile.avatar_url || "").trim();

    const fanName = document.getElementById("fanName");
    const fanHandle = document.getElementById("fanHandle");
    const fanBio = document.getElementById("fanBio");
    const fanAvatar = document.getElementById("fanAvatar");

    if (fanName) fanName.textContent = name;
    if (fanHandle) fanHandle.textContent = "@" + username;
    if (fanBio) fanBio.textContent = bio;

    if (fanAvatar) {
      if (avatarUrl) {
        fanAvatar.innerHTML = `<img src="${esc(avatarUrl)}" alt="Fan avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
      } else {
        fanAvatar.textContent = "🐾";
      }
    }
  }

  async function loadFanByParam(value) {
    const selectFields = "user_id, username, display_name, bio, avatar_url, role";
    const query = client.from("profiles").select(selectFields);

    const { data, error } = isUUID(value)
      ? await query.eq("user_id", value).maybeSingle()
      : await query.eq("username", value).maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Fan not found");

    return data;
  }

  async function countFollowing(fanUserId) {
    const { count, error } = await client
      .from("followers")
      .select("id", { count: "exact", head: true })
      .eq("fan_id", fanUserId);

    if (error) throw error;
    return count ?? 0;
  }

  async function countSubscriptions(fanUserId) {
    const { count, error } = await client
      .from("fan_subscriptions")
      .select("fan_id", { count: "exact", head: true })
      .eq("fan_id", fanUserId)
      .in("status", ["active", "trialing", "past_due"]);

    if (error) throw error;
    return count ?? 0;
  }

  async function loadFollowingCreators(fanUserId) {
    const { data: rows, error } = await client
      .from("followers")
      .select("creator_id")
      .eq("fan_id", fanUserId)
      .limit(50);

    if (error) throw error;

    const ids = (rows || []).map((row) => row.creator_id).filter(Boolean);
    if (ids.length === 0) return [];

    const { data: creators, error: creatorsError } = await client
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, role")
      .in("user_id", ids)
      .eq("role", "creator");

    if (creatorsError) throw creatorsError;

    const byId = new Map((creators || []).map((creator) => [creator.user_id, creator]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  function renderFollowingList(creators) {
    const list = document.getElementById("followingList");
    const hint = document.getElementById("followingHint");

    if (!list || !hint) return;

    if (!creators || creators.length === 0) {
      list.innerHTML = "";
      hint.textContent = "No creators yet.";
      return;
    }

    hint.textContent = "";

    list.innerHTML = creators.map((creator) => {
      const name = (creator.display_name || creator.username || "Creator").trim();
      const username = (creator.username || "").trim();
      const avatarUrl = (creator.avatar_url || "").trim();

      const avatar = avatarUrl
        ? `<img src="${esc(avatarUrl)}" alt="Creator avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : "🐾";

      const href = creatorProfileHref(username || creator.user_id);

      return `
        <a class="listItem" href="${esc(href)}">
          <div class="listAvatar">${avatar}</div>
          <div class="listMeta">
            <b>${esc(name)}</b>
            <span>${esc(username ? "@" + username : creator.user_id)}</span>
          </div>
        </a>
      `;
    }).join("");
  }

  function setHint(message) {
    const el = document.getElementById("fanHint");
    if (el) el.textContent = message || "";
  }

  async function boot() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    const { u } = getParams();
    if (!u) {
      setHint("Missing ?u=username (or UUID)");
      const followingHint = document.getElementById("followingHint");
      if (followingHint) followingHint.textContent = "";
      return;
    }

    try {
      const fan = await loadFanByParam(u);
      setFanUI(fan);

      if ((fan.role || "").toLowerCase() === "creator") {
        setHint("This user is a creator. You may be looking for the public creator profile instead.");
      } else {
        setHint("");
      }

      const [followingCount, subscriptionCount, creators] = await Promise.all([
        countFollowing(fan.user_id),
        countSubscriptions(fan.user_id),
        loadFollowingCreators(fan.user_id),
      ]);

      const statFollowing = document.getElementById("statFollowing");
      const statSubscriptions = document.getElementById("statSubscriptions");

      if (statFollowing) statFollowing.textContent = String(followingCount);
      if (statSubscriptions) statSubscriptions.textContent = String(subscriptionCount);

      renderFollowingList(creators);
    } catch (error) {
      setHint("❌ " + (error?.message || String(error)));
      const followingHint = document.getElementById("followingHint");
      if (followingHint) followingHint.textContent = "";
    }
  }

  window.OPCreatorFanProfile = {
    boot,
    loadFanByParam,
    countFollowing,
    countSubscriptions,
    loadFollowingCreators,
  };

  window.addEventListener("DOMContentLoaded", boot);
})();