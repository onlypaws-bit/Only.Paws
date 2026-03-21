/* =========================================================
   OnlyPaws
   File: /js/app/creators/creator-dash.js
   Purpose: creator dashboard page logic

   Creator access model:
   - role = creator => can create posts
   - Creator Plan => monetization only
   - Stripe onboarding => payout / Stripe tools access

   Dependencies:
   - window.OP_PATHS
   - window.OPRoutes
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   - window.OnlyPawsPost
   - window.OnlyPawsPostCard
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const state = {
    creatorUsername: "",
    profileUserId: null,
    isCreator: false,
    canPost: false,
    creatorPlanActive: false,
    creatorPlanCanceling: false,
    payoutEnabled: false,
  };

  const els = {
    stateBox: document.getElementById("stateBox"),
    createPostBtn: document.getElementById("createPostBtn"),
    managePetsBtn: document.getElementById("managePetsBtn"),

    myPosts: document.getElementById("myPosts"),
    myPostsHint: document.getElementById("myPostsHint"),

    petsList: document.getElementById("petsList"),
    petsHint: document.getElementById("petsHint"),

    subsList: document.getElementById("subsList"),
    subsHint: document.getElementById("subsHint"),

    followersList: document.getElementById("followersList"),
    followersHint: document.getElementById("followersHint"),

    walletHint: document.getElementById("walletHint"),
    walletAvailable: document.getElementById("walletAvailable"),
    walletPending: document.getElementById("walletPending"),
    walletMsg: document.getElementById("walletMsg"),
    walletMsgText: document.getElementById("walletMsgText"),
    enablePayoutBtn: document.getElementById("enablePayoutBtn"),
    refreshWalletBtn: document.getElementById("refreshWalletBtn"),

    earningsHint: document.getElementById("earningsHint"),
    earningsTable: document.getElementById("earningsTable"),
  };

  function routeGet(pathValue, fallback) {
    return pathValue || fallback;
  }

  function homeHref() {
    if (ROUTES?.get) {
      return ROUTES.get("home") || ROUTES.get("index") || "/";
    }
    return routeGet(PATHS?.home, routeGet(PATHS?.index, "/"));
  }

  function profileUrl(username) {
    if (ROUTES?.href && username) {
      return ROUTES.href("app.shared.profile", { u: username });
    }
    if (ROUTES?.get) {
      return ROUTES.get("app.shared.profile") || "/html/app/profile.html";
    }
    const base =
      PATHS?.app?.profile ||
      PATHS?.profile ||
      "/html/app/profile.html";
    return username ? `${base}?u=${encodeURIComponent(username)}` : base;
  }

  function creatorCreatePostUrl(editId = "", username = "") {
    if (ROUTES?.href) {
      const params = {};
      if (editId) params.edit = editId;
      if (username) params.u = username;
      return ROUTES.href("app.creators.createPost", params);
    }

    const base =
      PATHS?.app?.creators?.createPost ||
      "/html/app/creators/create-post.html";

    const qs = new URLSearchParams();
    if (editId) qs.set("edit", editId);
    if (username) qs.set("u", username);

    const suffix = qs.toString();
    return suffix ? `${base}?${suffix}` : base;
  }

  function creatorPetsUrl() {
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.pets") || "/html/app/creators/pets.html";
    }
    return PATHS?.app?.creators?.pets || "/html/app/creators/pets.html";
  }

  function creatorFanProfileUrl(username) {
    if (ROUTES?.href) {
      return ROUTES.href("app.creators.fanProfile", { u: username || "" });
    }

    const base =
      PATHS?.app?.creators?.fanProfile ||
      "/html/app/creators/fan-profile.html";

    return `${base}?u=${encodeURIComponent(username || "")}`;
  }

  function creatorPayoutSetupPath(doneState) {
    const base =
      PATHS?.app?.creators?.payoutsSetup ||
      "/html/app/creators/payouts-setup.html";

    if (ROUTES?.href) {
      return ROUTES.href(
        "app.creators.payoutsSetup",
        doneState ? { done: 1 } : { retry: 1 }
      );
    }

    return doneState ? `${base}?done=1` : `${base}?retry=1`;
  }

  function goHome() {
    window.location.replace(homeHref());
  }

  function esc(value) {
    return (value ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtEUR(cents) {
    const amount = Number(cents || 0);
    return "€" + (amount / 100).toFixed(2);
  }

  function setElementBusy(element, isBusy, busyText, idleText) {
    if (!element) return;

    if ("disabled" in element) {
      element.disabled = !!isBusy;
    }

    element.setAttribute("aria-disabled", isBusy ? "true" : "false");
    element.classList.toggle("isBusy", !!isBusy);
    element.classList.toggle("isDisabled", !!isBusy);

    if (busyText != null && isBusy) {
      element.textContent = busyText;
    } else if (idleText != null && !isBusy) {
      element.textContent = idleText;
    }
  }

  function enableAction(element, enabled) {
  if (!element) return;

  if ("disabled" in element) {
    element.disabled = !enabled;
  }

  if (enabled) {
    element.removeAttribute("aria-disabled");
    element.removeAttribute("tabindex");
  } else {
    element.setAttribute("aria-disabled", "true");

    if (element.tagName === "A") {
      element.setAttribute("tabindex", "-1");
    }
  }

  element.classList.toggle("isDisabled", !enabled);
  element.classList.toggle("dashboardIsDisabled", !enabled);
}

  function setStateBox(title, text, extrasHtml = "") {
    if (!els.stateBox) return;

    els.stateBox.innerHTML = `
      <b>${esc(title)}</b>
      <div class="hint">${esc(text || "").replaceAll("\n", "<br/>")}</div>
      ${extrasHtml || ""}
    `;
  }

  function showWalletMsg(title, text) {
    if (!els.walletMsg) return;

    els.walletMsg.hidden = false;

    const titleEl = els.walletMsg.querySelector("b");
    if (titleEl) titleEl.textContent = title;
    if (els.walletMsgText) els.walletMsgText.textContent = text || "";
  }

  function hideWalletMsg() {
    if (els.walletMsg) els.walletMsg.hidden = true;
    if (els.walletMsgText) els.walletMsgText.textContent = "";
  }

  function extractInvokeErrorDetails(error) {
    try {
      const message = error?.message || String(error);
      const ctxBody = error?.context?.body;
      const extra = ctxBody
        ? (typeof ctxBody === "string" ? ctxBody : JSON.stringify(ctxBody))
        : "";

      return extra ? `${message} — ${extra}` : message;
    } catch (_) {
      return error?.message || String(error);
    }
  }

  function attachOnce(element, key, eventName, handler) {
    if (!element || element.dataset[key] === "1") return;
    element.dataset[key] = "1";
    element.addEventListener(eventName, handler);
  }

  async function hasActiveCreatorPlan(userId) {
    try {
      const { data, error } = await client
        .from("entitlements")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", userId)
        .eq("key", "creator_plan")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        state.creatorPlanCanceling = false;
        return false;
      }

      const status = String(data.status || "").toLowerCase();
      const currentPeriodEndMs = data.current_period_end
        ? new Date(data.current_period_end).getTime()
        : 0;
      const now = Date.now();

      state.creatorPlanCanceling = !!data.cancel_at_period_end;

      if (["active", "trialing", "past_due"].includes(status)) return true;
      if (status === "canceled" && currentPeriodEndMs && currentPeriodEndMs > now) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn("hasActiveCreatorPlan error:", error);
      state.creatorPlanCanceling = false;
      return false;
    }
  }

  async function getCreatorPlanStatus(userId) {
    try {
      const { data, error } = await client
        .from("entitlements")
        .select("status, current_period_end, cancel_at_period_end, stripe_subscription_id")
        .eq("user_id", userId)
        .eq("key", "creator_plan")
        .maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("getCreatorPlanStatus error:", error);
      return null;
    }
  }

  function renderEmptyState(title, hint) {
    return `
      <div class="locked">
        <b>${esc(title)}</b>
        <div class="hint">${esc(hint)}</div>
      </div>
    `;
  }

  function renderErrorState(title, message) {
    return `
      <div class="locked">
        <b>${esc(title)}</b>
        <div class="hint">${esc(message)}</div>
      </div>
    `;
  }

  function mediaBlock(post) {
    if (!post?.media_url) return "";

    const url = esc(post.media_url);
    const isVideo =
      String(post.media_type || "").toLowerCase() === "video" ||
      String(post.media_type || "").toLowerCase().startsWith("video");

    if (isVideo) {
      return `<div class="mediaWrap"><video controls playsinline src="${url}"></video></div>`;
    }

    return `<div class="mediaWrap"><img src="${url}" alt="Post media" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
  }

  function renderReusablePostCard(post) {
    const title = post.title || "Untitled";
    const id = post.id;

    if (window.OnlyPawsPostCard?.renderPostCard) {
      return window.OnlyPawsPostCard.renderPostCard({
        id,
        creator_username: state.creatorUsername || "creator",
        title,
        excerpt: post.content || post.preview || "",
        price_cents: null,
        currency: "eur",
        is_locked: false,
        media_url: post.media_url || null,
        media_type: post.media_type || null,
      });
    }

    if (window.OnlyPawsPost?.renderPost) {
      return window.OnlyPawsPost.renderPost({
        id,
        creator_username: state.creatorUsername || "creator",
        title,
        content: post.content || "",
        excerpt: post.preview || post.content || "",
        price_cents: post.is_paid ? (post.price_cents ?? 0) : null,
        currency: "eur",
        is_locked: false,
        media_url: post.media_url || null,
        media_type: post.media_type || null,
        created_at: post.created_at || null,
      });
    }

    return "";
  }

  function initReusablePostCards() {
    if (window.OnlyPawsPostCard?.initPostCards && els.myPosts) {
      window.OnlyPawsPostCard.initPostCards(els.myPosts);
      return;
    }

    if (window.OnlyPawsPost?.initPosts && els.myPosts) {
      window.OnlyPawsPost.initPosts(els.myPosts);
    }
  }

  function renderMyPosts(posts) {
    if (!els.myPosts) return;

    if (!posts || posts.length === 0) {
      els.myPosts.innerHTML = renderEmptyState(
        "No posts yet",
        "Create your first post to see it here."
      );
      return;
    }

    const canUseReusable =
      !!window.OnlyPawsPostCard?.renderPostCard || !!window.OnlyPawsPost?.renderPost;

    if (canUseReusable) {
      els.myPosts.innerHTML = posts.map((post) => {
        const date = post.created_at ? new Date(post.created_at).toLocaleString() : "";
        const visibilityLabel = post.is_public ? "🌍 PUBLIC" : "🙈 PRIVATE";
        const typeLabel = post.is_paid ? "🔒 PREMIUM" : "🆓 FREE";

        return `
          <div class="rowCard" data-post-id="${esc(post.id)}">
            <div class="postMeta" style="width:100%;">
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
                <span class="badge">${typeLabel}</span>
                <span class="badge">${visibilityLabel}</span>
                ${date ? `<span class="badge">${esc(date)}</span>` : ""}
              </div>
              ${renderReusablePostCard(post)}
            </div>

            <div class="postActions">
              <a class="ghost" href="${creatorCreatePostUrl(post.id)}">Edit</a>
              <button class="ghost danger" type="button" data-action="delete">Delete</button>
            </div>
          </div>
        `;
      }).join("");

      initReusablePostCards();
      return;
    }

    els.myPosts.innerHTML = posts.map((post) => {
      const title = post.title || "Untitled";
      const previewText = post.preview || (post.content ? String(post.content).slice(0, 90) : "");
      const date = post.created_at ? new Date(post.created_at).toLocaleString() : "";
      const visibilityLabel = post.is_public ? "🌍 PUBLIC" : "🙈 PRIVATE";
      const typeLabel = post.is_paid ? "🔒 PREMIUM" : "🆓 FREE";

      return `
        <div class="rowCard" data-post-id="${esc(post.id)}">
          <div class="postMeta">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
              <span class="badge">${typeLabel}</span>
              <span class="badge">${visibilityLabel}</span>
              ${date ? `<span class="badge">${esc(date)}</span>` : ""}
            </div>

            <b>${esc(title)}</b>
            ${mediaBlock(post)}
            <div class="small" style="margin-top:8px;">${esc(previewText || "")}</div>
          </div>

          <div class="postActions">
            <a class="ghost" href="${creatorCreatePostUrl(post.id)}">Edit</a>
            <button class="ghost danger" type="button" data-action="delete">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function bindDeleteHandlers() {
    if (!els.myPosts || els.myPosts.dataset.deleteBound === "1") return;

    els.myPosts.dataset.deleteBound = "1";

    els.myPosts.addEventListener("click", async (event) => {
      const button = event.target.closest('[data-action="delete"]');
      if (!button) return;

      const row = button.closest(".rowCard");
      const postId = row?.getAttribute("data-post-id");
      if (!postId) return;

      if (!window.confirm("Delete this post? This can’t be undone.")) return;

      setElementBusy(button, true, "Deleting…");

      try {
        const { data } = await client.auth.getUser();
        const userId = data?.user?.id;

        const { error } = await client
          .from("posts")
          .delete()
          .eq("id", postId)
          .eq("creator_id", userId);

        if (error) throw error;

        row.remove();

        if (els.myPostsHint) {
          els.myPostsHint.textContent = "Deleted ✅";
        }

        if (!els.myPosts.querySelector(".rowCard")) {
          renderMyPosts([]);
          if (els.myPostsHint) {
            els.myPostsHint.textContent = "No posts yet.";
          }
        }
      } catch (error) {
        setElementBusy(button, false, null, "Delete");
        alert("❌ Delete failed: " + (error?.message || String(error)));
      }
    });
  }

  function renderPets(pets) {
    if (!els.petsList) return;

    if (!pets || pets.length === 0) {
      els.petsList.innerHTML = renderEmptyState(
        "No pets yet",
        "Add your first pet in Pets."
      );
      return;
    }

    els.petsList.innerHTML = pets.map((pet) => {
      const name = pet.name || "Pet";
      const species = pet.species ? `• ${pet.species}` : "";
      const breed = pet.breed ? `• ${pet.breed}` : "";
      const age = pet.age_years != null ? `• ${pet.age_years}y` : "";
      const bio = pet.bio || "";

      const avatarHtml = pet.avatar_url
        ? `<div class="petAvatarMini"><img src="${esc(pet.avatar_url)}" alt="pet avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
        : `<div class="petAvatarMini">🐾</div>`;

      return `
        <div class="rowCard">
          <div class="petMeta">
            <div class="petLine">
              ${avatarHtml}
              <b style="margin:0;">${esc(name)} ${esc(species)} ${esc(breed)} ${esc(age)}</b>
            </div>
            <div class="small">${esc(bio)}</div>
          </div>

          <div class="postActions">
            <a class="ghost" href="${creatorPetsUrl()}">Manage</a>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderSubs(subscriptions) {
    if (!els.subsList) return;

    if (!subscriptions || subscriptions.length === 0) {
      els.subsList.innerHTML = renderEmptyState(
        "No subscribers yet",
        "Subscriptions will show here."
      );
      return;
    }

    const now = Date.now();

    const visible = subscriptions.filter((subscription) => {
      const status = String(subscription.status || "").toLowerCase();
      const periodEndMs = subscription.current_period_end
        ? new Date(subscription.current_period_end).getTime()
        : 0;

      return ["active", "trialing", "past_due"].includes(status) || (periodEndMs && periodEndMs > now);
    });

    if (visible.length === 0) {
      els.subsList.innerHTML = renderEmptyState(
        "No active subscribers",
        "Subscriptions will appear here while access is valid."
      );
      return;
    }

    els.subsList.innerHTML = visible.map((subscription) => {
      const name = subscription.fan_display_name || subscription.fan_username || "Subscriber";
      const usernameRaw = (subscription.fan_username || "").trim();
      const usernameLabel = usernameRaw ? `@${usernameRaw}` : "";
      const sinceDate = subscription.created_at
        ? new Date(subscription.created_at).toLocaleDateString()
        : "";

      const periodEndMs = subscription.current_period_end
        ? new Date(subscription.current_period_end).getTime()
        : 0;
      const hasAccess = !!periodEndMs && periodEndMs > now;
      const endDate = subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString()
        : "";

      const status = String(subscription.status || "").toLowerCase();
      const cancelAtPeriodEnd = !!subscription.cancel_at_period_end && hasAccess;

      let badgeText = "Active";
      let badgeIcon = "💜";

      if (status === "trialing") {
        badgeText = "Trial";
        badgeIcon = "✨";
      } else if (status === "past_due") {
        badgeText = "Past due";
        badgeIcon = "⚠️";
      } else if (cancelAtPeriodEnd && endDate) {
        badgeText = "Cancels at period end";
        badgeIcon = "⏳";
      } else if (!hasAccess && status === "canceled") {
        badgeText = "Canceled";
        badgeIcon = "❌";
      } else if (!hasAccess && status === "expired") {
        badgeText = "Expired";
        badgeIcon = "❌";
      }

      const avatarHtml = subscription.fan_avatar_url
        ? `<div class="avatarMini"><img src="${esc(subscription.fan_avatar_url)}" alt="avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
        : `<div class="avatarMini">🐾</div>`;

      const renewText = endDate
        ? (
            cancelAtPeriodEnd
              ? `Access until ${endDate}`
              : (hasAccess ? `Renews ${endDate}` : `Ended ${endDate}`)
          )
        : "";

      const metaLine = [sinceDate ? `Subscribed: ${sinceDate}` : "", renewText]
        .filter(Boolean)
        .join(" • ");

      const clickableClass = usernameRaw ? "clickable" : "";

      return `
        <div class="rowCard ${clickableClass}" data-username="${esc(usernameRaw)}">
          <div class="postMeta">
            <div class="subLine">
              ${avatarHtml}
              <div style="display:flex;flex-direction:column;gap:2px;">
                <b style="margin:0;">
                  ${esc(name)}
                  ${usernameLabel ? `<span style="opacity:.85;font-weight:700;">${esc(usernameLabel)}</span>` : ""}
                </b>
                <span class="small" style="opacity:.9;">${esc(metaLine)}</span>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center">
            <span class="badge">${badgeIcon} ${esc(badgeText)}</span>
          </div>
        </div>
      `;
    }).join("");

    els.subsList.querySelectorAll(".rowCard.clickable").forEach((row) => {
      const username = (row.getAttribute("data-username") || "").trim();
      if (!username) return;

      row.addEventListener("click", () => {
        window.location.href = creatorFanProfileUrl(username);
      });
    });
  }

  function renderFollowers(followers) {
    if (!els.followersList) return;

    if (!followers || followers.length === 0) {
      els.followersList.innerHTML = renderEmptyState(
        "No followers yet",
        "Free followers will show up here."
      );
      return;
    }

    els.followersList.innerHTML = followers.map((follower) => {
      const name = follower.fan_display_name || follower.fan_username || "Follower";
      const usernameRaw = (follower.fan_username || "").trim();
      const usernameLabel = usernameRaw ? `@${usernameRaw}` : "";
      const sinceDate = follower.created_at
        ? new Date(follower.created_at).toLocaleDateString()
        : "";

      const avatarHtml = follower.fan_avatar_url
        ? `<div class="avatarMini"><img src="${esc(follower.fan_avatar_url)}" alt="avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
        : `<div class="avatarMini">🐾</div>`;

      const clickableClass = usernameRaw ? "clickable" : "";
      const metaLine = sinceDate ? `Followed: ${sinceDate}` : "Followed";

      return `
        <div class="rowCard ${clickableClass}" data-username="${esc(usernameRaw)}">
          <div class="postMeta">
            <div class="subLine">
              ${avatarHtml}
              <div style="display:flex;flex-direction:column;gap:2px;">
                <b style="margin:0;">
                  ${esc(name)}
                  ${usernameLabel ? `<span style="opacity:.85;font-weight:700;">${esc(usernameLabel)}</span>` : ""}
                </b>
                <span class="small" style="opacity:.9;">${esc(metaLine)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    els.followersList.querySelectorAll(".rowCard.clickable").forEach((row) => {
      const username = (row.getAttribute("data-username") || "").trim();
      if (!username) return;

      row.addEventListener("click", () => {
        window.location.href = creatorFanProfileUrl(username);
      });
    });
  }

  async function loadMyPosts(session) {
    if (!els.myPostsHint || !els.myPosts) return;

    els.myPostsHint.textContent = "Loading…";
    els.myPosts.innerHTML = "";

    try {
      const { data, error } = await client
        .from("posts")
        .select("id, title, content, preview, media_url, media_type, is_paid, is_public, created_at")
        .eq("creator_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      renderMyPosts(data || []);
      els.myPostsHint.textContent = data?.length ? "Loaded ✅" : "No posts yet.";
    } catch (error) {
      els.myPostsHint.textContent = "Couldn’t load posts";
      els.myPosts.innerHTML = renderErrorState("Posts list error", error?.message || String(error));
    }
  }

  async function loadPets(session) {
    if (!els.petsHint || !els.petsList) return;

    els.petsHint.textContent = "Loading…";
    els.petsList.innerHTML = "";

    try {
      const { data, error } = await client
        .from("pets")
        .select("id, name, species, breed, age_years, bio, avatar_url, created_at, owner_id")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      renderPets(data || []);
      els.petsHint.textContent = data?.length ? "Loaded ✅" : "No pets yet.";
    } catch (error) {
      els.petsHint.textContent = "Couldn’t load pets";
      els.petsList.innerHTML = renderErrorState("Pets list error", error?.message || String(error));
    }
  }

  async function loadAudience(session) {
    if (!els.subsHint || !els.followersHint || !els.subsList || !els.followersList) return;

    els.subsHint.textContent = "Loading…";
    els.followersHint.textContent = "Loading…";
    els.subsList.innerHTML = "";
    els.followersList.innerHTML = "";

    try {
      const { data: subscriptionRows, error } = await client
        .from("fan_subscriptions")
        .select("fan_id, status, cancel_at_period_end, created_at, current_period_end, provider_subscription_id, plan_id")
        .eq("creator_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const fanIds = Array.from(
        new Set((subscriptionRows || []).map((row) => row.fan_id).filter(Boolean))
      );

      const profileMap = new Map();

      if (fanIds.length) {
        const { data: profiles, error: profileError } = await client
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", fanIds);

        if (profileError) throw profileError;

        for (const profile of (profiles || [])) {
          profileMap.set(profile.user_id, profile);
        }
      }

      const subscriptions = (subscriptionRows || []).map((row) => {
        const profile = profileMap.get(row.fan_id) || {};
        return {
          ...row,
          fan_username: profile.username || null,
          fan_display_name: profile.display_name || null,
          fan_avatar_url: profile.avatar_url || null,
        };
      });

      renderSubs(subscriptions || []);
      els.subsHint.textContent = subscriptions?.length ? "Loaded ✅" : "No subscribers yet.";
    } catch (error) {
      els.subsHint.textContent = "Couldn’t load subscribers";
      els.subsList.innerHTML = renderErrorState("Subscribers error", error?.message || String(error));
    }

    try {
      const { data, error } = await client
        .from("v_followers_creator")
        .select("*")
        .eq("creator_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      renderFollowers(data || []);
      els.followersHint.textContent = data?.length ? "Loaded ✅" : "No followers yet.";
    } catch (error) {
      els.followersHint.textContent = "Couldn’t load followers";
      els.followersList.innerHTML = renderErrorState("Followers error", error?.message || String(error));
    }
  }

  async function loadSubscribers(session) {
    return loadAudience(session);
  }

  async function loadWallet() {
    if (!els.walletHint || !els.walletAvailable || !els.walletPending || !els.enablePayoutBtn) return;

    els.walletHint.textContent = "Loading…";
    hideWalletMsg();

    els.walletAvailable.textContent = "—";
    els.walletPending.textContent = "—";
    els.enablePayoutBtn.hidden = true;

    try {
      if (!state.isCreator) {
        els.walletHint.textContent = "Creator account required.";
        return;
      }

      if (!state.creatorPlanActive) {
        els.walletHint.textContent = "Creator Plan required to view balance.";
showWalletMsg(
  "Creator Plan required",
  "Activate Creator Plan to unlock balance and monetization tools."
);
        return;
      }

      if (!state.payoutEnabled) {
        els.walletHint.textContent = "Stripe setup required to show balance.";
        showWalletMsg(
          "Action required",
          "Complete Stripe onboarding to view your balance. If you already have a Stripe account, just log in during the onboarding — Stripe handles both login and registration. All payouts and withdrawals are handled in Stripe."
        );

        els.enablePayoutBtn.textContent = "Complete onboarding (Stripe)";
        els.enablePayoutBtn.hidden = false;
        return;
      }

      els.enablePayoutBtn.textContent = "Open Stripe";
      els.enablePayoutBtn.hidden = false;

      const { data, error } = await client.functions.invoke("creator-balance", {
        body: {},
      });

      if (error) throw error;

      const available = Number(data?.available_cents || 0);
      const pending = Number(data?.pending_cents || 0);

      els.walletAvailable.textContent = fmtEUR(available);
      els.walletPending.textContent = fmtEUR(pending);
      els.walletHint.textContent = "Loaded ✅";
    } catch (error) {
      els.walletHint.textContent = "Couldn’t load balance";
      showWalletMsg("Balance error", extractInvokeErrorDetails(error));
      els.enablePayoutBtn.hidden = !(state.isCreator && state.creatorPlanActive);
    }
  }

  async function loadEarnings() {
    if (!els.earningsHint || !els.earningsTable) return;

    if (!state.profileUserId) {
      els.earningsHint.textContent = "Unavailable";
      els.earningsTable.innerHTML = "";
      return;
    }

    if (!state.isCreator) {
      els.earningsHint.textContent = "Creator account required.";
      els.earningsTable.innerHTML = renderEmptyState(
        "Creator account required",
        "Only creator accounts can view monetization data."
      );
      return;
    }

    if (!state.creatorPlanActive) {
      els.earningsHint.textContent = "Monetization plan required.";
      els.earningsTable.innerHTML = renderEmptyState(
        "Creator Plan required",
        "Activate Creator Plan to start earning."
      );
      return;
    }

    els.earningsHint.textContent = "Loading…";
    els.earningsTable.innerHTML = "";

    try {
      const { data, error } = await client
        .from("wallet_transactions")
        .select("id, type, amount_cents, created_at, fan_id, status")
        .eq("creator_id", state.profileUserId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) {
        els.earningsTable.innerHTML = `
          <div class="locked">
            <b>No earnings yet</b>
            <div class="hint">Completed monetized payments will appear here.</div>
          </div>
        `;
        els.earningsHint.textContent = "No earnings yet.";
        return;
      }

      const fanIds = [...new Set((data || []).map((entry) => entry.fan_id).filter(Boolean))];
      const fanMap = new Map();

      if (fanIds.length) {
        const { data: profiles, error: profileError } = await client
          .from("profiles")
          .select("user_id, username, role, avatar_url")
          .in("user_id", fanIds);

        if (profileError) throw profileError;

        (profiles || []).forEach((profile) => {
          fanMap.set(profile.user_id, profile);
        });
      }

      const planIdByFanId = new Map();
      const planNameById = new Map();

      if (fanIds.length) {
        const { data: subscriptions, error: subscriptionError } = await client
          .from("fan_subscriptions")
          .select("fan_id, plan_id")
          .eq("creator_id", state.profileUserId)
          .in("fan_id", fanIds);

        if (subscriptionError) throw subscriptionError;

        (subscriptions || []).forEach((subscription) => {
          if (subscription?.fan_id) {
            planIdByFanId.set(subscription.fan_id, subscription.plan_id || null);
          }
        });

        const planIds = [...new Set((subscriptions || []).map((entry) => entry.plan_id).filter(Boolean))];

        if (planIds.length) {
          const { data: plans, error: planError } = await client
            .from("creator_plans")
            .select("id, name")
            .in("id", planIds);

          if (planError) throw planError;

          (plans || []).forEach((plan) => {
            if (plan?.id) {
              planNameById.set(plan.id, plan.name || "");
            }
          });
        }
      }

      els.earningsTable.innerHTML = (data || []).map((entry) => {
        const planId = entry.fan_id ? planIdByFanId.get(entry.fan_id) : null;
        const planName = planId ? planNameById.get(planId) : null;

        const typeLabel =
          entry.type === "subscription" ? `💜 ${planName || "Subscription"}`
          : entry.type === "post_unlock" ? "🔓 Unlock"
          : entry.type === "tip" ? "💰 Tip"
          : "Payment";

        const fan = entry.fan_id ? fanMap.get(entry.fan_id) : null;
        const username = ((fan?.username ?? "") + "").trim();
        const role = ((fan?.role ?? "") + "").trim();
        const avatarUrl = ((fan?.avatar_url ?? "") + "").trim();

        const avatarHtml = avatarUrl
          ? `<div class="avatarMini"><img src="${esc(avatarUrl)}" alt="avatar" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
          : `<div class="avatarMini">🐾</div>`;

        const fanLabel = username ? `@${username}` : "Fan";
        const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
        const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "";
        const clickableClass = username ? "clickable" : "";

        return `
          <div class="rowCard ${clickableClass}" data-username="${esc(username)}">
            <div class="postMeta">
              <div class="subLine">
                ${avatarHtml}
                <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                  <b style="margin:0;">${esc(typeLabel)}</b>
                  <div class="small" style="opacity:.92;">
                    ${esc(fanLabel)}${roleLabel ? ` • ${esc(roleLabel)}` : ""}
                  </div>
                </div>
              </div>
            </div>

            <div style="text-align:right;">
              <b>${fmtEUR(entry.amount_cents)}</b>
              <div class="small">${esc(date)}</div>
            </div>
          </div>
        `;
      }).join("");

      els.earningsTable.querySelectorAll(".rowCard.clickable").forEach((row) => {
        const username = (row.getAttribute("data-username") || "").trim();
        if (!username) return;

        row.addEventListener("click", () => {
          window.location.href = creatorFanProfileUrl(username);
        });
      });

      els.earningsHint.textContent = "Loaded ✅";
    } catch (error) {
      els.earningsHint.textContent = "Couldn’t load earnings";
      els.earningsTable.innerHTML = `
        <div class="locked">
          <b>Error</b>
          <div class="hint">${esc(error?.message || String(error))}</div>
        </div>
      `;
    }
  }

  async function openPayoutSetup() {
    if (!els.enablePayoutBtn) return;

    const isOnboarded = !!state.payoutEnabled;
    const idleLabel = isOnboarded
      ? "Open Stripe"
      : "Complete onboarding (Stripe)";

    try {
      setElementBusy(
        els.enablePayoutBtn,
        true,
        isOnboarded ? "Opening Stripe…" : "Opening onboarding…"
      );

      let data;
      let error;

      if (isOnboarded) {
        ({ data, error } = await client.functions.invoke("connect-login", {
          body: {},
        }));
      } else {
        ({ data, error } = await client.functions.invoke("update-connect-account", {
          body: {
            return_path: creatorPayoutSetupPath(true),
            refresh_path: creatorPayoutSetupPath(false),
          },
        }));
      }

      if (error) {
        const ctxBody = error?.context?.body;
        const extra = ctxBody
          ? (typeof ctxBody === "string" ? ctxBody : JSON.stringify(ctxBody))
          : "";

        throw new Error((error.message || "Stripe error") + (extra ? " — " + extra : ""));
      }

      if (!data?.url) {
        throw new Error("Missing Stripe URL");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert("❌ Stripe open failed: " + (error?.message || String(error)));
    } finally {
      setElementBusy(els.enablePayoutBtn, false, null, idleLabel);
    }
  }

  function bindRefreshPlanButton() {
    const refreshPlanBtn = document.getElementById("refreshPlanBtn");
    if (!refreshPlanBtn || refreshPlanBtn.dataset.bound === "1") return;

    refreshPlanBtn.dataset.bound = "1";
    refreshPlanBtn.addEventListener("click", () => window.location.reload());
  }

  function bindBuyCreatorPlanButton() {
    const buyCreatorPlanBtn = document.getElementById("buyCreatorPlanBtn");
    if (!buyCreatorPlanBtn || buyCreatorPlanBtn.dataset.bound === "1") return;

    buyCreatorPlanBtn.dataset.bound = "1";
    buyCreatorPlanBtn.addEventListener("click", async () => {
      setElementBusy(buyCreatorPlanBtn, true, "Opening Stripe…");

      try {
        const { data, error } = await client.functions.invoke(
          "create-creator-plan-checkout",
          { body: {} }
        );

        if (error) throw error;
        if (!data?.url) throw new Error("Missing Stripe URL");

        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (error) {
        setElementBusy(
          buyCreatorPlanBtn,
          false,
          null,
          "Unlock Creator Plan — €10/month"
        );
        alert("❌ Checkout error: " + (error?.message || String(error)));
      }
    });
  }

  function bindCancelPlanButton() {
    const cancelPlanBtn = document.getElementById("cancelPlanBtn");
    if (!cancelPlanBtn || cancelPlanBtn.dataset.bound === "1") return;

    cancelPlanBtn.dataset.bound = "1";
    cancelPlanBtn.addEventListener("click", async () => {
      if (!window.confirm("Cancel your Creator Plan at the end of the current period?")) {
        return;
      }

      setElementBusy(cancelPlanBtn, true, "Processing…");

      try {
        const { error } = await client.functions.invoke("cancel-creator-plan", {
          body: {},
        });

        if (error) throw error;
        window.location.reload();
      } catch (error) {
        setElementBusy(cancelPlanBtn, false, null, "Cancel at period end");
        alert("❌ Cancel failed: " + (error?.message || String(error)));
      }
    });
  }

  function bindResumePlanButton() {
    const resumePlanBtn = document.getElementById("resumePlanBtn");
    if (!resumePlanBtn || resumePlanBtn.dataset.bound === "1") return;

    resumePlanBtn.dataset.bound = "1";
    resumePlanBtn.addEventListener("click", async () => {
      setElementBusy(resumePlanBtn, true, "Processing…");

      try {
        const { error } = await client.functions.invoke("resume-creator-plan", {
          body: {},
        });

        if (error) throw error;
        window.location.reload();
      } catch (error) {
        setElementBusy(resumePlanBtn, false, null, "Resume Creator Plan");
        alert("❌ Resume failed: " + (error?.message || String(error)));
      }
    });
  }

  function renderCreatorStatusNoPlan() {
  const query = new URLSearchParams(window.location.search);
  const cameFromStripe = (
    query.has("session_id") ||
    query.has("success") ||
    query.has("checkout") ||
    query.has("payment_intent") ||
    query.has("redirect_status")
  );

  const extrasHtml = `
    <div class="btnRow" style="margin-top:12px;">
      ${
        cameFromStripe
          ? `<button class="navBtn primary" type="button" disabled style="opacity:.65;cursor:not-allowed;">Creator Plan processing…</button>`
          : `<button class="navBtn primary" type="button" id="buyCreatorPlanBtn">Unlock Creator Plan — €10/month</button>`
      }
      <button class="navBtn" type="button" id="refreshPlanBtn">Refresh</button>
    </div>
    ${
      cameFromStripe
        ? `<div class="hint" style="margin-top:10px;">✅ Payment started — waiting for Stripe confirmation. Then press Refresh.</div>`
        : `<div class="hint" style="margin-top:10px;"> Activate Creator Plan to unlock monetization.</div>`
    }
  `;

  setStateBox(
    "🔒 Creator Plan not active",
    cameFromStripe
      ? "Your payment is processing. Creator Plan will unlock after Stripe confirmation."
      : "Your creator account is ready. Creator Plan is optional and only needed to unlock monetization.",
    extrasHtml
  );

  bindRefreshPlanButton();
  bindBuyCreatorPlanButton();
}

  function renderCreatorStatusPlanActive(planData) {
  let extrasHtml = "";

  if (planData) {
    const cpeIso = planData.current_period_end || null;
    const cpeMs = cpeIso ? new Date(cpeIso).getTime() : 0;
    const now = Date.now();

    if (!!planData.cancel_at_period_end && cpeMs && cpeMs > now) {
      const endLabel = new Date(cpeIso).toLocaleDateString();
      extrasHtml = `
        <div class="btnRow" style="margin-top:12px;">
          <button class="ghost" type="button" id="resumePlanBtn">Resume Creator Plan</button>
        </div>
        <div class="hint" style="margin-top:8px;opacity:.9;">
          ⏳ Active until <b>${endLabel}</b>.
        </div>
      `;
    } else {
      extrasHtml = `
        <div class="btnRow" style="margin-top:12px;">
          <button class="ghost danger" type="button" id="cancelPlanBtn">Cancel</button>
        </div>
        <div class="hint" style="margin-top:8px;opacity:.9;">
          Cancels at the end of your current billing period.
        </div>
      `;
    }
  } else {
    extrasHtml = `
      <div class="btnRow" style="margin-top:12px;">
        <button class="ghost danger" type="button" id="cancelPlanBtn">Cancel at period end</button>
      </div>
      <div class="hint" style="margin-top:8px;opacity:.9;">
        Cancels at the end of your current billing period.
      </div>
    `;
  }

  setStateBox(
    (!!planData && !!planData.cancel_at_period_end)
      ? "⚠️ Creator Plan canceled"
      : "✅ Creator Plan active",
    (!!planData && !!planData.cancel_at_period_end)
      ? "Your Creator Plan will end at the end of the billing period. Monetization stays active until then."
      : "Creator Plan is active. Monetization is unlocked. Complete Stripe onboarding if needed.",
    extrasHtml
  );

  bindCancelPlanButton();
  bindResumePlanButton();
}

  async function loadDashboard() {
    if (!client) {
      setStateBox("❌ onlypawsClient missing", "Check onlypawsClient.js path and script order.");
      return;
    }

    attachOnce(els.refreshWalletBtn, "bound", "click", loadWallet);
    attachOnce(els.enablePayoutBtn, "bound", "click", (event) => {
      event.preventDefault();
      openPayoutSetup();
    });

    if (els.createPostBtn) {
      els.createPostBtn.href = creatorCreatePostUrl();
    }

    if (els.managePetsBtn) {
      els.managePetsBtn.href = creatorPetsUrl();
    }

    bindDeleteHandlers();

    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData?.session;

    state.creatorPlanActive = false;
    state.creatorPlanCanceling = false;
    state.payoutEnabled = false;
    state.profileUserId = null;
    state.creatorUsername = "";
    state.isCreator = false;
    state.canPost = false;

    if (els.enablePayoutBtn) {
      els.enablePayoutBtn.hidden = true;
    }

    if (!session) {
      enableAction(els.createPostBtn, false);
      enableAction(els.managePetsBtn, false);

      setStateBox("Not logged in", "Log in as a creator to access dashboard tools.");

      if (els.myPostsHint) els.myPostsHint.textContent = "Log in to see your posts.";
      if (els.myPosts) els.myPosts.innerHTML = "";

      if (els.petsHint) els.petsHint.textContent = "Log in to see pets.";
      if (els.petsList) els.petsList.innerHTML = "";

      if (els.subsHint) els.subsHint.textContent = "Log in to see subscribers.";
      if (els.subsList) els.subsList.innerHTML = "";

      if (els.followersHint) els.followersHint.textContent = "Log in to see followers.";
      if (els.followersList) els.followersList.innerHTML = "";

      if (els.walletHint) els.walletHint.textContent = "Log in to see balance.";
      if (els.earningsHint) els.earningsHint.textContent = "Log in to see earnings.";
      if (els.earningsTable) els.earningsTable.innerHTML = "";

      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("user_id, username, display_name, role, payouts_enabled, charges_enabled, stripe_onboarding_status, stripe_onboarded, stripe_connect_account_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileError) {
      enableAction(els.createPostBtn, false);
      enableAction(els.managePetsBtn, false);

      setStateBox("Profile error", profileError.message);

      await loadWallet();
      await loadEarnings();
      await loadPets(session);
      await loadSubscribers(session);
      await loadMyPosts(session);
      return;
    }

    state.profileUserId = profile?.user_id || session.user.id;
    state.creatorUsername = (profile?.username || "").trim();

    if (els.createPostBtn) {
      els.createPostBtn.href = creatorCreatePostUrl("", state.creatorUsername);
    }

    if (els.managePetsBtn) {
      els.managePetsBtn.href = creatorPetsUrl();
    }

    const role = profile?.role || "fan";

    state.isCreator = role === "creator";
    state.canPost = state.isCreator;

    if (!state.isCreator) {
      enableAction(els.createPostBtn, false);
      enableAction(els.managePetsBtn, false);

      setStateBox("🚫 Not a creator account", "Your profile role is not set to creator.");

      await loadWallet();
      await loadEarnings();
      await loadPets(session);
      await loadSubscribers(session);
      await loadMyPosts(session);
      return;
    }

    enableAction(els.createPostBtn, !!state.canPost);
    enableAction(els.managePetsBtn, true);

    const activePlan = await hasActiveCreatorPlan(session.user.id);
    state.creatorPlanActive = !!activePlan;
    state.payoutEnabled = !!(
      profile?.stripe_onboarded ||
      (profile?.payouts_enabled && profile?.charges_enabled)
    );

    if (!state.creatorPlanActive) {
      renderCreatorStatusNoPlan();

      await loadWallet();
      await loadEarnings();
      await loadPets(session);
      await loadSubscribers(session);
      await loadMyPosts(session);
      return;
    }

    const planData = await getCreatorPlanStatus(session.user.id);
    renderCreatorStatusPlanActive(planData);

    await loadWallet();
    await loadEarnings();
    await loadPets(session);
    await loadSubscribers(session);
    await loadMyPosts(session);
  }

  async function initPage() {
    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    client?.auth?.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        goHome();
      }
    });

    await loadDashboard();
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();
