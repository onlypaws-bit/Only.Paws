"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/comments.js
   Purpose:
   - shared comments helpers
   - render comments list
   - create/delete comments
   - single post comments init

   Dependencies:
   - window.onlypawsClient
   - optional: window.OnlyPawsPost (for esc/fmtDate/show)
   ========================================================= */

(function () {
  const COMMENTS_LIMIT = 20;
  const MAX_COMMENT_LENGTH = 300;

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, yes) {
    if (!el) return;
    el.classList.toggle("is-hidden", !yes);
    el.classList.toggle("isHidden", !yes);
  }

  function esc(value = "") {
    if (window.OnlyPawsPost?.esc) {
      return window.OnlyPawsPost.esc(value);
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    if (window.OnlyPawsPost?.fmtDate) {
      return window.OnlyPawsPost.fmtDate(iso);
    }

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

  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function getCommentsMount() {
    return $("commentsMount");
  }

  function getCommentsList() {
    return $("commentsList");
  }

  function getCommentsEmpty() {
    return $("commentsEmpty");
  }

  function getCommentsError() {
    return $("commentsError");
  }

  function getCommentsCount() {
    return $("commentsCount");
  }

  function getCommentForm() {
    return $("commentForm");
  }

  function getCommentInput() {
    return $("commentInput");
  }

  function getCommentSubmit() {
    return $("commentSubmit");
  }

  function getCommentHint() {
    return $("commentHint");
  }

  function getCommentsLoadMore() {
    return $("commentsLoadMore");
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
    if (!safeContent) {
      throw new Error("Write a comment first.");
    }

    if (safeContent.length > MAX_COMMENT_LENGTH) {
      throw new Error(`Comment too long. Max ${MAX_COMMENT_LENGTH} characters.`);
    }

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

    const { error } = await db
      .from("comments")
      .delete()
      .eq("id", commentId);

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

    const badgeHtml =
      role === "creator"
        ? `<span class="op-commentBadge">Creator</span>`
        : "";

    const avatarHtml = avatarUrl
      ? `<img src="${esc(avatarUrl)}" alt="@${esc(username)} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
      : `🐾`;

    return `
      <article class="op-commentCard" data-comment-id="${esc(comment?.id || "")}">
        <div class="op-commentAvatar">
          ${avatarHtml}
        </div>

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
                ? `
                  <button
                    class="op-commentDeleteBtn"
                    type="button"
                    data-comment-delete
                    data-comment-id="${esc(comment?.id || "")}"
                    aria-label="Delete comment"
                    title="${isAuthor ? "Delete your comment" : (isPostCreator ? "Moderate comment" : "Delete comment")}"
                  >
                    Delete
                  </button>
                `
                : ""
            }
          </div>

          <p class="op-commentText">${esc(comment?.content || "")}</p>
        </div>
      </article>
    `;
  }

  function renderCommentsList(comments, options = {}) {
    const listEl = getCommentsList();
    const emptyEl = getCommentsEmpty();

    if (!listEl) return;

    const items = Array.isArray(comments) ? comments : [];

    if (!items.length) {
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

    listEl.innerHTML = items
      .map((comment) => buildCommentItem(comment, options))
      .join("");
  }

  function prependComment(comment, options = {}) {
    const listEl = getCommentsList();
    const emptyEl = getCommentsEmpty();
    if (!listEl || !comment) return;

    if (emptyEl) show(emptyEl, false);

    listEl.insertAdjacentHTML(
      "afterbegin",
      buildCommentItem(comment, options)
    );
  }

  function updateCommentsCount(count) {
    const countEl = getCommentsCount();
    if (!countEl) return;
    countEl.textContent = String(Number(count || 0));
  }

  function setCommentsError(message = "") {
    const errorEl = getCommentsError();
    if (!errorEl) return;

    errorEl.textContent = String(message || "");
    show(errorEl, !!message);
  }

  function setCommentHint(message = "") {
    const hintEl = getCommentHint();
    if (!hintEl) return;
    hintEl.textContent = String(message || "");
  }

  function setSubmitting(isSubmitting) {
    const submitBtn = getCommentSubmit();
    const input = getCommentInput();

    if (submitBtn) {
      submitBtn.disabled = !!isSubmitting;
      submitBtn.textContent = isSubmitting ? "Posting..." : "Post";
    }

    if (input) {
      input.disabled = !!isSubmitting;
    }
  }

  function setLoadMoreVisible(yes) {
    const btn = getCommentsLoadMore();
    if (!btn) return;
    show(btn, !!yes);
  }

  async function loadAndRenderComments(state) {
    if (!state?.postId) return;

    setCommentsError("");

    const [comments, totalCount] = await Promise.all([
      fetchComments(state.postId, {
        limit: state.limit,
        offset: 0,
      }),
      fetchCommentsCount(state.postId),
    ]);

    state.items = comments;
    state.totalCount = totalCount;
    state.offset = comments.length;

    renderCommentsList(comments, {
      viewerId: state.viewerId,
      postCreatorId: state.postCreatorId,
    });

    updateCommentsCount(totalCount);
    setLoadMoreVisible(comments.length < totalCount);
  }

  async function loadMoreComments(state) {
    if (!state?.postId) return;
    if (state.offset >= state.totalCount) {
      setLoadMoreVisible(false);
      return;
    }

    const more = await fetchComments(state.postId, {
      limit: state.limit,
      offset: state.offset,
    });

    if (!more.length) {
      setLoadMoreVisible(false);
      return;
    }

    state.items = state.items.concat(more);
    state.offset += more.length;

    const listEl = getCommentsList();
    if (listEl) {
      listEl.insertAdjacentHTML(
        "beforeend",
        more
          .map((comment) =>
            buildCommentItem(comment, {
              viewerId: state.viewerId,
              postCreatorId: state.postCreatorId,
            })
          )
          .join("")
      );
    }

    setLoadMoreVisible(state.offset < state.totalCount);
  }

  async function handleCommentSubmit(event, state) {
    event.preventDefault();

    const input = getCommentInput();
    if (!input) return;

    const content = String(input.value || "").trim();
    if (!content) {
      setCommentHint("Write something first.");
      return;
    }

    if (!state?.viewerId) {
      setCommentHint("Log in to comment.");
      return;
    }

    setCommentHint("");
    setCommentsError("");
    setSubmitting(true);

    try {
      const newComment = await createComment(state.postId, state.viewerId, content);

      input.value = "";
      state.totalCount += 1;
      state.offset += 1;
      state.items.unshift(newComment);

      prependComment(newComment, {
        viewerId: state.viewerId,
        postCreatorId: state.postCreatorId,
      });

      updateCommentsCount(state.totalCount);
      setLoadMoreVisible(state.offset < state.totalCount);
    } catch (err) {
      setCommentsError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommentDeleteClick(event, state) {
    const btn = event.target.closest("[data-comment-delete]");
    if (!btn) return;

    const commentId = String(btn.dataset.commentId || "").trim();
    if (!commentId) return;

    btn.disabled = true;
    btn.textContent = "Deleting...";

    try {
      await deleteComment(commentId);

      const card = btn.closest("[data-comment-id]");
      if (card) {
        card.remove();
      }

      state.items = state.items.filter((item) => String(item.id) !== commentId);
      state.totalCount = Math.max(0, Number(state.totalCount || 0) - 1);
      state.offset = Math.max(0, Number(state.offset || 0) - 1);

      updateCommentsCount(state.totalCount);

      if (!state.items.length) {
        renderCommentsList([], {
          viewerId: state.viewerId,
          postCreatorId: state.postCreatorId,
        });
      }
    } catch (err) {
      setCommentsError(err?.message || String(err));
      btn.disabled = false;
      btn.textContent = "Delete";
    }
  }

  async function initComments(options = {}) {
    const mount = getCommentsMount();
    if (!mount) return null;

    const postId =
      String(options.postId || "").trim() ||
      getPostIdFromUrl();

    if (!postId) {
      setCommentsError("Missing post id.");
      return null;
    }

    const sessionUser = await getSessionUser();

    const state = {
      postId,
      viewerId: String(options.viewerId || sessionUser?.id || "").trim(),
      postCreatorId: String(options.postCreatorId || "").trim(),
      items: [],
      totalCount: 0,
      offset: 0,
      limit: Number(options.limit || COMMENTS_LIMIT),
    };

    await loadAndRenderComments(state);

    const form = getCommentForm();
    const loadMoreBtn = getCommentsLoadMore();
    const listEl = getCommentsList();

    if (form && !form.dataset.commentsBound) {
      form.addEventListener("submit", (event) => {
        handleCommentSubmit(event, state);
      });
      form.dataset.commentsBound = "true";
    }

    if (loadMoreBtn && !loadMoreBtn.dataset.commentsBound) {
      loadMoreBtn.addEventListener("click", async () => {
        try {
          loadMoreBtn.disabled = true;
          loadMoreBtn.textContent = "Loading...";
          await loadMoreComments(state);
        } catch (err) {
          setCommentsError(err?.message || String(err));
        } finally {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = "Load more";
        }
      });
      loadMoreBtn.dataset.commentsBound = "true";
    }

    if (listEl && !listEl.dataset.commentsBound) {
      listEl.addEventListener("click", (event) => {
        handleCommentDeleteClick(event, state);
      });
      listEl.dataset.commentsBound = "true";
    }

    return state;
  }

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
    initComments,
  };
})();