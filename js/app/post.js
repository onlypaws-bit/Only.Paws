/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose: render reusable posts and bind post interactions
   Dependencies:
   - window.onlypawsClient
   - window.onlypawsLikes
   - window.OP_PATHS
   - window.OPRoutes (recommended)
   - /css/app/post.css
   ========================================================= */

(() => {
  const FEATURE_LIKES = true;

  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(cents, currency = "eur") {
    const n = Number(cents);
    if (!Number.isFinite(n)) return "";

    const value = n / 100;

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: String(currency).toUpperCase(),
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${String(currency).toUpperCase()}`;
    }
  }

  function isVideoMedia(mediaType, mediaUrl) {
    const mt = String(mediaType || "").toLowerCase();
    if (mt.startsWith("video")) return true;

    const url = String(mediaUrl || "").toLowerCase();
    return (
      url.endsWith(".mp4") ||
      url.endsWith(".webm") ||
      url.endsWith(".mov") ||
      url.endsWith(".m4v")
    );
  }

  function defaultPostUrl(post) {
    if (ROUTES?.href) {
      return ROUTES.href("app.post", { id: post.id });
    }

    const base = PATHS?.app?.post || "/html/app/post.html";
    return `${base}?id=${encodeURIComponent(post.id)}`;
  }

  function creatorProfileUrl(username) {
    const safeUsername = username || "creator";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: safeUsername });
    }

    const base =
      PATHS?.app?.fans?.creatorProfile ||
      "/html/app/fans/creator-profile.html";

    return `${base}?u=${encodeURIComponent(safeUsername)}`;
  }

  function mediaHtml(post, locked) {
    const url = post?.media_url;
    if (!url) return "";

    const isVideo = isVideoMedia(post.media_type, url);

    const mediaEl = isVideo
      ? `<video ${locked ? "" : "controls"} playsinline preload="metadata" src="${esc(url)}"></video>`
      : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async">`;

    if (!locked) {
      return `
        <div class="op-mediaWrap">
          ${mediaEl}
        </div>
      `;
    }

    const creator = post.creator_username || post.creator_name || "creator";
    const profileUrl = creatorProfileUrl(creator);

    return `
      <div class="op-mediaWrap op-isLocked">
        ${mediaEl}
        <div class="op-lockOverlay">
          <div class="op-lockBox">
            <div class="op-badge op-badge--locked">Locked</div>
            <p class="op-lockTitle">Premium post</p>
            <p class="op-lockText">Subscribe to unlock this content</p>
            <a class="op-openCreatorBtn" href="${esc(profileUrl)}" data-op-stop-nav="1">Open creator</a>
          </div>
        </div>
      </div>
    `;
  }

  function formatPostDate(value) {
    if (!value) return "";

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const diffMs = now - d;

    const min = Math.floor(diffMs / 60000);
    const hr = Math.floor(diffMs / 3600000);
    const day = Math.floor(diffMs / 86400000);

    if (min < 1) return "now";
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    if (day < 7) return `${day}d`;

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function renderBadge(post, locked) {
    const price =
      post.price_cents != null && Number(post.price_cents) > 0
        ? fmtMoney(post.price_cents, post.currency || "eur")
        : "";

    if (locked) {
      return `<span class="op-badge op-badge--locked">Locked</span>`;
    }

    if (price) {
      return `<span class="op-badge op-badge--price">${esc(price)}</span>`;
    }

    return `<span class="op-badge op-badge--free">Free</span>`;
  }

  function renderPost(post, opts = {}) {
    const postUrl = (opts.postUrl || defaultPostUrl)(post);
    const title = esc(post.title || "");
    const excerpt = esc(post.excerpt || post.content || "");
    const creator = esc(post.creator_username || post.creator_name || "");
    const creatorAvatar = esc(post.creator_avatar_url || "");
    const createdAt = formatPostDate(post.created_at);
    const locked = Boolean(post.is_locked);
    const media = mediaHtml(post, locked);
    const badge = renderBadge(post, locked);

    const avatarHtml = creatorAvatar
      ? `<img src="${creatorAvatar}" alt="${creator || "Creator"} avatar" loading="lazy" decoding="async">`
      : `<span aria-hidden="true">🐾</span>`;

    const likeBlock = FEATURE_LIKES
      ? `
        <button
          class="op-likeBtn"
          type="button"
          aria-label="Like post"
          data-post-id="${esc(post.id)}"
          data-liked="0"
          data-op-stop-nav="1"
        >
          <span class="op-likeIcon" aria-hidden="true">♡</span>
          <span class="op-likeCount" data-like-count>—</span>
        </button>
      `
      : "";

    return `
      <article class="op-postCard" data-post-id="${esc(post.id)}">
        <div
          class="op-postMain"
          role="link"
          tabindex="0"
          data-post-url="${esc(postUrl)}"
        >
          <div class="op-postHeader">
            <div class="op-postCreator">
              <a
                class="op-postCreatorAvatar"
                href="${esc(creatorProfileUrl(creator))}"
                data-op-stop-nav="1"
                aria-label="Open ${creator || "creator"} profile"
              >
                ${avatarHtml}
              </a>

              <div class="op-postCreatorMeta">
                ${
                  opts.showCreator !== false && creator
                    ? `<a class="op-postCreatorName" href="${esc(creatorProfileUrl(creator))}" data-op-stop-nav="1">@${creator}</a>`
                    : `<span class="op-postCreatorName"></span>`
                }
                ${createdAt ? `<span class="op-postDate">${esc(createdAt)}</span>` : ``}
              </div>
            </div>

            <div class="op-postHeaderRight">
              ${badge}
            </div>
          </div>

          <div class="op-postBody">
            ${title ? `<h3 class="op-title">${title}</h3>` : ``}
            ${excerpt ? `<p class="op-excerpt">${excerpt}</p>` : ``}
            ${media}
          </div>
        </div>

        <div class="op-postBottom">
          ${likeBlock}
        </div>
      </article>
    `.trim();
  }

  async function isLoggedIn() {
    try {
      const { data } = await client.auth.getSession();
      return Boolean(data?.session?.user?.id);
    } catch {
      return false;
    }
  }

  function setLiked(btn, liked) {
    btn.dataset.liked = liked ? "1" : "0";
    btn.classList.toggle("op-liked", liked);

    const icon = btn.querySelector(".op-likeIcon");
    if (icon) icon.textContent = liked ? "♥" : "♡";
  }

  function setCount(btn, count) {
    const el = btn.querySelector("[data-like-count]");
    if (!el) return;
    el.textContent = String(count ?? "—");
  }

  async function hydrateLikeButton(btn, logged) {
    const postId = btn.dataset.postId;
    if (!postId) return;

    try {
      const count = await window.onlypawsLikes.getPostLikeCount(postId);
      setCount(btn, count);
    } catch (err) {
      console.warn("getPostLikeCount failed", postId, err);
      setCount(btn, "—");
    }

    if (!logged) {
      setLiked(btn, false);
      return;
    }

    try {
      const liked = await window.onlypawsLikes.getPostLikedByMe(postId);
      setLiked(btn, liked);
    } catch (err) {
      console.warn("getPostLikedByMe failed", postId, err);
    }
  }

  function bindLikeButton(btn, logged) {
    if (btn.dataset.likeBound === "1") return;
    btn.dataset.likeBound = "1";

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!logged) {
        alert("Login required");
        return;
      }

      if (btn.disabled) return;
      btn.disabled = true;

      const prevLiked = btn.dataset.liked === "1";
      const prevCountText =
        btn.querySelector("[data-like-count]")?.textContent ?? "—";
      const prevCount = prevCountText !== "—" ? Number(prevCountText) : NaN;

      setLiked(btn, !prevLiked);
      if (Number.isFinite(prevCount)) {
        setCount(btn, prevLiked ? prevCount - 1 : prevCount + 1);
      }

      try {
        const res = await window.onlypawsLikes.togglePostLike(btn.dataset.postId);
        setLiked(btn, Boolean(res?.liked));
        setCount(btn, Number(res?.like_count ?? 0));
      } catch (err) {
        setLiked(btn, prevLiked);
        setCount(btn, prevCountText);
        console.error("toggle like failed", err);
        alert("Like failed");
      } finally {
        btn.disabled = false;
      }
    });
  }

  function bindPostNavigation(root = document) {
    const mains = $$(".op-postMain", root);

    mains.forEach((main) => {
      if (main.dataset.navBound === "1") return;
      main.dataset.navBound = "1";

      const go = () => {
        const url = main.dataset.postUrl;
        if (url) window.location.href = url;
      };

      main.addEventListener("click", (e) => {
        if (e.target.closest("[data-op-stop-nav='1']")) return;
        if (e.target.closest("a, button, input, textarea, select, label")) return;
        go();
      });

      main.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest("[data-op-stop-nav='1']")) return;
        e.preventDefault();
        go();
      });
    });
  }

  async function initPosts(root = document) {
    bindPostNavigation(root);

    if (!FEATURE_LIKES) return;

    if (!window.onlypawsLikes || !client) {
      console.warn("Load onlypawsClient.js and /js/app/likes.js before /js/app/post.js");
      return;
    }

    const logged = await isLoggedIn();
    const buttons = $$(".op-likeBtn", root);

    await Promise.all(
      buttons.map(async (btn) => {
        await hydrateLikeButton(btn, logged);
        bindLikeButton(btn, logged);
      })
    );
  }

  const api = {
    renderPost,
    renderPostCard: renderPost,
    initPosts,
    initPostCards: initPosts,
    FEATURE_LIKES,
  };

  window.OnlyPawsPost = api;

  // Compat alias for older files still checking OnlyPawsPostCard
  window.OnlyPawsPostCard = api;
})();