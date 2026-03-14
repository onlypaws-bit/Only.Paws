// onlypawsClient.js
// Initializes Supabase client for OnlyPaws
// Exposes:
//   window.onlypawsClient
//   window.onlypawsLikes

(() => {

  const ONLYPAWS_SUPABASE_URL = "https://sdhpbwkhdovyunvtdtbq.supabase.co";

  const ONLYPAWS_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaHBid2toZG92eXVudnRkdGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTU1NDMsImV4cCI6MjA4NTUzMTU0M30.QuEhO3G7U0ScHrHqgIGnwm0uqtlfs2qXvGXPh1UKsRo";

  if (!window.supabase) {
    throw new Error(
      "Supabase JS not loaded. Include first: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    );
  }

  const onlypawsClient = window.supabase.createClient(
    ONLYPAWS_SUPABASE_URL,
    ONLYPAWS_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    }
  );

  // expose client globally
  window.onlypawsClient = onlypawsClient;

  /* =====================================================
     LIKE HELPERS (RPC)
     ===================================================== */

  async function getPostLikeCount(postId) {
    if (!postId) throw new Error("getPostLikeCount: missing postId");

    const { data, error } = await onlypawsClient.rpc(
      "get_post_like_count",
      { p_post_id: postId }
    );

    if (error) throw error;

    const n = Number(data);
    return Number.isFinite(n) ? n : data;
  }

  async function getPostLikedByMe(postId) {
    if (!postId) throw new Error("getPostLikedByMe: missing postId");

    const { data, error } = await onlypawsClient.rpc(
      "get_post_liked_by_me",
      { p_post_id: postId }
    );

    if (error) throw error;

    return Boolean(data);
  }

  async function togglePostLike(postId) {
    if (!postId) throw new Error("togglePostLike: missing postId");

    const { data, error } = await onlypawsClient.rpc(
      "toggle_post_like",
      { p_post_id: postId }
    );

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return { liked: false, like_count: 0 };
    }

    return {
      liked: Boolean(row.liked),
      like_count: Number(row.like_count ?? 0),
    };
  }

  // expose like helpers
  window.onlypawsLikes = {
    getPostLikeCount,
    getPostLikedByMe,
    togglePostLike,
  };

  console.log("✅ onlypawsClient ready");
  console.log("✅ onlypawsLikes ready");

})();
