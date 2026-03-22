/* =========================================================
   OnlyPaws
   File: /js/app/profile.js
   Purpose: manage the authenticated user profile page
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes (recommended)
   - window.OPPartials
   - window.OPNav
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const AVATAR_BUCKET = "avatars";

  const els = {
    msg: document.getElementById("msg"),
    deleteMsg: document.getElementById("deleteMsg"),
    deleteBtn: document.getElementById("deleteBtn"),

    emailPill: document.getElementById("emailPill"),
    userPill: document.getElementById("userPill"),

    email: document.getElementById("email"),
    displayName: document.getElementById("display_name"),
    username: document.getElementById("username"),
    bio: document.getElementById("bio"),
    instagram: document.getElementById("instagram_url"),
    tiktok: document.getElementById("tiktok_url"),

    socialSection: document.getElementById("socialSection"),

    saveBtn: document.getElementById("saveBtn"),

    avatarImg: document.getElementById("avatarImg"),
    avatarFile: document.getElementById("avatarFile"),
    uploadAvatarBtn: document.getElementById("uploadAvatarBtn"),
    removeAvatarBtn: document.getElementById("removeAvatarBtn"),
    avatarHint: document.getElementById("avatarHint"),

    logoutBtn: document.getElementById("logoutBtn"),

    usernameHint: document.getElementById("usernameHint"),

    // Preview
    previewBox: document.getElementById("profilePreview"),
    previewAvatar: document.getElementById("previewAvatar"),
    previewName: document.getElementById("previewName"),
    previewHandle: document.getElementById("previewHandle"),
    previewBio: document.getElementById("previewBio"),
    previewSocials: document.getElementById("previewSocials"),
    previewInstagram: document.getElementById("previewInstagram"),
    previewTikTok: document.getElementById("previewTikTok"),
    previewHint: document.getElementById("previewHint"),
    previewHeaderSub: document.getElementById("previewHeaderSub"),
    previewActions: document.getElementById("previewActions"),
    previewOpenBtn: document.getElementById("previewOpenBtn"),
    previewCopyBtn: document.getElementById("previewCopyBtn"),
  };

  const state = {
    role: "fan",
    userId: null,
    email: "",
    usernameAvailable: false,
  };

  const USERNAME_RE = /^[a-z0-9._]{3,24}$/;
  const HAS_LETTER_RE = /[a-z]/;

  function setMsg(text) {
    if (els.msg) els.msg.textContent = text || "";
  }

  function setDeleteMsg(text) {
    if (els.deleteMsg) els.deleteMsg.textContent = text || "";
  }

  function setHint(text) {
    if (els.avatarHint) els.avatarHint.textContent = text || "";
  }

  function setPreviewHint(text) {
    if (els.previewHint) els.previewHint.textContent = text || "";
  }

  function normalizeRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isCreatorRole(value) {
    return normalizeRole(value) === "creator";
  }

  function setShown(el, shown, displayValue = "") {
    if (!el) return;
    el.hidden = !shown;
    el.style.display = shown ? displayValue : "none";
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
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
      cleaned = cleaned.replace(/^@+/, "");
      return `https://instagram.com/${cleaned}`;
    }

    if (platform === "tiktok") {
      cleaned = cleaned.replace(/^tiktok\.com\//i, "");
      cleaned = cleaned.replace(/^www\.tiktok\.com\//i, "");
      cleaned = cleaned.replace(/^@+/, "");
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

  function setUsernameHint(ok, text) {
    if (!els.usernameHint) return;
    els.usernameHint.textContent = text || "";
    els.usernameHint.classList.toggle("ok", !!ok);
    els.usernameHint.classList.toggle("bad", !ok);
  }

  function validateUsername(rawValue) {
    const value = normalizeUsername(rawValue);

    if (!value) {
      return {
        ok: false,
        value,
        msg: "Username required.\nAllowed: a–z, 0–9, '.', '_' (3–24 chars). Must include at least one letter.",
      };
    }

    if (value.length < 3) {
      return { ok: false, value, msg: "Too short (min 3 characters)." };
    }

    if (value.length > 24) {
      return { ok: false, value, msg: "Too long (max 24 characters)." };
    }

    if (!USERNAME_RE.test(value)) {
      return {
        ok: false,
        value,
        msg: "Invalid characters.\nAllowed: lowercase letters, numbers, '.', '_' only.",
      };
    }

    if (!HAS_LETTER_RE.test(value)) {
      return {
        ok: false,
        value,
        msg: "Must include at least one letter (a–z).",
      };
    }

    return { ok: true, value, msg: "Looks good ✅" };
  }

  function refreshUsernameUI() {
    const result = validateUsername(els.username?.value || "");

    if (els.username && els.username.value !== result.value) {
      const start = els.username.selectionStart;
      const end = els.username.selectionEnd;
      els.username.value = result.value;

      if (start != null && end != null) {
        try {
          els.username.setSelectionRange(start, end);
        } catch (_) {}
      }
    }

    setUsernameHint(result.ok, result.msg);

    if (els.saveBtn) {
      els.saveBtn.disabled = !result.ok;
    }

    state.usernameAvailable = result.ok;
    return result;
  }

  function hydrateUserPillFromProfile(profile, email) {
    try {
      const uname = (profile?.username || "").trim();
      const dname = (profile?.display_name || "").trim();

      if (els.userPill) {
        if (uname) els.userPill.textContent = "@" + uname;
        else if (dname) els.userPill.textContent = dname;
        else if (email) els.userPill.textContent = email.split("@")[0];
        else els.userPill.textContent = "User";
      }
    } catch (_) {}
  }

  function getHomePath() {
    if (ROUTES?.get) {
      return ROUTES.get("home") || ROUTES.get("index") || "index.html";
    }
    return PATHS?.home || PATHS?.index || "index.html";
  }

  function getLogoPath() {
    return PATHS?.assets?.logo || "logo.png";
  }

  function getPublicPreviewPath(usernameOrId) {
    if (!usernameOrId) return "";

    if (ROUTES?.href) {
      return ROUTES.href("app.fans.creatorProfile", { u: usernameOrId });
    }

    const base = PATHS?.app?.fans?.creatorProfile || "creator-profile.html";
    return `${base}?u=${encodeURIComponent(usernameOrId)}`;
  }

  function goHome() {
    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }
    window.location.replace(getHomePath());
  }

  function applyRoleUI() {
    const isCreator = isCreatorRole(state.role);

    setShown(els.socialSection, isCreator, "block");

    if (els.previewHeaderSub) {
      els.previewHeaderSub.textContent = isCreator
        ? "Quick live preview of how your creator profile can look."
        : "Basic preview of your profile. Public creator profile is available for creator accounts.";
    }

    if (!isCreator) {
      setShown(els.previewSocials, false);
      setShown(els.previewInstagram, false);
      setShown(els.previewTikTok, false);
      setShown(els.previewActions, false);

      if (els.previewOpenBtn) {
        els.previewOpenBtn.removeAttribute("href");
      }

      if (els.previewCopyBtn) {
        els.previewCopyBtn.disabled = true;
        delete els.previewCopyBtn.dataset.href;
      }
    }
  }

  async function guardAuthOrRedirect() {
    try {
      const { data: sessData } = await client.auth.getSession();
      const session = sessData?.session;

      if (!session) {
        goHome();
        return null;
      }

      const { data: userData, error: userError } = await client.auth.getUser();
      const user = userData?.user;

      if (userError || !user) {
        try {
          await client.auth.signOut();
        } catch (_) {}
        goHome();
        return null;
      }

      return user;
    } catch (_) {
      try {
        await client.auth.signOut();
      } catch (_) {}
      goHome();
      return null;
    }
  }

  try {
    client?.auth?.onAuthStateChange((_event, session) => {
      if (!session) goHome();
    });
  } catch (_) {}

  function fileExt(name) {
    const match = String(name || "").toLowerCase().match(/\.(\w+)$/);
    return match ? match[1] : "png";
  }

  async function uploadAvatarToBucket(file, userId) {
    const ext = fileExt(file.name);
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${userId}/${safeName}`;

    const { error: uploadError } = await client
      .storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = client
      .storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    const url = data?.publicUrl;
    if (!url) throw new Error("Could not get public URL for uploaded file.");

    return url;
  }

  async function ensureProfileExists(userId) {
    const { data: existing, error } = await client
      .from("profiles")
      .select("user_id, display_name, username, bio, role, avatar_url, instagram_url, tiktok_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (existing) return existing;

    const { error: insertError } = await client
      .from("profiles")
      .insert({ user_id: userId, role: "fan" });

    if (insertError) throw insertError;

    const { data: created, error: createdError } = await client
      .from("profiles")
      .select("user_id, display_name, username, bio, role, avatar_url, instagram_url, tiktok_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (createdError) throw createdError;
    return created || null;
  }

  function updatePreview() {
    const isCreator = isCreatorRole(state.role);

    const displayName = (els.displayName?.value || "").trim();
    const username = normalizeUsername(els.username?.value || "");
    const bio = (els.bio?.value || "").trim();
    const instagramUrl = isCreator
      ? normalizeSocialUrl(els.instagram?.value || "", "instagram")
      : "";
    const tiktokUrl = isCreator
      ? normalizeSocialUrl(els.tiktok?.value || "", "tiktok")
      : "";
    const avatarUrl = (els.avatarImg?.src || "").trim();

    if (els.previewAvatar) {
      els.previewAvatar.src = avatarUrl || getLogoPath();
    }

    if (els.previewName) {
      els.previewName.textContent = displayName || "Your name";
    }

    if (els.previewHandle) {
      els.previewHandle.textContent = username ? `@${username}` : "@username";
    }

    if (els.previewBio) {
      els.previewBio.textContent = bio || "Your bio preview will appear here.";
    }

    let hasSocials = false;

    if (els.previewInstagram) {
      if (isCreator && instagramUrl) {
        els.previewInstagram.href = instagramUrl;
        els.previewInstagram.textContent = displaySocialLabel(instagramUrl, "Instagram");
        setShown(els.previewInstagram, true, "inline-flex");
        hasSocials = true;
      } else {
        els.previewInstagram.removeAttribute("href");
        setShown(els.previewInstagram, false);
      }
    }

    if (els.previewTikTok) {
      if (isCreator && tiktokUrl) {
        els.previewTikTok.href = tiktokUrl;
        els.previewTikTok.textContent = displaySocialLabel(tiktokUrl, "TikTok");
        setShown(els.previewTikTok, true, "inline-flex");
        hasSocials = true;
      } else {
        els.previewTikTok.removeAttribute("href");
        setShown(els.previewTikTok, false);
      }
    }

    setShown(els.previewSocials, isCreator && hasSocials, "flex");

    const canOpenPublicPreview = isCreator && !!username;
    const publicPath = canOpenPublicPreview
      ? getPublicPreviewPath(username || state.userId)
      : "";

    setShown(els.previewActions, canOpenPublicPreview, "flex");

    if (els.previewOpenBtn) {
      if (canOpenPublicPreview) {
        els.previewOpenBtn.href = publicPath;
        setShown(els.previewOpenBtn, true, "inline-flex");
      } else {
        els.previewOpenBtn.removeAttribute("href");
        setShown(els.previewOpenBtn, false);
      }
    }

    if (els.previewCopyBtn) {
      els.previewCopyBtn.disabled = !canOpenPublicPreview;

      if (canOpenPublicPreview) {
        els.previewCopyBtn.dataset.href = publicPath;
        setShown(els.previewCopyBtn, true, "inline-flex");
      } else {
        delete els.previewCopyBtn.dataset.href;
        setShown(els.previewCopyBtn, false);
      }
    }

    if (isCreator) {
      if (username) {
        setPreviewHint("This is a quick preview of your public creator profile.");
      } else {
        setPreviewHint("Set a valid username to enable public profile preview.");
      }
    } else {
      setPreviewHint("Public profile sharing and social links are available for creator accounts.");
    }
  }

  async function loadProfile() {
    setMsg("");

    const user = await guardAuthOrRedirect();
    if (!user) return;

    state.userId = user.id;
    state.email = user.email || "";

    if (els.email) els.email.value = state.email;
    if (els.emailPill) els.emailPill.textContent = state.email || "…";

    try {
      const profile = await ensureProfileExists(user.id);

      state.role = normalizeRole(profile?.role || "fan");

      hydrateUserPillFromProfile(profile, state.email);

      if (els.displayName) els.displayName.value = profile?.display_name || "";
      if (els.username) els.username.value = profile?.username || "";
      if (els.bio) els.bio.value = profile?.bio || "";

      if (els.instagram) {
        els.instagram.value = isCreatorRole(state.role) ? (profile?.instagram_url || "") : "";
      }

      if (els.tiktok) {
        els.tiktok.value = isCreatorRole(state.role) ? (profile?.tiktok_url || "") : "";
      }

      const avatarUrl = (profile?.avatar_url || "").trim();
      if (els.avatarImg) {
        els.avatarImg.src = avatarUrl || getLogoPath();
      }

      applyRoleUI();
      setHint("Upload an image to change your avatar.");
      refreshUsernameUI();
      updatePreview();
    } catch (err) {
      const message = err?.message || String(err);

      if (String(message).toLowerCase().includes("foreign key")) {
        try {
          await client.auth.signOut();
        } catch (_) {}
        goHome();
        return;
      }

      setMsg("❌ Load profile error: " + message);
    }
  }

  async function saveProfile() {
    setMsg("");

    const user = await guardAuthOrRedirect();
    if (!user) return;

    const validation = refreshUsernameUI();
    if (!validation.ok) {
      setMsg("❌ Fix username before saving.");
      return;
    }

    if (els.saveBtn) {
      els.saveBtn.disabled = true;
    }
    setMsg("Saving…");

    try {
      const isCreator = isCreatorRole(state.role);

      const payload = {
        user_id: user.id,
        display_name: (els.displayName?.value || "").trim(),
        username: validation.value,
        bio: (els.bio?.value || "").trim(),
        instagram_url: isCreator
          ? normalizeSocialUrl(els.instagram?.value || "", "instagram") || null
          : null,
        tiktok_url: isCreator
          ? normalizeSocialUrl(els.tiktok?.value || "", "tiktok") || null
          : null,
      };

      const { error } = await client
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setMsg("Saved ✅");
      await loadProfile();
    } catch (err) {
      const code = err?.code || "";
      const message = err?.message || String(err);
      const lower = String(message).toLowerCase();

      if (lower.includes("foreign key")) {
        try {
          await client.auth.signOut();
        } catch (_) {}
        goHome();
        return;
      }

      if (
        code === "23505" ||
        lower.includes("duplicate key") ||
        lower.includes("profiles_username_unique")
      ) {
        setMsg("❌ Username already taken. Try a different one.");
        return;
      }

      if (
        code === "23514" ||
        lower.includes("profiles_username_format") ||
        lower.includes("profiles_username_not_blank")
      ) {
        setMsg("❌ Invalid username. Allowed: a–z, 0–9, '.', '_' (3–24). Must include at least one letter.");
        return;
      }

      if (lower.includes("profiles_instagram_url_check")) {
        setMsg("❌ Invalid Instagram URL.");
        return;
      }

      if (lower.includes("profiles_tiktok_url_check")) {
        setMsg("❌ Invalid TikTok URL.");
        return;
      }

      setMsg("❌ " + message);
    } finally {
      const validation = refreshUsernameUI();
      if (validation.ok && els.saveBtn) {
        els.saveBtn.disabled = false;
      }
      updatePreview();
    }
  }

  async function uploadAvatar() {
    setMsg("");

    const user = await guardAuthOrRedirect();
    if (!user) return;

    if (!els.avatarFile?.files || !els.avatarFile.files[0]) {
      alert("Pick an image first.");
      return;
    }

    if (els.uploadAvatarBtn) {
      els.uploadAvatarBtn.disabled = true;
      els.uploadAvatarBtn.textContent = "Uploading…";
    }
    setHint("Uploading…");

    try {
      const file = els.avatarFile.files[0];
      const url = await uploadAvatarToBucket(file, user.id);

      const { error } = await client
        .from("profiles")
        .upsert({ user_id: user.id, avatar_url: url }, { onConflict: "user_id" });

      if (error) throw error;

      if (els.avatarImg) {
        els.avatarImg.src = url;
      }

      if (els.avatarFile) {
        els.avatarFile.value = "";
      }

      setHint("Uploaded ✅");
      setMsg("Avatar updated ✅");
      updatePreview();
    } catch (err) {
      const message = err?.message || String(err);

      if (String(message).toLowerCase().includes("foreign key")) {
        try {
          await client.auth.signOut();
        } catch (_) {}
        goHome();
        return;
      }

      setHint("Upload failed");
      setMsg("❌ " + message);
    } finally {
      if (els.uploadAvatarBtn) {
        els.uploadAvatarBtn.disabled = false;
        els.uploadAvatarBtn.textContent = "Upload";
      }
    }
  }

  async function removeAvatar() {
    setMsg("");

    const user = await guardAuthOrRedirect();
    if (!user) return;

    try {
      const { error } = await client
        .from("profiles")
        .upsert({ user_id: user.id, avatar_url: null }, { onConflict: "user_id" });

      if (error) throw error;

      if (els.avatarImg) {
        els.avatarImg.src = getLogoPath();
      }

      setHint("Removed ✅");
      setMsg("Avatar removed ✅");
      updatePreview();
    } catch (err) {
      const message = err?.message || String(err);

      if (String(message).toLowerCase().includes("foreign key")) {
        try {
          await client.auth.signOut();
        } catch (_) {}
        goHome();
        return;
      }

      setMsg("❌ " + message);
    }
  }

  async function deleteAccount() {
    setDeleteMsg("");

    if (!window.confirm("Delete account permanently?")) return;
    if (window.prompt("Type DELETE to confirm") !== "DELETE") {
      setDeleteMsg("Cancelled.");
      return;
    }

    if (els.deleteBtn) {
      els.deleteBtn.disabled = true;
    }
    setDeleteMsg("Deleting…");

    try {
      const user = await guardAuthOrRedirect();
      if (!user) return;

      const { error } = await client.functions.invoke("delete-profile", {
        body: { confirm: true },
      });

      if (error) throw error;

      try {
        await client.auth.signOut();
      } catch (_) {}

      goHome();
    } catch (err) {
      setDeleteMsg("❌ " + (err?.message || String(err)));
      if (els.deleteBtn) {
        els.deleteBtn.disabled = false;
      }
    }
  }

  async function copyPreviewLink() {
    const href = els.previewCopyBtn?.dataset?.href || "";
    if (!href) return;

    try {
      const absoluteUrl = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      setPreviewHint("Public profile link copied ✅");
    } catch (_) {
      setPreviewHint("Could not copy link.");
    }
  }

  function bindEvents() {
    els.username?.addEventListener("input", () => {
      refreshUsernameUI();
      updatePreview();
    });

    els.username?.addEventListener("blur", () => {
      refreshUsernameUI();
      updatePreview();
    });

    els.displayName?.addEventListener("input", updatePreview);
    els.bio?.addEventListener("input", updatePreview);
    els.instagram?.addEventListener("input", updatePreview);
    els.tiktok?.addEventListener("input", updatePreview);

    els.uploadAvatarBtn?.addEventListener("click", uploadAvatar);
    els.removeAvatarBtn?.addEventListener("click", removeAvatar);
    els.saveBtn?.addEventListener("click", saveProfile);
    els.deleteBtn?.addEventListener("click", deleteAccount);

    els.previewCopyBtn?.addEventListener("click", copyPreviewLink);

    els.logoutBtn?.addEventListener("click", async () => {
      try {
        await client.auth.signOut();
      } catch (_) {}
      goHome();
    });
  }

  async function initProfilePage() {
    bindEvents();

    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    await loadProfile();
  }

  window.OPProfile = {
    loadProfile,
    saveProfile,
    uploadAvatar,
    removeAvatar,
    deleteAccount,
    updatePreview,
    initProfilePage,
  };

  initProfilePage();
})();
