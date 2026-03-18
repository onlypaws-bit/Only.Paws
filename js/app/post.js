/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose: render reusable posts and bind post interactions
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

  function isAbsoluteUrl(value) {
    return /^(https?:)?\/\//i.test(String(value || ""));
  }

  function normalizeAssetUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    if (
      isAbsoluteUrl(raw) ||
      raw.startsWith("/") ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:")
    ) {
      return raw;
    }

    return `/${raw.replace(/^\/+/, "")}`;
  }

  function resolveCreatorAvatar(post) {
    const raw =
      post?.creator_avatar_url ||
      post?.avatar_url ||
      post?.creator_profile_image_url ||
      post?.creator_image_url ||
      post?.profile_image_url ||
      post?.profile_photo_url ||
      post?.creator_profile_photo_url ||
      post?.creator_photo_url ||
      "";

    return normalizeAssetUrl(raw);
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
    const rawUrl = post?.media_url || "";
    const url = normalizeAssetUrl(rawUrl);
    if (!url) return "";

    const isVideo = isVideoMedia(post.media_type, url);

    const mediaEl = isVideo
      ? `<video ${locked ? "" : "controls"} playsinline preload="metadata" src="${esc(url)}"></video>`
      : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async">`;

    if (!locked) {
      return `<div class="op-mediaWrap" data-op-clickable="1">${mediaEl}</div>`;
    }

    const creator = post.creator_username || "creator";
    const profileUrl = creatorProfileUrl(creator);

    return `
      <div class="op-mediaWrap op-isLocked" data-op-clickable="1">
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

    if (locked) return `<span class="op-badge op-badge--locked">Locked</span>`;
    if (price) return `<span class="op-badge op-badge--price">${esc(price)}</span>`;

    return `<span class="op-badge op-badge--free">Free</span>`;
  }

  function renderPost(post, opts = {}) {
    const postUrl = (opts.postUrl || defaultPostUrl)(post);
    const title = esc(post.title || "");
    const excerpt = esc(post.excerpt || post.content || "");

    const creatorRaw = post.creator_username || "creator";
    const creator = esc(creatorRaw);

    const creatorAvatar = esc(resolveCreatorAvatar(post));
    const createdAt = formatPostDate(post.created_at);
    const locked = Boolean(post.is_locked);

    const media = mediaHtml(post, locked);
    const badge = renderBadge(post, locked);

    const avatarHtml = creatorAvatar
      ? `<img src="${creatorAvatar}" alt="${creator} avatar" loading="lazy" decoding="async" onerror="this.remove()">`
      : `<span aria-hidden="true">🐾</span>`;

    const likeBlock = FEATURE_LIKES
      ? `
        <button
          class="op-likeBtn"
          type="button"
          data-post-id="${esc(post.id)}"
          data-liked="0"
          data-op-stop-nav="1"
          aria-label="Like post"
        >
          <span class="op-likeIcon" aria-hidden="true">♡</span>
          <span class="op-likeCount" data-like-count>—</span>
        </button>
      `
      : "";

    return `
      <article class="op-postCard" data-post-id="${esc(post.id)}">
        <div class="op-postMain" role="link" tabindex="0" data-post-url="${esc(postUrl)}">

          <div class="op-postHeader">
            <div class="op-postCreator">
              <a
                class="op-postCreatorAvatar"
                href="${esc(creatorProfileUrl(creatorRaw))}"
                data-op-stop-nav="1"
                aria-label="Open @${creator} profile"
              >
                ${avatarHtml}
              </a>

              <div class="op-postCreatorMeta">
                ${
                  opts.showCreator !== false
                    ? `<a class="op-postCreatorName" href="${esc(creatorProfileUrl(creatorRaw))}" data-op-stop-nav="1">@${creator}</a>`
                    : ``
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

    const buttons = $$(".op-likeBtn", root);
    if (!buttons.length) return;

    const logged = await isLoggedIn();

    buttons.forEach((btn) => {
      if (btn.dataset.likeBound === "1") return;
      btn.dataset.likeBound = "1";

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!logged) {
          alert("Login required");
          return;
        }

        if (!window.onlypawsLikes?.togglePostLike) return;

        try {
          const res = await window.onlypawsLikes.togglePostLike(btn.dataset.postId);
          btn.querySelector(".op-likeIcon").textContent = res.liked ? "♥" : "♡";
          btn.querySelector("[data-like-count]").textContent = res.like_count;
          btn.dataset.liked = res.liked ? "1" : "0";
          btn.classList.toggle("op-liked", Boolean(res.liked));
        } catch (err) {
          console.error("toggle like failed", err);
        }
      });
    });
  }

  const api = {
    renderPost,
    renderPostCard: renderPost,
    initPosts,
    initPostCards: initPosts,
    FEATURE_LIKES,
  };

  window.OnlyPawsPost = api;
  window.OnlyPawsPostCard = api;
})();
