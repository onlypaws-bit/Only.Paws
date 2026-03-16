/* =========================================================
   OnlyPaws
   File: /js/app/feed.js
   Purpose:
   Shared feed helpers plus page init for /html/app/feed.html

   Handles:
   - viewer session helpers
   - creator/profile/post href builders
   - featured creators fetch
   - creator feed fetch
   - feed page init
   - featured creators rendering
   - latest posts rendering
   - app layout loading
   - media preview modal interactions

   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPPartials
   - window.OPNav
   - window.OnlyPawsPost
   - window.onlypawsLikes
   - window.OPSupport
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  /* =========================================================
     Core client helpers
     ========================================================= */

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

  /* =========================================================
     Route / href helpers
     ========================================================= */

  function creatorProfileHref(usernameOrId) {
    const safeValue = String(usernameOrId || "").trim();
    if (!safeValue) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: safeValue });
    }

    const base =
      PATHS?.app?.fans?.creatorProfile ||
      "/html/app/fans/creator-profile.html";

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

  /* =========================================================
     Creator feed data
     Fetches posts for a single creator and marks locked state
     depending on viewer role / subscription status.
     ========================================================= */

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

  /* =========================================================
     Featured creators helpers
     Uses a small deterministic shuffle so the mix rotates
     but remains stable for the same day.
     ========================================================= */

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

  /* =========================================================
     Small UI helpers
     ========================================================= */

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  function show(el) {
    if (el) el.hidden = false;
  }

  function creatorAvatarHtml(creator) {
    const name = creator?.display_name || creator?.username || "Creator";
    const avatar = creator?.avatar_url || "";

    if (avatar) {
      return `
        <img
          class="creatorAvatar"
          src="${esc(avatar)}"
          alt="${esc(name)} avatar"
          loading="lazy"
          decoding="async"
        />
      `;
    }

    return `<div class="creatorAvatar creatorAvatarFallback" aria-hidden="true">🐾</div>`;
  }

  function creatorCardHtml(creator) {
    const name = creator?.display_name || creator?.username || "Creator";
    const username = creator?.username ? `@${creator.username}` : "";
    const bio = creator?.bio || "";
    const href = creator?.href || "#";

    return `
      <a class="creatorCard" href="${esc(href)}">
        <div class="creatorCardHead">
          <div class="creatorAvatarWrap">
            ${creatorAvatarHtml(creator)}
          </div>

          <div class="creatorMeta">
            <strong>${esc(name)}</strong>
            ${username ? `<span>${esc(username)}</span>` : ""}
          </div>
        </div>

        ${bio ? `<p class="creatorBio">${esc(bio)}</p>` : ""}
      </a>
    `.trim();
  }

  /* =========================================================
     Featured creators section
     Fetches and renders the mixed featured creator set.
     ========================================================= */

  async function loadFeaturedCreators() {
    const creatorList = document.getElementById("creatorList");
    const creatorHint = document.getElementById("creatorHint");

    if (!creatorList) return;

    try {
      const creators = await fetchFeaturedCreators(6);

      creatorList.innerHTML = "";

      if (!Array.isArray(creators) || creators.length === 0) {
        setText(creatorHint, "No creators available right now.");
        show(creatorHint);
        return;
      }

      creatorList.innerHTML = creators.map(creatorCardHtml).join("");
      hide(creatorHint);
    } catch (error) {
      console.error("[feed] failed to load featured creators", error);
      setText(creatorHint, "Failed to load creators.");
      show(creatorHint);
    }
  }

  /* =========================================================
     Latest posts section
     Fetches recent posts across creators and renders them
     using the shared post renderer.
     ========================================================= */

  async function loadLatestPosts() {
    const postsEl = document.getElementById("posts");
    const postsHint = document.getElementById("postsHint");

    if (!postsEl) return;

    if (!window.OnlyPawsPost?.renderPost) {
      console.warn("[feed] OnlyPawsPost not found. Load /js/app/post.js first.");
      setText(postsHint, "Post renderer not available.");
      show(postsHint);
      return;
    }

    const supabase = getClient();

    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          creator_id,
          pet_id,
          title,
          content,
          preview,
          slug,
          media_url,
          media_type,
          is_public,
          is_paid,
          is_pinned,
          likes_count,
          created_at,
          price_cents,
          currency,
          profiles:creator_id (
            user_id,
            username,
            display_name,
            avatar_url
          )
        `
        )
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      const posts = (data || []).map((post) => {
        const profile = Array.isArray(post.profiles)
          ? post.profiles[0]
          : post.profiles || null;

        const isLocked = Boolean(post.is_paid === true || post.is_public === false);

        return {
          ...post,
          excerpt: post.preview || post.content || "",
          creator_username: profile?.username || "",
          creator_name: profile?.display_name || "",
          creator_avatar_url: profile?.avatar_url || "",
          is_locked: isLocked,
        };
      });

      postsEl.innerHTML = "";

      if (!posts.length) {
        setText(postsHint, "No posts yet.");
        show(postsHint);
        return;
      }

      postsEl.innerHTML = posts
        .map((post) =>
          window.OnlyPawsPost.renderPost(post, {
            showCreator: true,
          })
        )
        .join("");

      hide(postsHint);

      if (window.OnlyPawsPost?.initPosts) {
        await window.OnlyPawsPost.initPosts(postsEl);
      }
    } catch (error) {
      console.error("[feed] failed to load latest posts", error);
      setText(postsHint, "Failed to load posts.");
      show(postsHint);
    }
  }

  /* =========================================================
     Support button wiring
     Connects the feed CTA to the shared support flow if present.
     ========================================================= */

  function initSupportButton() {
    const btn = document.getElementById("supportBtn");
    if (!btn) return;

    if (window.OPSupport?.bindSupportButton) {
      window.OPSupport.bindSupportButton(btn);
      return;
    }

    if (window.OPSupport?.openSupportModal) {
      btn.addEventListener("click", () => {
        window.OPSupport.openSupportModal();
      });
    }
  }

  /* =========================================================
     Media modal
     Lightweight preview modal for future feed media hooks.
     Safe to initialize even if currently unused.
     ========================================================= */

  function initMediaModal() {
    const modal = document.getElementById("mediaModal");
    const closeBtn = document.getElementById("mediaModalClose");
    const img = document.getElementById("mediaModalImg");
    const vid = document.getElementById("mediaModalVid");

    if (!modal || !closeBtn || !img || !vid) return;

    function closeModal() {
      modal.setAttribute("aria-hidden", "true");
      img.classList.add("isHidden");
      vid.classList.add("isHidden");
      img.removeAttribute("src");
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
    }

    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
    });

    window.OPFeedMediaModal = {
      openImage(src, alt = "Preview") {
        if (!src) return;
        img.src = src;
        img.alt = alt;
        img.classList.remove("isHidden");
        vid.classList.add("isHidden");
        modal.setAttribute("aria-hidden", "false");
      },

      openVideo(src) {
        if (!src) return;
        vid.src = src;
        vid.classList.remove("isHidden");
        img.classList.add("isHidden");
        modal.setAttribute("aria-hidden", "false");
      },

      close: closeModal,
    };
  }

  /* =========================================================
     Page init
     Loads shared app layout, initializes nav/support/modal,
     then fetches creators and posts for the feed page.
     ========================================================= */

  async function initFeedPage() {
    const isFeedPage =
      document.body?.classList.contains("feedPage") ||
      document.getElementById("creatorList") ||
      document.getElementById("posts");

    if (!isFeedPage) return;

    try {
      if (window.OPPartials?.loadLayout) {
        await window.OPPartials.loadLayout();
      }

      if (window.OPNav?.init) {
        window.OPNav.init();
      }

      initSupportButton();
      initMediaModal();

      await Promise.all([
        loadFeaturedCreators(),
        loadLatestPosts(),
      ]);
    } catch (error) {
      console.error("[feed] init failed", error);
    }
  }

  /* =========================================================
     Public API
     ========================================================= */

  window.OPFeed = {
    getViewerSession,
    isCreatorViewingOwnFeed,
    creatorProfileHref,
    postHref,
    fetchCreatorFeed,
    fetchFeaturedCreators,
    loadFeaturedCreators,
    loadLatestPosts,
    initFeedPage,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initFeedPage();
  });
})();
