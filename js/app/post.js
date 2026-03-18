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
   - window.onlypawsLikes (optional but recommended)
   - window.OP_PATHS (optional)
   - window.OPRoutes (optional)
   ========================================================= */

(() => {
  const FEATURE_LIKES = true;

  const client = window.onlypawsClient || null;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function show(el, yes) {
    if (!el) return;
    el.style.display = yes ? "" : "none";
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

  function fmtDate(iso) {
    if (!iso) return "";

    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    try {
      return d.toLocaleString("it-IT", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d.toISOString();
    }
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

  function routeHref(pathKey, query = {}, fallback = "") {
    if (ROUTES?.href) {
      const href = ROUTES.href(pathKey, query);
      if (href) return href;
    }

    if (fallback) {
      const url = new URL(fallback, window.location.origin);
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value == null || value === "") return;
        url.searchParams.set(key, String(value));
      });
      return url.pathname + url.search + url.hash;
    }

    return "";
  }

  function homeUrl() {
    return (
      routeHref("home", {}, PATHS?.home || PATHS?.index || "/index.html") ||
      "/index.html"
    );
  }

  function marketingHomeUrl() {
    return (
      routeHref(
        "marketing.home",
        {},
        PATHS?.marketing?.home || PATHS?.home || "/index.html"
      ) || "/index.html"
    );
  }

  function feedUrl() {
    return (
      routeHref("app.feed", {}, PATHS?.app?.feed || "/html/app/feed.html") ||
      "/html/app/feed.html"
    );
  }

  function profileUrl() {
    return (
      routeHref(
        "app.profile",
        {},
        PATHS?.app?.profile || "/html/app/profile.html"
      ) || "/html/app/profile.html"
    );
  }

  function fanDashUrl() {
    return (
      routeHref(
        "app.fans.fanDash",
        {},
        PATHS?.app?.fans?.fanDash || "/html/app/fans/fan-dash.html"
      ) || "/html/app/fans/fan-dash.html"
    );
  }

  function creatorDashUrl() {
    return (
      routeHref(
        "app.creators.creatorDash",
        {},
        PATHS?.app?.creators?.creatorDash ||
          "/html/app/creators/creator-dash.html"
      ) || "/html/app/creators/creator-dash.html"
    );
  }

  function defaultPostUrl(post) {
    return (
      routeHref(
        "app.post",
        { id: post.id },
        PATHS?.app?.post || "/html/app/post.html"
      ) || `/html/app/post.html?id=${encodeURIComponent(post.id)}`
    );
  }

  function creatorProfileUrl(username) {
    const safeUsername = username || "creator";

    return (
      routeHref(
        "app.fans.creatorProfile",
        { u: safeUsername },
        PATHS?.app?.fans?.creatorProfile ||
          "/html/app/fans/creator-profile.html"
      ) ||
      `/html/app/fans/creator-profile.html?u=${encodeURIComponent(safeUsername)}`
    );
  }

  function legalContentPolicyUrl() {
    return (
      routeHref(
        "legal.contentPolicy",
        {},
        PATHS?.legal?.contentPolicy ||
          "/html/marketing/legal/content-policy.html"
      ) || "/html/marketing/legal/content-policy.html"
    );
  }

  function legalPrivacyPolicyUrl() {
    return (
      routeHref(
        "legal.privacyPolicy",
        {},
        PATHS?.legal?.privacyPolicy ||
          "/html/marketing/legal/privacy-policy.html"
      ) || "/html/marketing/legal/privacy-policy.html"
    );
  }

  function legalTermsUrl() {
    return (
      routeHref(
        "legal.terms",
        {},
        PATHS?.legal?.terms || "/html/marketing/legal/terms.html"
      ) || "/html/marketing/legal/terms.html"
    );
  }

  function getPostLocked(post) {
    return Boolean(post?.is_paid);
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

  function renderBadge(post, locked) {
    const price =
      post?.price_cents != null && Number(post.price_cents) > 0
        ? fmtMoney(post.price_cents, post.currency || "eur")
        : "";

    if (locked) return `<span class="op-badge op-badge--locked">Locked</span>`;
    if (price) return `<span class="op-badge op-badge--price">${esc(price)}</span>`;
    if (post?.is_paid) return `<span class="op-badge op-badge--price">Paid</span>`;

    return `<span class="op-badge op-badge--free">Free</span>`;
  }

  function renderPost(post, opts = {}) {
    const postUrl = (opts.postUrl || defaultPostUrl)(post);
    const title = esc(post.title || "");
    const excerpt = esc(post.preview || post.content || "");

    const creatorRaw = post.creator_username || "creator";
    const creator = esc(creatorRaw);

    const creatorAvatar = esc(resolveCreatorAvatar(post));
    const createdAt = formatPostDate(post.created_at);
    const locked = getPostLocked(post);

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
                    : `<span class="op-postCreatorPlaceholder"></span>`
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

  async function getClient() {
    if (client) return client;
    throw new Error("Missing onlypawsClient.");
  }

  async function isLoggedIn() {
    try {
      const c = await getClient();
      const { data } = await c.auth.getSession();
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

    if (!window.onlypawsLikes) {
      setCount(btn, "—");
      setLiked(btn, false);
      return;
    }

    try {
      if (window.onlypawsLikes.getPostLikeCount) {
        const count = await window.onlypawsLikes.getPostLikeCount(postId);
        setCount(btn, count);
      } else {
        setCount(btn, "—");
      }
    } catch (err) {
      console.warn("getPostLikeCount failed", postId, err);
      setCount(btn, "—");
    }

    if (!logged) {
      setLiked(btn, false);
      return;
    }

    try {
      if (window.onlypawsLikes.getPostLikedByMe) {
        const liked = await window.onlypawsLikes.getPostLikedByMe(postId);
        setLiked(btn, liked);
      } else {
        setLiked(btn, false);
      }
    } catch (err) {
      console.warn("getPostLikedByMe failed", postId, err);
      setLiked(btn, false);
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

      if (!window.onlypawsLikes?.togglePostLike) return;
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

    const buttons = $$(".op-likeBtn", root);
    if (!buttons.length) return;

    const logged = await isLoggedIn();

    await Promise.all(
      buttons.map(async (btn) => {
        await hydrateLikeButton(btn, logged);
        bindLikeButton(btn, logged);
      })
    );
  }

  function getPostIdFromUrl() {
    const p = new URLSearchParams(window.location.search);
    return (p.get("id") || "").trim();
  }

  function goHomeReplace() {
    const href = homeUrl();
    window.location.replace(href);
  }

  async function hydrateUserPill(c) {
    const pill = $("userPill");
    if (!pill) return;

    try {
      const { data: sessData } = await c.auth.getSession();
      const session = sessData?.session;

      if (!session) {
        pill.textContent = "Guest";
        return;
      }

      const uid = session.user.id;
      const email = session.user.email || "";

      const { data: prof } = await c
        .from("profiles")
        .select("username, display_name, role")
        .eq("user_id", uid)
        .maybeSingle();

      const uname = (prof?.username || "").trim();
      const dname = (prof?.display_name || "").trim();

      if (uname) pill.textContent = "@" + uname;
      else if (dname) pill.textContent = dname;
      else if (email) pill.textContent = email.split("@")[0];
      else pill.textContent = "User";
    } catch (_) {
      pill.textContent = "User";
    }
  }

  async function hydrateNav(c) {
    const navProfile = $("navProfile");
    const navFanDash = $("navFanDash");
    const navCreatorDash = $("navCreatorDash");
    const navLogout = $("navLogout");
    const brandLink = document.querySelector(".brand");
    const backBtn = $("backBtn");

    if (brandLink && !brandLink.getAttribute("href")) {
      brandLink.setAttribute("href", feedUrl());
    }

    if (backBtn && !backBtn.getAttribute("href")) {
      backBtn.setAttribute("href", feedUrl());
    }

    if (navProfile) navProfile.setAttribute("href", profileUrl());
    if (navFanDash) navFanDash.setAttribute("href", fanDashUrl());
    if (navCreatorDash) navCreatorDash.setAttribute("href", creatorDashUrl());

    show(navProfile, true);
    show(navFanDash, false);
    show(navCreatorDash, false);

    if (navLogout) show(navLogout, false);

    try {
      const { data: u } = await c.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return;

      const { data: p } = await c
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (p?.role === "creator") show(navCreatorDash, true);
      else show(navFanDash, true);
    } catch (_) {}
  }

  function setupLogout(c) {
    const logoutBtn = $("navLogout");
    if (!logoutBtn) return;

    if (logoutBtn.dataset.bound === "1") return;
    logoutBtn.dataset.bound = "1";

    logoutBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      logoutBtn.disabled = true;
      logoutBtn.textContent = "Logging out…";

      try {
        await c.auth.signOut();
      } catch (_) {}

      goHomeReplace();
    });
  }

  async function fetchSinglePost(c, postId) {
    const { data, error } = await c
      .from("posts")
      .select(
        [
          "id",
          "creator_id",
          "pet_id",
          "title",
          "content",
          "preview",
          "slug",
          "media_url",
          "media_type",
          "is_public",
          "is_paid",
          "is_pinned",
          "likes_count",
          "created_at",
          "updated_at",
        ].join(", ")
      )
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function fetchCreatorUsername(c, creatorId) {
    if (!creatorId) return "";

    try {
      const { data } = await c
        .from("profiles")
        .select("username")
        .eq("user_id", creatorId)
        .maybeSingle();

      return data?.username || "";
    } catch {
      return "";
    }
  }

  async function refreshSinglePostLikes(c, postId, userId, state = {}) {
    const likeBtn = $("likeBtn");
    const likeCount = $("likeCount");
    const likeIcon = $("likeIcon");

    if (!likeBtn || !likeCount || !likeIcon) return state;

    let post = state.post || null;

    try {
      const fresh = await fetchSinglePost(c, postId);
      if (fresh) post = fresh;
    } catch (_) {}

    if (post) likeCount.textContent = String(post.likes_count ?? 0);

    try {
      const { data: mine, error: mErr } = await c
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("fan_id", userId)
        .maybeSingle();

      const liked = !!(mine && mine.id) && !mErr;
      likeBtn.setAttribute("data-liked", liked ? "true" : "false");
      likeIcon.textContent = liked ? "♥" : "♡";
    } catch {
      likeBtn.setAttribute("data-liked", "false");
      likeIcon.textContent = "♡";
    }

    return { ...state, post };
  }

  async function initSinglePostPage() {
    const pageTitle = $("pageTitle");
    const author = $("author");
    const createdAt = $("createdAt");
    const mediaBox = $("mediaBox");
    const caption = $("caption");
    const hintBox = $("hintBox");
    const errBox = $("errBox");
    const likeBtn = $("likeBtn");
    const copyLinkBtn = $("copyLinkBtn");
    const backBtn = $("backBtn");

    const isSinglePostPage =
      pageTitle ||
      author ||
      createdAt ||
      mediaBox ||
      caption ||
      hintBox ||
      errBox ||
      likeBtn ||
      copyLinkBtn ||
      backBtn;

    if (!isSinglePostPage) return;

    try {
      const c = await getClient();

      const { data: sessData } = await c.auth.getSession();
      const session = sessData?.session;
      if (!session) {
        goHomeReplace();
        return;
      }

      const userId = session.user.id;
      const postId = getPostIdFromUrl();

      setupLogout(c);
      await hydrateNav(c);
      await hydrateUserPill(c);

      if (backBtn) backBtn.setAttribute("href", feedUrl());

      if (!postId) {
        if (hintBox) hintBox.textContent = "";
        if (errBox) {
          errBox.style.display = "block";
          errBox.textContent = "Missing ?id= in URL";
        }
        return;
      }

      let post = await fetchSinglePost(c, postId);

      if (!post) {
        if (hintBox) hintBox.textContent = "";
        if (errBox) {
          errBox.style.display = "block";
          errBox.textContent = "Post not found";
        }
        return;
      }

      const creatorUsername = await fetchCreatorUsername(c, post.creator_id);

      if (pageTitle) {
        pageTitle.textContent =
          post.title && String(post.title).trim() ? post.title : "Post";
      }

      if (createdAt) {
        createdAt.textContent = fmtDate(post.created_at);
      }

      if (author) {
        author.textContent = creatorUsername ? `@${creatorUsername}` : "@creator";
        author.setAttribute("href", creatorProfileUrl(creatorUsername || "creator"));
      }

      const canViewFull =
        !post?.is_paid || (userId && post.creator_id === userId);

      const bodyText = canViewFull
        ? (
            (post.content && String(post.content).trim().length
              ? post.content
              : post.preview || "") || ""
          )
        : (post.preview || "");

      if (caption) {
        if (bodyText && String(bodyText).trim().length) {
          caption.style.display = "block";
          caption.textContent = bodyText;
        } else {
          caption.style.display = "none";
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
            const creatorUrl = creatorProfileUrl(creatorUsername || "creator");
            const mediaEl = isVideo
              ? `<video playsinline preload="metadata" muted src="${esc(url)}"></video>`
              : `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;

            mediaBox.innerHTML = `
              <div class="op-mediaWrap op-isLocked">
                ${mediaEl}
                <div class="op-lockOverlay">
                  <div class="op-lockBox">
                    <div class="op-badge op-badge--locked">Locked</div>
                    <p class="op-lockTitle">Premium post</p>
                    <p class="op-lockText">Subscribe to unlock this content</p>
                    <a class="op-openCreatorBtn" href="${esc(creatorUrl)}">Open creator</a>
                  </div>
                </div>
              </div>
            `;
          } else if (isVideo) {
            mediaBox.innerHTML = `<video controls playsinline preload="metadata" src="${esc(url)}"></video>`;
          } else {
            mediaBox.innerHTML = `<img src="${esc(url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
          }
        }
      }

      if (likeBtn) {
        if (likeBtn.dataset.bound !== "1") {
          likeBtn.dataset.bound = "1";

          likeBtn.addEventListener("click", async () => {
            if (!likeBtn) return;

            if (errBox) errBox.style.display = "none";

            const liked = likeBtn.getAttribute("data-liked") === "true";
            likeBtn.disabled = true;

            try {
              if (liked) {
                const { error } = await c
                  .from("post_likes")
                  .delete()
                  .eq("post_id", postId)
                  .eq("fan_id", userId);
                if (error) throw error;
              } else {
                const { error } = await c
                  .from("post_likes")
                  .insert({ post_id: postId, fan_id: userId });
                if (error) throw error;
              }

              const refreshed = await refreshSinglePostLikes(c, postId, userId, {
                post,
              });
              post = refreshed.post || post;
            } catch (e) {
              if (errBox) {
                errBox.style.display = "block";
                errBox.textContent = "Like error: " + (e?.message || String(e));
              }
            } finally {
              likeBtn.disabled = false;
            }
          });
        }

        const refreshed = await refreshSinglePostLikes(c, postId, userId, {
          post,
        });
        post = refreshed.post || post;
      }

      if (copyLinkBtn && copyLinkBtn.dataset.bound !== "1") {
        copyLinkBtn.dataset.bound = "1";

        copyLinkBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            copyLinkBtn.textContent = "Copied!";
            setTimeout(() => {
              copyLinkBtn.textContent = "Copy link";
            }, 900);
          } catch (_) {
            copyLinkBtn.textContent = "Nope";
            setTimeout(() => {
              copyLinkBtn.textContent = "Copy link";
            }, 900);
          }
        });
      }

      if (hintBox) hintBox.textContent = "";
    } catch (e) {
      if ($("hintBox")) $("hintBox").textContent = "";
      if ($("errBox")) {
        $("errBox").style.display = "block";
        $("errBox").textContent = e?.message || String(e);
      }
    }
  }

  function bindAuthStateRedirect() {
    try {
      if (!client?.auth?.onAuthStateChange) return;

      client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          goHomeReplace();
        }
      });
    } catch (_) {}
  }

  function injectStyles() {
    if (document.getElementById("op-post-css")) return;

    const s = document.createElement("style");
    s.id = "op-post-css";
    s.textContent = `
      .op-postCard{
        border-radius:18px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        overflow:hidden;
      }

      .op-postMain{
        display:block;
        padding:14px;
        color:inherit;
        text-decoration:none;
        cursor:pointer;
        outline:none;
      }

      .op-postMain:focus-visible{
        outline:2px solid rgba(255,255,255,.45);
        outline-offset:-2px;
      }

      .op-postHeader{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:10px;
      }

      .op-postCreator{
        min-width:0;
        display:flex;
        align-items:center;
        gap:10px;
      }

      .op-postCreatorAvatar{
        width:40px;
        height:40px;
        border-radius:999px;
        overflow:hidden;
        flex:0 0 auto;
        display:flex;
        align-items:center;
        justify-content:center;
        background:rgba(0,0,0,.18);
        border:1px solid rgba(255,255,255,.14);
        color:inherit;
        text-decoration:none;
        font-size:18px;
      }

      .op-postCreatorAvatar img{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
      }

      .op-postCreatorMeta{
        min-width:0;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }

      .op-postCreatorName{
        font-size:13px;
        opacity:.95;
        font-weight:900;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        color:inherit;
        text-decoration:none;
      }

      .op-postCreatorName:hover{
        text-decoration:underline;
      }

      .op-postCreatorPlaceholder{
        display:block;
        width:1px;
        height:13px;
      }

      .op-postHeaderRight{
        display:flex;
        align-items:center;
        gap:8px;
        flex:0 0 auto;
      }

      .op-badge{
        font-size:11px;
        font-weight:900;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.18);
        white-space:nowrap;
      }

      .op-badge--locked{
        background:rgba(0,0,0,.30);
      }

      .op-badge--free{
        background:rgba(255,255,255,.10);
      }

      .op-badge--price{
        background:rgba(0,0,0,.18);
      }

      .op-title{
        margin:0 0 6px;
        font-size:15px;
        font-weight:950;
        letter-spacing:.2px;
        line-height:1.3;
      }

      .op-excerpt{
        margin:0 0 10px;
        font-size:14px;
        opacity:.92;
        line-height:1.45;
        display:-webkit-box;
        -webkit-line-clamp:3;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }

      .op-mediaWrap{
        margin-top:8px;
        border-radius:14px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.18);
        position:relative;
      }

      .op-mediaWrap img,
      .op-mediaWrap video{
        width:100%;
        display:block;
        max-height:520px;
        object-fit:cover;
      }

      .op-mediaWrap.op-isLocked img,
      .op-mediaWrap.op-isLocked video{
        filter:blur(18px);
        transform:scale(1.03);
      }

      .op-lockOverlay{
        position:absolute;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(0,0,0,.40);
        backdrop-filter:blur(2px);
      }

      .op-lockBox{
        width:100%;
        max-width:260px;
        padding:16px;
        text-align:center;
        border-radius:18px;
        background:rgba(18,18,30,.42);
        border:1px solid rgba(255,255,255,.14);
        backdrop-filter:blur(10px);
      }

      .op-lockTitle{
        margin:10px 0 6px;
        font-size:15px;
        font-weight:900;
      }

      .op-lockText{
        margin:0 0 12px;
        font-size:13px;
        line-height:1.35;
        opacity:.9;
      }

      .op-postDate{
        font-size:12px;
        opacity:.72;
        margin-top:2px;
        white-space:nowrap;
      }

      .op-openCreatorBtn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:10px 14px;
        border-radius:999px;
        font-weight:900;
        text-decoration:none;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.92);
        color:rgba(107,78,255,1);
      }

      .op-postBottom{
        display:flex;
        justify-content:flex-start;
        padding:10px 14px;
        border-top:1px solid rgba(255,255,255,.10);
      }

      .op-likeBtn{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.15);
        color:inherit;
        cursor:pointer;
        user-select:none;
      }

      .op-likeBtn:disabled{
        opacity:.6;
        cursor:default;
      }

      .op-likeIcon{
        font-size:14px;
        line-height:1;
      }

      .op-likeCount{
        font-size:12px;
        font-weight:900;
        opacity:.95;
        min-width:16px;
        text-align:right;
      }

      .op-liked{
        background:rgba(255,255,255,.14);
      }
    `;

    document.head.appendChild(s);
  }

  async function boot() {
    injectStyles();
    bindAuthStateRedirect();
    await initSinglePostPage();
  }

  const api = {
    renderPost,
    renderPostCard: renderPost,
    initPosts,
    initPostCards: initPosts,
    initSinglePostPage,
    FEATURE_LIKES,

    urls: {
      home: homeUrl,
      marketingHome: marketingHomeUrl,
      feed: feedUrl,
      profile: profileUrl,
      fanDash: fanDashUrl,
      creatorDash: creatorDashUrl,
      post: defaultPostUrl,
      creatorProfile: creatorProfileUrl,
      legalContentPolicy: legalContentPolicyUrl,
      legalPrivacyPolicy: legalPrivacyPolicyUrl,
      legalTerms: legalTermsUrl,
    },
  };

  window.OnlyPawsPost = api;
  window.OnlyPawsPostCard = api;

  boot();
})();
