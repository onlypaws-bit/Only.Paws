/* =========================================================
   OnlyPaws
   File: js/nav.js
   Purpose: shared navigation hydration for app and marketing headers
   ========================================================= */

function show(el, yes) {
  if (!el) return;
  el.hidden = !yes;
}

async function hydrateUserPill() {
  const pill = document.getElementById("userPill");
  if (!pill) return;

  try {
    const { data } = await onlypawsClient.auth.getSession();
    const session = data?.session;

    if (!session) {
      pill.textContent = "Guest";
      return;
    }

    const uid = session.user.id;
    const email = session.user.email || "";

    const { data: prof } = await onlypawsClient
      .from("profiles")
      .select("username, display_name")
      .eq("user_id", uid)
      .maybeSingle();

    const username = (prof?.username || "").trim();
    const displayName = (prof?.display_name || "").trim();

    if (username) {
      pill.textContent = "@" + username;
    } else if (displayName) {
      pill.textContent = displayName;
    } else if (email) {
      pill.textContent = email.split("@")[0];
    } else {
      pill.textContent = "User";
    }
  } catch (e) {
    pill.textContent = "User";
  }
}

async function hydrateNav() {
  const profileBtn = document.getElementById("navProfile");
  const logoutBtn = document.getElementById("navLogout");
  const fanDashBtn = document.getElementById("navFanDash");
  const creatorDashBtn = document.getElementById("navCreatorDash");

  try {
    const { data } = await onlypawsClient.auth.getUser();
    const userId = data?.user?.id;

    if (!userId) {
      show(profileBtn, false);
      show(logoutBtn, false);
      show(fanDashBtn, false);
      show(creatorDashBtn, false);
      return;
    }

    if (profileBtn) profileBtn.href = OP_PATHS.app.profile;
    if (fanDashBtn) fanDashBtn.href = OP_PATHS.fans.fanDash;
    if (creatorDashBtn) creatorDashBtn.href = OP_PATHS.creators.creatorDash;

    show(profileBtn, true);
    show(logoutBtn, true);
    show(fanDashBtn, false);
    show(creatorDashBtn, false);

    const { data: p } = await onlypawsClient
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (p?.role === "creator") {
      show(creatorDashBtn, true);
    } else {
      show(fanDashBtn, true);
    }
  } catch (e) {
    show(profileBtn, false);
    show(logoutBtn, false);
    show(fanDashBtn, false);
    show(creatorDashBtn, false);
  }
}

function setupLogout() {
  const btn = document.getElementById("navLogout");
  if (!btn) return;
  if (btn.dataset.bound === "1") return;

  btn.dataset.bound = "1";

  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "Logging out…";

    try {
      await onlypawsClient.auth.signOut();
    } catch (e) {
      // ignore and redirect anyway
    }

    window.location.replace(OP_PATHS.marketing.index);
    btn.textContent = oldText;
  });
}

async function initNav() {
  await hydrateUserPill();
  await hydrateNav();
  setupLogout();
}
