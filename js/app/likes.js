/* =========================================================
   OnlyPaws
   File: /js/app/likes.js
   Purpose: shared post like helpers + UI binding
   Dependencies:
   - window.onlypawsClient
   ========================================================= */

(function () {
  function getClient() {
    const client = window.onlypawsClient;
    if (!client) {
      throw new Error("onlypawsClient not found. Load /js/onlypawsClient.js first.");
    }
    return client;
  }

  const state = {
    byPostId: new Map(),
    loadingByPostId: new Map(),
  };

  function normalizePostId(postId) {
    return String(postId || "").trim();
  }

  function formatLikeCount(count) {
    const n = Number(count) || 0;
    return String(n);
  }

  function getButtonsForPost(postId, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return [];
    return Array.from(
      root.querySelectorAll('[data-like-button][data-post-id]')
    ).filter((el) => normalizePostId(el.dataset.postId) === safePostId);
  }

  function getCountElsForPost(postId, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return [];
    return Array.from(
      root.querySelectorAll('[data-like-count][data-post-id]')
    ).filter((el) => normalizePostId(el.dataset.postId) === safePostId);
  }

  async function getPostLikeCount(postId) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) {
      throw new Error("getPostLikeCount: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("get_post_like_count", {
      p_post_id: safePostId,
    });

    if (error) throw error;

    const count = Number(data);
    return Number.isFinite(count) ? count : 0;
  }

  async function getPostLikedByMe(postId) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) {
      throw new Error("getPostLikedByMe: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("get_post_liked_by_me", {
      p_post_id: safePostId,
    });

    if (error) throw error;

    return Boolean(data);
  }

  async function getPostLikeState(postId) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) {
      throw new Error("getPostLikeState: missing postId");
    }

    const [like_count, liked] = await Promise.all([
      getPostLikeCount(safePostId),
      getPostLikedByMe(safePostId),
    ]);

    const next = {
      liked: Boolean(liked),
      like_count: Number(like_count) || 0,
    };

    state.byPostId.set(safePostId, next);
    return next;
  }

  async function togglePostLike(postId) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) {
      throw new Error("togglePostLike: missing postId");
    }

    const supabase = getClient();

    const { data, error } = await supabase.rpc("toggle_post_like", {
      p_post_id: safePostId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    const next = {
      liked: Boolean(row?.liked),
      like_count: Number(row?.like_count ?? 0),
    };

    state.byPostId.set(safePostId, next);
    return next;
  }

  function applyLikeStateToDom(postId, likeState, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return;

    const liked = Boolean(likeState?.liked);
    const likeCount = Number(likeState?.like_count) || 0;

    const buttons = getButtonsForPost(safePostId, root);
    const countEls = getCountElsForPost(safePostId, root);

    buttons.forEach((btn) => {
      btn.dataset.liked = liked ? "true" : "false";
      btn.setAttribute("aria-pressed", liked ? "true" : "false");
      btn.classList.toggle("is-liked", liked);

      const iconEl = btn.querySelector("[data-like-icon]");
      if (iconEl) {
        iconEl.textContent = liked ? "💜" : "🤍";
      }

      const inlineCountEl = btn.querySelector("[data-like-count-inline]");
      if (inlineCountEl) {
        inlineCountEl.textContent = formatLikeCount(likeCount);
      }
    });

    countEls.forEach((el) => {
      el.textContent = formatLikeCount(likeCount);
    });
  }

  function setLoading(postId, isLoading, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return;

    const buttons = getButtonsForPost(safePostId, root);
    buttons.forEach((btn) => {
      btn.disabled = Boolean(isLoading);
      btn.classList.toggle("is-loading", Boolean(isLoading));
    });

    state.loadingByPostId.set(safePostId, Boolean(isLoading));
  }

  async function refreshPostLikeUi(postId, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return { liked: false, like_count: 0 };

    const likeState = await getPostLikeState(safePostId);
    applyLikeStateToDom(safePostId, likeState, root);
    return likeState;
  }

  async function handleLikeClick(postId, root = document) {
    const safePostId = normalizePostId(postId);
    if (!safePostId) return;

    if (state.loadingByPostId.get(safePostId)) return;

    try {
      setLoading(safePostId, true, root);
      const next = await togglePostLike(safePostId);
      applyLikeStateToDom(safePostId, next, root);
      return next;
    } catch (error) {
      console.error("toggle like failed:", error);
      throw error;
    } finally {
      setLoading(safePostId, false, root);
    }
  }

  async function initLikeButtons(root = document) {
    const buttons = Array.from(
      root.querySelectorAll("[data-like-button][data-post-id]")
    );

    const uniquePostIds = [
      ...new Set(
        buttons
          .map((btn) => normalizePostId(btn.dataset.postId))
          .filter(Boolean)
      ),
    ];

    buttons.forEach((btn) => {
      if (btn.dataset.likeBound === "true") return;

      btn.dataset.likeBound = "true";
      btn.type = btn.getAttribute("type") || "button";

      btn.addEventListener("click", async () => {
        const postId = normalizePostId(btn.dataset.postId);
        if (!postId) return;

        try {
          await handleLikeClick(postId, root);
        } catch (error) {
          console.error(error);
        }
      });
    });

    await Promise.all(
      uniquePostIds.map(async (postId) => {
        try {
          await refreshPostLikeUi(postId, root);
        } catch (error) {
          console.error(`init likes failed for post ${postId}:`, error);
        }
      })
    );
  }

  window.onlypawsLikes = {
    getPostLikeCount,
    getPostLikedByMe,
    getPostLikeState,
    togglePostLike,
    refreshPostLikeUi,
    initLikeButtons,
    applyLikeStateToDom,
    handleLikeClick,
  };
})();
