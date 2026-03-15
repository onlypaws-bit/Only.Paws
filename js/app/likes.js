/* =========================================================
   OnlyPaws
   File: /js/app/likes.js
   Purpose: shared post like helpers
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

  async function getPostLikeCount(postId) {
    if (!postId) {
      throw new Error("getPostLikeCount: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("get_post_like_count", {
      p_post_id: postId,
    });

    if (error) throw error;

    const count = Number(data);
    return Number.isFinite(count) ? count : 0;
  }

  async function getPostLikedByMe(postId) {
    if (!postId) {
      throw new Error("getPostLikedByMe: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("get_post_liked_by_me", {
      p_post_id: postId,
    });

    if (error) throw error;

    return Boolean(data);
  }

  async function togglePostLike(postId) {
    if (!postId) {
      throw new Error("togglePostLike: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("toggle_post_like", {
      p_post_id: postId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        liked: false,
        like_count: 0,
      };
    }

    return {
      liked: Boolean(row.liked),
      like_count: Number(row.like_count ?? 0),
    };
  }

  window.onlypawsLikes = {
    getPostLikeCount,
    getPostLikedByMe,
    togglePostLike,
  };
})();