/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose:
   - shared post helpers
   - shared post card rendering
   - single post page logic

   Used by:
   - /html/app/feed.html
   - /html/app/post.html

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

  function postUrl(postId) {
    return `${getPostPagePath()}?id=${encodeURIComponent(postId)}`;
  }

  function isVideoMedia(type = "", url = "") {
    const t = String(type || "").toLowerCase();
    if (t === "video") return true;

    const cleanUrl = String(url || "").toLowerCase();
    return [".mp4", ".webm", ".ogg", ".mov", ".m4v"].some((ext) =>
      cleanUrl.includes(ext)
    );
  }

  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function canViewFullPost(post, viewerId) {
    if (!post) return false;

    const isMine =
      !!viewerId && String(post.creator_id || "") === String(viewerId || "");

    if (post.is_public === false) {
      return isMine;
    }

    if (!post.is_paid) {
      return true;
    }

    if (!viewerId) {
      return false;
    }

    if (isMine) {
      return true;
    }

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
        is_paid,
        is_public
      `)
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function fetchCreatorProfile(creatorId) {
    const db = getClient();

    const { data, error } = await db
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, role")
      .eq("user_id", creatorId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function checkPostAccess(post, viewerId) {
    if (!post) return false;

    const isMine =
      !!viewerId && String(post.creator_id || "") === String(viewerId || "");

    if (post.is_public === false) {
      return isMine;
    }

    if (!post.is_paid) {
      return true;
    }

    if (!viewerId) {
      return false;
    }

    if (isMine) {
      return true;
    }

    const db = getClient();

    try {
      const { data, error } = await db
        .from("fan_subscriptions")
        .select("creator_id, status, current_period_end, cancel_at_period_end")
        .eq("fan_id", viewerId)
        .eq("creator_id", post.creator_id);

      if (error) throw error;

      const rows = data || [];
      const now = Date.now();

      for (const row of rows) {
        const raw = row?.current_period_end;
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
          const status = String(row?.status || "").toLowerCase();
          if (status === "active" || status === "trialing") {
            hasAccess = true;
          }
        }

        if (hasAccess) return true;
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  async function getLikedByMe(postId, userId) {
    if (!postId || !userId) return false;

    const db = getClient();
    const { data, error } = await db
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("fan_id", userId)
      .maybeSingle();

    if (error) return false;
    return !!data?.id;
  }

  async function refreshSinglePostLikes(
    postId,
    likeBtn,
    likeIcon,
    likeCount,
    userId
  ) {
    const post = await fetchPostById(postId);
    if (likeCount) likeCount.textContent = String(post?.likes_count ?? 0);

    const liked = await getLikedByMe(postId, userId);

    if (likeBtn) {
      likeBtn.setAttribute("data-liked", liked ? "true" : "false");
      likeBtn.classList.toggle("op-liked", liked);
    }

    if (likeIcon) likeIcon.textContent = liked ? "♥" : "♡";

    return { post, liked };
  }

  async function togglePostLike(postId, userId) {
    if (!postId || !userId) {
      throw new Error("Missing post or user.");
    }

    const db = getClient();
    const liked = await getLikedByMe(postId, userId);

    if (liked) {
      const { error } = await db
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("fan_id", userId);

      if (error) throw error;
      return false;
    }

    const { error } = await db
      .from("post_likes")
      .insert({ post_id: postId, fan_id: userId });

    if (error) throw error;
    return true;
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
            <a class="op-openCreatorBtn" href="${esc(
              creatorProfileUrl(creatorUsername)
            )}">Open creator</a>
          </div>
        </div>
      </div>
    `;
  }

  function buildPostCard(post, options = {}) {
    const {
      creatorUsername = "creator",
      creatorDisplayName = "",
      creatorAvatarUrl = "",
      canViewFull = false,
      liked = false,
      postHref: customPostHref = null,
    } = options;

    const id = post?.id || "";
    const title = String(post?.title || "").trim() || "Post";
    const previewText = canViewFull
      ? (String(post?.content || "").trim() || post?.preview || "")
      : (post?.preview || "");

    const url = normalizeAssetUrl(post?.media_url || "");
    const type = (post?.media_type || "none").toLowerCase();
    const isVideo = isVideoMedia(type, url);
    const hasMedia = !!url && type !== "none";
    const href =
      typeof customPostHref === "function"
        ? customPostHref(post)
        : postUrl(id);

    const isLocked =
      post?.is_locked === true ||
      (post?.is_paid === true && !canViewFull) ||
      (post?.is_public === false && !canViewFull);

    let badgeHtml = `<div class="op-badge op-badge--free">Free</div>`;

    if (post?.is_public === false) {
      badgeHtml = canViewFull
        ? `<div class="op-badge op-badge--price">Private</div>`
        : `<div class="op-badge op-badge--locked">Private</div>`;
    } else if (post?.is_paid) {
      badgeHtml = canViewFull
        ? `<div class="op-badge op-badge--price">Premium</div>`
        : `<div class="op-badge op-badge--locked">Locked</div>`;
    }

    const avatarHtml = creatorAvatarUrl
      ? `<img src="${esc(normalizeAssetUrl(creatorAvatarUrl))}" alt="${esc(
          creatorUsername
        )} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `🐾`;

    let mediaHtml = "";
    if (hasMedia) {
      if (isLocked) {
        mediaHtml = buildLockedMediaHtml(url, isVideo, creatorUsername);
      } else {
        mediaHtml = `
          <div class="op-mediaWrap">
            ${
              isVideo
                ? `<video playsinline preload="metadata" src="${esc(url)}"></video>`
                : `<img src="${esc(
                    url
                  )}" alt="${esc(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
            }
          </div>
        `;
      }
    }

    return `
      <article class="op-postCard" data-post-id="${esc(id)}">
        <a class="op-postMain" href="${esc(href)}">
          <div class="op-postHeader">
            <div class="op-postCreator">
              <a
                class="op-postCreatorAvatar"
                href="${esc(creatorProfileUrl(creatorUsername))}"
                aria-label="Open creator profile"
              >
                ${avatarHtml}
              </a>

              <div class="op-postCreatorMeta">
                <a class="op-postCreatorName" href="${esc(
                  creatorProfileUrl(creatorUsername)
                )}">
                  ${esc(creatorDisplayName || `@${creatorUsername}`)}
                </a>
                <div class="op-postDate">${esc(fmtDate(post?.created_at))}</div>
              </div>
            </div>

            <div class="op-postHeaderRight">
              ${badgeHtml}
            </div>
          </div>

          <div class="op-postBody">
            <h3 class="op-title">${esc(title)}</h3>
            ${previewText ? `<p class="op-excerpt">${esc(previewText)}</p>` : ""}
            ${mediaHtml}
          </div>
        </a>

        <div class="op-postBottom">
          <button
            class="op-likeBtn ${liked ? "op-liked" : ""}"
            type="button"
            data-post-id="${esc(id)}"
            data-liked="${liked ? "true" : "false"}"
            aria-label="Toggle like"
          >
            <span class="op-likeIcon">${liked ? "♥" : "♡"}</span>
            <span class="op-likeCount">${Number(post?.likes_count || 0)}</span>
          </button>
        </div>
      </article>
    `;
  }

  function renderPost(post, options = {}) {
    return buildPostCard(post, {
      creatorUsername:
        options.creatorUsername ||
        post?.creator_username ||
        "creator",
      creatorDisplayName:
        options.creatorDisplayName ||
        post?.creator_name ||
        "",
      creatorAvatarUrl:
        options.creatorAvatarUrl ||
        post?.creator_avatar_url ||
        "",
      canViewFull:
        typeof options.canViewFull === "boolean"
          ? options.canViewFull
          : post?.can_view === true,
      liked:
        typeof options.liked === "boolean"
          ? options.liked
          : post?.liked === true,
      postHref: options.postUrl || null,
    });
  }

  async function renderSinglePost(post, userId) {
    const pageTitle = $("pageTitle");
    const author = $("author");
    const createdAt = $("createdAt");
    const mediaBox = $("mediaBox");
    const caption = $("caption");

    const profile = await fetchCreatorProfile(post.creator_id);
    const creatorUsername = String(profile?.username || "").trim() || "creator";
    const canAccess = await checkPostAccess(post, userId);

    post.has_access = canAccess;

    if (pageTitle) {
      pageTitle.textContent = String(post.title || "").trim() || "Post";
    }

    if (author) {
      author.textContent = `@${creatorUsername}`;
      author.href = creatorProfileUrl(creatorUsername);
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

        if (!canViewFull && (post.is_paid || post.is_public === false)) {
          mediaBox.innerHTML = buildLockedMediaHtml(
            url,
            isVideo,
            creatorUsername
          );
        } else if (isVideo) {
          mediaBox.innerHTML = `<video controls playsinline preload="metadata" src="${esc(
            url
          )}"></video>`;
        } else {
          mediaBox.innerHTML = `<img src="${esc(
            url
          )}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
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
    const likeBtn = $("likeBtn");
    const likeIcon = $("likeIcon");
    const likeCount = $("likeCount");
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

      let post = await fetchPostById(postId);

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

      if (likeBtn) {
        likeBtn.addEventListener("click", async () => {
          show(errBox, false);
          likeBtn.disabled = true;

          try {
            await togglePostLike(postId, userId);
            const fresh = await refreshSinglePostLikes(
              postId,
              likeBtn,
              likeIcon,
              likeCount,
              userId
            );
            post = fresh.post || post;
          } catch (err) {
            if (errBox) {
              errBox.textContent = `Like error: ${err?.message || String(err)}`;
              show(errBox, true);
            }
          } finally {
            likeBtn.disabled = false;
          }
        });
      }

      await refreshSinglePostLikes(
        postId,
        likeBtn,
        likeIcon,
        likeCount,
        userId
      );

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
    renderPost,
    fetchPostById,
    fetchCreatorProfile,
    checkPostAccess,
    togglePostLike,
    getLikedByMe,
    initSinglePostPage,
  };
})();
