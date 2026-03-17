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

  let creatorsAll = [];

  /* =========================================================
     Core helpers
     ========================================================= */

  function getClient() {
    if (!client) {
      throw new Error("[feed] onlypawsClient not found.");
    }
    return client;
  }

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

  function show(el) {
    if (el) el.hidden = false;
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  function setDebug(message) {
    const el = document.getElementById("debug");
    if (!el) return;

    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }

    el.hidden = false;
    el.textContent = message;
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
     Route helpers
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
     Featured creators
     Old behavior restored:
     - mix latest active + newest creators
     - de-dup
     - deterministic daily shuffle
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

    const halfTop = Math.ceil(limit / 2);
    const halfNew = Math.floor(limit / 2);

    const creatorFields =
      "user_id, username, display_name, bio, avatar_url, created_at, last_active_at";

    let latestActive = [];
    let newestCreators = [];

    const latestRes = await supabase
      .from("profiles")
      .select(creatorFields)
      .eq("role", "creator")
      .not("username", "is", null)
      .order("last_active_at", { ascending: false })
      .limit(halfTop);

    if (latestRes.error) {
      console.warn("[feed] latest active fallback -> created_at", latestRes.error);

      const fallbackRes = await supabase
        .from("profiles")
        .select(creatorFields)
        .eq("role", "creator")
        .not("username", "is", null)
        .order("created_at", { ascending: false })
        .limit(halfTop);

      if (fallbackRes.error) throw fallbackRes.error;
      latestActive = fallbackRes.data || [];
    } else {
      latestActive = latestRes.data || [];
    }

    const newestRes = await supabase
      .from("profiles")
      .select(creatorFields)
      .eq("role", "creator")
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(halfNew);

    if (newestRes.error) throw newestRes.error;
    newestCreators = newestRes.data || [];

    const map = new Map();

    [...latestActive, ...newestCreators].forEach((creator) => {
      const key = creator?.user_id || creator?.id;
      if (!key || map.has(key)) return;

      map.set(key, {
        ...creator,
        href: creatorProfileHref(creator?.username || creator?.user_id),
      });
    });

    const merged = Array.from(map.values());

    if (merged.length <= limit) {
      return merged;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rand = seededRandom(today.replace(/-/g, ""));

    for (let i = merged.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [merged[i], merged[j]] = [merged[j], merged[i]];
    }

    return merged.slice(0, limit);
  }

  /* =========================================================
     Single creator feed
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
     Creator cards
     ========================================================= */

  function creatorAvatarHtml(creator) {
    const name = creator?.display_name || creator?.username || "Creator";
    const avatar = String(creator?.avatar_url || "").trim();

    if (avatar) {
      return `
        <img
          class="creatorAvatar"
          src="${esc(avatar)}"
          alt="${esc(name)} avatar"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
      `;
    }

    return `<div class="creatorAvatar creatorAvatarFallback" aria-hidden="true">🐾</div>`;
  }

  function creatorCardHtml(creator) {
    const name = creator?.display_name || creator?.username || "Creator";
    const username = creator?.username || "creator";
    const bio = creator?.bio || "";
    const href = creator?.href || creatorProfileHref(username);

    return `
      <a class="creatorCard" href="${esc(href)}" aria-label="Open ${esc(name)} profile">
        <div class="creatorCardHead">
          <div class="creatorAvatarWrap">
            ${creatorAvatarHtml(creator)}
          </div>

          <div class="creatorMeta">
            <strong>${esc(name)}</strong>
            <span>@${esc(username)}${bio ? ` • ${esc(bio).slice(0, 40)}` : ""}</span>
          </div>
        </div>
      </a>
    `.trim();
  }

  function renderCreators(list) {
    const el = document.getElementById("creatorList");
    const hint = document.getElementById("creatorHint");
    if (!el) return;

    if (!Array.isArray(list) || !list.length) {
      el.innerHTML = "";
      setText(hint, "No creators yet.");
      show(hint);
      return;
    }

    el.innerHTML = list.map(creatorCardHtml).join("");
    hide(hint);
  }

  function setupSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    input.addEventListener("input", () => {
      const q = String(input.value || "").trim().toLowerCase();

      if (!q) {
        renderCreators(creatorsAll);
        return;
      }

      const filtered = creatorsAll.filter((creator) => {
        const name = String(creator.display_name || "").toLowerCase();
        const username = String(creator.username || "").toLowerCase();
        return name.includes(q) || username.includes(q);
      });

      renderCreators(filtered);
    });
  }

  async function loadFeaturedCreators() {
    const creatorHint = document.getElementById("creatorHint");

    try {
      const session = await getViewerSession();
      const viewerId = session?.user?.id || null;

      const creators = await fetchFeaturedCreators(6);

      creatorsAll = (creators || [])
        .filter((creator) => String(creator.user_id || "") !== String(viewerId || ""))
        .slice(0, 12);

      renderCreators(creatorsAll);
    } catch (error) {
      console.error("[feed] failed to load featured creators", error);
      setText(creatorHint, "Could not load creators.");
      show(creatorHint);
      setDebug(
        `Creators query failed:\n${error?.message || "Unknown error"}`
      );
      creatorsAll = [];
      renderCreators([]);
    }
  }

  /* =========================================================
     Latest posts
     Old lock/unlock behavior restored:
     - private => only creator
     - public free => everyone
     - public premium => creator or active subscriber
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const viewerId = session?.user?.id || null;

      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          creator_id,
          title,
          content,
          preview,
          media_url,
          media_type,
          is_paid,
          is_public,
          created_at,
          profiles:creator_id (
            user_id,
            username,
            display_name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      const posts = data || [];

      if (!viewerId) {
        const enrichedLoggedOut = posts.map((post) => {
          const profile = Array.isArray(post.profiles)
            ? post.profiles[0]
            : post.profiles || null;

          const locked = post.is_public === false || post.is_paid === true;

          return {
            ...post,
            creator_username: profile?.username || "creator",
            creator_name: profile?.display_name || profile?.username || "creator",
            creator_avatar_url: profile?.avatar_url || "",
            excerpt: locked
              ? (post.preview || "Locked content.")
              : (post.preview || post.content || ""),
            is_locked: locked,
            can_view: !locked,
          };
        });

        if (!enrichedLoggedOut.length) {
          postsEl.innerHTML = "";
          setText(postsHint, "No posts yet.");
          show(postsHint);
          return;
        }

        postsEl.innerHTML = enrichedLoggedOut
          .map((post) =>
            window.OnlyPawsPost.renderPost(post, {
              showCreator: true,
              postUrl: (p) => postHref(p.id),
            })
          )
          .join("");

        hide(postsHint);

        if (window.OnlyPawsPost?.initPosts) {
          await window.OnlyPawsPost.initPosts(postsEl);
        }

        return;
      }

      const creatorIdsToCheck = [
        ...new Set(
          posts
            .filter(
              (post) =>
                post?.creator_id &&
                post.creator_id !== viewerId &&
                post.is_public !== false &&
                post.is_paid === true
            )
            .map((post) => post.creator_id)
        ),
      ];

      const subMap = new Map();
      creatorIdsToCheck.forEach((id) => subMap.set(id, false));

      if (creatorIdsToCheck.length) {
        const { data: subs, error: subsError } = await supabase
          .from("fan_subscriptions")
          .select("creator_id, status, current_period_end, cancel_at_period_end")
          .eq("fan_id", viewerId)
          .in("creator_id", creatorIdsToCheck);

        if (subsError) {
          console.warn("[feed] fan_subscriptions lookup error", subsError);
        } else {
          const now = Date.now();

          for (const row of subs || []) {
            const raw = row.current_period_end;

            let endMs = 0;

            if (raw) {
              if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
                const n = Number(raw);
                endMs = n < 1e12 ? n * 1000 : n;
              } else {
                endMs = new Date(raw).getTime();
              }
            }

            let hasAccess = !!endMs && endMs > now;

            if (!hasAccess && !raw) {
              const status = String(row.status || "").toLowerCase();
              if (status === "active" || status === "trialing") {
                hasAccess = true;
              }
            }

            if (hasAccess) {
              subMap.set(row.creator_id, true);
            }
          }
        }
      }

      const enriched = posts.map((post) => {
        const profile = Array.isArray(post.profiles)
          ? post.profiles[0]
          : post.profiles || null;

        const isMine = String(post.creator_id || "") === String(viewerId || "");
        let locked = false;

        if (post.is_public === false) {
          locked = !isMine;
        } else if (post.is_paid === true) {
          const isSub = subMap.get(post.creator_id) === true;
          locked = !(isMine || isSub);
        } else {
          locked = false;
        }

        return {
          ...post,
          creator_username: profile?.username || "creator",
          creator_name: profile?.display_name || profile?.username || "creator",
          creator_avatar_url: profile?.avatar_url || "",
          excerpt: locked
            ? (post.preview || "Locked content.")
            : (post.preview || post.content || ""),
          is_locked: locked,
          can_view: !locked,
        };
      });

      if (!enriched.length) {
        postsEl.innerHTML = "";
        setText(postsHint, "No posts yet.");
        show(postsHint);
        return;
      }

      postsEl.innerHTML = enriched
        .map((post) =>
          window.OnlyPawsPost.renderPost(post, {
            showCreator: true,
            postUrl: (p) => postHref(p.id),
          })
        )
        .join("");

      hide(postsHint);

      if (window.OnlyPawsPost?.initPosts) {
        await window.OnlyPawsPost.initPosts(postsEl);
      }
    } catch (error) {
      console.error("[feed] failed to load latest posts", error);
      setText(postsHint, "Could not load posts.");
      show(postsHint);
      setDebug(
        `${document.getElementById("debug")?.textContent ? `${document.getElementById("debug").textContent}\n\n` : ""}Posts query failed:\n${error?.message || "Unknown error"}`
      );
      postsEl.innerHTML = "";
    }
  }

  /* =========================================================
     Support button
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
      img.removeAttribute("src");

      vid.classList.add("isHidden");
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

      setupSearch();
      initSupportButton();
      initMediaModal();

      await Promise.all([
        loadFeaturedCreators(),
        loadLatestPosts(),
      ]);
    } catch (error) {
      console.error("[feed] init failed", error);
      setDebug(`Feed init failed:\n${error?.message || "Unknown error"}`);
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
