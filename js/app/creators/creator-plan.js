/* =========================================================
   OnlyPaws
   File: /js/app/creators/creator-plan.js
   Purpose: Creator Plan entitlement helpers
   Dependencies:
   - window.onlypawsClient
   ========================================================= */

(function () {
  const client = window.onlypawsClient;

  function getClient() {
    if (!client) {
      throw new Error("onlypawsClient not found. Load /js/onlypawsClient.js first.");
    }
    return client;
  }

  async function getCreatorPlanEntitlement(userId) {
    if (!userId) return null;

    const supabase = getClient();

    const { data, error } = await supabase
      .from("entitlements")
      .select(`
        id,
        key,
        status,
        cancel_at_period_end,
        current_period_end
      `)
      .eq("user_id", userId)
      .eq("key", "creator_plan")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function isCreatorPlanActive(entitlement) {
    if (!entitlement) return false;

    const status = String(entitlement.status || "").toLowerCase();
    return status === "active" || status === "trialing";
  }

  function isCreatorPlanCanceling(entitlement) {
    if (!entitlement) return false;
    return isCreatorPlanActive(entitlement) && entitlement.cancel_at_period_end === true;
  }

  function getCreatorPlanPeriodEndMs(entitlement) {
    if (!entitlement?.current_period_end) return 0;

    const time = new Date(entitlement.current_period_end).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function hasCreatorPlanAccess(entitlement) {
    if (!isCreatorPlanActive(entitlement)) return false;

    const periodEndMs = getCreatorPlanPeriodEndMs(entitlement);
    if (!periodEndMs) return true;

    return periodEndMs > Date.now();
  }

  window.OPCreatorPlan = {
    getCreatorPlanEntitlement,
    isCreatorPlanActive,
    isCreatorPlanCanceling,
    getCreatorPlanPeriodEndMs,
    hasCreatorPlanAccess,
  };
})();