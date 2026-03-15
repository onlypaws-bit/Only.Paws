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
    editingPost: null,
    currentPreviewUrl: null,
  };

  const els = {
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

    mediaPreviewWrap: document.getElementById("mediaPreviewWrap"),
    mediaPreviewImage: document.getElementById("mediaPreviewImage"),
    mediaPreviewVideo: document.getElementById("mediaPreviewVideo"),
    mediaPreviewEmpty: document.getElementById("mediaPreviewEmpty"),
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
    if (ROUTES?.get) {
      return ROUTES.get("app.creators.creatorDash") || "creator-dash.html";
    }
    return PATHS?.app?.creators?.creatorDash || "/html/app/creators/creator-dash.html";
  }

  function creatorsLoginHref() {
    if (ROUTES?.get) {
      return ROUTES.get("marketing.creators") || "creators.html";
    }
    return PATHS?.marketing?.creators || "/html/marketing/creators.html";
  }

  function homeHref() {
    if (ROUTES?.get) {
      return ROUTES.get("home") || ROUTES.get("index") || "index.html";
    }
    return PATHS?.home || PATHS?.index || "/index.html";
  }

  function setEditorEnabled(enabled) {
    if (els.isPublic) els.isPublic.disabled = !enabled;
    if (els.title) els.title.disabled = !enabled;
    if (els.content) els.content.disabled = !enabled;
    if (els.preview) els.preview.disabled = !enabled;
    if (els.mediaFile) els.mediaFile.disabled = !enabled;
    if (els.publishBtn) els.publishBtn.disabled = !enabled;

    if (els.isPaid) {
      if (enabled) {
        els.isPaid.disabled = !state.creatorPlanActive;
      } else {
        els.isPaid.disabled = true;
      }
    }
  }

  function updatePlanUI() {
    if (state.creatorPlanActive) {
      setHidden(els.creatorLockBox, true);
      if (els.isPaid) els.isPaid.disabled = false;
      return;
    }

    setHidden(els.creatorLockBox, false);

    if (els.isPaid) {
      els.isPaid.value = "false";
      els.isPaid.disabled = true;
    }
  }

  function getFormValues() {
    return {
      title: (els.title?.value || "").trim(),
      content: (els.content?.value || "").trim(),
      preview: (els.preview?.value || "").trim(),
      is_paid: state.creatorPlanActive ? els.isPaid?.value === "true" : false,
      is_public: els.isPublic?.value === "true",
    };
  }

  function resetForm() {
    if (els.title) els.title.value = "";
    if (els.content) els.content.value = "";
    if (els.preview) els.preview.value = "";
    if (els.mediaFile) els.mediaFile.value = "";
    if (els.isPaid) els.isPaid.value = "false";
    if (els.isPublic) els.isPublic.value = "true";

    clearMediaPreview();
    updatePlanUI();
  }

  function detectMediaType(file) {
    if (!file) return "none";
    if (file.type?.startsWith("image/")) return "image";
    if (file.type?.startsWith("video/")) return "video";
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

  function clearMediaPreview() {
    setHidden(els.mediaPreviewWrap, true);
    setHidden(els.mediaPreviewImage, true);
    setHidden(els.mediaPreviewVideo, true);

    if (els.mediaPreviewImage) {
      els.mediaPreviewImage.removeAttribute("src");
    }

    if (els.mediaPreviewVideo) {
      els.mediaPreviewVideo.pause();
      els.mediaPreviewVideo.removeAttribute("src");
      els.mediaPreviewVideo.load();
    }

    revokePreviewUrl();

    if (els.mediaPreviewEmpty) {
      els.mediaPreviewEmpty.textContent = "No media selected.";
    }
  }

  function updateMediaPreview() {
    const file = els.mediaFile?.files?.[0] || null;

    if (!file) {
      clearMediaPreview();
      return;
    }

    const mediaType = detectMediaType(file);
    revokePreviewUrl();

    state.currentPreviewUrl = URL.createObjectURL(file);

    setHidden(els.mediaPreviewWrap, false);
    setHidden(els.mediaPreviewImage, true);
    setHidden(els.mediaPreviewVideo, true);

    if (els.mediaPreviewEmpty) {
      els.mediaPreviewEmpty.textContent = "";
    }

    if (mediaType === "image") {
      if (els.mediaPreviewImage) {
        els.mediaPreviewImage.src = state.currentPreviewUrl;
      }
      setHidden(els.mediaPreviewImage, false);
      return;
    }

    if (mediaType === "video") {
      if (els.mediaPreviewVideo) {
        els.mediaPreviewVideo.src = state.currentPreviewUrl;
      }
      setHidden(els.mediaPreviewVideo, false);
      return;
    }

    if (els.mediaPreviewEmpty) {
      els.mediaPreviewEmpty.textContent = "Unsupported preview type.";
    }
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

    const entitlement = await window.OPCreatorPlan.getCreatorPlanEntitlement(state.user.id);
    state.creatorPlanActive = window.OPCreatorPlan.isCreatorPlanActive(entitlement);

    setEditorEnabled(true);
    updatePlanUI();

    if (!state.creatorPlanActive) {
      setMessage("Creator Plan unlocks premium posts and monetization. You can still publish free posts.");
    } else {
      setMessage("");
    }

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
    if (els.isPaid) els.isPaid.value = data.is_paid ? "true" : "false";
    if (els.isPublic) els.isPublic.value = data.is_public === false ? "false" : "true";

    updatePlanUI();
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
        creator_id: state.user.id,
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
    if (!state.user || !state.profile || state.profile.role !== "creator") {
      throw new Error("Not allowed.");
    }

    if (!values.title) {
      throw new Error("Title is required.");
    }

    if (!values.content) {
      throw new Error("Content is required.");
    }

    if (values.is_paid && !state.creatorPlanActive) {
      throw new Error("Creator Plan required for premium posts.");
    }

    if (editId && !state.editingPost) {
      throw new Error("Edit mode not ready.");
    }
  }

  async function publishOrUpdate() {
    if (els.publishBtn) {
      els.publishBtn.disabled = true;
    }

    setMessage(editId ? "Saving…" : "Publishing…");

    try {
      const values = getFormValues();
      validateBeforeSubmit(values);

      if (editId) {
        await updatePost(editId, values);
        await attachUploadedMediaToPost(editId);

        setMessage("Saved ✅");
        if (els.mediaFile) els.mediaFile.value = "";
        clearMediaPreview();
        updatePlanUI();
        return;
      }

      const newPostId = await createPost(values);
      await attachUploadedMediaToPost(newPostId);

      setMessage("Published ✅");
      resetForm();
    } catch (error) {
      console.warn(error);
      setMessage(error?.message || String(error));
    } finally {
      if (els.publishBtn) {
        els.publishBtn.disabled = false;
      }
    }
  }

  async function initPage() {
    await window.OPPartials.loadLayout();
    await window.OPNav.initNav();

    if (els.unlockBtn) {
      els.unlockBtn.href = CREATOR_PLAN_URL;
    }

    if (els.cancelEditBtn) {
      els.cancelEditBtn.href = creatorDashHref();
    }

    if (els.publishBtn) {
      els.publishBtn.addEventListener("click", publishOrUpdate);
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", () => window.location.reload());
    }

    if (els.mediaFile) {
      els.mediaFile.addEventListener("change", updateMediaPreview);
    }

    if (els.isPaid) {
      els.isPaid.addEventListener("change", () => {
        if (!state.creatorPlanActive && els.isPaid.value === "true") {
          els.isPaid.value = "false";
          setMessage("Creator Plan required for premium posts.");
        }
      });
    }

    clearMediaPreview();

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

  window.addEventListener("DOMContentLoaded", initPage);
})();