/* =========================================================
   OnlyPaws
   File: /js/app/post.js
   Purpose:
   - render reusable post cards
   - bind shared post interactions
   - hydrate single post page
   - support likes across feed / creator profile / post page

   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS (optional)
   - window.OPRoutes (optional)
   ========================================================= */

/* =========================================================
   OnlyPaws — post.js FINAL
   ========================================================= */

(() => {
  const client = window.onlypawsClient;

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("it-IT", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isVideoMedia(type, url) {
    const t = String(type || "").toLowerCase();
    if (t === "video") return true;
    return /\.(mp4|webm|mov)$/i.test(url || "");
  }

  function normalizeAssetUrl(v) {
    if (!v) return "";
    if (/^(https?:|\/|data:|blob:)/.test(v)) return v;
    return "/" + v.replace(/^\/+/, "");
  }

  function showClass(el) {
    if (!el) return;
    el.classList.remove("isHidden");
  }

  function hideClass(el) {
    if (!el) return;
    el.classList.add("isHidden");
  }

  function getPostId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function goHome() {
    window.location.replace("/");
  }

  function creatorProfileUrl(u) {
    return `/html/app/fans/creator-profile.html?u=${encodeURIComponent(u || "creator")}`;
  }

  async function fetchPost(id) {
    const { data, error } = await client
      .from("posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function fetchUsername(id) {
    const { data } = await client
      .from("profiles")
      .select("username")
      .eq("user_id", id)
      .maybeSingle();

    return data?.username || "";
  }

  async function init() {
    const pageTitle = $("pageTitle");
    const author = $("author");
    const createdAt = $("createdAt");
    const mediaBox = $("mediaBox");
    const caption = $("caption");
    const hint = $("hintBox");
    const err = $("errBox");
    const likeBtn = $("likeBtn");
    const likeIcon = $("likeIcon");
    const likeCount = $("likeCount");

    try {
      const { data } = await client.auth.getSession();
      const session = data?.session;
      if (!session) return goHome();

      const userId = session.user.id;
      const postId = getPostId();
      if (!postId) throw new Error("Missing id");

      let post = await fetchPost(postId);
      if (!post) throw new Error("Post not found");

      const username = await fetchUsername(post.creator_id);

      pageTitle.textContent = post.title || "Post";
      createdAt.textContent = fmtDate(post.created_at);

      author.textContent = "@" + (username || "creator");
      author.href = creatorProfileUrl(username);

      const canViewFull =
        !post.is_paid || post.creator_id === userId;

      const body = canViewFull
        ? post.content || post.preview || ""
        : post.preview || "";

      if (body.trim()) {
        caption.textContent = body;
        showClass(caption);
      } else {
        hideClass(caption);
      }

      const url = normalizeAssetUrl(post.media_url);
      const type = (post.media_type || "").toLowerCase();

      if (!url || type === "none") {
        hideClass(mediaBox);
      } else {
        showClass(mediaBox);

        const isVideo = isVideoMedia(type, url);

        if (!canViewFull && post.is_paid) {
          const media = isVideo
            ? `<video muted src="${esc(url)}"></video>`
            : `<img src="${esc(url)}">`;

          mediaBox.innerHTML = `
            <div class="op-mediaWrap op-isLocked">
              ${media}
              <div class="op-lockOverlay">
                <div class="op-lockBox">
                  <div class="op-badge op-badge--locked">Locked</div>
                  <p class="op-lockTitle">Premium post</p>
                  <p class="op-lockText">Subscribe to unlock</p>
                  <a href="${creatorProfileUrl(username)}" class="op-openCreatorBtn">Open creator</a>
                </div>
              </div>
            </div>
          `;
        } else {
          mediaBox.innerHTML = isVideo
            ? `<video controls src="${esc(url)}"></video>`
            : `<img src="${esc(url)}">`;
        }
      }

      async function refreshLikes() {
        const fresh = await fetchPost(postId);
        if (fresh) post = fresh;

        likeCount.textContent = post.likes_count ?? 0;

        const { data } = await client
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("fan_id", userId)
          .maybeSingle();

        const liked = !!data;
        likeBtn.dataset.liked = liked;
        likeIcon.textContent = liked ? "♥" : "♡";
      }

      likeBtn.addEventListener("click", async () => {
        const liked = likeBtn.dataset.liked === "true";
        likeBtn.disabled = true;

        try {
          if (liked) {
            await client
              .from("post_likes")
              .delete()
              .eq("post_id", postId)
              .eq("fan_id", userId);
          } else {
            await client
              .from("post_likes")
              .insert({ post_id: postId, fan_id: userId });
          }

          await refreshLikes();
        } catch (e) {
          showClass(err);
          err.textContent = e.message;
        } finally {
          likeBtn.disabled = false;
        }
      });

      await refreshLikes();
      hint.textContent = "";
    } catch (e) {
      hideClass(hint);
      showClass(err);
      err.textContent = e.message;
    }
  }

  init();
})();

  boot();
})();
