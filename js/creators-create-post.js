"use strict";

/* =========================================================
   OnlyPaws
   File: /js/create-post.js

   Purpose:
   Create / Edit post page logic.
   ========================================================= */

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
  currentPreviewUrl: null
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
  mediaPreviewEmpty: document.getElementById("mediaPreviewEmpty")
};

function setMessage(text) {
  els.msg.textContent = text || "";
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("op-hidden", hidden);
}

function setEditorEnabled(enabled) {
  els.isPublic.disabled = !enabled;
  els.isPaid.disabled = !enabled;
  els.title.disabled = !enabled;
  els.content.disabled = !enabled;
  els.preview.disabled = !enabled;
  els.mediaFile.disabled = !enabled;
  els.publishBtn.disabled = !enabled;
}

function getFormValues() {
  return {
    title: (els.title.value || "").trim(),
    content: (els.content.value || "").trim(),
    preview: (els.preview.value || "").trim(),
    is_paid: els.isPaid.value === "true",
    is_public: els.isPublic.value === "true"
  };
}

function resetForm() {
  els.title.value = "";
  els.content.value = "";
  els.preview.value = "";
  els.mediaFile.value = "";
  els.isPaid.value = "false";
  els.isPublic.value = "true";

  clearMediaPreview();
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

  els.mediaPreviewImage.removeAttribute("src");

  els.mediaPreviewVideo.pause();
  els.mediaPreviewVideo.removeAttribute("src");
  els.mediaPreviewVideo.load();

  revokePreviewUrl();

  els.mediaPreviewEmpty.textContent = "No media selected.";
}

function updateMediaPreview() {
  const file = els.mediaFile.files?.[0] || null;

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
  els.mediaPreviewEmpty.textContent = "";

  if (mediaType === "image") {
    els.mediaPreviewImage.src = state.currentPreviewUrl;
    setHidden(els.mediaPreviewImage, false);
    return;
  }

  if (mediaType === "video") {
    els.mediaPreviewVideo.src = state.currentPreviewUrl;
    setHidden(els.mediaPreviewVideo, false);
    return;
  }

  els.mediaPreviewEmpty.textContent = "Unsupported preview type.";
}

async function getSessionOrRedirect() {
  const session = await OPAuth.getSession();

  if (!session) {
    window.location.href = OP_PATHS.marketing.fans;
    return null;
  }

  return session;
}

async function requireCreatorAndPlan() {
  const session = await getSessionOrRedirect();
  if (!session) return false;

  state.user = session.user;
  state.profile = await OPAuth.getProfile(state.user.id);

  if (!state.profile || state.profile.role !== "creator") {
    window.location.href = OP_PATHS.marketing.home;
    return false;
  }

  state.creatorPlanActive = await OPAuth.isCreatorPlanActive(state.user.id);

  if (!state.creatorPlanActive) {
    setHidden(els.creatorLockBox, false);
    setEditorEnabled(false);
    setMessage("Creator Plan required to publish posts.");
    return false;
  }

  setHidden(els.creatorLockBox, true);
  setEditorEnabled(true);
  setMessage("");

  return true;
}

function enableEditModeUI() {
  setHidden(els.modePill, false);
  setHidden(els.cancelEditBtn, false);

  els.modePill.textContent = "Edit Post";
  document.title = "OnlyPaws — Edit Post";
  els.pageTitle.textContent = "Edit post";
  els.pageSub.innerHTML = 'Update your post. Changes save into <b>posts</b>.';
  els.publishBtn.textContent = "Save changes";
}

async function loadPostForEdit(postId) {
  setMessage("Loading post…");
  enableEditModeUI();

  const { data, error } = await onlypawsClient
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

  els.title.value = data.title || "";
  els.content.value = data.content || "";
  els.preview.value = data.preview || "";
  els.isPaid.value = data.is_paid ? "true" : "false";
  els.isPublic.value = data.is_public === false ? "false" : "true";

  setMessage("Loaded ✅");
}

async function uploadMedia(postId) {
  const file = els.mediaFile.files?.[0] || null;
  if (!file) return { media_url: null, media_type: "none" };

  const media_type = detectMediaType(file);
  if (media_type === "none") {
    throw new Error("Unsupported file type. Use image/video only.");
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    throw new Error(`File too large (${sizeMb.toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.`);
  }

  const path = `uploads/${state.user.id}/${postId}/${Date.now()}_${safeFileName(file.name)}`;

  const { error: uploadError } = await onlypawsClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
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

  let media_url = null;

  if (STORAGE_BUCKET_IS_PUBLIC) {
    const { data } = onlypawsClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    media_url = data?.publicUrl || null;
  } else {
    media_url = path;
  }

  return { media_url, media_type };
}

async function createPost(values) {
  const { data, error } = await onlypawsClient
    .from("posts")
    .insert([{
      creator_id: state.user.id,
      title: values.title,
      content: values.content,
      preview: values.preview || null,
      is_paid: values.is_paid,
      is_public: values.is_public,
      media_type: "none",
      media_url: null
    }])
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function updatePost(postId, values) {
  const { error } = await onlypawsClient
    .from("posts")
    .update({
      title: values.title,
      content: values.content,
      preview: values.preview || null,
      is_paid: values.is_paid,
      is_public: values.is_public,
      creator_id: state.user.id
    })
    .eq("id", postId)
    .eq("creator_id", state.user.id);

  if (error) throw error;
}

async function attachUploadedMediaToPost(postId) {
  const hasFile = !!els.mediaFile.files?.[0];
  if (!hasFile) return;

  setMessage("Uploading media…");

  const { media_url, media_type } = await uploadMedia(postId);
  if (!media_url) return;

  const { error } = await onlypawsClient
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

  if (!state.creatorPlanActive) {
    throw new Error("Creator Plan required.");
  }

  if (!values.title) {
    throw new Error("Title is required.");
  }

  if (!values.content) {
    throw new Error("Content is required.");
  }

  if (editId && !state.editingPost) {
    throw new Error("Edit mode not ready.");
  }
}

async function publishOrUpdate() {
  els.publishBtn.disabled = true;
  setMessage(editId ? "Saving…" : "Publishing…");

  try {
    const values = getFormValues();
    validateBeforeSubmit(values);

    if (editId) {
      await updatePost(editId, values);
      await attachUploadedMediaToPost(editId);

      setMessage("Saved ✅");
      els.mediaFile.value = "";
      clearMediaPreview();
      return;
    }

    const newPostId = await createPost(values);
    await attachUploadedMediaToPost(newPostId);

    setMessage("Published ✅");
    resetForm();
  } catch (error) {
    console.warn(error);
    setMessage(error.message || String(error));
  } finally {
    els.publishBtn.disabled = false;
  }
}

async function handleLogoutClick() {
  await onlypawsClient.auth.signOut();
  window.location.href = OP_PATHS.marketing.home;
}

async function initPage() {
  await loadLayout();
  await initNav();

  els.unlockBtn.href = CREATOR_PLAN_URL;
  els.cancelEditBtn.href = OP_PATHS.app.creators.creatorDash;

  els.publishBtn.addEventListener("click", publishOrUpdate);
  els.refreshBtn.addEventListener("click", () => window.location.reload());
  els.mediaFile.addEventListener("change", updateMediaPreview);

  const navLogout = document.getElementById("navLogout");
  if (navLogout) {
    navLogout.addEventListener("click", handleLogoutClick);
  }

  clearMediaPreview();

  const hasAccess = await requireCreatorAndPlan();
  if (!hasAccess) return;

  if (!editId) return;

  try {
    await loadPostForEdit(editId);
  } catch (error) {
    setMessage(error.message || String(error));
    setEditorEnabled(false);
  }
}

window.addEventListener("DOMContentLoaded", initPage);
