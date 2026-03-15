/* =========================================================
   OnlyPaws
   File: /js/auth-guard.js
   Purpose: shared auth and role guards
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   ========================================================= */

(function () {
  const client = () => window.onlypawsClient || null;
  const PATHS = () => window.OP_PATHS || {};
  const ROUTES = () => window.OPRoutes || null;

  function homePath() {
    const routes = ROUTES();
    const paths = PATHS();

    if (routes?.get) {
      return routes.get("home") || routes.get("index") || "index.html";
    }

    return paths?.home || paths?.index || "index.html";
  }

  function creatorsLoginPath() {
    const routes = ROUTES();
    const paths = PATHS();

    if (routes?.get) {
      return routes.get("marketing.creators") || "creators.html";
    }

    return paths?.marketing?.creators || "creators.html";
  }

  function creatorDashPath() {
    const routes = ROUTES();
    const paths = PATHS();

    if (routes?.get) {
      return routes.get("app.creators.creatorDash") || "creator-dash.html";
    }

    return paths?.app?.creators?.creatorDash || "creator-dash.html";
  }

  function redirectTo(path, replace = false) {
    if (!path) return;

    if (replace) {
      window.location.replace(path);
      return;
    }

    window.location.href = path;
  }

  async function getSession() {
    const c = client();
    if (!c?.auth) return null;

    const { data, error } = await c.auth.getSession();
    if (error) throw error;

    return data?.session || null;
  }

  async function getUser() {
    const c = client();
    if (!c?.auth) return null;

    const { data, error } = await c.auth.getUser();
    if (error) throw error;

    return data?.user || null;
  }

  async function getProfile(userId) {
    const c = client();
    if (!c || !userId) return null;

    const { data, error } = await c
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function getCreatorPlanEntitlement(userId) {
    const c = client();
    if (!c || !userId) return null;

    const { data, error } = await c
      .from("entitlements")
      .select("id, key, status, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("key", "creator_plan")
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function hasCreatorPlan(userId) {
    const entitlement = await getCreatorPlanEntitlement(userId);
    return !!entitlement;
  }

  async function requireAuth() {
    const session = await getSession();

    if (!session) {
      redirectTo(homePath(), true);
      return null;
    }

    return session;
  }

  async function requireCreator() {
    const session = await requireAuth();
    if (!session) return null;

    const profile = await getProfile(session.user.id);

    if (!profile || profile.role !== "creator") {
      redirectTo(creatorsLoginPath(), true);
      return null;
    }

    return { session, profile };
  }

  async function requireCreatorUnlocked() {
    const payload = await requireCreator();
    if (!payload) return null;

    const unlocked = await hasCreatorPlan(payload.session.user.id);

    if (!unlocked) {
      redirectTo(creatorDashPath(), true);
      return null;
    }

    return {
      ...payload,
      entitlement: await getCreatorPlanEntitlement(payload.session.user.id),
    };
  }

  window.OPAuth = {
    getSession,
    getUser,
    getProfile,
    getCreatorPlanEntitlement,
    hasCreatorPlan,
    requireAuth,
    requireCreator,
    requireCreatorUnlocked,
  };
})();