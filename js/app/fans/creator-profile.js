/* =========================================================
   OnlyPaws
   File: /js/app/fans/creator-profile.js
   Purpose:
   - public/shareable creator profile preview
   - optional logged-in actions for follow / subscribe
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  if (!client) {
    console.error("onlypawsClient missing");
    return;
  }

  const els = {
    creatorName: document.getElementById("creatorName"),
    creatorHandle: document.getElementById("creatorHandle"),
    creatorBio: document.getElementById("creatorBio"),
    creatorAvatarImg: document.getElementById("creatorAvatarImg"),

    creatorSocials: document.getElementById("creatorSocials"),
    creatorInstagram: document.getElementById("creatorInstagram"),
    creatorTikTok: document.getElementById("creatorTikTok"),
    shareProfileBtn: document.getElementById("shareProfileBtn"),

    petsList: document.getElementById("petsList"),
    petsHint: document.getElementById("petsHint"),

    posts: document.getElementById("posts"),
    postsHint: document.getElementById("postsHint"),

    actionRow: document.getElementById("actionRow"),
    followBtn: document.getElementById("followBtn"),
    premiumBtn: document.getElementById("premiumBtn"),

    creatorHint: document.getElementById("creatorHint"),
    toast: document.getElementById("toast"),
  };

  const state = {
    viewerId: null,
    viewerRole: "",
    viewerIsCreator: false,
    creator: null,
    creatorEligible: false,
    followRowId: null,
    subRow: null,
    posts: [],
    isSelf: false,
    creatorUsername: "",
    creatorAvatarUrl: "",
  };

  function esc(v) {
    return (v ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message || "";
    els.toast.classList.add("show");
    clearTimeout(els.toast._t);
    els.toast._t = setTimeout(() => {
      els.toast.classList.remove("show");
    }, 2600);
  }

  function setHint(message) {
    if (!els.creatorHint) return;
    els.creatorHint.textContent = message || "";
  }

  function setBtnBusy(btn, yes, text) {
    if (!btn) return;
    btn.disabled = !!yes;
    btn.classList.toggle("isBusy", !!yes);
    if (text != null) btn.textContent = text;
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

  function resolveAvatarUrl(obj) {
    return normalizeAssetUrl(obj?.avatar_url || "");
  }

  function normalizeSocialUrl(value, platform) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let cleaned = raw.replace(/^@+/, "").trim();

    if (/^https?:\/\//i.test(cleaned)) {
      return cleaned;
    }

    if (platform === "instagram") {
      cleaned = cleaned.replace(/^instagram\.com\//i, "");
      cleaned = cleaned.replace(/^www\.instagram\.com\//i, "");
      return `https://instagram.com/${cleaned}`;
    }

    if (platform === "tiktok") {
      cleaned = cleaned.replace(/^tiktok\.com\//i, "");
      cleaned = cleaned.replace(/^www\.tiktok\.com\//i, "");
      if (!cleaned.startsWith("@")) cleaned = `@${cleaned}`;
      return `https://tiktok.com/${cleaned}`;
    }

    return raw;
  }

  function isUUID(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || "");
  }

  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      u: (p.get("u") || "").trim(),
      success: (p.get("success") || "").trim(),
      session_id: (p.get("session_id") || "").trim(),
    };
  }

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }
    window.location.replace(PATHS?.home || PATHS?.index || "/index.html");
  }

  function creatorProfileHref(usernameOrId) {
    if (!usernameOrId) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: usernameOrId });
    }

    const base =
      PATHS?.app?.fans?.creatorProfile || "/html/app/fans/creator-profile.html";
    return `${base}?u=${encodeURIComponent(usernameOrId)}`;
  }

  function fansAuthHref() {
    const shareKey =
      state.creatorUsername ||
      state.creator?.username ||
      state.creator?.user_id;

    const redirectTarget =
      creatorProfileHref(shareKey) ||
      (window.location.pathname + window.location.search);

    if (ROUTES?.href) {
      return ROUTES.href("marketing.fans", {
        auth: 1,
        redirect: redirectTarget,
      });
    }

    const base = PATHS?.marketing?.fans || "/html/marketing/fans.html";
    return `${base}?auth=1&redirect=${encodeURIComponent(redirectTarget)}`;
  }

  function goFansAuth() {
    window.location.href = fansAuthHref();
  }

  function subscriptionsHref(creatorId) {
    if (ROUTES?.href) {
      return ROUTES.href("app.fans.subscriptions", { creator: creatorId });
    }
    const base =
      PATHS?.app?.fans?.subscriptions || "/html/app/fans/subscriptions.html";
    return `${base}?creator=${encodeURIComponent(creatorId)}`;
  }

  function computePostHref(postId) {
    if (ROUTES?.href) {
      return ROUTES.href("app.post", { id: postId });
    }

    const base = PATHS?.app?.post || "/html/app/post.html";
    return `${base}?id=${encodeURIComponent(postId)}`;
  }

  function creatorEligible(profile) {
    if (!profile) return false;

    const roleOk = profile.role === "creator";
    const onboard = (profile.stripe_onboarding_status || "").toLowerCase();
    const onboardOk = onboard === "complete" || onboard === "completed";
    const charges = profile.charges_enabled === true;
    const connect = !!(profile.stripe_connect_account_id || "").trim();

    return roleOk && onboardOk && charges && connect;
  }

  function computeAccess(subRow, eligible) {
    const periodEnd = subRow?.current_period_end
      ? new Date(subRow.current_period_end).getTime()
      : 0;

    const active = !!periodEnd && periodEnd > Date.now();
    const status = (subRow?.status || "").toLowerCase();
    const canceled = status === "canceled" || status === "cancelled";

    return {
      hasAccess: active && eligible,
      rawActive: active,
      canceling: active && subRow?.cancel_at_period_end === true,
      hardCanceled: !active && canceled,
    };
  }

  function renderCreatorSocials(creator) {
    const instagramUrl = normalizeSocialUrl(
      creator?.instagram_url || "",
      "instagram"
    );
    const tiktokUrl = normalizeSocialUrl(
      creator?.tiktok_url || "",
      "tiktok"
    );

    let hasSocials = false;

    if (els.creatorInstagram) {
      if (instagramUrl) {
        els.creatorInstagram.href = instagramUrl;
        els.creatorInstagram.target = "_blank";
        els.creatorInstagram.rel = "noopener noreferrer";
        els.creatorInstagram.hidden = false;
        hasSocials = true;
      } else {
        els.creatorInstagram.hidden = true;
        els.creatorInstagram.removeAttribute("href");
      }
    }

    if (els.creatorTikTok) {
      if (tiktokUrl) {
        els.creatorTikTok.href = tiktokUrl;
        els.creatorTikTok.target = "_blank";
        els.creatorTikTok.rel = "noopener noreferrer";
        els.creatorTikTok.hidden = false;
        hasSocials = true;
      } else {
        els.creatorTikTok.hidden = true;
        els.creatorTikTok.removeAttribute("href");
      }
    }

    if (els.creatorSocials) {
      els.creatorSocials.hidden = !hasSocials;
    }
  }

  function renderCreator(c) {
    const name = c.display_name || c.username || "Creator";
    const uname = c.username || "username";
    const bio = c.bio || "";
    const avatarUrl = resolveAvatarUrl(c);

    if (els.creatorName) els.creatorName.textContent = name;
    if (els.creatorHandle) els.creatorHandle.textContent = `@${uname}`;
    if (els.creatorBio) els.creatorBio.textContent = bio;

    state.creatorUsername = uname;
    state.creatorAvatarUrl = avatarUrl;

    if (els.creatorAvatarImg) {
      els.creatorAvatarImg.src = avatarUrl || "/assets/images/logo.png";
      els.creatorAvatarImg.alt = `${name} avatar`;
    }

    renderCreatorSocials(c);
  }

  function renderPets(list) {
    if (!els.petsList) return;

    if (!list?.length) {
      els.petsList.innerHTML = "";
      return;
    }

    els.petsList.innerHTML = list
      .map((pet) => {
        const name = pet.name || "Pet";
        const line = [pet.species, pet.breed].filter(Boolean).join(" • ");
        const avatarUrl = resolveAvatarUrl(pet);

        const av = avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="${esc(name)} avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          : `<span aria-hidden="true">🐾</span>`;

        return `
        <div class="petCard">
          <div class="petAvatar">${av}</div>
          <div>
            <b>${esc(name)}</b>
            <span>${esc(line || " ")}</span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function enrichPostsForRenderer(posts) {
    const access = computeAccess(state.subRow, state.creatorEligible);

    return posts.map((post) => {
      const isPremium = post.is_paid === true;
      const isPrivate = post.is_public === false;

      let canView = false;

      if (isPrivate) {
        canView = state.isSelf;
      } else if (!isPremium) {
        canView = true;
      } else {
        canView = state.isSelf || access.hasAccess;
      }

      return {
        ...post,
        href: computePostHref(post.id),
        creator_username: state.creatorUsername,
        creator_name: state.creator?.display_name || state.creatorUsername,
        creator_avatar_url: state.creatorAvatarUrl,
        excerpt: post.preview || (isPremium ? "Locked content." : ""),
        is_locked: !canView,
        can_view: canView,
        liked: false,
        comments_count: Number(post.comments_count || 0),
      };
    });
  }

  function initPostCardsForContainer(container) {
    if (!container) return;

    const postApi = window.OnlyPawsPost || null;
    if (!postApi) return;

    try {
      if (typeof postApi.initPostCards === "function") {
        postApi.initPostCards(container);
      }
    } catch (error) {
      console.warn("creator profile post cards init failed", error);
    }
  }

  async function initLikesForContainer(container) {
    if (!container || !state.viewerId) return;

    const likesApi = window.onlypawsLikes || null;
    if (!likesApi) return;

    try {
      if (typeof likesApi.initLikeButtons === "function") {
        await likesApi.initLikeButtons(container);
      }
    } catch (error) {
      console.warn("creator profile likes init failed", error);
    }
  }

  async function initRenderedPosts(container) {
    if (!container) return;
    initPostCardsForContainer(container);
    await initLikesForContainer(container);
  }

  async function renderPosts(posts) {
    if (!els.posts) return;

    if (!posts.length) {
      els.posts.innerHTML = `
        <div class="postCard">
          <h3>No posts yet</h3>
          <p>This creator hasn’t published anything yet.</p>
        </div>
      `;
      if (els.postsHint) els.postsHint.textContent = "";
      return;
    }

    const postApi = window.OnlyPawsPost || null;

    if (!postApi?.buildPostCard) {
      els.posts.innerHTML = "";
      if (els.postsHint) {
        els.postsHint.textContent = "Post renderer not available.";
      }
      return;
    }

    const enriched = enrichPostsForRenderer(posts);

    els.posts.innerHTML = enriched
      .map((post) =>
        postApi.buildPostCard(post, {
          creatorUsername: post.creator_username,
          creatorDisplayName: post.creator_name,
          creatorAvatarUrl: post.creator_avatar_url,
          canViewFull: post.can_view === true,
          liked: post.liked === true,
          viewerCanComment: true,
        })
      )
      .join("");

    if (els.postsHint) els.postsHint.textContent = "";

    await initRenderedPosts(els.posts);
  }

  async function getFollowRowId(fanId, creatorId) {
    const { data, error } = await client
      .from("followers")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("fan_id", fanId)
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  async function getSubscription(creatorId, fanId) {
    const { data, error } = await client
      .from("fan_subscriptions")
      .select(
        "id,status,current_period_end,cancel_at_period_end,provider_subscription_id"
      )
      .eq("creator_id", creatorId)
      .eq("fan_id", fanId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function getCreatorEligibility(creatorId) {
    if (!creatorId) return false;

    const { data, error } = await client
      .from("profiles")
      .select(
        "role,stripe_onboarding_status,charges_enabled,stripe_connect_account_id"
      )
      .eq("user_id", creatorId)
      .maybeSingle();

    if (error) throw error;
    return creatorEligible(data);
  }

  function updateActionRow() {
    const isGuest = !state.viewerId;
    const isSelf = !!state.isSelf;

    if (els.actionRow) {
      els.actionRow.hidden = false;
    }

    if (els.followBtn) {
      els.followBtn.hidden = isSelf;
    }

    if (els.premiumBtn) {
      els.premiumBtn.hidden = isSelf;
    }

    if (els.shareProfileBtn) {
      els.shareProfileBtn.hidden = false;
    }

    if (isGuest) {
      setHint("Public profile preview. Log in to follow or subscribe.");
      return;
    }

    if (isSelf) {
      setHint("");
      return;
    }

    setHint("");
  }

  function setFollowUI() {
    if (!els.followBtn) return;

    if (!state.viewerId) {
      els.followBtn.textContent = "Follow";
      return;
    }

    els.followBtn.textContent = state.followRowId ? "Unfollow" : "Follow";
  }

  function setPremiumUI() {
    const btn = els.premiumBtn;
    if (!btn) return;

    if (state.isSelf) {
      return;
    }

    if (!state.viewerId) {
      btn.textContent = "Subscribe";
      btn.disabled = false;
      return;
    }

    if (state.viewerIsCreator) {
      btn.textContent = "Coming soon";
      btn.disabled = true;
      return;
    }

    if (!state.creatorEligible) {
      btn.textContent = "Creator not ready";
      btn.disabled = true;
      return;
    }

    const access = computeAccess(state.subRow, state.creatorEligible);

    if (access.hardCanceled) {
      btn.textContent = "Subscribe again";
      btn.disabled = false;
      return;
    }

    if (!access.rawActive) {
      btn.textContent = "Subscribe";
      btn.disabled = false;
      return;
    }

    if (access.canceling) {
      btn.textContent = "Resume (keep access)";
      btn.disabled = false;
      return;
    }

    btn.textContent = "Subscribed ✓ (Cancel)";
    btn.disabled = false;
  }

  async function copyProfileLink() {
    const shareKey = state.creatorUsername || state.creator?.user_id;
    if (!shareKey) return;

    try {
      const href = creatorProfileHref(shareKey);
      const absoluteUrl = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      toast("Profile link copied ✅");
    } catch (_) {
      toast("Could not copy link");
    }
  }

  async function shareProfile() {
    const shareKey = state.creatorUsername || state.creator?.user_id;
    if (!shareKey || !state.creator) return;

    const href = creatorProfileHref(shareKey);
    const absoluteUrl = new URL(href, window.location.origin).toString();
    const title =
      state.creator.display_name ||
      state.creator.username ||
      "OnlyPaws creator";
    const text = `Check out ${title} on OnlyPaws 🐾`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return;
      } catch (_) {}
    }

    await copyProfileLink();
  }

  async function bindFollow() {
    if (!els.followBtn || !state.creator || state.isSelf) return;
    if (els.followBtn.dataset.bound === "1") return;
    els.followBtn.dataset.bound = "1";

    setFollowUI();

    els.followBtn.addEventListener("click", async () => {
      if (!state.viewerId) {
        goFansAuth();
        return;
      }

      try {
        if (state.followRowId) {
          setBtnBusy(els.followBtn, true, "Unfollowing…");

          const { error } = await client
            .from("followers")
            .delete()
            .eq("id", state.followRowId)
            .eq("fan_id", state.viewerId);

          if (error) throw error;
          state.followRowId = null;
        } else {
          setBtnBusy(els.followBtn, true, "Following…");

          const { data, error } = await client
            .from("followers")
            .insert({
              creator_id: state.creator.user_id,
              fan_id: state.viewerId,
            })
            .select("id")
            .maybeSingle();

          if (error) throw error;
          state.followRowId = data?.id || null;
        }

        setFollowUI();
      } catch (error) {
        alert(error?.message || String(error));
      } finally {
        setBtnBusy(
          els.followBtn,
          false,
          state.followRowId ? "Unfollow" : "Follow"
        );
      }
    });
  }

  async function bindPremium() {
    if (!els.premiumBtn || !state.creator || state.isSelf) return;
    if (els.premiumBtn.dataset.bound === "1") return;
    els.premiumBtn.dataset.bound = "1";

    els.premiumBtn.addEventListener("click", async () => {
      if (!state.viewerId) {
        goFansAuth();
        return;
      }

      if (state.viewerIsCreator) {
        setHint("⏳ Creator → creator subscriptions are coming later.");
        return;
      }

      if (!state.creatorEligible) {
        setHint("⚠️ This creator isn’t ready for subscriptions yet.");
        return;
      }

      window.location.href = subscriptionsHref(state.creator.user_id);
    });
  }

  async function loadCreatorByParam(param) {
    const cleaned = String(param || "").trim();

    const { data, error } = await client.rpc(
      "get_public_creator_profile_preview",
      { p_u: cleaned }
    );

    if (error) throw error;

    const creator = Array.isArray(data) ? data[0] : data;
    if (!creator) throw new Error("Creator not found");
    if (creator.role !== "creator") {
      throw new Error("This user is not a creator");
    }

    return creator;
  }

  async function boot() {
    const { data: sess } = await client.auth.getSession();
    const session = sess?.session || null;

    state.viewerId = session?.user?.id || null;
    state.viewerRole = "";
    state.viewerIsCreator = false;
    state.followRowId = null;
    state.subRow = null;
    state.isSelf = false;
    state.creatorEligible = false;

    if (state.viewerId) {
      const { data: vp } = await client
        .from("profiles")
        .select("role")
        .eq("user_id", state.viewerId)
        .maybeSingle();

      state.viewerRole = vp?.role || "";
      state.viewerIsCreator = state.viewerRole === "creator";
    }

    const { u } = getParams();
    if (!u) {
      goHome();
      return;
    }

    try {
      const creator = await loadCreatorByParam(u);

      state.creator = creator;
      state.isSelf = !!state.viewerId && creator.user_id === state.viewerId;

      renderCreator(creator);
      updateActionRow();

      if (state.viewerId && !state.isSelf) {
        try {
          state.creatorEligible = await getCreatorEligibility(creator.user_id);
        } catch (error) {
          console.warn("creator eligibility lookup failed", error);
          state.creatorEligible = false;
        }

        state.subRow = await getSubscription(creator.user_id, state.viewerId);
      } else {
        state.subRow = null;
        state.creatorEligible = false;
      }

      const tasks = [
        client.rpc("get_public_creator_posts_preview", {
          p_creator_id: creator.user_id,
        }),

        client.rpc("get_public_creator_pets_preview", {
          p_owner_id: creator.user_id,
        }),
      ];

      if (state.viewerId && !state.isSelf) {
        tasks.unshift(getFollowRowId(state.viewerId, creator.user_id));
      } else {
        tasks.unshift(Promise.resolve(null));
      }

      const [followRowId, postsRes, petsRes] = await Promise.all(tasks);

      if (postsRes.error) throw postsRes.error;
      if (petsRes.error) throw petsRes.error;

      state.followRowId = followRowId;
      state.posts = postsRes.data || [];

      renderPets(petsRes.data || []);
      if (els.petsHint) {
        els.petsHint.textContent = petsRes.data?.length ? "" : "No pets yet.";
      }

      await renderPosts(state.posts);
      updateActionRow();
      setFollowUI();
      setPremiumUI();

      await bindFollow();
      await bindPremium();

      if (els.shareProfileBtn && els.shareProfileBtn.dataset.bound !== "1") {
        els.shareProfileBtn.dataset.bound = "1";
        els.shareProfileBtn.addEventListener("click", shareProfile);
      }
    } catch (error) {
      console.error("creator profile boot error", error);
      setHint("❌ " + (error?.message || String(error)));
      if (els.petsHint) els.petsHint.textContent = "";
      if (els.postsHint) els.postsHint.textContent = "";
    }
  }

  async function initPage() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    client.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        boot().catch((err) => {
          console.error("creator profile re-boot error", err);
        });
      }
    });

    await boot();
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();
