/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose:
   - shared post helpers
   - shared post card rendering
   - single post page rendering

   Used by:
   - /html/app/feed.html
   - /html/app/post.html
   - /html/app/fans/creator-profile.html

   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};
  const client = window.onlypawsClient || null;

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, yes) {
    if (!el) return;
    el.classList.toggle("is-hidden", !yes);
    el.classList.toggle("isHidden", !yes);
  }

  function esc(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeAssetUrl(url = "") {
    const value = String(url || "").trim();
    if (!value) return "";
    return value;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);

    try {
      return d.toLocaleString("it-IT", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return d.toISOString();
    }
  }

  function getClient() {
    if (client) return client;
    if (window.onlypawsClient) return window.onlypawsClient;
    throw new Error("Missing onlypawsClient.");
  }

  function getPostPagePath() {
    return PATHS?.app?.post || "/html/app/post.html";
  }

  function getFeedPath() {
    return PATHS?.app?.feed || "/html/app/feed.html";
  }

  function getIndexPath() {
    return (
      PATHS?.marketing?.home ||
      PATHS?.marketing?.index ||
      PATHS?.home ||
      PATHS?.index ||
      "/"
    );
  }

  function creatorProfileUrl(username = "") {
    const safeUsername = String(username || "").trim() || "creator";
    const base =
      PATHS?.app?.fans?.creatorProfile ||
      PATHS?.app?.creatorProfile ||
      "/html/app/fans/creator-profile.html";

    return `${base}?u=${encodeURIComponent(safeUsername)}`;
  }

  function postUrl(postId = "") {
    return `${getPostPagePath()}?id=${encodeURIComponent(postId)}`;
  }

  function isVideoMedia(type = "", url = "") {
    const t = String(type || "").toLowerCase();
    if (t === "video") return true;

    const cleanUrl = String(url || "").toLowerCase();
    return [".mp4", ".webm", ".ogg", ".mov", ".m4v"].some((ext) => cleanUrl.includes(ext));
  }

  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function canViewFullPost(post, viewerId) {
    if (!post) return false;
    if (!post.is_paid) return true;
    if (!viewerId) return false;
    if (post.creator_id === viewerId) return true;
    return !!post.has_access;
  }

  async function fetchPostById(postId) {
    const db = getClient();

    const { data, error } = await db
      .from("posts")
      .select(`
        id,
        creator_id,
        title,
        content,
        preview,
        media_url,
        media_type,
        likes_count,
        created_at,
        is_paid
      `)
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function fetchCreatorProfile(creatorId) {
    const db = getClient();

    const { data, error } = await db
      .from("profiles")
      .select("user_id, username, avatar_url, role")
      .eq("user_id", creatorId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function checkPostAccess(post, viewerId) {
    if (!post?.is_paid) return true;
    if (!viewerId) return false;
    if (post.creator_id === viewerId) return true;

    const db = getClient();

    const { data, error } = await db
      .from("subscriptions")
      .select("id, status")
      .eq("fan_id", viewerId)
      .eq("creator_id", post.creator_id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (error) return false;
    return !!data?.id;
  }

  function buildLockedMediaHtml(url, isVideo, creatorUsername) {
    const mediaEl = isVideo
      ? `<video playsinline preload="metadata" src="${esc(url)}"></video>`
      : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;

    return `
      <div class="op-mediaWrap op-isLocked">
        ${mediaEl}
        <div class="op-lockOverlay">
          <div class="op-lockBox">
            <div class="op-badge op-badge--locked">Locked</div>
            <p class="op-lockTitle">Premium post</p>
            <p class="op-lockText">Subscribe to unlock this content</p>
            <a class="op-openCreatorBtn" href="${esc(creatorProfileUrl(creatorUsername))}">Open creator</a>
          </div>
        </div>
      </div>
    `;
  }

  function buildPostCard(post, options = {}) {
    const {
      creatorUsername = "creator",
      creatorAvatarUrl = "",
      canViewFull = false,
      liked = false,
      variant = "",
    } = options;

    const id = post?.id || "";
    const rawTitle = String(post?.title || "").trim();
    const title = rawTitle;
    const previewText = canViewFull
      ? ((post?.content && String(post.content).trim()) || post?.preview || "")
      : (post?.preview || "");

    const url = normalizeAssetUrl(post?.media_url || "");
    const type = (post?.media_type || "none").toLowerCase();
    const isVideo = isVideoMedia(type, url);
    const hasMedia = !!url && type !== "none";

    const creatorHref = creatorProfileUrl(creatorUsername);
    const postHref = postUrl(id);

    const badgeHtml = post?.is_paid
      ? (canViewFull
          ? `<div class="op-badge op-badge--price">Premium</div>`
          : `<div class="op-badge op-badge--locked">Locked</div>`)
      : `<div class="op-badge op-badge--free">Free</div>`;

    const avatarHtml = creatorAvatarUrl
      ? `<img src="${esc(normalizeAssetUrl(creatorAvatarUrl))}" alt="@${esc(creatorUsername)} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `🐾`;

    let mediaHtml = "";
    if (hasMedia) {
      if (!canViewFull && post?.is_paid) {
        mediaHtml = buildLockedMediaHtml(url, isVideo, creatorUsername);
      } else {
        mediaHtml = `
          <a class="op-postMediaLink" href="${esc(postHref)}" aria-label="Open post">
            <div class="op-mediaWrap">
              ${
                isVideo
                  ? `<video playsinline preload="metadata" src="${esc(url)}"></video>`
                  : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
              }
            </div>
          </a>
        `;
      }
    }

    const variantClass = variant ? ` op-postCard--${esc(variant)}` : "";

    return `
      <article class="op-postCard${variantClass}" data-post-id="${esc(id)}">
        <div class="op-postMain">
          <div class="op-postHeader">
            <div class="op-postCreator">
              <a class="op-postCreatorAvatar" href="${esc(creatorHref)}" aria-label="Open creator profile">
                ${avatarHtml}
              </a>

              <div class="op-postCreatorMeta">
                <div class="op-postMetaRow">
                  <a class="op-postUsername" href="${esc(creatorHref)}">@${esc(creatorUsername)}</a>
                  <span>•</span>
                  <div class="op-postDate">${esc(fmtDate(post?.created_at))}</div>
                </div>
              </div>
            </div>

            <div class="op-postHeaderRight">
              ${badgeHtml}
            </div>
          </div>

          <div class="op-postBody">
            <a class="op-postContentLink" href="${esc(postHref)}" aria-label="Open post">
              ${title ? `<h3 class="op-title">${esc(title)}</h3>` : ""}
              ${previewText ? `<p class="op-excerpt">${esc(previewText)}</p>` : ""}
            </a>
            ${mediaHtml}
          </div>
        </div>

        <div class="op-postBottom">
          <button
            class="op-likeBtn ${liked ? "op-liked" : ""}"
            type="button"
            data-post-id="${esc(id)}"
            data-liked="${liked ? "true" : "false"}"
          >
            <span class="op-likeIcon">${liked ? "♥" : "♡"}</span>
            <span class="op-likeCount">${Number(post?.likes_count || 0)}</span>
          </button>
        </div>
      </article>
    `;
  }

  async function renderSinglePost(post, userId) {
    const pageTitle = $("pageTitle");
    const createdAt = $("createdAt");
    const mediaBox = $("mediaBox");
    const caption = $("caption");

    const author = $("author");
    const authorUsername = $("authorUsername");
    const authorAvatarImg = $("authorAvatarImg");

    const profile = await fetchCreatorProfile(post.creator_id);
    const creatorUsername = String(profile?.username || "").trim() || "creator";
    const creatorAvatarUrl = normalizeAssetUrl(profile?.avatar_url || "");
    const canAccess = await checkPostAccess(post, userId);

    post.has_access = canAccess;

    if (pageTitle) {
      pageTitle.textContent = String(post.title || "").trim() || "Post";
    }

    if (author) {
      author.href = creatorProfileUrl(creatorUsername);
    }

    if (authorUsername) {
      authorUsername.textContent = `@${creatorUsername}`;
    }

    if (authorAvatarImg) {
      authorAvatarImg.src = creatorAvatarUrl || "/assets/images/logo.png";
      authorAvatarImg.alt = `@${creatorUsername} avatar`;
    }

    if (createdAt) {
      createdAt.textContent = fmtDate(post.created_at);
    }

    const canViewFull = canViewFullPost(post, userId);

    const bodyText = canViewFull
      ? ((post.content && String(post.content).trim().length
          ? post.content
          : post.preview || "") || "")
      : (post.preview || "");

    if (caption) {
      if (bodyText && String(bodyText).trim().length) {
        caption.textContent = bodyText;
        show(caption, true);
      } else {
        caption.textContent = "";
        show(caption, false);
      }
    }

    if (mediaBox) {
      const url = normalizeAssetUrl(post.media_url || "");
      const type = (post.media_type || "none").toLowerCase();

      mediaBox.innerHTML = "";

      if (!url || type === "none") {
        show(mediaBox, false);
      } else {
        show(mediaBox, true);

        const isVideo = isVideoMedia(type, url);

        if (!canViewFull && post.is_paid) {
          mediaBox.innerHTML = buildLockedMediaHtml(url, isVideo, creatorUsername);
        } else if (isVideo) {
          mediaBox.innerHTML = `<video controls playsinline preload="metadata" src="${esc(url)}"></video>`;
        } else {
          mediaBox.innerHTML = `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
        }
      }
    }

    return {
      profile,
      creatorUsername,
      canViewFull,
    };
  }

  async function initSinglePostPage() {
    const hintBox = $("hintBox");
    const errBox = $("errBox");
    const copyLinkBtn = $("copyLinkBtn");
    const backBtn = $("backBtn");

    try {
      const db = getClient();

      const { data: sessionData } = await db.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        window.location.replace(getIndexPath());
        return;
      }

      const userId = session.user.id;
      const postId = getPostIdFromUrl();

      if (!postId) {
        throw new Error("Missing ?id= in URL.");
      }

      const post = await fetchPostById(postId);

      if (!post) {
        throw new Error("Post not found.");
      }

      await renderSinglePost(post, userId);

      if (backBtn) {
        backBtn.href = getFeedPath();
      }

      if (copyLinkBtn) {
        copyLinkBtn.addEventListener("click", async () => {
          const defaultText = "Copy link";

          try {
            await navigator.clipboard.writeText(window.location.href);
            copyLinkBtn.textContent = "Copied!";
          } catch (err) {
            copyLinkBtn.textContent = "Nope";
          }

          setTimeout(() => {
            copyLinkBtn.textContent = defaultText;
          }, 900);
        });
      }

      if (hintBox) hintBox.textContent = "";
      if (errBox) {
        errBox.textContent = "";
        show(errBox, false);
      }
    } catch (err) {
      if (hintBox) hintBox.textContent = "";
      if (errBox) {
        errBox.textContent = err?.message || String(err);
        show(errBox, true);
      }
    }
  }

  window.OnlyPawsPost = {
    esc,
    show,
    fmtDate,
    normalizeAssetUrl,
    isVideoMedia,
    creatorProfileUrl,
    postUrl,
    canViewFullPost,
    buildLockedMediaHtml,
    buildPostCard,
    fetchPostById,
    fetchCreatorProfile,
    checkPostAccess,
    renderSinglePost,
    initSinglePostPage,
  };
})();
