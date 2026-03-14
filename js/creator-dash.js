"use strict";

/* =========================================================
   OnlyPaws
   File: /js/creator-dash.js

   Purpose:
   Logic for creator dashboard page.

   Notes:
   - Requires window.OP_PATHS
   - Requires window.onlypawsClient
   - Requires loadLayout() from partials.js
   - Uses OnlyPawsPostCard when available
   ========================================================= */

const state = {
  creatorUsername: "",
  profileUserId: null,
  creatorUnlocked: false,
  payoutEnabled: false
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
  earningsTable: document.getElementById("earningsTable")
};

function goIndex() {
  window.location.replace(OP_PATHS.marketing.index);
}

function esc(value) {
  return (value ?? "").toString()
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

function enableAction(element, enabled) {
  if (!element) return;

  if ("disabled" in element) {
    element.disabled = !enabled;
  }

  element.setAttribute("aria-disabled", enabled ? "false" : "true");
  element.classList.toggle("isDisabled", !enabled);
  element.style.pointerEvents = enabled ? "auto" : "none";
  element.style.opacity = enabled ? "1" : ".6";
}

function setStateBox(title, text, extrasHtml = "") {
  els.stateBox.innerHTML = `
    <b>${title}</b>
    <div class="hint">${(text || "").toString().replaceAll("\n", "<br/>")}</div>
    ${extrasHtml}
  `;
}

function showWalletMsg(title, text) {
  els.walletMsg.hidden = false;
  els.walletMsg.querySelector("b").textContent = title;
  els.walletMsgText.textContent = text || "";
}

function hideWalletMsg() {
  els.walletMsg.hidden = true;
  els.walletMsgText.textContent = "";
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

function creatorCreatePostUrl() {
  return OP_PATHS.app.creators.createPost;
}

function creatorPetsUrl() {
  return OP_PATHS.app.creators.pets;
}

function creatorFanProfileUrl(username) {
  return `${OP_PATHS.app.creators.fanProfile}?u=${encodeURIComponent(username || "")}`;
}

function creatorPayoutSetupUrl(doneState) {
  const base = OP_PATHS.app.creators.payoutsSetup;
  return doneState ? `${base}?done=1` : `${base}?retry=1`;
}

function attachOnce(element, key, eventName, handler) {
  if (!element || element.dataset[key] === "1") return;
  element.dataset[key] = "1";
  element.addEventListener(eventName, handler);
}

async function getCreatorPlanStatus(userId) {
  try {
    const { data, error } = await onlypawsClient
      .from("entitlements")
      .select("creator_plan, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn("getCreatorPlanStatus error:", error);
    return null;
  }
}

async function hasActiveCreatorPlan(userId) {
  const entitlement = await getCreatorPlanStatus(userId);
  return !!entitlement?.creator_plan;
}

function renderEmptyState(title, hint) {
  return `
    <div class="locked dashboardLockedTop">
      <b>${esc(title)}</b>
      <div class="hint">${esc(hint)}</div>
    </div>
  `;
}

function renderErrorState(title, message) {
  return `
    <div class="locked dashboardLockedTop">
      <b>${esc(title)}</b>
      <div class="hint">${esc(message)}</div>
    </div>
  `;
}

function renderMyPosts(posts) {
  if (!posts || posts.length === 0) {
    els.myPosts.innerHTML = renderEmptyState(
      "No posts yet",
      "Create your first post to see it here."
    );
    return;
  }

  if (window.OnlyPawsPostCard?.renderPostCard) {
    els.myPosts.innerHTML = posts.map((post) => {
      const title = post.title || "Untitled";
      const date = post.created_at ? new Date(post.created_at).toLocaleString() : "";
      const id = post.id;

      const cardHtml = window.OnlyPawsPostCard.renderPostCard({
        id,
        creator_username: state.creatorUsername || "creator",
        title,
        excerpt: post.content || post.preview || "",
        price_cents: null,
        currency: "eur",
        is_locked: false,
        media_url: post.media_url || null,
        media_type: post.media_type || null,
        created_at: post.created_at || null
      });

      const visibilityLabel = post.is_public ? "🌍 PUBLIC" : "🙈 PRIVATE";
      const typeLabel = post.is_paid ? "🔒 PREMIUM" : "🆓 FREE";

      return `
        <div class="rowCard dashboardRowCard" data-post-id="${esc(id)}">
          <div class="postMeta dashboardPostMetaFull">
            <div class="dashboardBadgeRow">
              <span class="badge">${typeLabel}</span>
              <span class="badge">${visibilityLabel}</span>
              ${date ? `<span class="badge">${esc(date)}</span>` : ""}
            </div>

            ${cardHtml}
          </div>

          <div class="postActions">
            <a class="ghost" href="${creatorCreatePostUrl()}?edit=${encodeURIComponent(id)}">Edit</a>
            <button class="ghost danger" type="button" data-action="delete">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    window.OnlyPawsPostCard.initPostCards(els.myPosts);
    bindDeleteHandlers();
    return;
  }

  els.myPosts.innerHTML = posts.map((post) => {
    const title = post.title || "Untitled";
    const previewText = post.preview || (post.content ? String(post.content).slice(0, 90) : "");
    const date = post.created_at ? new Date(post.created_at).toLocaleString() : "";
    const visibilityLabel = post.is_public ? "🌍 PUBLIC" : "🙈 PRIVATE";
    const typeLabel = post.is_paid ? "🔒 PREMIUM" : "🆓 FREE";

    return `
      <div class="rowCard dashboardRowCard" data-post-id="${esc(post.id)}">
        <div class="postMeta">
          <div class="dashboardBadgeRow dashboardBadgeRowSmall">
            <span class="badge">${typeLabel}</span>
            <span class="badge">${visibilityLabel}</span>
            ${date ? `<span class="badge">${esc(date)}</span>` : ""}
          </div>

          <b>${esc(title)}</b>

          ${post.media_url ? `
            <div class="mediaWrap">
              ${post.media_type === "video"
                ? `<video controls playsinline src="${esc(post.media_url)}"></video>`
                : `<img src="${esc(post.media_url)}" alt="Post media" />`}
            </div>
          ` : ""}

          <div class="small dashboardSmallTop">${esc(previewText || "")}</div>
        </div>

        <div class="postActions">
          <a class="ghost" href="${creatorCreatePostUrl()}?edit=${encodeURIComponent(post.id)}">Edit</a>
          <button class="ghost danger" type="button" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  bindDeleteHandlers();
}

function bindDeleteHandlers() {
  els.myPosts.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest(".rowCard");
      const postId = row?.getAttribute("data-post-id");

      if (!postId) return;
      if (!confirm("Delete this post? This can’t be undone.")) return;

      button.disabled = true;
      button.textContent = "Deleting…";

      try {
        const { data } = await onlypawsClient.auth.getUser();
        const userId = data?.user?.id;

        const { error } = await onlypawsClient
          .from("posts")
          .delete()
          .eq("id", postId)
          .eq("creator_id", userId);

        if (error) throw error;

        row.remove();
        els.myPostsHint.textContent = "Deleted ✅";

        if (!els.myPosts.querySelector(".rowCard")) {
          renderMyPosts([]);
          els.myPostsHint.textContent = "No posts yet.";
        }
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        alert("❌ Delete failed: " + (error?.message || String(error)));
      }
    });
  });
}

function renderPets(pets) {
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
      ? `<div class="petAvatarMini"><img src="${esc(pet.avatar_url)}" alt="pet avatar" /></div>`
      : `<div class="petAvatarMini">🐾</div>`;

    return `
      <div class="rowCard">
        <div class="petMeta">
          <div class="petLine">
            ${avatarHtml}
            <b class="dashboardPetTitle">${esc(name)} ${esc(species)} ${esc(breed)} ${esc(age)}</b>
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
      ? `<div class="avatarMini"><img src="${esc(subscription.fan_avatar_url)}" alt="avatar" /></div>`
      : `<div class="avatarMini">🐾</div>`;

    const renewText = endDate
      ? (cancelAtPeriodEnd
          ? `Access until ${endDate}`
          : (hasAccess ? `Renews ${endDate}` : `Ended ${endDate}`))
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
            <div class="dashboardColText">
              <b class="dashboardNoMargin">
                ${esc(name)}
                ${usernameLabel ? `<span class="dashboardHandle">${esc(usernameLabel)}</span>` : ""}
              </b>
              <span class="small dashboardMetaLine">${esc(metaLine)}</span>
            </div>
          </div>
        </div>

        <div class="dashboardBadgeWrap">
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
      ? `<div class="avatarMini"><img src="${esc(follower.fan_avatar_url)}" alt="avatar" /></div>`
      : `<div class="avatarMini">🐾</div>`;

    const clickableClass = usernameRaw ? "clickable" : "";
    const metaLine = sinceDate ? `Followed: ${sinceDate}` : "Followed";

    return `
      <div class="rowCard ${clickableClass}" data-username="${esc(usernameRaw)}">
        <div class="postMeta">
          <div class="subLine">
            ${avatarHtml}
            <div class="dashboardColText">
              <b class="dashboardNoMargin">
                ${esc(name)}
                ${usernameLabel ? `<span class="dashboardHandle">${esc(usernameLabel)}</span>` : ""}
              </b>
              <span class="small dashboardMetaLine">${esc(metaLine)}</span>
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
  els.myPostsHint.textContent = "Loading…";
  els.myPosts.innerHTML = "";

  try {
    const { data, error } = await onlypawsClient
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
  els.petsHint.textContent = "Loading…";
  els.petsList.innerHTML = "";

  try {
    const { data, error } = await onlypawsClient
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
  els.subsHint.textContent = "Loading…";
  els.followersHint.textContent = "Loading…";
  els.subsList.innerHTML = "";
  els.followersList.innerHTML = "";

  try {
    const { data: subscriptionRows, error } = await onlypawsClient
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
      const { data: profiles, error: profileError } = await onlypawsClient
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
        fan_avatar_url: profile.avatar_url || null
      };
    });

    renderSubs(subscriptions);
    els.subsHint.textContent = subscriptions.length ? "Loaded ✅" : "No subscribers yet.";
  } catch (error) {
    els.subsHint.textContent = "Couldn’t load subscribers";
    els.subsList.innerHTML = renderErrorState("Subscribers error", error?.message || String(error));
  }

  try {
    const { data, error } = await onlypawsClient
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
  els.walletHint.textContent = "Loading…";
  hideWalletMsg();

  els.walletAvailable.textContent = "—";
  els.walletPending.textContent = "—";
  els.enablePayoutBtn.hidden = true;

  try {
    if (!state.creatorUnlocked) {
      els.walletHint.textContent = "Creator Plan required to view balance.";
      return;
    }

    if (!state.payoutEnabled) {
      els.walletHint.textContent = "Stripe setup required to show balance.";
      showWalletMsg(
        "Action required",
        "Complete Stripe onboarding to view your balance. If you already have a Stripe account, just log in during the onboarding — Stripe handles both login and registration. All payouts/withdrawals are handled in Stripe."
      );

      els.enablePayoutBtn.textContent = "Complete onboarding (Stripe)";
      els.enablePayoutBtn.hidden = false;
      return;
    }

    els.enablePayoutBtn.textContent = "Open Stripe";
    els.enablePayoutBtn.hidden = false;

    const { data, error } = await onlypawsClient.functions.invoke("creator-balance", { body: {} });
    if (error) throw error;

    els.walletAvailable.textContent = fmtEUR(data?.available_cents || 0);
    els.walletPending.textContent = fmtEUR(data?.pending_cents || 0);
    els.walletHint.textContent = "Loaded ✅";
  } catch (error) {
    els.walletHint.textContent = "Couldn’t load balance";
    showWalletMsg("Balance error", extractInvokeErrorDetails(error));
    els.enablePayoutBtn.hidden = false;
  }
}

async function loadEarnings() {
  if (!state.profileUserId) {
    els.earningsHint.textContent = "Unavailable";
    els.earningsTable.innerHTML = "";
    return;
  }

  els.earningsHint.textContent = "Loading…";
  els.earningsTable.innerHTML = "";

  try {
    const { data, error } = await onlypawsClient
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
          <div class="hint">Completed payments will appear here.</div>
        </div>
      `;
      els.earningsHint.textContent = "No earnings yet.";
      return;
    }

    const fanIds = [...new Set(data.map((entry) => entry.fan_id).filter(Boolean))];
    const fanMap = new Map();

    if (fanIds.length) {
      const { data: profiles, error: profileError } = await onlypawsClient
        .from("profiles")
        .select("user_id, username, role, avatar_url")
        .in("user_id", fanIds);

      if (profileError) throw profileError;

      (profiles || []).forEach((profile) => fanMap.set(profile.user_id, profile));
    }

    const planIdByFanId = new Map();
    const planNameById = new Map();

    if (fanIds.length) {
      const { data: subscriptions, error: subscriptionError } = await onlypawsClient
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
        const { data: plans, error: planError } = await onlypawsClient
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

    els.earningsTable.innerHTML = data.map((entry) => {
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
        ? `<div class="avatarMini"><img src="${esc(avatarUrl)}" alt="avatar" /></div>`
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
              <div class="dashboardColText dashboardMinWidthZero">
                <b class="dashboardNoMargin">${esc(typeLabel)}</b>
                <div class="small dashboardMetaLine">
                  ${esc(fanLabel)}${roleLabel ? ` • ${esc(roleLabel)}` : ""}
                </div>
              </div>
            </div>
          </div>

          <div class="dashboardAmountCol">
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
  try {
    const isOnboarded = !!state.payoutEnabled;

    els.enablePayoutBtn.textContent = isOnboarded ? "Opening Stripe…" : "Opening onboarding…";
    els.enablePayoutBtn.style.pointerEvents = "none";
    els.enablePayoutBtn.style.opacity = ".75";

    let data;
    let error;

    if (isOnboarded) {
      ({ data, error } = await onlypawsClient.functions.invoke("connect-login", { body: {} }));
    } else {
      ({ data, error } = await onlypawsClient.functions.invoke("update-connect-account", {
        body: {
          return_path: creatorPayoutSetupUrl(true),
          refresh_path: creatorPayoutSetupUrl(false)
        }
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
    els.enablePayoutBtn.textContent = state.payoutEnabled
      ? "Open Stripe"
      : "Complete onboarding (Stripe)";
    els.enablePayoutBtn.style.pointerEvents = "auto";
    els.enablePayoutBtn.style.opacity = "1";
  }
}

async function loadDashboard() {
  if (typeof onlypawsClient === "undefined") {
    setStateBox("❌ onlypawsClient missing", "Check onlypawsClient.js path and script order.");
    return;
  }

  attachOnce(els.refreshWalletBtn, "bound", "click", loadWallet);
  attachOnce(els.enablePayoutBtn, "bound", "click", (event) => {
    event.preventDefault();
    openPayoutSetup();
  });

  els.createPostBtn.href = creatorCreatePostUrl();
  els.managePetsBtn.href = creatorPetsUrl();

  const { data: sessionData } = await onlypawsClient.auth.getSession();
  const session = sessionData?.session;

  state.creatorUnlocked = false;
  state.payoutEnabled = false;
  state.profileUserId = null;
  state.creatorUsername = "";
  els.enablePayoutBtn.hidden = true;

  if (!session) {
    enableAction(els.createPostBtn, false);

    setStateBox("Not logged in", "Log in as a creator to access dashboard tools.");

    els.myPostsHint.textContent = "Log in to see your posts.";
    els.myPosts.innerHTML = "";

    els.petsHint.textContent = "Log in to see pets.";
    els.petsList.innerHTML = "";

    els.subsHint.textContent = "Log in to see subscribers.";
    els.subsList.innerHTML = "";

    els.followersHint.textContent = "Log in to see followers.";
    els.followersList.innerHTML = "";

    els.walletHint.textContent = "Log in to see balance.";
    els.earningsHint.textContent = "Log in to see earnings.";
    els.earningsTable.innerHTML = "";

    return;
  }

  const { data: profile, error: profileError } = await onlypawsClient
    .from("profiles")
    .select("user_id, username, display_name, role, payouts_enabled, charges_enabled, stripe_onboarding_status, stripe_onboarded, stripe_connect_account_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (profileError) {
    enableAction(els.createPostBtn, false);
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

  els.createPostBtn.href = creatorCreatePostUrl();

  if ((profile?.role || "fan") !== "creator") {
    enableAction(els.createPostBtn, false);
    setStateBox("🚫 Not a creator account", "Your profile role is not set to creator.");

    await loadWallet();
    await loadEarnings();
    await loadPets(session);
    await loadSubscribers(session);
    await loadMyPosts(session);
    return;
  }

  const activePlan = await hasActiveCreatorPlan(session.user.id);
  state.creatorUnlocked = !!activePlan;
  state.payoutEnabled = !!(profile?.stripe_onboarded || (profile?.payouts_enabled && profile?.charges_enabled));

  if (!activePlan) {
    enableAction(els.createPostBtn, false);

    const query = new URLSearchParams(window.location.search);
    const cameFromStripe = (
      query.has("session_id") ||
      query.has("success") ||
      query.has("checkout") ||
      query.has("payment_intent") ||
      query.has("redirect_status")
    );

    const extrasHtml = `
      <div class="btnRow dashboardBtnRow">
        ${
          cameFromStripe
            ? `<button class="navBtn primary" type="button" disabled>Creator Plan processing…</button>`
            : `<button class="navBtn primary" type="button" id="buyCreatorPlanBtn">Unlock Creator Access — €10/month</button>`
        }
        <button class="navBtn" type="button" id="refreshBtn">Refresh</button>
      </div>
      ${
        cameFromStripe
          ? `<div class="hint dashboardInfoGap">✅ Payment started — waiting for Stripe confirmation. Then press Refresh.</div>`
          : ``
      }
    `;

    setStateBox(
      "🔒 Creator tools locked",
      cameFromStripe
        ? "Thanks! Your payment is processing. Creator Plan stays disabled until our server receives confirmation from Stripe."
        : "Your creator account is ready, but the Creator Plan is not active yet (or the dashboard can’t read it).",
      extrasHtml
    );

    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => window.location.reload());
    }

    const buyCreatorPlanBtn = document.getElementById("buyCreatorPlanBtn");
    if (buyCreatorPlanBtn) {
      buyCreatorPlanBtn.addEventListener("click", async () => {
        buyCreatorPlanBtn.disabled = true;
        buyCreatorPlanBtn.style.opacity = ".75";
        buyCreatorPlanBtn.textContent = "Opening Stripe…";

        try {
          const { data, error } = await onlypawsClient.functions.invoke(
            "create-creator-plan-checkout",
            { body: {} }
          );

          if (error) throw error;
          if (!data?.url) throw new Error("Missing Stripe URL");

          window.open(data.url, "_blank", "noopener,noreferrer");
        } catch (error) {
          buyCreatorPlanBtn.disabled = false;
          buyCreatorPlanBtn.style.opacity = "1";
          buyCreatorPlanBtn.textContent = "Unlock Creator Access — €10/month";
          alert("❌ Checkout error: " + (error?.message || String(error)));
        }
      });
    }

    await loadWallet();
    await loadEarnings();
    await loadPets(session);
    await loadSubscribers(session);
    await loadMyPosts(session);
    return;
  }

  enableAction(els.createPostBtn, true);

  const planData = await getCreatorPlanStatus(session.user.id);
  const extrasHtml = `
    <div class="btnRow dashboardBtnRow">
      <button class="ghost danger" type="button" id="cancelPlanBtn">
        ${planData?.creator_plan ? "Cancel" : "Cancel at period end"}
      </button>
    </div>
    <div class="hint dashboardInfoGap">Cancels at the end of your current billing period.</div>
  `;

  setStateBox(
    "✅ Creator unlocked",
    "Plan active. You can create posts and use creator tools.",
    extrasHtml
  );

  const cancelPlanBtn = document.getElementById("cancelPlanBtn");
  if (cancelPlanBtn) {
    cancelPlanBtn.addEventListener("click", async () => {
      if (!confirm("Cancel your Creator Plan at the end of the current period?")) {
        return;
      }

      cancelPlanBtn.disabled = true;
      cancelPlanBtn.style.opacity = ".75";
      cancelPlanBtn.textContent = "Processing…";

      try {
        const { error } = await onlypawsClient.functions.invoke("cancel-creator-plan", { body: {} });
        if (error) throw error;

        window.location.reload();
      } catch (error) {
        cancelPlanBtn.disabled = false;
        cancelPlanBtn.style.opacity = "1";
        cancelPlanBtn.textContent = "Cancel at period end";
        alert("❌ Cancel failed: " + (error?.message || String(error)));
      }
    });
  }

  await loadWallet();
  await loadEarnings();
  await loadPets(session);
  await loadSubscribers(session);
  await loadMyPosts(session);
}

async function initPage() {
  await loadLayout();

  if (typeof initNav === "function") {
    await initNav();
  }

  onlypawsClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goIndex();
    }
  });

  await loadDashboard();
}

window.addEventListener("DOMContentLoaded", initPage);
