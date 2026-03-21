/* =========================================================
   OnlyPaws
   File: /js/app/creators/pets.js
   Purpose: creator pets management page logic
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};
  const client = window.onlypawsClient;

  const PET_AVATAR_BUCKET = "pets";

  const els = {
    petsList: document.getElementById("petsList"),
    listHint: document.getElementById("listHint"),
    addHint: document.getElementById("addHint"),

    fName: document.getElementById("fName"),
    fSpecies: document.getElementById("fSpecies"),
    fBreed: document.getElementById("fBreed"),
    fBirth: document.getElementById("fBirth"),
    fAge: document.getElementById("fAge"),
    fAvatarFile: document.getElementById("fAvatarFile"),
    fBio: document.getElementById("fBio"),
    fHealthNotes: document.getElementById("fHealthNotes"),
    fSpecialMarks: document.getElementById("fSpecialMarks"),

    addBtn: document.getElementById("addBtn"),
    resetBtn: document.getElementById("resetBtn"),
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNullableTrimmed(value) {
    const v = String(value ?? "").trim();
    return v === "" ? null : v;
  }

  function clearForm() {
    if (els.fName) els.fName.value = "";
    if (els.fSpecies) els.fSpecies.value = "";
    if (els.fBreed) els.fBreed.value = "";
    if (els.fBirth) els.fBirth.value = "";
    if (els.fAge) els.fAge.value = "";
    if (els.fBio) els.fBio.value = "";
    if (els.fHealthNotes) els.fHealthNotes.value = "";
    if (els.fSpecialMarks) els.fSpecialMarks.value = "";
    if (els.fAvatarFile) els.fAvatarFile.value = "";
  }

  function getExtFromFile(file) {
    const name = String(file?.name || "").toLowerCase();
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1) : "jpg";
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function uploadPetAvatar(ownerId, petId, file) {
    if (!file) return null;

    const ext = getExtFromFile(file);
    const path = `${ownerId}/${petId}/${Date.now()}.${ext}`;

    const uploadRes = await client.storage
      .from(PET_AVATAR_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadRes.error) throw uploadRes.error;

    const publicRes = client.storage
      .from(PET_AVATAR_BUCKET)
      .getPublicUrl(path);

    const url = publicRes?.data?.publicUrl;
    if (!url) throw new Error("Could not get public URL for uploaded file");

    return url;
  }

  function petSummaryLine(pet) {
    const parts = [];

    if (pet.species) parts.push(pet.species);
    if (pet.breed) parts.push(pet.breed);

    if (pet.birth_date) {
      try {
        parts.push(`born ${new Date(pet.birth_date).toLocaleDateString()}`);
      } catch (_) {}
    }

    if (
      pet.age_years !== null &&
      pet.age_years !== undefined &&
      pet.age_years !== ""
    ) {
      parts.push(`${pet.age_years}y`);
    }

    return parts.join(" • ");
  }

  function renderPets(list) {
    if (!els.petsList) return;

    if (!list || list.length === 0) {
      els.petsList.innerHTML = `<div class="petsHint">No pets yet.</div>`;
      return;
    }

    els.petsList.innerHTML = list
      .map((pet) => {
        const avatar = pet.avatar_url
          ? `<img class="petsAvatarMini" src="${esc(
              pet.avatar_url
            )}" alt="pet avatar">`
          : `<div class="petsAvatarMiniFallback">🐾</div>`;

        const topLine = petSummaryLine(pet);

        return `
          <article class="petsRowCard" data-id="${esc(pet.id)}">
            ${avatar}

            <div class="petsMeta">
              <div class="petsBadges">
                <span class="petsBadge">🐾 PET</span>
                ${
                  pet.created_at
                    ? `<span class="petsBadge">📅 ${esc(
                        new Date(pet.created_at).toLocaleDateString()
                      )}</span>`
                    : ""
                }
              </div>

              <b class="petsNameLine">
                ${esc(pet.name || "Pet")}
                ${
                  topLine
                    ? `<span class="petsTopLine"> • ${esc(topLine)}</span>`
                    : ""
                }
              </b>

              ${
                pet.bio
                  ? `<div class="petsSmall" style="margin-top:6px;">${esc(
                      pet.bio
                    )}</div>`
                  : ""
              }
              ${
                pet.health_notes
                  ? `<div class="petsSmall" style="margin-top:6px;"><b>Health:</b> ${esc(
                      pet.health_notes
                    )}</div>`
                  : ""
              }
              ${
                pet.special_marks
                  ? `<div class="petsSmall" style="margin-top:6px;"><b>Special marks:</b> ${esc(
                      pet.special_marks
                    )}</div>`
                  : ""
              }

              <div class="petsDivider"></div>

              <div class="petsEditorBlock">
                <div class="petsEditorTitle">Edit basics</div>

                <div class="petsFormGrid">
                  <input class="petsRowInput" data-k="name" type="text" placeholder="Name" value="${esc(
                    pet.name || ""
                  )}">
                  <input class="petsRowInput" data-k="species" type="text" placeholder="Species" value="${esc(
                    pet.species || ""
                  )}">
                  <input class="petsRowInput" data-k="breed" type="text" placeholder="Breed" value="${esc(
                    pet.breed || ""
                  )}">
                  <input class="petsRowInput" data-k="birth_date" type="date" value="${
                    pet.birth_date
                      ? esc(String(pet.birth_date).slice(0, 10))
                      : ""
                  }">
                  <input class="petsRowInput" data-k="age_years" type="number" min="0" step="1" placeholder="Age years" value="${esc(
                    pet.age_years ?? ""
                  )}">
                  <textarea class="petsRowTextarea" data-k="bio" placeholder="Bio">${esc(
                    pet.bio || ""
                  )}</textarea>
                  <textarea class="petsRowTextarea" data-k="health_notes" placeholder="Health notes">${esc(
                    pet.health_notes || ""
                  )}</textarea>
                  <textarea class="petsRowTextarea" data-k="special_marks" placeholder="Special marks">${esc(
                    pet.special_marks || ""
                  )}</textarea>
                </div>
              </div>

              <div class="petsField">
                <label class="petsLabel">Change pet photo</label>
                <input class="petsRowInputFile" data-kfile="avatar" type="file" accept="image/*">
              </div>

              <div class="btnRow">
                <button class="ghost" type="button" data-action="save">Save</button>
                <button class="ghost danger" type="button" data-action="delete">Delete</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    bindRowActions();
  }

  function buildRowPayload(row) {
    const payload = {};

    row.querySelectorAll("[data-k]").forEach((input) => {
      const key = input.getAttribute("data-k");
      let value = input.value;

      if (key === "age_years") {
        value = value === "" ? null : Number(value);
        if (value !== null && Number.isNaN(value)) value = null;
      } else if (key === "birth_date") {
        value = value === "" ? null : value;
      } else {
        value = toNullableTrimmed(value);
      }

      payload[key] = value;
    });

    return payload;
  }

  async function savePet(row, button) {
    const petId = row?.getAttribute("data-id");
    if (!petId) return;

    button.disabled = true;
    button.textContent = "Saving…";
    if (els.listHint) els.listHint.textContent = "";

    try {
      const session = await getSession();
      if (!session) throw new Error("Not logged in");

      const payload = buildRowPayload(row);

      const fileInput = row.querySelector('[data-kfile="avatar"]');
      const file = fileInput?.files?.[0] || null;

      if (file) {
        const url = await uploadPetAvatar(session.user.id, petId, file);
        payload.avatar_url = url;
      }

      const updateRes = await client
        .from("pets")
        .update(payload)
        .eq("id", petId)
        .eq("owner_id", session.user.id);

      if (updateRes.error) throw updateRes.error;

      if (els.listHint) els.listHint.textContent = "Saved ✅";
      await loadPets(session.user.id);
    } catch (error) {
      alert("❌ Save failed: " + (error?.message || String(error)));
    } finally {
      button.disabled = false;
      button.textContent = "Save";
    }
  }

  async function deletePet(row, button) {
    const petId = row?.getAttribute("data-id");
    if (!petId) return;

    const confirmed = window.confirm("Delete this pet? This can’t be undone.");
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting…";
    if (els.listHint) els.listHint.textContent = "";

    try {
      const session = await getSession();
      if (!session) throw new Error("Not logged in");

      const deleteRes = await client
        .from("pets")
        .delete()
        .eq("id", petId)
        .eq("owner_id", session.user.id);

      if (deleteRes.error) throw deleteRes.error;

      row.remove();

      if (!els.petsList.querySelector(".petsRowCard")) {
        renderPets([]);
        if (els.listHint) els.listHint.textContent = "No pets yet.";
      } else if (els.listHint) {
        els.listHint.textContent = "Deleted ✅";
      }
    } catch (error) {
      alert("❌ Delete failed: " + (error?.message || String(error)));
    } finally {
      button.disabled = false;
      button.textContent = "Delete";
    }
  }

  function bindRowActions() {
    if (!els.petsList) return;

    els.petsList.querySelectorAll('[data-action="save"]').forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".petsRowCard");
        savePet(row, button);
      });
    });

    els.petsList.querySelectorAll('[data-action="delete"]').forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".petsRowCard");
        deletePet(row, button);
      });
    });
  }

  async function loadPets(ownerId) {
    if (els.listHint) els.listHint.textContent = "Loading…";
    if (els.petsList) els.petsList.innerHTML = "";

    const res = await client
      .from("pets")
      .select(
        "id, name, species, breed, avatar_url, bio, created_at, owner_id, age_years, birth_date, health_notes, special_marks"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (res.error) {
      if (els.listHint) els.listHint.textContent = "Couldn’t load pets";
      if (els.petsList) {
        els.petsList.innerHTML = `<div class="petsHint">${esc(
          res.error.message
        )}</div>`;
      }
      return;
    }

    const data = res.data || [];
    renderPets(data);

    if (els.listHint) {
      els.listHint.textContent = data.length ? "Loaded ✅" : "No pets yet.";
    }
  }

  async function addPet() {
    if (els.addHint) els.addHint.textContent = "Adding…";
    if (els.addBtn) els.addBtn.disabled = true;

    try {
      const session = await getSession();
      if (!session) throw new Error("Not logged in");

      const name = String(els.fName?.value || "").trim();
      if (!name) throw new Error("Name is required");

      const insertPayload = {
        owner_id: session.user.id,
        name,
        species: toNullableTrimmed(els.fSpecies?.value),
        breed: toNullableTrimmed(els.fBreed?.value),
        birth_date: els.fBirth?.value ? els.fBirth.value : null,
        age_years: els.fAge?.value === "" ? null : Number(els.fAge?.value),
        bio: toNullableTrimmed(els.fBio?.value),
        health_notes: toNullableTrimmed(els.fHealthNotes?.value),
        special_marks: toNullableTrimmed(els.fSpecialMarks?.value),
      };

      if (
        insertPayload.age_years !== null &&
        Number.isNaN(insertPayload.age_years)
      ) {
        insertPayload.age_years = null;
      }

      const insertRes = await client
        .from("pets")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertRes.error) throw insertRes.error;

      const petId = insertRes.data?.id;
      if (!petId) throw new Error("Missing new pet id");

      const file = els.fAvatarFile?.files?.[0] || null;
      if (file) {
        const avatarUrl = await uploadPetAvatar(session.user.id, petId, file);

        const avatarUpdateRes = await client
          .from("pets")
          .update({ avatar_url: avatarUrl })
          .eq("id", petId)
          .eq("owner_id", session.user.id);

        if (avatarUpdateRes.error) throw avatarUpdateRes.error;
      }

      clearForm();
      if (els.addHint) els.addHint.textContent = "Added ✅";
      await loadPets(session.user.id);
    } catch (error) {
      if (els.addHint) {
        els.addHint.textContent = "❌ " + (error?.message || String(error));
      }
    } finally {
      if (els.addBtn) els.addBtn.disabled = false;
    }
  }

  async function initLayout() {
    try {
      if (window.OPPartials?.loadLayout) {
        await window.OPPartials.loadLayout();
      }
    } catch (error) {
      console.error("Failed to load layout:", error);
    }
  }

  async function initNav() {
    try {
      if (window.OPNav?.initNav) {
        await window.OPNav.initNav();
      }
    } catch (error) {
      console.error("Failed to init nav:", error);
    }
  }

  function goHome() {
    const target =
      PATHS?.home ||
      PATHS?.index ||
      PATHS?.marketing?.index ||
      "/";

    window.location.replace(target);
  }

  async function boot() {
    try {
      await initLayout();
      await initNav();

      const session = await getSession();

      if (!session) {
        if (els.addHint) {
          els.addHint.textContent = "You must log in to manage pets.";
        }
        if (els.addBtn) els.addBtn.disabled = true;
        if (els.listHint) els.listHint.textContent = "Not logged in";
        return;
      }

      if (els.addBtn) els.addBtn.disabled = false;
      await loadPets(session.user.id);
    } catch (error) {
      if (els.listHint) {
        els.listHint.textContent = error?.message || "Something went wrong";
      }
    }
  }

  if (els.addBtn) {
    els.addBtn.addEventListener("click", addPet);
  }

  if (els.resetBtn) {
    els.resetBtn.addEventListener("click", clearForm);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    if (!window.onlypawsClient) {
      try {
        if (window.onlypawsClientReady) {
          await window.onlypawsClientReady;
        }
      } catch (_) {}
    }

    if (!window.onlypawsClient) {
      if (els.listHint) els.listHint.textContent = "Supabase client not available";
      return;
    }

    await boot();
  });

  window.goPetsHome = goHome;
})();
