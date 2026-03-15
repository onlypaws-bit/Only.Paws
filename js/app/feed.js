/* =========================================================
   OnlyPaws
   File: /js/app/feed.js
   Purpose: shared feed helpers for creator posts and featured creators
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  function getClient() {
    if (!client) {
      throw new Error("[feed] onlypawsClient not found.");
    }
    return client;
  }

  async function getViewerSession() {
    const supabase = getClient();

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    return session || null;
  }

  function isCreatorViewingOwnFeed(viewerId, creatorId) {
    return Boolean(viewerId && creatorId && viewerId === creatorId);
  }

  function creatorProfileHref(usernameOrId) {
    const safeValue = String(usernameOrId || "").trim();
    if (!safeValue) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: safeValue });
    }

    const base = PATHS?.app?.fans?.creatorProfile || "/html/app/fans/creator-profile.html";
    return `${base}?u=${encodeURIComponent(safeValue)}`;
  }

  function postHref(postId) {
    const safeValue = String(postId || "").trim();
    if (!safeValue) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.post", { id: safeValue });
    }

    const base = PATHS?.app?.post || "/html/app/post.html";
    return `${base}?id=${encodeURIComponent(safeValue)}`;
  }

  async function fetchCreatorFeed(creatorId) {
    const supabase = getClient();
    const session = await getViewerSession();

    const viewerId = session?.user?.id || null;
    const isOwnFeed = isCreatorViewingOwnFeed(viewerId, creatorId);

    let isSubscribed = false;

    if (session && !isOwnFeed) {
      const { data, error } = await supabase.rpc("is_subscribed_to", {
        p_creator_id: creatorId,
      });

      if (error) throw error;
      isSubscribed = Boolean(data);
    }

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select(
        "id, creator_id, pet_id, title, content, preview, slug, media_url, media_type, is_public, is_paid, is_pinned, likes_count, created_at"
      )
      .eq("creator_id", creatorId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (postsError) throw postsError;

    const enrichedPosts = (posts || []).map((post) => {
      if (post.is_public === false) {
        const canView = isOwnFeed;
        return {
          ...post,
          can_view: canView,
          is_locked: !canView,
          href: postHref(post.id),
        };
      }

      if (post.is_paid !== true) {
        return {
          ...post,
          can_view: true,
          is_locked: false,
          href: postHref(post.id),
        };
      }

      const canView = isOwnFeed || isSubscribed;

      return {
        ...post,
        can_view: canView,
        is_locked: !canView,
        href: postHref(post.id),
      };
    });

    return {
      isSubscribed,
      posts: enrichedPosts,
    };
  }

  function seededRandom(seed) {
    let h = 0;

    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }

    return () => {
      h = (Math.imul(1664525, h) + 1013904223) | 0;
      return (h >>> 0) / 4294967296;
    };
  }

  async function fetchFeaturedCreators(limit = 6) {
    const supabase = getClient();

    const topCount = Math.ceil(limit / 2);
    const newCount = Math.floor(limit / 2);

    const creatorFields =
      "user_id, username, display_name, bio, avatar_url, created_at, last_active_at, instagram_url, tiktok_url";

    const { data: latestActive, error: latestError } = await supabase
      .from("profiles")
      .select(creatorFields)
      .eq("role", "creator")
      .order("last_active_at", { ascending: false })
      .limit(topCount);

    if (latestError) throw latestError;

    const { data: newestCreators, error: newestError } = await supabase
      .from("profiles")
      .select(creatorFields)
      .eq("role", "creator")
      .order("created_at", { ascending: false })
      .limit(newCount);

    if (newestError) throw newestError;

    const map = new Map();

    [...(latestActive || []), ...(newestCreators || [])].forEach((creator) => {
      const key = creator?.user_id || creator?.id;
      if (!key || map.has(key)) return;

      map.set(key, {
        ...creator,
        href: creatorProfileHref(creator?.username || creator?.user_id),
      });
    });

    const mergedCreators = Array.from(map.values());

    if (mergedCreators.length <= limit) {
      return mergedCreators;
    }

    const today = new Date().toISOString().slice(0, 10);
    const seed = today.replace(/-/g, "");
    const rand = seededRandom(seed);

    for (let i = mergedCreators.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [mergedCreators[i], mergedCreators[j]] = [mergedCreators[j], mergedCreators[i]];
    }

    return mergedCreators.slice(0, limit);
  }

  window.OPFeed = {
    getViewerSession,
    isCreatorViewingOwnFeed,
    creatorProfileHref,
    postHref,
    fetchCreatorFeed,
    fetchFeaturedCreators,
  };
})();