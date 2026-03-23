"use strict";

/* =========================================================
   OnlyPaws
   File: /js/app/creators/create-post.js
   Purpose: create and edit creator posts

   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPPartials
   - window.OPNav
   - window.OPAuth
   - window.OPCreatorPlan
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;
  const client = window.onlypawsClient;

  const CREATOR_PLAN_URL = "https://buy.stripe.com/5kQbJ25UY5qegpM4kD5wI02";

  const STORAGE_BUCKET = "posts";
  const STORAGE_BUCKET_IS_PUBLIC = true;
  const MAX_FILE_SIZE_MB = 25;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");

  const state = {
    user: null,
    profile: null,
    creatorPlanActive: false,
    creatorTrialActive: false,
    creatorTrialDaysLeft: 0,
    creatorMonetizationActive: false,
    editingPost: null,
    currentPreviewUrl: null,
    isSubmitting: false,
  };

  const els = {
    form: document.getElementById("createPostForm") || document.querySelector("form"),
    msg: document.getElementById("msg"),
    publishBtn: document.getElementById("publishBtn"),

    creatorLockBox: document.getElementById("creatorLockBox"),
    unlockBtn: document.getElementById("unlockBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    modePill: document.getElementById("modePill"),
    pageTitle: document.getElementById("pageTitle"),
    pageSub: document.getElementById("pageSub"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),

    isPublic: document.getElementById("is_public"),
    isPaid: document.getElementById("is_paid"),
    title: document.getElementById("title"),
    content: document.getElementById("content"),
    preview: document.getElementById("preview"),
    mediaFile: document.getElementById("mediaFile"),
    mediaField: document.getElementById("mediaField"),
    mediaMeta: document.getElementById("mediaMeta"),

    previewVisibilityPill: document.getElementById("previewVisibilityPill"),
    previewTypePill: document.getElementById("previewTypePill"),
    previewTitleText: document.getElementById("previewTitleText"),
    previewContentText: document.getElementById("previewContentText"),
    previewLockedBox: document.getElementById("previewLockedBox"),
    previewTeaserText: document.getElementById("previewTeaserText"),
    previewMediaWrap: document.getElementById("previewMediaWrap"),
    previewImage: document.getElementById("previewImage"),
    previewVideo: document.getElementById("previewVideo"),
    previewMediaEmpty: document.getElementById("previewMediaEmpty"),
  };

  function setMessage(text) {
    if (!els.msg) return;
    els.msg.textContent = text || "";
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle("op-hidden", !!hidden);
    element.hidden = !!hidden;
  }

  function creatorDashHref() {
    if (ROUTES?.href && ROUTES.has?.("app.creators.creatorDash")) {
      return ROUTES.href("app.creators.creatorDash");
    }
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "creator-dash.html";
    }
    return PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html";
  }

  function creatorsLoginHref() {
    if (ROUTES?.href && ROUTES.has?.("marketing.creators")) {
      return ROUTES.href("marketing.creators");
    }
    if (ROUTES?.get) {
      return ROUTES.get("marketing.creators") || "creators.html";
    }
    return PATHS?.marketing?.creators || "/html/marketing/creators.html";
  }

  function homeHref() {
    if (ROUTES?.href && ROUTES.has?.("home")) {
      return ROUTES.href("home");
    }
    if (ROUTES?.href && ROUTES.has?.("index")) {
      return ROUTES.href("index");
    }
    if (ROUTES?.get) {
      return ROUTES.get("home") || ROUTES.get("index") || "index.html";
    }
    return PATHS?.home || PATHS?.index || "/index.html";
  }

  function feedHref() {
    if (ROUTES?.href && ROUTES.has?.("app.feed")) {
      return ROUTES.href("app.feed");
    }
    if (ROUTES?.get) {
      return ROUTES.get("app.feed") || "feed.html";
    }
    return PATHS?.app?.feed || "/html/app/feed.html";
  }

  function isDraftSelected() {
    return els.isPublic?.value === "false";
  }

  function getFormValues() {
    const isDraft = isDraftSelected();

    return {
      title: (els.title?.value || "").trim(),
      content: (els.content?.value || "").trim(),
      preview: (els.preview?.value || "").trim(),
      is_paid: els.isPaid?.value === "true",
      is_public: !isDraft,
    };
  }

  function setEditorEnabled(enabled) {
    if (els.isPublic) els.isPublic.disabled = !enabled;
    if (els.isPaid) els.isPaid.disabled = !enabled || !state.creatorMonetizationActive;
    if (els.title) els.title.disabled = !enabled;
    if (els.content) els.content.disabled = !enabled;
    if (els.preview) els.preview.disabled = !enabled;
    if (els.mediaFile) els.mediaFile.disabled = !enabled;
    if (els.publishBtn) els.publishBtn.disabled = !enabled;
  }

  function getCreatorAccessMessage() {
    if (state.creatorTrialActive) {
      const days = state.creatorTrialDaysLeft;
      if (days > 0) {
        return `Your early creator trial is active — ${days} day${days === 1 ? "" : "s"} left.`;
      }
      return "Your early creator trial is active.";
    }

    if (!state.creatorMonetizationActive) {
      return "You can publish free posts already. Creator Plan unlocks premium posts and monetization.";
    }

    return "";
  }

  function updatePlanUI() {
    const hasMonetization = !!state.creatorMonetizationActive;

    if (els.creatorLockBox) {
      setHidden(els.creatorLockBox, hasMonetization);
    }

    if (els.isPaid) {
      if (hasMonetization) {
        els.isPaid.disabled = false;
      } else {
        els.isPaid.value = "false";
        els.isPaid.disabled = true;
      }
    }

    syncPostPreview();
  }

  function resetForm() {
    if (els.title) els.title.value = "";
    if (els.content) els.content.value = "";
    if (els.preview) els.preview.value = "";
    if (els.mediaFile) els.mediaFile.value = "";
    if (els.isPaid) els.isPaid.value = "false";
    if (els.isPublic) els.isPublic.value = "true";

    state.editingPost = null;

    clearLocalMediaPreview();
    updatePlanUI();
    syncPostPreview();
  }

  function detectMediaType(file) {
    if (!file) return "none";
    if (file.type && file.type.startsWith("image/")) return "image";
    if (file.type && file.type.startsWith("video/")) return "video";
    return "none";
  }

  function safeFileName(name) {
    return (name || "file").replace(/[^\w.\-]+/g, "_");
  }

  function revokePreviewUrl() {
    if (!state.currentPreviewUrl) return;
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }

  function clearLocalMediaPreview() {
    revokePreviewUrl();

    if (els.previewImage) {
      els.previewImage.removeAttribute("src");
    }

    if (els.previewVideo) {
      els.previewVideo.pause();
      els.previewVideo.removeAttribute("src");
      els.previewVideo.load();
    }

    setHidden(els.previewImage, true);
    setHidden(els.previewVideo, true);
    setHidden(els.previewMediaWrap, true);

    if (els.previewMediaEmpty) {
      els.previewMediaEmpty.textContent = "No media selected yet.";
      setHidden(els.previewMediaEmpty, false);
    }

    if (els.mediaMeta) {
      els.mediaMeta.textContent = "Image or video · max 25MB";
    }
  }

  function syncPostPreviewText() {
    const values = getFormValues();
    const isDraft = !values.is_public;

    if (els.previewVisibilityPill) {
      els.previewVisibilityPill.textContent = isDraft ? "Draft" : "Public";
    }

    if (els.previewTypePill) {
      els.previewTypePill.textContent = values.is_paid ? "🔒 PREMIUM" : "🆓 FREE";
      els.previewTypePill.classList.toggle("isPremium", values.is_paid);
      els.previewTypePill.classList.toggle("isFree", !values.is_paid);
    }

    if (els.previewTitleText) {
      els.previewTitleText.textContent = values.title || "Your post title";
    }

    if (els.previewContentText) {
      els.previewContentText.textContent =
        values.content || "Start writing to see your post preview here…";
    }

    if (values.is_paid) {
      if (els.previewTeaserText) {
        els.previewTeaserText.textContent =
          values.preview || "Short teaser shown when the premium post is locked.";
      }
      setHidden(els.previewLockedBox, false);
    } else {
      setHidden(els.previewLockedBox, true);
    }
  }

  function syncPostPreview() {
    syncPostPreviewText();
  }

  function updateMediaPreview() {
    const file = els.mediaFile?.files?.[0] || null;

    if (!file) {
      clearLocalMediaPreview();
      return;
    }

    const mediaType = detectMediaType(file);
    revokePreviewUrl();

    const sizeMb = file.size / (1024 * 1024);

    if (els.mediaMeta) {
      els.mediaMeta.textContent = `${file.name} · ${sizeMb.toFixed(1)}MB`;
    }

    if (mediaType === "none") {
      setHidden(els.previewMediaWrap, true);

      if (els.previewMediaEmpty) {
        els.previewMediaEmpty.textContent = "Unsupported preview type.";
        setHidden(els.previewMediaEmpty, false);
      }

      setHidden(els.previewImage, true);
      setHidden(els.previewVideo, true);
      return;
    }

    state.currentPreviewUrl = URL.createObjectURL(file);

    setHidden(els.previewMediaWrap, false);
    setHidden(els.previewMediaEmpty, true);
    setHidden(els.previewImage, true);
    setHidden(els.previewVideo, true);

    if (mediaType === "image") {
      if (els.previewImage) {
        els.previewImage.src = state.currentPreviewUrl;
      }
      setHidden(els.previewImage, false);
      return;
    }

    if (mediaType === "video") {
      if (els.previewVideo) {
        els.previewVideo.src = state.currentPreviewUrl;
      }
      setHidden(els.previewVideo, false);
    }
  }

  function normalizeErrorMessage(error) {
    const rawMessage = error?.message || String(error || "");

    if (/failed to fetch/i.test(rawMessage)) {
      return "Network error while publishing. Check Supabase, Storage, or interrupted requests.";
    }

    return rawMessage || "Something went wrong.";
  }

  async function getSessionOrRedirect() {
    const session = await window.OPAuth.getSession();

    if (!session) {
      window.location.replace(creatorsLoginHref());
      return null;
    }

    return session;
  }

  async function requireCreator() {
    const session = await getSessionOrRedirect();
    if (!session) return false;

    state.user = session.user;
    state.profile = await window.OPAuth.getProfile(state.user.id);

    if (!state.profile || state.profile.role !== "creator") {
      window.location.replace(homeHref());
      return false;
    }

    if (!window.OPCreatorPlan) {
      throw new Error("Creator Plan module not loaded.");
    }

    const access = await window.OPCreatorPlan.getCreatorAccessState(state.user.id);

    state.creatorPlanActive = !!access.hasCreatorPlan;
    state.creatorTrialActive = !!access.hasActiveTrial;
    state.creatorTrialDaysLeft = Number(access.trialDaysLeft || 0);
    state.creatorMonetizationActive = !!access.canUseCreatorFeatures;

    setEditorEnabled(true);
    updatePlanUI();
    setMessage(getCreatorAccessMessage());

    return true;
  }

  function enableEditModeUI() {
    setHidden(els.modePill, false);
    setHidden(els.cancelEditBtn, false);

    if (els.modePill) els.modePill.textContent = "Edit Post";
    document.title = "OnlyPaws — Edit Post";

    if (els.pageTitle) els.pageTitle.textContent = "Edit post";
    if (els.pageSub) {
      els.pageSub.innerHTML = "Update your post. Changes save into <b>posts</b>.";
    }
    if (els.publishBtn) {
      els.publishBtn.textContent = "Save changes";
    }
  }

  async function loadPostForEdit(postId) {
    setMessage("Loading post…");
    enableEditModeUI();

    const { data, error } = await client
      .from("posts")
      .select("id, title, content, preview, is_paid, is_public, media_url, media_type, creator_id")
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Post not found.");
    if (data.creator_id !== state.user.id) {
      throw new Error("Not allowed: this post is not yours.");
    }

    state.editingPost = data;

    if (els.title) els.title.value = data.title || "";
    if (els.content) els.content.value = data.content || "";
    if (els.preview) els.preview.value = data.preview || "";

    if (els.isPaid) {
      if (state.creatorMonetizationActive) {
        els.isPaid.value = data.is_paid ? "true" : "false";
      } else {
        els.isPaid.value = "false";
      }
    }

    if (els.isPublic) {
      els.isPublic.value = data.is_public === false ? "false" : "true";
    }

    updatePlanUI();
    clearLocalMediaPreview();
    syncPostPreview();
    setMessage("Loaded ✅");
  }

  async function uploadMedia(postId) {
    const file = els.mediaFile?.files?.[0] || null;
    if (!file) return { media_url: null, media_type: "none" };

    const mediaType = detectMediaType(file);
    if (mediaType === "none") {
      throw new Error("Unsupported file type. Use image/video only.");
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      throw new Error(`File too large (${sizeMb.toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.`);
    }

    const path = `uploads/${state.user.id}/${postId}/${Date.now()}_${safeFileName(file.name)}`;

    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      const lowerMessage = (uploadError.message || "").toLowerCase();

      if (lowerMessage.includes("bucket") && lowerMessage.includes("not found")) {
        throw new Error(
          `Bucket "${STORAGE_BUCKET}" not found. Create it in Supabase Storage → Buckets.`
        );
      }

      throw uploadError;
    }

    let mediaUrl = null;

    if (STORAGE_BUCKET_IS_PUBLIC) {
      const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      mediaUrl = data?.publicUrl || null;
    } else {
      mediaUrl = path;
    }

    return { media_url: mediaUrl, media_type: mediaType };
  }

  async function createPost(values) {
    const { data, error } = await client
      .from("posts")
      .insert([
        {
          creator_id: state.user.id,
          title: values.title,
          content: values.content,
          preview: values.preview || null,
          is_paid: values.is_paid,
          is_public: values.is_public,
          media_type: "none",
          media_url: null,
        },
      ])
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async function updatePost(postId, values) {
    const { error } = await client
      .from("posts")
      .update({
        title: values.title,
        content: values.content,
        preview: values.preview || null,
        is_paid: values.is_paid,
        is_public: values.is_public,
      })
      .eq("id", postId)
      .eq("creator_id", state.user.id);

    if (error) throw error;
  }

  async function attachUploadedMediaToPost(postId) {
    const hasFile = !!els.mediaFile?.files?.[0];
    if (!hasFile) return;

    setMessage("Uploading media…");

    const { media_url, media_type } = await uploadMedia(postId);
    if (!media_url) return;

    const { error } = await client
      .from("posts")
      .update({ media_url, media_type })
      .eq("id", postId)
      .eq("creator_id", state.user.id);

    if (error) throw error;
  }

  function validateBeforeSubmit(values) {
    if (!client) {
      throw new Error("Supabase client not available.");
    }

    if (!state.user || !state.profile || state.profile.role !== "creator") {
      throw new Error("Not allowed.");
    }

    if (!values.title) {
      throw new Error("Title is required.");
    }

    if (!values.content) {
      throw new Error("Content is required.");
    }

    if (values.is_paid && !state.creatorMonetizationActive) {
      throw new Error("Creator Plan or active trial required for premium posts.");
    }

    if (editId && !state.editingPost) {
      throw new Error("Edit mode not ready.");
    }
  }

  async function publishOrUpdate(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (state.isSubmitting) return;
    state.isSubmitting = true;

    if (els.publishBtn) {
      els.publishBtn.disabled = true;
    }

    const isEditing = !!editId;
    const isDraft = isDraftSelected();

    setMessage(isEditing ? "Saving…" : isDraft ? "Saving draft…" : "Publishing…");

    try {
      const values = getFormValues();
      validateBeforeSubmit(values);

      console.log("[create-post] submit", {
        editId,
        isEditing,
        values,
        hasFile: !!els.mediaFile?.files?.[0],
        creatorPlanActive: state.creatorPlanActive,
        creatorTrialActive: state.creatorTrialActive,
        creatorTrialDaysLeft: state.creatorTrialDaysLeft,
        creatorMonetizationActive: state.creatorMonetizationActive,
        userId: state.user?.id || null,
      });

      if (editId) {
        await updatePost(editId, values);
        await attachUploadedMediaToPost(editId);

        setMessage(values.is_public ? "Saved ✅" : "Draft saved ✅");

        if (els.mediaFile) {
          els.mediaFile.value = "";
        }

        clearLocalMediaPreview();
        syncPostPreview();

        window.location.href = feedHref();
        return;
      }

      const newPostId = await createPost(values);
      await attachUploadedMediaToPost(newPostId);

      setMessage(values.is_public ? "Published ✅" : "Draft saved ✅");
      resetForm();

      window.location.href = feedHref();
    } catch (error) {
      console.error("[create-post] publish failed", error);
      setMessage(normalizeErrorMessage(error));
    } finally {
      state.isSubmitting = false;

      if (els.publishBtn) {
        els.publishBtn.disabled = false;
      }
    }
  }

  function bindPreviewListeners() {
    if (els.title) {
      els.title.addEventListener("input", syncPostPreview);
    }

    if (els.content) {
      els.content.addEventListener("input", syncPostPreview);
    }

    if (els.preview) {
      els.preview.addEventListener("input", syncPostPreview);
    }

    if (els.isPublic) {
      els.isPublic.addEventListener("change", () => {
        syncPostPreview();

        if (isDraftSelected()) {
          setMessage("Draft mode: this post should only be visible to you.");
        } else {
          setMessage(getCreatorAccessMessage());
        }
      });
    }

    if (els.isPaid) {
      els.isPaid.addEventListener("change", () => {
        if (!state.creatorMonetizationActive && els.isPaid.value === "true") {
          els.isPaid.value = "false";
          setMessage("Creator Plan or active trial required for premium posts.");
        }

        syncPostPreview();
      });
    }

    if (els.mediaFile) {
      els.mediaFile.addEventListener("change", updateMediaPreview);
    }
  }

  async function initPage() {
    await window.OPPartials.loadLayout();
    await window.OPNav.initNav();

    if (!client) {
      setMessage("Supabase client not available.");
      setEditorEnabled(false);
      return;
    }

    if (els.unlockBtn) {
      els.unlockBtn.href = CREATOR_PLAN_URL;
    }

    if (els.cancelEditBtn) {
      els.cancelEditBtn.href = creatorDashHref();
    }

    if (els.form) {
      els.form.addEventListener("submit", publishOrUpdate);
    }

    if (els.publishBtn) {
      els.publishBtn.addEventListener("click", publishOrUpdate);
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", () => window.location.reload());
    }

    bindPreviewListeners();
    clearLocalMediaPreview();
    syncPostPreview();

    const hasAccess = await requireCreator();
    if (!hasAccess) return;

    if (!editId) return;

    try {
      await loadPostForEdit(editId);
    } catch (error) {
      setMessage(error?.message || String(error));
      setEditorEnabled(false);
    }
  }

  window.addEventListener("beforeunload", revokePreviewUrl);
  window.addEventListener("DOMContentLoaded", initPage);
})();
