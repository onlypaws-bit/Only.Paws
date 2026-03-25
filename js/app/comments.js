"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/comments.js
   Purpose:
   - multi-post comments helpers
   - render comments list
   - create/delete comments
   - single post comments init
   ========================================================= */

(function () {
  const COMMENTS_LIMIT = 20;
  const MAX_COMMENT_LENGTH = 300;

  function esc(value = "") {
    if (window.OnlyPawsPost?.esc) return window.OnlyPawsPost.esc(value);
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    if (window.OnlyPawsPost?.fmtDate) return window.OnlyPawsPost.fmtDate(iso);
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
    } catch (_) {
      return d.toISOString();
    }
  }

  function getClient() {
    if (window.onlypawsClient) return window.onlypawsClient;
    throw new Error("Missing onlypawsClient.");
  }

  function normalizeAvatarUrl(url = "") {
    return String(url || "").trim();
  }

  function getCommentsElements(postId) {
    return {
      list: document.getElementById(`commentsList-${postId}`),
      empty: document.getElementById(`commentsEmpty-${postId}`),
      error: document.getElementById(`commentsError-${postId}`),
      count: document.getElementById(`commentsCount-${postId}`),
      form: document.getElementById(`commentForm-${postId}`),
      input: document.getElementById(`commentInput-${postId}`),
      submit: document.getElementById(`commentSubmit-${postId}`),
      loadMore: document.getElementById(`commentsLoadMore-${postId}`)
    };
  }

  function show(el, yes) {
    if (!el) return;
    el.classList.toggle("is-hidden", !yes);
    el.classList.toggle("isHidden", !yes);
  }

  async function getSessionUser() {
    const db = getClient();
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function fetchComments(postId, options = {}) {
    const db = getClient();
    const limit = Number(options.limit || COMMENTS_LIMIT);
    const offset = Number(options.offset || 0);
    const { data, error } = await db
      .from("comments")
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          user_id,
          username,
          avatar_url,
          role
        )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function fetchCommentsCount(postId) {
    const db = getClient();
    const { count, error } = await db
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (error) throw error;
    return Number(count || 0);
  }

  async function createComment(postId, userId, content) {
    const db = getClient();
    const safeContent = String(content || "").trim();
    if (!safeContent) throw new Error("Write a comment first.");
    if (safeContent.length > MAX_COMMENT_LENGTH)
      throw new Error(`Comment too long. Max ${MAX_COMMENT_LENGTH} characters.`);
    const { data, error } = await db
      .from("comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: safeContent,
      })
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles:user_id (
          user_id,
          username,
          avatar_url,
          role
        )
      `)
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteComment(commentId) {
    const db = getClient();
    const { error } = await db.from("comments").delete().eq("id", commentId);
    if (error) throw error;
  }

  function canDeleteComment(comment, options = {}) {
    const viewerId = String(options.viewerId || "").trim();
    const postCreatorId = String(options.postCreatorId || "").trim();
    if (!viewerId || !comment) return false;
    if (String(comment.user_id || "") === viewerId) return true;
    if (postCreatorId && viewerId === postCreatorId) return true;
    return false;
  }

  function buildCommentItem(comment, options = {}) {
    const viewerId = String(options.viewerId || "").trim();
    const postCreatorId = String(options.postCreatorId || "").trim();
    const profile = comment?.profiles || {};
    const username = String(profile?.username || "").trim() || "user";
    const avatarUrl = normalizeAvatarUrl(profile?.avatar_url || "");
    const role = String(profile?.role || "").trim().toLowerCase();
    const isAuthor = String(comment?.user_id || "") === viewerId;
    const isPostCreator = viewerId && postCreatorId && viewerId === postCreatorId;
    const canDelete = canDeleteComment(comment, { viewerId, postCreatorId });
    const badgeHtml = role === "creator" ? `<span class="op-commentBadge">Creator</span>` : "";
    const avatarHtml = avatarUrl
      ? `<img src="${esc(avatarUrl)}" alt="@${esc(username)} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `🐾`;

    return `
      <article class="op-commentCard" data-comment-id="${esc(comment?.id || "")}">
        <div class="op-commentAvatar">${avatarHtml}</div>
        <div class="op-commentMain">
          <div class="op-commentTop">
            <div class="op-commentMeta">
              <span class="op-commentUser">@${esc(username)}</span>
              ${badgeHtml}
              <span class="op-commentDot">•</span>
              <time class="op-commentDate">${esc(fmtDate(comment?.created_at))}</time>
            </div>
            ${
              canDelete
                ? `<button
                     class="op-commentDeleteBtn"
                     type="button"
                     data-comment-delete
                     data-comment-id="${esc(comment?.id || "")}"
                     aria-label="Delete comment"
                     title="${isAuthor ? "Delete your comment" : isPostCreator ? "Moderate comment" : "Delete comment"}"
                   >Delete</button>`
                : ""
            }
          </div>
          <p class="op-commentText">${esc(comment?.content || "")}</p>
        </div>
      </article>
    `;
  }

  function renderCommentsList(postId, comments, options = {}) {
    const els = getCommentsElements(postId);
    if (!els.list) return;
    const items = Array.isArray(comments) ? comments : [];

    if (!items.length) {
      els.list.innerHTML = "";
      if (els.empty) {
        els.empty.textContent = "No comments yet. Be the first 🐾";
        show(els.empty, true);
      }
      return;
    }

    if (els.empty) show(els.empty, false);

    els.list.innerHTML = items
      .map((comment) => buildCommentItem(comment, options))
      .join("");
  }

  function prependComment(postId, comment, options = {}) {
    const els = getCommentsElements(postId);
    if (!els.list || !comment) return;
    if (els.empty) show(els.empty, false);
    els.list.insertAdjacentHTML("afterbegin", buildCommentItem(comment, options));
  }

  function updateCommentsCount(postId, count) {
    const el = document.getElementById(`commentsCount-${postId}`);
    if (!el) return;
    el.textContent = String(Number(count || 0));
  }

  function setCommentsError(postId, message = "") {
    const el = document.getElementById(`commentsError-${postId}`);
    if (!el) return;
    el.textContent = String(message || "");
    show(el, !!message);
  }

  function setCommentHint(postId, message = "") {
    const el = document.getElementById(`commentHint-${postId}`);
    if (!el) return;
    el.textContent = String(message || "");
  }

  function setSubmitting(postId, isSubmitting) {
    const els = getCommentsElements(postId);
    if (els.submit) {
      els.submit.disabled = !!isSubmitting;
      els.submit.textContent = isSubmitting ? "Posting..." : "Post";
    }
    if (els.input) els.input.disabled = !!isSubmitting;
  }

  function setLoadMoreVisible(postId, yes) {
    const el = document.getElementById(`commentsLoadMore-${postId}`);
    if (!el) return;
    show(el, !!yes);
  }

  async function loadAndRenderComments(postId, state) {
    setCommentsError(postId, "");

    const [comments, totalCount] = await Promise.all([
      fetchComments(postId, { limit: state.limit, offset: 0 }),
      fetchCommentsCount(postId)
    ]);

    state.items = comments;
    state.totalCount = totalCount;
    state.offset = comments.length;

    renderCommentsList(postId, comments, {
      viewerId: state.viewerId,
      postCreatorId: state.postCreatorId
    });

    updateCommentsCount(postId, totalCount);
    setLoadMoreVisible(postId, comments.length < totalCount);
  }

  async function loadMoreComments(postId, state) {
    if (state.offset >= state.totalCount) return setLoadMoreVisible(postId, false);
    const more = await fetchComments(postId, { limit: state.limit, offset: state.offset });
    if (!more.length) return setLoadMoreVisible(postId, false);

    state.items = state.items.concat(more);
    state.offset += more.length;

    const listEl = document.getElementById(`commentsList-${postId}`);
    if (listEl) {
      listEl.insertAdjacentHTML(
        "beforeend",
        more.map(c => buildCommentItem(c, { viewerId: state.viewerId, postCreatorId: state.postCreatorId })).join("")
      );
    }

    setLoadMoreVisible(postId, state.offset < state.totalCount);
  }

  async function handleCommentSubmit(event, postId, state) {
    event.preventDefault();
    const els = getCommentsElements(postId);
    if (!els.input) return;

    const content = String(els.input.value || "").trim();
    if (!content) return setCommentHint(postId, "Write something first.");
    if (!state.viewerId) return setCommentHint(postId, "Log in to comment.");

    setCommentHint(postId, "");
    setCommentsError(postId, "");
    setSubmitting(postId, true);

    try {
      const newComment = await createComment(postId, state.viewerId, content);
      els.input.value = "";
      state.totalCount += 1;
      state.offset += 1;
      state.items.unshift(newComment);

      prependComment(postId, newComment, { viewerId: state.viewerId, postCreatorId: state.postCreatorId });
      updateCommentsCount(postId, state.totalCount);
      setLoadMoreVisible(postId, state.offset < state.totalCount);
    } catch (err) {
      setCommentsError(postId, err?.message || String(err));
    } finally {
      setSubmitting(postId, false);
    }
  }

  async function handleCommentDeleteClick(event, postId, state) {
    const btn = event.target.closest("[data-comment-delete]");
    if (!btn) return;
    const commentId = String(btn.dataset.commentId || "").trim();
    if (!commentId) return;

    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
      await deleteComment(commentId);
      const card = btn.closest("[data-comment-id]");
      if (card) card.remove();

      state.items = state.items.filter(i => String(i.id) !== commentId);
      state.totalCount = Math.max(0, Number(state.totalCount || 0) - 1);
      state.offset = Math.max(0, Number(state.offset || 0) - 1);

      updateCommentsCount(postId, state.totalCount);

      if (!state.items.length) {
        renderCommentsList(postId, [], { viewerId: state.viewerId, postCreatorId: state.postCreatorId });
      }
    } catch (err) {
      setCommentsError(postId, err?.message || String(err));
      btn.disabled = false;
      btn.textContent = "Delete";
    }
  }

  async function initComments({ postId, viewerId = "", postCreatorId = "", limit = COMMENTS_LIMIT } = {}) {
    if (!postId) return null;

    const sessionUser = await getSessionUser();
    const state = {
      postId,
      viewerId: viewerId || (sessionUser?.id || ""),
      postCreatorId,
      items: [],
      totalCount: 0,
      offset: 0,
      limit
    };

    await loadAndRenderComments(postId, state);

    const els = getCommentsElements(postId);

    if (els.form && !els.form.dataset.commentsBound) {
      els.form.addEventListener("submit", e => handleCommentSubmit(e, postId, state));
      els.form.dataset.commentsBound = "true";
    }

    if (els.loadMore && !els.loadMore.dataset.commentsBound) {
      els.loadMore.addEventListener("click", async () => {
        try {
          els.loadMore.disabled = true;
          els.loadMore.textContent = "Loading...";
          await loadMoreComments(postId, state);
        } catch (err) {
          setCommentsError(postId, err?.message || String(err));
        } finally {
          els.loadMore.disabled = false;
          els.loadMore.textContent = "Load more";
        }
      });
      els.loadMore.dataset.commentsBound = "true";
    }

    if (els.list && !els.list.dataset.commentsBound) {
      els.list.addEventListener("click", e => handleCommentDeleteClick(e, postId, state));
      els.list.dataset.commentsBound = "true";
    }

    return state;
  }

  // init all comments sections automatically
  document.querySelectorAll(".op-commentsSection").forEach(section => {
    const postId = section.dataset.postId;
    if (postId) initComments({ postId });
  });

  window.OnlyPawsComments = {
    COMMENTS_LIMIT,
    MAX_COMMENT_LENGTH,
    esc,
    fmtDate,
    fetchComments,
    fetchCommentsCount,
    createComment,
    deleteComment,
    canDeleteComment,
    buildCommentItem,
    renderCommentsList,
    initComments
  };
})();
