/* =========================================================
   OnlyPaws
   File: /js/app/auth-callback.js
   Purpose:
   Finalize Supabase auth callback bootstrap and redirect the
   signed-in user into the app.

   Handles:
   - session check
   - safe bootstrap for profiles, wallets, entitlements
   - redirect to next param or default profile page

   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   ========================================================= */

(function initAuthCallbackPage() {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const Routes = window.OPRoutes;

  async function bootstrapUser(roleFallback) {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;

    const user = userData?.user;
    if (!user) return;

    const userId = user.id;
    const now = new Date().toISOString();

    const { data: existingProfile, error: profileReadError } = await client
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileReadError) throw profileReadError;

    if (!existingProfile) {
      const role = roleFallback || user?.user_metadata?.role || "fan";

      const { error: profileInsertError } = await client
        .from("profiles")
        .insert({
          user_id: userId,
          role,
          updated_at: now,
        });

      if (profileInsertError) throw profileInsertError;
    }

    const { error: walletError } = await client
      .from("wallets")
      .upsert(
        { profile_id: userId },
        { onConflict: "profile_id" }
      );

    if (walletError) throw walletError;

    const { data: existingEntitlement, error: entitlementReadError } = await client
      .from("entitlements")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (entitlementReadError) throw entitlementReadError;

    if (!existingEntitlement) {
      const role = roleFallback || user?.user_metadata?.role || "fan";

      const { error: entitlementInsertError } = await client
        .from("entitlements")
        .insert({
          user_id: userId,
          fan_membership: role === "fan",
          creator_plan: role === "creator",
          creator_membership: false,
          updated_at: now,
        });

      if (entitlementInsertError) throw entitlementInsertError;
    } else {
      const { error: entitlementUpdateError } = await client
        .from("entitlements")
        .update({ updated_at: now })
        .eq("user_id", userId);

      if (entitlementUpdateError) throw entitlementUpdateError;
    }
  }

  function getNextHref() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next) {
      return Routes?.from(next) || next;
    }

    return PATHS.app?.profile || "/html/app/profile.html";
  }

  async function run() {
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;

      if (sessionData?.session) {
        const role = sessionData.session.user?.user_metadata?.role || "fan";
        await bootstrapUser(role);
      }
    } catch (error) {
      console.warn("Auth bootstrap skipped:", error);
    }

    const nextHref = getNextHref();

    if (Routes?.replaceTo) {
      Routes.replaceTo(nextHref);
      return;
    }

    window.location.replace(nextHref);
  }

  run();
})();