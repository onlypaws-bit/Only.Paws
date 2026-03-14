/* =========================================================
   OnlyPaws
   File: /js/auth-guard.js
   Purpose: central auth, role, and entitlement helpers for OnlyPaws
   Requires: supabase-js CDN + onlypawsClient.js + paths.js
   ========================================================= */

(function () {
  function getClient() {
    const sb = window.onlypawsClient;
    if (!sb) {
      throw new Error("[auth-guard] onlypawsClient not found.");
    }
    return sb;
  }

  function getMarketingHomePath() {
    return OP_PATHS?.marketing?.home || "/html/marketing/pages/index.html";
  }

  function getMarketingCreatorsPath() {
    return OP_PATHS?.marketing?.creators || "/html/marketing/pages/creators.html";
  }

  async function getSession() {
    const sb = getClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function getUser() {
    const sb = getClient();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function getProfile(userId) {
    const sb = getClient();

    const { data, error } = await sb
      .from("profiles")
      .select("user_id, role, username, display_name, bio")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function ensureProfileRow(user, roleFallback) {
    const sb = getClient();

    // IMPORTANT:
    // if profile already exists, do NOT upsert again
    // so existing roles never get overwritten here
    const existing = await getProfile(user.id);
    if (existing) return existing;

    const role = roleFallback || user?.user_metadata?.role || "fan";

    const { error } = await sb
      .from("profiles")
      .insert({
        user_id: user.id,
        role
      });

    if (error) throw error;

    return await getProfile(user.id);
  }

  async function isCreatorPlanActive(userId) {
    const sb = getClient();

    try {
      const { data, error } = await sb
        .from("entitlements")
        .select("creator_plan")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data?.creator_plan === true;
    } catch {
      return false;
    }
  }

  async function requireAuth({
    redirectTo = getMarketingHomePath(),
    ensureProfile = true
  } = {}) {
    const user = await getUser();

    if (!user) {
      window.location.href = redirectTo;
      return null;
    }

    if (ensureProfile) {
      await ensureProfileRow(user);
    }

    return user;
  }

  async function requireCreator({
    redirectTo = getMarketingCreatorsPath(),
    ensureProfile = true
  } = {}) {
    const user = await requireAuth({
      redirectTo: getMarketingHomePath(),
      ensureProfile
    });

    if (!user) return null;

    const profile = await getProfile(user.id);

    if (profile?.role !== "creator") {
      window.location.href = redirectTo;
      return null;
    }

    return { user, profile };
  }

  async function requireCreatorUnlocked({
    redirectTo = getMarketingCreatorsPath(),
    ensureProfile = true
  } = {}) {
    const ctx = await requireCreator({
      redirectTo,
      ensureProfile
    });

    if (!ctx) return null;

    const active = await isCreatorPlanActive(ctx.user.id);

    if (!active) {
      window.location.href = redirectTo;
      return null;
    }

    return ctx;
  }

  window.OPAuth = {
    getSession,
    getUser,
    getProfile,
    ensureProfileRow,
    isCreatorPlanActive,
    requireAuth,
    requireCreator,
    requireCreatorUnlocked
  };
})();
