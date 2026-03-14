/* =========================================================
   OnlyPaws
   File: /js/auth-guard.js
   Purpose: central auth, role, and entitlement helpers for OnlyPaws
   Requires: supabase-js CDN + onlypawsClient.js
   ========================================================= */

(function () {
  const sb = window.onlypawsClient;

  if (!sb) {
    console.error("[auth-guard] onlypawsClient not found.");
    return;
  }

  async function getSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getUser() {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  async function getProfile(userId) {
    const { data, error } = await sb
      .from("profiles")
      .select("user_id, role, username, display_name, bio")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  }

  async function ensureProfileRow(user, roleFallback) {
    const role = roleFallback || user?.user_metadata?.role || "fan";

    const { error } = await sb
      .from("profiles")
      .upsert({ user_id: user.id, role }, { onConflict: "user_id" });

    if (error) throw error;
  }

  async function isCreatorPlanActive(userId) {
    try {
      const { data } = await sb
        .from("entitlements")
        .select("creator_plan")
        .eq("user_id", userId)
        .maybeSingle();

      return data?.creator_plan === true;
    } catch {
      return false;
    }
  }

  async function requireAuth({
    redirectTo = OP_PATHS?.marketing?.home || "/html/marketing/pages/index.html",
    ensureProfile = true
  } = {}) {
    const user = await getUser();

    if (!user) {
      window.location.href = redirectTo;
      return null;
    }

    if (ensureProfile) {
      const profile = await getProfile(user.id);
      if (!profile) {
        await ensureProfileRow(user);
      }
    }

    return user;
  }

  async function requireCreatorUnlocked() {
    const user = await requireAuth({
      redirectTo: OP_PATHS?.marketing?.home || "/html/marketing/pages/index.html"
    });

    if (!user) return null;

    const profile = await getProfile(user.id);

    if (profile?.role !== "creator") {
      window.location.href = OP_PATHS?.marketing?.creators || "/html/marketing/pages/creators.html";
      return null;
    }

    const active = await isCreatorPlanActive(user.id);

    if (!active) {
      window.location.href = OP_PATHS?.marketing?.creators || "/html/marketing/pages/creators.html";
      return null;
    }

    return { user, profile };
  }

  window.OPAuth = {
    getSession,
    getUser,
    getProfile,
    ensureProfileRow,
    isCreatorPlanActive,
    requireAuth,
    requireCreatorUnlocked
  };
})();
