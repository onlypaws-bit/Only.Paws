/* =========================================================
   OnlyPaws
   File: /js/nav.js
   Purpose: hydrate shared app navigation and user pill
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function profilePath() {
    if (ROUTES?.get) {
      return ROUTES.get("app.profile") || "profile.html";
    }
    return PATHS?.app?.profile || "/html/app/profile.html";
  }

  function fanDashPath() {
    if (ROUTES?.get) {
      return ROUTES.get("app.fans.fanDash") || "fan-dash.html";
    }
    return PATHS?.app?.fans?.fanDash || "/html/app/fans/fan-dash.html";
  }

  function creatorDashPath() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "creator-dash.html";
    }
    return PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html";
  }

  function homePath() {
    if (ROUTES?.get) {
      return ROUTES.get("home") || ROUTES.get("index") || "index.html";
    }
    return PATHS?.home || PATHS?.index || "/index.html";
  }

  function currentMarketingPageKeys() {
    const pathname = (window.location.pathname || "").toLowerCase();

    if (
      pathname === "/" ||
      pathname.endsWith("/index.html") ||
      pathname.endsWith("/html/marketing/index.html")
    ) {
      return ["index", "home"];
    }

    if (pathname.endsWith("/html/marketing/creators.html")) {
      return ["creators"];
    }

    if (pathname.endsWith("/html/marketing/fans.html")) {
      return ["fans"];
    }

    if (pathname.endsWith("/html/marketing/the-pack.html")) {
      return ["the-pack"];
    }

    return [];
  }

  function hideCurrentMarketingLink() {
    const currentKeys = currentMarketingPageKeys();
    if (!currentKeys.length) return;

    document.querySelectorAll("[data-page]").forEach((link) => {
      const page = (link.dataset.page || "").trim().toLowerCase();
      if (currentKeys.includes(page)) {
        link.hidden = true;
      }
    });
  }

  async function hydrateUserPill() {
    const pill = document.getElementById("userPill");
    if (!pill || !client?.auth) return;

    try {
      const { data: sessData } = await client.auth.getSession();
      const session = sessData?.session;

      if (!session) {
        pill.textContent = "Guest";
        return;
      }

      const uid = session.user.id;
      const email = session.user.email || "";

      const { data: prof } = await client
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", uid)
        .maybeSingle();

      const uname = (prof?.username || "").trim();
      const dname = (prof?.display_name || "").trim();

      if (uname) pill.textContent = "@" + uname;
      else if (dname) pill.textContent = dname;
      else if (email) pill.textContent = email.split("@")[0];
      else pill.textContent = "User";
    } catch (err) {
      console.warn("hydrateUserPill failed:", err);
    }
  }

  async function hydrateNav() {
    const profileBtn = document.getElementById("navProfile");
    const fanDashBtn = document.getElementById("navFanDash");
    const creatorDashBtn = document.getElementById("navCreatorDash");
    const logoutBtn = document.getElementById("navLogout");

    if (profileBtn) {
      profileBtn.href = profilePath();
      setHidden(profileBtn, false);
    }

    if (fanDashBtn) {
      fanDashBtn.href = fanDashPath();
      setHidden(fanDashBtn, true);
    }

    if (creatorDashBtn) {
      creatorDashBtn.href = creatorDashPath();
      setHidden(creatorDashBtn, true);
    }

    if (logoutBtn) {
      setHidden(logoutBtn, false);

      if (logoutBtn.dataset.bound !== "1") {
        logoutBtn.dataset.bound = "1";

        logoutBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          logoutBtn.disabled = true;
          logoutBtn.textContent = "Logging out…";

          try {
            await client?.auth?.signOut();
          } catch (_) {}

          window.location.replace(homePath());
        });
      }
    }

    try {
      const { data: u } = await client.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return;

      const { data: p } = await client
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (p?.role === "creator") {
        setHidden(creatorDashBtn, false);
        setHidden(fanDashBtn, true);
      } else {
        setHidden(fanDashBtn, false);
        setHidden(creatorDashBtn, true);
      }
    } catch (err) {
      console.warn("hydrateNav failed:", err);
    }
  }

  async function initNav() {
    hideCurrentMarketingLink();
    await hydrateNav();
    await hydrateUserPill();
  }

  window.OPNav = {
    setHidden,
    hideCurrentMarketingLink,
    hydrateNav,
    hydrateUserPill,
    initNav,
  };
})();
