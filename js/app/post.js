/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose:
   - shared post helpers
   - shared post card rendering
   - single post page rendering
   - inline comments for post cards

   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - optional: window.OnlyPawsComments
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};

  const INLINE_COMMENTS_LIMIT = 3;
  const MAX_COMMENT_LENGTH = 300;

  const inlineCommentsState = new Map();
  let sessionUserPromise = null;
  let inlineCommentsBound = false;

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
    return String(url || "").trim();
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
    if (window.onlypawsClient) return window.onlypawsClient;
    throw new Error("Missing onlypawsClient.");
  }

  function getCommentsApi() {
    return window.OnlyPawsComments || null;
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

  function getInlineCommentsSection(card) {
    return card?.querySelector("[data-inline-comments-section]") || null;
  }

  function getInlineCommentsList(card) {
    return card?.querySelector("[data-inline-comments-list]") || null;
  }

  function getInlineCommentsEmpty(card) {
    return card?.querySelector("[data-inline-comments-empty]") || null;
  }

  function getInlineCommentsError(card) {
    return card?.querySelector("[data-inline-comments-error]") || null;
  }

  function getInlineCommentsLoadMore(card) {
    return card?.querySelector("[data-inline-comments-load-more]") || null;
  }

  function getInlineCommentsInput(card) {
    return card?.querySelector("[data-inline-comment-input]") || null;
  }

  function getInlineCommentsSubmit(card) {
    return card?.querySelector("[data-inline-comment-submit]") || null;
  }

  function getInlineCommentsHint(card) {
    return card?.querySelector("[data-inline-comment-hint]") || null;
  }

  function getInlineCommentsToggle(card) {
    return card?.querySelector("[data-inline-comments-toggle]") || null;
  }

  function getInlineCommentsCountEls(postId) {
    return document.querySelectorAll(
      `[data-inline-comments-count][data-post-id="${CSS.escape(String(postId || ""))}"]`
    );
  }

  function setInlineCommentsError(card, message = "") {
    const el = getInlineCommentsError(card);
    if (!el) return;
    el.textContent = String(message || "");
    show(el, !!message);
  }

  function setInlineCommentsHint(card, message = "") {
    const el = getInlineCommentsHint(card);
    if (!el) return;
    el.textContent = String(message || "");
  }

  function setInlineCommentsLoadMoreVisible(card, yes) {
    const el = getInlineCommentsLoadMore(card);
    if (!el) return;
    show(el, !!yes);
  }

  function setInlineCommentsSubmitting(card, isSubmitting) {
    const input = getInlineCommentsInput(card);
    const submit = getInlineCommentsSubmit(card);

    if (input) input.disabled = !!isSubmitting;

    if (submit) {
      submit.disabled = !!isSubmitting;
      submit.textContent = isSubmitting ? "Posting..." : "Post";
    }
  }

  function setInlineCommentsLoadingMore(card, isLoading) {
    const btn = getInlineCommentsLoadMore(card);
    if (!btn) return;

    btn.disabled = !!isLoading;
    btn.textContent = isLoading ? "Loading..." : "Load more";
  }

  function setInlineCommentsOpen(card, isOpen) {
    const section = getInlineCommentsSection(card);
    const btn = getInlineCommentsToggle(card);

    if (section) show(section, !!isOpen);

    if (btn) {
      btn.dataset.open = isOpen ? "true" : "false";
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      btn.classList.toggle("is-open", !!isOpen);
    }
  }

  function updateInlineCommentsCount(postId, count) {
    const safeCount = Number(count || 0);

    getInlineCommentsCountEls(postId).forEach((el) => {
      el.textContent = String(safeCount);
    });
  }

  async function getSessionUser() {
    if (sessionUserPromise) return sessionUserPromise;

    sessionUserPromise = (async () => {
      try {
        const db = getClient();
        const { data, error } = await db.auth.getSession();
        if (error) throw error;
        return data?.session?.user || null;
      } catch (_) {
        return null;
      }
    })();

    return sessionUserPromise;
  }

  function getInlineState(postId, postCreatorId = "") {
    const key = String(postId || "").trim();
    if (!key) return null;

    if (!inlineCommentsState.has(key)) {
      inlineCommentsState.set(key, {
        postId: key,
        postCreatorId: String(postCreatorId || "").trim(),
        items: [],
        totalCount: 0,
        offset: 0,
        loaded: false,
        loading: false,
      });
    }

    const state = inlineCommentsState.get(key);

    if (postCreatorId && !state.postCreatorId) {
      state.postCreatorId = String(postCreatorId || "").trim();
    }

    return state;
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
        comments_count,
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
      .from("fan_subscriptions")
      .select("id, status, current_period_end, cancel_at_period_end")
      .eq("fan_id", viewerId)
      .eq("creator_id", post.creator_id)
      .maybeSingle();

    if (error || !data) return false;

    const raw = data.current_period_end;
    let endMs = 0;

    if (raw) {
      if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
        const n = Number(raw);
        endMs = n < 1e12 ? n * 1000 : n;
      } else {
        endMs = new Date(raw).getTime();
      }
    }

    const now = Date.now();
    let hasAccess = !!endMs && endMs > now;

    if (!hasAccess && !raw) {
      const st = String(data.status || "").toLowerCase();
      if (st === "active" || st === "trialing") hasAccess = true;
    }

    return hasAccess;
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

  function buildInlineCommentsHtml(post, options = {}) {
    const commentsCount = Number(post?.comments_count || 0);
    const postHref = postUrl(post?.id || "");
    const viewerCanComment = options.viewerCanComment !== false;

    return `
      <div
        class="op-inlineComments is-hidden"
        data-inline-comments-section
        data-post-id="${esc(post?.id || "")}"
      >
        <form class="op-commentForm op-inlineCommentForm" data-inline-comment-form>
          <textarea
            data-inline-comment-input
            rows="2"
            maxlength="${MAX_COMMENT_LENGTH}"
            placeholder="${viewerCanComment ? "Write a comment..." : "Log in to comment"}"
            ${viewerCanComment ? "" : "disabled"}
          ></textarea>

          <div class="op-commentFormBottom">
            <p class="op-commentHint" data-inline-comment-hint></p>
            <button
              class="op-commentSubmit"
              data-inline-comment-submit
              type="submit"
              ${viewerCanComment ? "" : "disabled"}
            >
              Post
            </button>
          </div>
        </form>

        <p class="op-commentsError is-hidden" data-inline-comments-error></p>
        <p class="op-commentsEmpty is-hidden" data-inline-comments-empty></p>

        <div class="op-commentsList" data-inline-comments-list></div>

        <div class="op-inlineCommentsFooter">
          <button
            class="op-commentsLoadMore is-hidden"
            data-inline-comments-load-more
            type="button"
          >
            Load more
          </button>

          <a class="ghost op-inlineCommentsOpenPost" href="${esc(postHref)}">
            Open post
          </a>
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
      viewerCanComment = true,
    } = options;

    const id = post?.id || "";
    const rawTitle = String(post?.title || "").trim();
    const previewText = canViewFull
      ? ((post?.content && String(post.content).trim()) || post?.preview || "")
      : (post?.preview || "");

    const url = normalizeAssetUrl(post?.media_url || "");
    const type = (post?.media_type || "none").toLowerCase();
    const isVideo = isVideoMedia(type, url);
    const hasMedia = !!url && type !== "none";

    const creatorHref = creatorProfileUrl(creatorUsername);
    const postHref = postUrl(id);
    const commentsCount = Number(post?.comments_count || 0);

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
      <article
        class="op-postCard${variantClass}"
        data-post-id="${esc(id)}"
        data-post-creator-id="${esc(post?.creator_id || "")}"
      >
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
              ${rawTitle ? `<h3 class="op-title">${esc(rawTitle)}</h3>` : ""}
              ${previewText ? `<p class="op-excerpt">${esc(previewText)}</p>` : ""}
            </a>
            ${mediaHtml}
          </div>
        </div>

        <div class="op-postBottom">
          <button
            class="op-likeBtn ${liked ? "op-liked is-liked" : ""}"
            type="button"
            data-like-button
            data-post-id="${esc(id)}"
            data-liked="${liked ? "true" : "false"}"
            aria-pressed="${liked ? "true" : "false"}"
          >
            <span class="op-likeIcon" data-like-icon>${liked ? "❤️" : "🤍"}</span>
            <span class="op-likeCount" data-like-count-inline>${Number(post?.likes_count || 0)}</span>
          </button>

          <button
            class="op-commentsBtn"
            type="button"
            data-inline-comments-toggle
            data-post-id="${esc(id)}"
            aria-expanded="false"
          >
            <span class="op-commentsBtnIcon">💬</span>
            <span
              class="op-commentsBtnCount"
              data-inline-comments-count
              data-post-id="${esc(id)}"
            >${commentsCount}</span>
          </button>
        </div>

        ${buildInlineCommentsHtml(post, { viewerCanComment })}
      </article>
    `;
  }

  function renderInlineCommentsList(card, items, viewerId, postCreatorId) {
    const listEl = getInlineCommentsList(card);
    const emptyEl = getInlineCommentsEmpty(card);
    const commentsApi = getCommentsApi();

    if (!listEl) return;

    if (!Array.isArray(items) || !items.length) {
      listEl.innerHTML = "";
      if (emptyEl) {
        emptyEl.textContent = "No comments yet. Be the first 🐾";
        show(emptyEl, true);
      }
      return;
    }

    if (emptyEl) {
      emptyEl.textContent = "";
      show(emptyEl, false);
    }

    if (commentsApi?.buildCommentItem) {
      listEl.innerHTML = items
        .map((comment) => commentsApi.buildCommentItem(comment, {
          viewerId,
          postCreatorId,
        }))
        .join("");
      return;
    }

    listEl.innerHTML = items
      .map((comment) => {
        const username = comment?.profiles?.username || "user";
        return `
          <article class="op-commentCard" data-comment-id="${esc(comment?.id || "")}">
            <div class="op-commentMain">
              <div class="op-commentTop">
                <div class="op-commentMeta">
                  <span class="op-commentUser">@${esc(username)}</span>
                  <span class="op-commentDot">•</span>
                  <time class="op-commentDate">${esc(fmtDate(comment?.created_at))}</time>
                </div>
              </div>
              <p class="op-commentText">${esc(comment?.content || "")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function ensureInlineCommentsLoaded(card, forceReload = false) {
    const commentsApi = getCommentsApi();
    if (!commentsApi?.fetchComments || !commentsApi?.fetchCommentsCount) {
      setInlineCommentsError(card, "Comments are not available right now.");
      return;
    }

    const postId = String(card?.dataset?.postId || "").trim();
    const postCreatorId = String(card?.dataset?.postCreatorId || "").trim();
    const state = getInlineState(postId, postCreatorId);
    if (!state) return;

    if (state.loading) return;
    if (state.loaded && !forceReload) return;

    state.loading = true;
    setInlineCommentsError(card, "");
    setInlineCommentsHint(card, "Loading comments...");

    try {
      const sessionUser = await getSessionUser();
      const viewerId = String(sessionUser?.id || "").trim();

      const [items, totalCount] = await Promise.all([
        commentsApi.fetchComments(postId, {
          limit: INLINE_COMMENTS_LIMIT,
          offset: 0,
        }),
        commentsApi.fetchCommentsCount(postId),
      ]);

      state.items = Array.isArray(items) ? items : [];
      state.totalCount = Number(totalCount || 0);
      state.offset = state.items.length;
      state.loaded = true;

      renderInlineCommentsList(card, state.items, viewerId, state.postCreatorId);
      updateInlineCommentsCount(postId, state.totalCount);
      setInlineCommentsLoadMoreVisible(card, state.offset < state.totalCount);
      setInlineCommentsHint(card, "");
    } catch (err) {
      setInlineCommentsError(card, err?.message || String(err));
      setInlineCommentsHint(card, "");
    } finally {
      state.loading = false;
    }
  }

  async function loadMoreInlineComments(card) {
    const commentsApi = getCommentsApi();
    if (!commentsApi?.fetchComments) return;

    const postId = String(card?.dataset?.postId || "").trim();
    const postCreatorId = String(card?.dataset?.postCreatorId || "").trim();
    const state = getInlineState(postId, postCreatorId);
    if (!state || state.loading) return;

    if (state.offset >= state.totalCount) {
      setInlineCommentsLoadMoreVisible(card, false);
      return;
    }

    state.loading = true;
    setInlineCommentsError(card, "");
    setInlineCommentsLoadingMore(card, true);

    try {
      const sessionUser = await getSessionUser();
      const viewerId = String(sessionUser?.id || "").trim();

      const more = await commentsApi.fetchComments(postId, {
        limit: INLINE_COMMENTS_LIMIT,
        offset: state.offset,
      });

      if (!Array.isArray(more) || !more.length) {
        setInlineCommentsLoadMoreVisible(card, false);
        return;
      }

      state.items = state.items.concat(more);
      state.offset += more.length;

      renderInlineCommentsList(card, state.items, viewerId, state.postCreatorId);
      setInlineCommentsLoadMoreVisible(card, state.offset < state.totalCount);
    } catch (err) {
      setInlineCommentsError(card, err?.message || String(err));
    } finally {
      state.loading = false;
      setInlineCommentsLoadingMore(card, false);
    }
  }

  async function toggleInlineComments(card) {
    const section = getInlineCommentsSection(card);
    if (!section) return;

    const isOpen = !section.classList.contains("is-hidden") && !section.classList.contains("isHidden");

    if (isOpen) {
      setInlineCommentsOpen(card, false);
      return;
    }

    setInlineCommentsOpen(card, true);
    await ensureInlineCommentsLoaded(card, false);
  }

  async function submitInlineComment(card, form) {
    const commentsApi = getCommentsApi();
    if (!commentsApi?.createComment) {
      setInlineCommentsError(card, "Comments are not available right now.");
      return;
    }

    const sessionUser = await getSessionUser();
    const viewerId = String(sessionUser?.id || "").trim();
    if (!viewerId) {
      setInlineCommentsHint(card, "Log in to comment.");
      return;
    }

    const input = getInlineCommentsInput(card);
    if (!input) return;

    const content = String(input.value || "").trim();
    if (!content) {
      setInlineCommentsHint(card, "Write something first.");
      return;
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      setInlineCommentsHint(card, `Max ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    const postId = String(card?.dataset?.postId || "").trim();
    const postCreatorId = String(card?.dataset?.postCreatorId || "").trim();
    const state = getInlineState(postId, postCreatorId);
    if (!state) return;

    setInlineCommentsHint(card, "");
    setInlineCommentsError(card, "");
    setInlineCommentsSubmitting(card, true);

    try {
      const newComment = await commentsApi.createComment(postId, viewerId, content);

      input.value = "";
      state.totalCount += 1;
      state.items.unshift(newComment);

      if (!state.loaded) state.loaded = true;
      state.items = state.items.slice(
        0,
        Math.max(state.offset || INLINE_COMMENTS_LIMIT, INLINE_COMMENTS_LIMIT)
      );

      if (state.offset < INLINE_COMMENTS_LIMIT) {
        state.offset = state.items.length;
      }

      renderInlineCommentsList(card, state.items, viewerId, state.postCreatorId);
      updateInlineCommentsCount(postId, state.totalCount);
      setInlineCommentsLoadMoreVisible(card, state.items.length < state.totalCount);
    } catch (err) {
      setInlineCommentsError(card, err?.message || String(err));
    } finally {
      setInlineCommentsSubmitting(card, false);
      if (form) form.reset?.();
    }
  }

  async function deleteInlineComment(card, button) {
    const commentsApi = getCommentsApi();
    if (!commentsApi?.deleteComment) {
      setInlineCommentsError(card, "Comments are not available right now.");
      return;
    }

    const commentId = String(button?.dataset?.commentId || "").trim();
    if (!commentId) return;

    const postId = String(card?.dataset?.postId || "").trim();
    const postCreatorId = String(card?.dataset?.postCreatorId || "").trim();
    const state = getInlineState(postId, postCreatorId);
    if (!state) return;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      await commentsApi.deleteComment(commentId);

      state.items = state.items.filter((item) => String(item.id) !== commentId);
      state.totalCount = Math.max(0, Number(state.totalCount || 0) - 1);
      state.offset = Math.max(0, Math.min(state.offset, state.totalCount));

      const sessionUser = await getSessionUser();
      const viewerId = String(sessionUser?.id || "").trim();

      renderInlineCommentsList(card, state.items, viewerId, state.postCreatorId);
      updateInlineCommentsCount(postId, state.totalCount);
      setInlineCommentsLoadMoreVisible(card, state.items.length < state.totalCount);
    } catch (err) {
      setInlineCommentsError(card, err?.message || String(err));
      button.disabled = false;
      button.textContent = "Delete";
    }
  }

  function bindInlineCommentsDelegation() {
    if (inlineCommentsBound) return;
    inlineCommentsBound = true;

    document.addEventListener("click", async (event) => {
      const toggleBtn = event.target.closest("[data-inline-comments-toggle]");
      if (toggleBtn) {
        const card = toggleBtn.closest(".op-postCard");
        if (!card) return;
        event.preventDefault();
        await toggleInlineComments(card);
        return;
      }

      const loadMoreBtn = event.target.closest("[data-inline-comments-load-more]");
      if (loadMoreBtn) {
        const card = loadMoreBtn.closest(".op-postCard");
        if (!card) return;
        event.preventDefault();
        await loadMoreInlineComments(card);
        return;
      }

      const deleteBtn = event.target.closest("[data-comment-delete]");
      if (deleteBtn) {
        const card = deleteBtn.closest(".op-postCard");
        if (!card) return;
        event.preventDefault();
        await deleteInlineComment(card, deleteBtn);
      }
    });

    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-inline-comment-form]");
      if (!form) return;

      const card = form.closest(".op-postCard");
      if (!card) return;

      event.preventDefault();
      await submitInlineComment(card, form);
    });
  }

  function initPostCards(root = document) {
    const cards = Array.from(root.querySelectorAll(".op-postCard[data-post-id]"));
    cards.forEach((card) => {
      const postId = String(card.dataset.postId || "").trim();
      const postCreatorId = String(card.dataset.postCreatorId || "").trim();
      getInlineState(postId, postCreatorId);
    });

    bindInlineCommentsDelegation();
    return cards;
  }

  async function renderSinglePost(post, userId) {
    const pageTitle = $("pageTitle");
    const createdAt = $("createdAt");
    const mediaBox = $("mediaBox");
    const caption = $("caption");

    const author = $("author");
    const authorUsername = $("authorUsername");
    const authorAvatarImg = $("authorAvatarImg");

    const likeBtn = $("likeBtn");
    const likeIcon = $("likeIcon");
    const likeCount = $("likeCount");

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

    if (likeBtn) {
      likeBtn.dataset.postId = String(post.id || "");
      likeBtn.dataset.liked = "false";
      likeBtn.setAttribute("aria-pressed", "false");
      likeBtn.classList.remove("is-liked");
      likeBtn.classList.remove("op-liked");
    }

    if (likeIcon) {
      likeIcon.textContent = "🤍";
    }

    if (likeCount) {
      likeCount.textContent = String(Number(post.likes_count || 0));
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

      const likesApi = window.onlypawsLikes || null;
      if (likesApi?.initLikeButtons) {
        await likesApi.initLikeButtons(document);
      }

      const commentsApi = getCommentsApi();
      if (commentsApi?.initComments) {
        await commentsApi.initComments({
          postId: post.id,
          viewerId: userId,
          postCreatorId: post.creator_id,
        });
      }

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

  bindInlineCommentsDelegation();

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
    initPostCards,
    fetchPostById,
    fetchCreatorProfile,
    checkPostAccess,
    renderSinglePost,
    initSinglePostPage,
  };
})();
