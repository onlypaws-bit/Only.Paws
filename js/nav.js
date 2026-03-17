/* =========================================================
   OnlyPaws
   File: /js/nav.js
   Purpose: hydrate shared marketing/app navigation and user pill
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

  function route(pathKey, fallback) {
    if (ROUTES?.get) {
      return ROUTES.get(pathKey) || fallback;
    }
    return fallback;
  }

  function homePath() {
    return route("home", PATHS?.home || PATHS?.index || "/index.html");
  }

  function marketingHomePath() {
    return route("marketing.home", PATHS?.marketing?.home || "/html/marketing/index.html");
  }

  function appFeedPath() {
    return route("app.feed", PATHS?.app?.feed || "/html/app/feed.html");
  }

  function profilePath() {
    return route("app.profile", PATHS?.app?.profile || "/html/app/profile.html");
  }

  function fanDashPath() {
    return route(
      "app.fans.fanDash",
      PATHS?.app?.fans?.fanDash || "/html/app/fans/fan-dash.html"
    );
  }

  function creatorDashPath() {
    return route(
      "app.creators.creatorDash",
      PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html"
    );
  }

  function creatorsPath() {
    return route(
      "marketing.creators",
      PATHS?.marketing?.creators || "/html/marketing/creators.html"
    );
  }

  function fansPath() {
    return route(
      "marketing.fans",
      PATHS?.marketing?.fans || "/html/marketing/fans.html"
    );
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

  function hydrateStaticLinks() {
    const navHome = document.getElementById("navHome");
    const brandLink = document.querySelector(".nav .brand");

    const navProfile = document.getElementById("navProfile");
    const navDashboard = document.getElementById("navDashboard");
    const navFanDash = document.getElementById("navFanDash");
    const navCreatorDash = document.getElementById("navCreatorDash");

    const marketingHome = document.querySelector('[data-page="index"], [data-page="home"]');
    const marketingCreators = document.querySelector('[data-page="creators"]');
    const marketingFans = document.querySelector('[data-page="fans"]');

    if (navHome) {
      const nav = navHome.closest(".nav");
      navHome.href = nav?.classList.contains("appNav") ? appFeedPath() : homePath();
    }

    if (brandLink && !navHome) {
      const nav = brandLink.closest(".nav");
      brandLink.href = nav?.classList.contains("appNav") ? appFeedPath() : homePath();
    }

    if (navProfile) {
      navProfile.href = profilePath();
    }

    if (navDashboard) {
      navDashboard.hidden = true;
      navDashboard.removeAttribute("href");
    }

    if (navFanDash) {
      navFanDash.href = fanDashPath();
      navFanDash.hidden = true;
    }

    if (navCreatorDash) {
      navCreatorDash.href = creatorDashPath();
      navCreatorDash.hidden = true;
    }

    if (marketingHome) marketingHome.href = homePath();
    if (marketingCreators) marketingCreators.href = creatorsPath();
    if (marketingFans) marketingFans.href = fansPath();
  }

  async function hydrateUserPill() {
    const pill = document.getElementById("userPill");
    if (!pill) return;

    if (!client?.auth) {
      pill.textContent = "Guest";
      return;
    }

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
      if (!pill.textContent) pill.textContent = "User";
    }
  }

  async function bindLogout() {
    const logoutBtn = document.getElementById("navLogout");
    if (!logoutBtn) return;

    setHidden(logoutBtn, false);

    if (logoutBtn.dataset.bound === "1") return;
    logoutBtn.dataset.bound = "1";

    logoutBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      logoutBtn.disabled = true;
      logoutBtn.textContent = "Logging out…";

      try {
        await client?.auth?.signOut();
      } catch (err) {
        console.warn("signOut failed:", err);
      }

      window.location.replace(homePath());
    });
  }

  async function hydrateAppNav() {
    const profileBtn = document.getElementById("navProfile");
    const dashboardBtn = document.getElementById("navDashboard");
    const fanDashBtn = document.getElementById("navFanDash");
    const creatorDashBtn = document.getElementById("navCreatorDash");
    const pill = document.getElementById("userPill");

    if (profileBtn) {
      profileBtn.href = profilePath();
      setHidden(profileBtn, true);
    }

    if (dashboardBtn) {
      setHidden(dashboardBtn, true);
      dashboardBtn.removeAttribute("href");
    }

    if (fanDashBtn) {
      fanDashBtn.href = fanDashPath();
      setHidden(fanDashBtn, true);
    }

    if (creatorDashBtn) {
      creatorDashBtn.href = creatorDashPath();
      setHidden(creatorDashBtn, true);
    }

    if (!client?.auth) {
      if (pill && !pill.textContent) pill.textContent = "Guest";
      return;
    }

    try {
      const { data: sessData } = await client.auth.getSession();
      const session = sessData?.session;
      const userId = session?.user?.id;

      if (!userId) {
        if (pill && !pill.textContent) pill.textContent = "Guest";
        return;
      }

      if (profileBtn) {
        setHidden(profileBtn, false);
      }

      const { data: p } = await client
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const isCreator = p?.role === "creator";

      if (dashboardBtn) {
        dashboardBtn.href = isCreator ? creatorDashPath() : fanDashPath();
        dashboardBtn.textContent = "Dashboard";
        setHidden(dashboardBtn, false);
      } else {
        if (fanDashBtn) {
          setHidden(fanDashBtn, isCreator);
        }
        if (creatorDashBtn) {
          setHidden(creatorDashBtn, !isCreator);
        }
      }
    } catch (err) {
      console.warn("hydrateAppNav failed:", err);
    }
  }

  async function hydrateNav() {
    hydrateStaticLinks();
    hideCurrentMarketingLink();
    await bindLogout();
    await hydrateAppNav();
    await hydrateUserPill();
  }

  async function initNav() {
    await hydrateNav();
  }

  window.OPNav = {
    setHidden,
    homePath,
    marketingHomePath,
    appFeedPath,
    profilePath,
    fanDashPath,
    creatorDashPath,
    hideCurrentMarketingLink,
    hydrateStaticLinks,
    hydrateUserPill,
    hydrateNav,
    initNav,
  };
})();
