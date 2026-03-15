/* =========================================================
   OnlyPaws
   File: /js/app/fans/creator-profile.js
   Purpose:
   Fan-side creator profile page logic.

   Handles:
   - loading creator profile
   - pets list
   - posts rendering
   - follow / unfollow
   - subscription state UI
   - premium post access checks
   - creator social links
   - share profile button

   Premium access is granted only when:
   - creator is eligible (Stripe onboarding completed)
   - AND fan subscription is still valid.

   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPPartials
   - window.OPNav
   - window.OnlyPawsPostCard (optional)
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
    creatorAvatar: document.getElementById("creatorAvatar"),

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

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
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
    if (text != null) {
      btn.textContent = text;
    }
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
      if (!cleaned.startsWith("@")) {
        cleaned = `@${cleaned}`;
      }
      return `https://tiktok.com/${cleaned}`;
    }

    return raw;
  }

  function displaySocialLabel(url, fallback) {
    const value = String(url || "").trim();
    if (!value) return fallback;

    try {
      const parsed = new URL(value);
      const path = parsed.pathname.replace(/^\/+/, "");
      return path || fallback;
    } catch (_) {
      return fallback;
    }
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
    window.location.replace(PATHS?.home || PATHS?.index || "index.html");
  }

  function subscriptionsHref(creatorId) {
    if (ROUTES?.href) {
      return ROUTES.href("app.fans.subscriptions", { creator: creatorId });
    }
    const base = PATHS?.app?.fans?.subscriptions || "subscriptions.html";
    return `${base}?creator=${encodeURIComponent(creatorId)}`;
  }

  function publicCreatorProfileHref(usernameOrId) {
    if (!usernameOrId) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: usernameOrId });
    }

    const base = PATHS?.app?.fans?.creatorProfile || "creator-profile.html";
    return `${base}?u=${encodeURIComponent(usernameOrId)}`;
  }

  function profileHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.profile") || "profile.html";
    }
    return PATHS?.app?.profile || "profile.html";
  }

  function fanDashHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.fans.fanDash") || "fan-dash.html";
    }
    return PATHS?.app?.fans?.fanDash || "fan-dash.html";
  }

  function creatorDashHref() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "creator-dash.html";
    }
    return PATHS?.app?.creators?.creatorDash || "creator-dash.html";
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
    const instagramUrl = normalizeSocialUrl(creator?.instagram_url || "", "instagram");
    const tiktokUrl = normalizeSocialUrl(creator?.tiktok_url || "", "tiktok");

    let hasSocials = false;

    if (els.creatorInstagram) {
      if (instagramUrl) {
        els.creatorInstagram.href = instagramUrl;
        els.creatorInstagram.textContent = displaySocialLabel(instagramUrl, "Instagram");
        els.creatorInstagram.hidden = false;
        hasSocials = true;
      } else {
        els.creatorInstagram.hidden = true;
      }
    }

    if (els.creatorTikTok) {
      if (tiktokUrl) {
        els.creatorTikTok.href = tiktokUrl;
        els.creatorTikTok.textContent = displaySocialLabel(tiktokUrl, "TikTok");
        els.creatorTikTok.hidden = false;
        hasSocials = true;
      } else {
        els.creatorTikTok.hidden = true;
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

    if (els.creatorName) els.creatorName.textContent = name;
    if (els.creatorHandle) els.creatorHandle.textContent = "@" + uname;
    if (els.creatorBio) els.creatorBio.textContent = bio;

    state.creatorUsername = uname;

    if (els.creatorAvatar) {
      if (c.avatar_url) {
        els.creatorAvatar.innerHTML =
          `<img src="${esc(c.avatar_url)}" alt="Creator avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
      } else {
        els.creatorAvatar.textContent = "🐾";
      }
    }

    renderCreatorSocials(c);
  }

  function renderPets(list) {
    if (!els.petsList) return;

    if (!list?.length) {
      els.petsList.innerHTML = "";
      return;
    }

    els.petsList.innerHTML = list.map((pet) => {
      const name = pet.name || "Pet";
      const line = [pet.species, pet.breed].filter(Boolean).join(" • ");
      const av = (pet.avatar_url || "").trim()
        ? `<img src="${esc(pet.avatar_url)}" alt="Pet avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : "🐾";

      return `
        <div class="petCard">
          <div class="petAvatar">${av}</div>
          <div>
            <b>${esc(name)}</b>
            <span>${esc(line || " ")}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function lockedOverlayHtml() {
    return `
      <div class="lockedOverlay">
        <div class="lockedBox">
          <b>🔒 Premium post</b>
          <div class="small">Subscribe to unlock all premium posts from this creator.</div>
          <div class="ctaRow">
            <button class="ghost" type="button" data-action="premium">Subscribe</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPosts(posts) {
    if (!els.posts) return;

    if (!posts.length) {
      els.posts.innerHTML = `
        <div class="postCard">
          <h3>No posts yet</h3>
          <p>This creator hasn’t published anything yet.</p>
        </div>
      `;
      return;
    }

    const access = computeAccess(state.subRow, state.creatorEligible);

    if (window.OnlyPawsPostCard?.renderPostCard) {
      els.posts.innerHTML = posts.map((post) => {
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

        return window.OnlyPawsPostCard.renderPostCard({
          id: post.id,
          creator_username: state.creatorUsername,
          title: post.title || "Post",
          excerpt: canView
            ? (post.content || post.preview || "")
            : (post.preview || "Locked content."),
          is_locked: !canView,
          media_url: post.media_url || null,
          media_type: post.media_type || null,
        });
      }).join("");

      if (window.OnlyPawsPostCard?.initPostCards) {
        window.OnlyPawsPostCard.initPostCards(els.posts);
      }

      bindLockedSubscribeButtons();
      return;
    }

    els.posts.innerHTML = posts.map((post) => {
      const who = state.creatorUsername ? `@${state.creatorUsername}` : "@creator";
      const title = post.title || "Post";
      const fullText = post.content || post.preview || "";
      const preview = post.preview || "Subscribe to unlock this post.";

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

      const badgeLabel = isPremium
        ? "🔒 PREMIUM"
        : (isPrivate ? "🙈 PRIVATE" : "🆓 FREE");

      return `
        <div class="postCard ${canView ? "" : "isLocked"}" data-postid="${esc(post.id)}">
          <div class="postTop">
            <div class="badge">${esc(who)}</div>
            <div class="badge">${badgeLabel}</div>
          </div>

          <h3>${esc(title)}</h3>

          ${post.media_url ? `
            <div class="mediaWrap">
              ${String(post.media_type || "").startsWith("video")
                ? `<video controls playsinline src="${esc(post.media_url)}"></video>`
                : `<img src="${esc(post.media_url)}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer">`}
            </div>
          ` : ""}

          <div class="postText">
            <p>${esc(canView ? fullText : preview)}</p>
          </div>

          ${canView ? "" : lockedOverlayHtml()}
        </div>
      `;
    }).join("");

    bindLockedSubscribeButtons();
  }

  function bindLockedSubscribeButtons() {
    if (!els.posts) return;

    els.posts.querySelectorAll('[data-action="premium"]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!state.creator?.user_id) return;
        window.location.href = subscriptionsHref(state.creator.user_id);
      });
    });
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
      .select("id,status,current_period_end,cancel_at_period_end,provider_subscription_id")
      .eq("creator_id", creatorId)
      .eq("fan_id", fanId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  function setPremiumUI(success = "", sessionId = "") {
    const btn = els.premiumBtn;
    if (!btn) return;

    if (state.viewerIsCreator) {
      btn.textContent = "Coming soon";
      btn.disabled = true;
      btn.title = "Creators can’t subscribe yet.";
      return;
    }

    if (!state.creatorEligible) {
      btn.textContent = "Creator not ready";
      btn.disabled = true;
      btn.title = "Creator not ready yet (Stripe setup incomplete).";
      return;
    }

    const access = computeAccess(state.subRow, state.creatorEligible);

    if (access.hardCanceled) {
      btn.textContent = "Subscribe again";
      btn.disabled = false;
      btn.title = "";
      if (!(success === "1" || sessionId)) {
        setHint("⚠️ This subscription was canceled and can’t be resumed. Subscribe again to renew.");
      }
      return;
    }

    if (!access.rawActive) {
      btn.textContent = "Subscribe";
      btn.disabled = false;
      btn.title = "";
      return;
    }

    if (access.canceling) {
      btn.textContent = "Resume (keep access)";
      btn.disabled = false;
      btn.title = "";

      if (!(success === "1" || sessionId)) {
        const d = state.subRow?.current_period_end
          ? new Date(state.subRow.current_period_end).toLocaleDateString()
          : "";
        setHint(d ? `Cancels on ${d} — resume anytime.` : "Cancels at period end — resume anytime.");
      }
      return;
    }

    btn.textContent = "Subscribed ✓ (Cancel)";
    btn.disabled = false;
    btn.title = "";
  }

  async function hydrateHeaderActions() {
    const navProfile = document.getElementById("navProfile");
    const navFanDash = document.getElementById("navFanDash");
    const navCreatorDash = document.getElementById("navCreatorDash");
    const navLogout = document.getElementById("navLogout");
    const userPill = document.getElementById("userPill");

    if (navProfile) {
      navProfile.hidden = false;
      navProfile.href = profileHref();
    }

    if (navLogout) {
      navLogout.hidden = false;
      navLogout.addEventListener("click", async (event) => {
        event.preventDefault();
        navLogout.disabled = true;
        navLogout.textContent = "Logging out…";

        try {
          await client.auth.signOut();
        } catch (_) {}

        goHome();
      });
    }

    try {
      const { data: sessData } = await client.auth.getSession();
      const session = sessData?.session;

      if (!session) {
        if (userPill) userPill.textContent = "Guest";
        return;
      }

      const uid = session.user.id;
      const email = session.user.email || "";

      const { data: prof } = await client
        .from("profiles")
        .select("username, display_name, role")
        .eq("user_id", uid)
        .maybeSingle();

      const uname = (prof?.username || "").trim();
      const dname = (prof?.display_name || "").trim();

      if (userPill) {
        if (uname) userPill.textContent = "@" + uname;
        else if (dname) userPill.textContent = dname;
        else if (email) userPill.textContent = email.split("@")[0];
        else userPill.textContent = "User";
      }

      if (prof?.role === "creator") {
        if (navCreatorDash) {
          navCreatorDash.hidden = false;
          navCreatorDash.href = creatorDashHref();
        }
        if (navFanDash) navFanDash.hidden = true;
      } else {
        if (navFanDash) {
          navFanDash.hidden = false;
          navFanDash.href = fanDashHref();
        }
        if (navCreatorDash) navCreatorDash.hidden = true;
      }
    } catch (_) {}
  }

  async function copyProfileLink() {
    const shareKey = state.creatorUsername || state.creator?.user_id;
    if (!shareKey) return;

    try {
      const href = publicCreatorProfileHref(shareKey);
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

    const href = publicCreatorProfileHref(shareKey);
    const absoluteUrl = new URL(href, window.location.origin).toString();
    const title = state.creator.display_name || state.creator.username || "OnlyPaws creator";
    const text = `Check out ${title} on OnlyPaws 🐾`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: absoluteUrl,
        });
        return;
      } catch (_) {}
    }

    await copyProfileLink();
  }

  async function bindFollow() {
    if (!els.followBtn || !state.creator || state.isSelf) return;

    function setFollowUi() {
      els.followBtn.textContent = state.followRowId ? "Unfollow" : "Follow";
    }

    setFollowUi();

    els.followBtn.addEventListener("click", async () => {
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
            .insert({ creator_id: state.creator.user_id, fan_id: state.viewerId })
            .select("id")
            .maybeSingle();

          if (error) throw error;
          state.followRowId = data?.id || null;
        }

        setFollowUi();
      } catch (error) {
        alert(error?.message || String(error));
      } finally {
        setBtnBusy(els.followBtn, false, state.followRowId ? "Unfollow" : "Follow");
      }
    });
  }

  async function bindPremium(success = "", sessionId = "") {
    if (!els.premiumBtn || !state.creator || state.isSelf) return;

    function explainCreatorCantSubscribe() {
      setHint("⏳ Creator → creator subscriptions are coming later. For now, creators can’t subscribe.");
    }

    function explainCreatorNotReady() {
      setHint("⚠️ This creator isn’t ready for subscriptions yet (Stripe setup incomplete).");
    }

    els.premiumBtn.addEventListener("click", async () => {
      if (state.viewerIsCreator) {
        explainCreatorCantSubscribe();
        return;
      }

      if (!state.creatorEligible) {
        explainCreatorNotReady();
        return;
      }

      const access = computeAccess(state.subRow, state.creatorEligible);

      if (state.subRow && access.canceling) {
        try {
          setBtnBusy(els.premiumBtn, true, "Resuming…");

          const { data: s } = await client.auth.getSession();
          const token = s?.session?.access_token;
          if (!token) throw new Error("No session");

          const { error } = await client.functions.invoke("resume-fan-subscription", {
            body: { creator_id: state.creator.user_id },
            headers: { Authorization: `Bearer ${token}` },
          });

          if (error) throw error;

          state.subRow = await getSubscription(state.creator.user_id, state.viewerId);

          setPremiumUI(success, sessionId);
          toast("✅ Subscription resumed.");
          setHint("");

          renderPosts(state.posts);
        } catch (error) {
          alert(error?.message || String(error));
        } finally {
          setBtnBusy(els.premiumBtn, false, null);
          setPremiumUI(success, sessionId);
        }
        return;
      }

      if (state.subRow && access.rawActive && !state.subRow.cancel_at_period_end) {
        try {
          setBtnBusy(els.premiumBtn, true, "Canceling…");

          const { data: s } = await client.auth.getSession();
          const token = s?.session?.access_token;
          if (!token) throw new Error("No session");

          const { error } = await client.functions.invoke("cancel-fan-subscription", {
            body: { creator_id: state.creator.user_id },
            headers: { Authorization: `Bearer ${token}` },
          });

          if (error) throw error;

          state.subRow = await getSubscription(state.creator.user_id, state.viewerId);

          setPremiumUI(success, sessionId);

          const d = state.subRow?.current_period_end
            ? new Date(state.subRow.current_period_end).toLocaleDateString()
            : "";

          setHint(
            d
              ? `✅ Will cancel on ${d}. You can resume anytime before then.`
              : "✅ Will cancel at period end. You can resume anytime before then."
          );
        } catch (error) {
          alert(error?.message || String(error));
        } finally {
          setBtnBusy(els.premiumBtn, false, null);
          setPremiumUI(success, sessionId);
        }
        return;
      }

      window.location.href = subscriptionsHref(state.creator.user_id);
    });
  }

  async function loadCreatorByParam(param) {
    let result;

    if (isUUID(param)) {
      result = await client
        .from("profiles")
        .select("user_id, username, display_name, bio, avatar_url, role, stripe_onboarding_status, charges_enabled, stripe_connect_account_id, instagram_url, tiktok_url")
        .eq("user_id", param)
        .maybeSingle();
    } else {
      result = await client
        .from("profiles")
        .select("user_id, username, display_name, bio, avatar_url, role, stripe_onboarding_status, charges_enabled, stripe_connect_account_id, instagram_url, tiktok_url")
        .eq("username", param)
        .maybeSingle();
    }

    if (result.error) throw result.error;
    if (!result.data) throw new Error("Creator not found");
    if (result.data.role !== "creator") throw new Error("This user is not a creator");

    return result.data;
  }

  async function boot() {
    const { data: sess } = await client.auth.getSession();
    const session = sess?.session;

    if (!session) {
      goHome();
      return;
    }

    await hydrateHeaderActions();

    state.viewerId = session.user.id;

    const { data: vp } = await client
      .from("profiles")
      .select("role")
      .eq("user_id", state.viewerId)
      .maybeSingle();

    state.viewerRole = vp?.role || "";
    state.viewerIsCreator = state.viewerRole === "creator";

    const { u, success, session_id } = getParams();
    if (!u) {
      goHome();
      return;
    }

    try {
      const creator = await loadCreatorByParam(u);

      state.creator = creator;
      state.creatorEligible = creatorEligible(creator);
      state.isSelf = creator.user_id === state.viewerId;

      renderCreator(creator);

      if (els.actionRow) {
        els.actionRow.hidden = !!state.isSelf;
      }

      if (success === "1" || session_id) {
        toast("✅ Payment received — syncing subscription…");
        setHint("");
      } else {
        setHint("");
      }

      state.subRow = await getSubscription(creator.user_id, state.viewerId);

      let access = computeAccess(state.subRow, state.creatorEligible);
      let hasAccess = access.hasAccess;

      if ((success === "1" || session_id) && !hasAccess) {
        const waits = [1500, 3000, 5000];

        for (const wait of waits) {
          await new Promise((resolve) => setTimeout(resolve, wait));

          try {
            state.subRow = await getSubscription(creator.user_id, state.viewerId);
            access = computeAccess(state.subRow, state.creatorEligible);
            hasAccess = access.hasAccess;
            if (hasAccess) break;
          } catch (_) {}
        }
      }

      const [followRowId, postsRes, petsRes] = await Promise.all([
        getFollowRowId(state.viewerId, creator.user_id),
        client
          .from("posts")
          .select("id, creator_id, title, content, preview, media_url, media_type, is_paid, is_public, is_pinned, created_at")
          .eq("creator_id", creator.user_id)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(24),
        client
          .from("pets")
          .select("id, name, species, breed, avatar_url")
          .eq("owner_id", creator.user_id)
          .order("created_at", { ascending: false }),
      ]);

      state.followRowId = followRowId;
      state.posts = postsRes.data || [];

      renderPets(petsRes.data || []);
      if (els.petsHint) {
        els.petsHint.textContent = petsRes.data?.length ? "" : "No pets yet.";
      }

      renderPosts(state.posts);
      if (els.postsHint) {
        els.postsHint.textContent = state.posts.length ? "" : "No posts yet.";
      }

      if (!state.isSelf && state.viewerIsCreator) {
        setHint("⏳ Creator → creator subscriptions are coming later. For now, creators can’t subscribe.");
      }

      setPremiumUI(success, session_id);
      await bindFollow();
      await bindPremium(success, session_id);

      if (els.shareProfileBtn) {
        els.shareProfileBtn.addEventListener("click", shareProfile);
      }

      if (hasAccess && (success === "1" || session_id)) {
        setHint("✅ Subscribed! Premium posts are now unlocked.");
        const clean = new URL(window.location.href);
        clean.searchParams.delete("success");
        clean.searchParams.delete("session_id");
        window.history.replaceState({}, "", clean.toString());
      }
    } catch (error) {
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
      if (event === "SIGNED_OUT") {
        goHome();
      }
    });

    await boot();
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();