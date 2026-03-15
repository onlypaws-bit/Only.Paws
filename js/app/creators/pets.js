/* =========================================================
   OnlyPaws
   File: /js/app/creators/pets.js
   Purpose: manage creator pets
   Dependencies:
   - window.onlypawsClient
   - window.OP_PATHS
   - window.OPRoutes
   - window.OPPartials
   - window.OPNav
   - window.OPAuth
   ========================================================= */

(function () {

  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || null;

  const PET_AVATAR_BUCKET = "pets";

  const addHint = document.getElementById("addHint") || { textContent: "" };
  const listHint = document.getElementById("listHint");
  const petsList = document.getElementById("petsList");

  const fName = document.getElementById("fName");
  const fSpecies = document.getElementById("fSpecies");
  const fBreed = document.getElementById("fBreed");
  const fBirth = document.getElementById("fBirth");
  const fAge = document.getElementById("fAge");
  const fAvatarFile = document.getElementById("fAvatarFile");
  const fBio = document.getElementById("fBio");

  const addBtn = document.getElementById("addBtn");
  const resetBtn = document.getElementById("resetBtn");

  function goHome() {

    if (ROUTES?.replace) {
      ROUTES.replace("home");
      return;
    }

    window.location.replace(PATHS?.home || "/index.html");

  }

  function creatorsLoginHref() {

    if (ROUTES?.get) {
      return ROUTES.get("marketing.creators") || "creators.html";
    }

    return PATHS?.marketing?.creators || "/html/marketing/creators.html";

  }

  function esc(value) {
    return (value ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clearForm() {

    fName.value = "";
    fSpecies.value = "";
    fBreed.value = "";
    fBirth.value = "";
    fAge.value = "";
    fBio.value = "";

    if (fAvatarFile) {
      fAvatarFile.value = "";
    }

  }

  function getExtFromFile(file) {

    const name = (file?.name || "").toLowerCase();
    const dot = name.lastIndexOf(".");

    return dot >= 0 ? name.slice(dot + 1) : "jpg";

  }

  async function requireCreatorSession() {

    const session = await window.OPAuth.getSession();

    if (!session) {
      window.location.replace(creatorsLoginHref());
      return null;
    }

    const profile = await window.OPAuth.getProfile(session.user.id);

    if (!profile || profile.role !== "creator") {
      goHome();
      return null;
    }

    return { session, profile };

  }

  async function uploadPetAvatar(ownerId, petId, file) {

    if (!file) return null;

    const ext = getExtFromFile(file);
    const path = `${ownerId}/${petId}/${Date.now()}.${ext}`;

    const upload = await client
      .storage
      .from(PET_AVATAR_BUCKET)
      .upload(path, file, { upsert: true });

    if (upload.error) throw upload.error;

    const pub = client
      .storage
      .from(PET_AVATAR_BUCKET)
      .getPublicUrl(path);

    const url = pub?.data?.publicUrl;

    if (!url) {
      throw new Error("Could not get public URL for uploaded file");
    }

    return url;

  }

  function renderPets(list) {

    if (!list || list.length === 0) {

      petsList.innerHTML =
        `<div class="hint">No pets yet.</div>`;

      return;
    }

    petsList.innerHTML = list.map((pet) => {

      const avatar = pet.avatar_url
        ? `<img class="avatarMini" src="${esc(pet.avatar_url)}" alt="pet avatar">`
        : `<div class="avatarMini">🐾</div>`;

      const species = pet.species ? `• ${pet.species}` : "";
      const breed = pet.breed ? `• ${pet.breed}` : "";

      const born =
        pet.birth_date
          ? new Date(pet.birth_date).toLocaleDateString()
          : "";

      const age =
        pet.age_years != null && pet.age_years !== ""
          ? `${pet.age_years}y`
          : "";

      const topLine = [
        species,
        breed,
        born ? `• born ${born}` : "",
        age ? `• ${age}` : ""
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return `
        <div class="rowCard" data-id="${esc(pet.id)}">

          ${avatar}

          <div class="meta">

            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
              <span class="badge">🐾 PET</span>
              ${pet.created_at
                ? `<span class="badge">📅 ${esc(new Date(pet.created_at).toLocaleDateString())}</span>`
                : ""}
            </div>

            <b>
              ${esc(pet.name || "Pet")}
              ${
                topLine
                  ? `<span style="opacity:.9;font-weight:800;"> ${esc(topLine)}</span>`
                  : ""
              }
            </b>

            <div class="small" style="margin-top:6px;">
              ${esc(pet.bio || "")}
            </div>

            <div class="divider"></div>

            <div class="field" style="margin-top:10px;">

              <div class="label">Edit basics</div>

              <input data-k="name" placeholder="Name" value="${esc(pet.name || "")}">
              <input data-k="species" placeholder="Species" value="${esc(pet.species || "")}">
              <input data-k="breed" placeholder="Breed" value="${esc(pet.breed || "")}">

              <input
                data-k="birth_date"
                type="date"
                value="${
                  pet.birth_date
                    ? esc(String(pet.birth_date).slice(0,10))
                    : ""
                }"
              >

              <input
                data-k="age_years"
                type="number"
                min="0"
                step="1"
                placeholder="Age years"
                value="${esc(pet.age_years ?? "")}"
              >

              <textarea data-k="bio" placeholder="Bio">${esc(pet.bio || "")}</textarea>

            </div>

            <div class="field">
              <div class="label">Change pet photo</div>
              <input data-kfile="avatar" type="file" accept="image/*">
            </div>

            <div class="btnRow">
              <button class="ghost" data-action="save">Save</button>
              <button class="ghost danger" data-action="delete">Delete</button>
            </div>

          </div>

        </div>
      `;

    }).join("");

    bindPetRowEvents(list);

  }

  function bindPetRowEvents(list) {

    petsList.querySelectorAll('[data-action="save"]').forEach((btn) => {

      btn.addEventListener("click", async () => {

        const row = btn.closest(".rowCard");
        const id = row?.getAttribute("data-id");

        if (!id) return;

        btn.disabled = true;
        btn.textContent = "Saving…";
        listHint.textContent = "";

        try {

          const auth = await requireCreatorSession();
          if (!auth) throw new Error("Not logged in");

          const payload = {};

          row.querySelectorAll("[data-k]").forEach((input) => {

            const key = input.getAttribute("data-k");
            let value = input.value;

            if (key === "age_years") {

              value = value === "" ? null : Number(value);
              if (value != null && Number.isNaN(value)) value = null;

            } else if (key === "birth_date") {

              value = value === "" ? null : value;

            } else {

              value = value.trim() === "" ? null : value.trim();

            }

            payload[key] = value;

          });

          const fileInput = row.querySelector("[data-kfile='avatar']");
          const file = fileInput?.files?.[0] || null;

          if (file) {

            const url =
              await uploadPetAvatar(auth.session.user.id, id, file);

            payload.avatar_url = url;

          }

          const { error } = await client
            .from("pets")
            .update(payload)
            .eq("id", id)
            .eq("owner_id", auth.session.user.id);

          if (error) throw error;

          listHint.textContent = "Saved ✅";

          await loadPets(auth.session.user.id);

        } catch (error) {

          alert("❌ Save failed: " + (error?.message || String(error)));

        } finally {

          btn.disabled = false;
          btn.textContent = "Save";

        }

      });

    });

    petsList.querySelectorAll('[data-action="delete"]').forEach((btn) => {

      btn.addEventListener("click", async () => {

        const row = btn.closest(".rowCard");
        const id = row?.getAttribute("data-id");

        if (!id) return;

        if (!confirm("Delete this pet? This can’t be undone.")) return;

        btn.disabled = true;
        btn.textContent = "Deleting…";

        try {

          const auth = await requireCreatorSession();
          if (!auth) throw new Error("Not logged in");

          const { error } = await client
            .from("pets")
            .delete()
            .eq("id", id)
            .eq("owner_id", auth.session.user.id);

          if (error) throw error;

          row.remove();

          listHint.textContent = "Deleted ✅";

        } catch (error) {

          alert("❌ Delete failed: " + (error?.message || String(error)));

        } finally {

          btn.disabled = false;
          btn.textContent = "Delete";

        }

      });

    });

  }

  async function loadPets(ownerId) {

    listHint.textContent = "Loading…";
    petsList.innerHTML = "";

    const { data, error } = await client
      .from("pets")
      .select("id,name,species,breed,avatar_url,bio,created_at,owner_id,age_years,birth_date")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {

      listHint.textContent = "Couldn’t load pets";

      petsList.innerHTML =
        `<div class="hint">${esc(error.message)}</div>`;

      return;

    }

    renderPets(data || []);

    listHint.textContent =
      data && data.length
        ? "Loaded ✅"
        : "No pets yet.";

  }

  async function addPet() {

    addHint.textContent = "Adding…";
    addBtn.disabled = true;

    try {

      const auth = await requireCreatorSession();
      if (!auth) throw new Error("Not logged in");

      const name = fName.value.trim();

      if (!name) {
        throw new Error("Name is required");
      }

      const insertPayload = {

        owner_id: auth.session.user.id,
        name,

        species: fSpecies.value.trim() || null,
        breed: fBreed.value.trim() || null,
        birth_date: fBirth.value || null,

        age_years:
          fAge.value === ""
            ? null
            : Number(fAge.value),

        bio: fBio.value.trim() || null,

      };

      if (
        insertPayload.age_years != null &&
        Number.isNaN(insertPayload.age_years)
      ) {
        insertPayload.age_years = null;
      }

      const inserted = await client
        .from("pets")
        .insert(insertPayload)
        .select("id")
        .single();

      if (inserted.error) throw inserted.error;

      const petId = inserted.data?.id;

      if (!petId) {
        throw new Error("Missing new pet id");
      }

      const file = fAvatarFile?.files?.[0] || null;

      if (file) {

        const url =
          await uploadPetAvatar(auth.session.user.id, petId, file);

        const updated = await client
          .from("pets")
          .update({ avatar_url: url })
          .eq("id", petId)
          .eq("owner_id", auth.session.user.id);

        if (updated.error) throw updated.error;

      }

      clearForm();

      addHint.textContent = "Added ✅";

      await loadPets(auth.session.user.id);

    } catch (error) {

      addHint.textContent =
        "❌ " + (error?.message || String(error));

    } finally {

      addBtn.disabled = false;

    }

  }

  function bindEvents() {

    addBtn.addEventListener("click", addPet);
    resetBtn.addEventListener("click", clearForm);

  }

  async function boot() {

    if (window.OPPartials?.loadLayout) {
      await window.OPPartials.loadLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    bindEvents();

    const auth = await requireCreatorSession();

    if (!auth) {

      addHint.textContent = "You must log in to manage pets.";
      addBtn.disabled = true;

      listHint.textContent = "Not logged in";

      return;

    }

    addBtn.disabled = false;

    await loadPets(auth.session.user.id);

  }

  window.OPCreatorPets = {
    boot,
    loadPets,
    addPet,
    uploadPetAvatar,
  };

  window.addEventListener("DOMContentLoaded", boot);

})();