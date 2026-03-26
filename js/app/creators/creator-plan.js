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

  async function getEarlyCreatorTrial(userId) {
    if (!userId) return null;

    const supabase = getClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        is_early_creator,
        trial_expires_at,
        trial_used
      `)
      .eq("user_id", userId)
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

  function isEarlyCreator(trialProfile) {
    return trialProfile?.is_early_creator === true;
  }

  function getTrialPeriodEndMs(trialProfile) {
    if (!trialProfile?.trial_expires_at) return 0;

    const time = new Date(trialProfile.trial_expires_at).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function hasActiveTrialAccess(trialProfile) {
    if (!isEarlyCreator(trialProfile)) return false;

    const trialEndMs = getTrialPeriodEndMs(trialProfile);
    if (!trialEndMs) return false;

    return trialEndMs > Date.now();
  }

  function getTrialDaysLeft(trialProfile) {
    const trialEndMs = getTrialPeriodEndMs(trialProfile);
    if (!trialEndMs) return 0;

    const diff = trialEndMs - Date.now();
    if (diff <= 0) return 0;

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function hasCreatorMonetizationAccess(entitlement, trialProfile) {
    return hasCreatorPlanAccess(entitlement) || hasActiveTrialAccess(trialProfile);
  }

  async function getCreatorAccessState(userId) {
    if (!userId) {
      return {
        entitlement: null,
        trialProfile: null,
        hasCreatorPlan: false,
        hasActiveTrial: false,
        canUseCreatorFeatures: false,
        isCanceling: false,
        creatorPlanPeriodEndMs: 0,
        trialPeriodEndMs: 0,
        trialDaysLeft: 0,
      };
    }

    const [entitlement, trialProfile] = await Promise.all([
      getCreatorPlanEntitlement(userId),
      getEarlyCreatorTrial(userId),
    ]);

    const hasCreatorPlan = hasCreatorPlanAccess(entitlement);
    const hasActiveTrial = hasActiveTrialAccess(trialProfile);

    return {
      entitlement,
      trialProfile,
      hasCreatorPlan,
      hasActiveTrial,
      canUseCreatorFeatures: hasCreatorPlan || hasActiveTrial,
      isCanceling: isCreatorPlanCanceling(entitlement),
      creatorPlanPeriodEndMs: getCreatorPlanPeriodEndMs(entitlement),
      trialPeriodEndMs: getTrialPeriodEndMs(trialProfile),
      trialDaysLeft: getTrialDaysLeft(trialProfile),
    };
  }

  window.OPCreatorPlan = {
    getCreatorPlanEntitlement,
    getEarlyCreatorTrial,
    isCreatorPlanActive,
    isCreatorPlanCanceling,
    getCreatorPlanPeriodEndMs,
    hasCreatorPlanAccess,
    isEarlyCreator,
    getTrialPeriodEndMs,
    hasActiveTrialAccess,
    getTrialDaysLeft,
    hasCreatorMonetizationAccess,
    getCreatorAccessState,
  };
})();
