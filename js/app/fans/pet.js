/* =========================================================
   OnlyPaws
   File: /js/app/fans/pet.js
   Purpose:
   - Load and render a pet's data for fan view
   - Uses window.onlypawsClient (Supabase) and OP_PATHS structure
   ========================================================= */

(async function () {
  const PATHS  = window.OP_PATHS  || {};
  const client = window.onlypawsClient;

  const fallbackHint = document.getElementById("petFallbackHint");

  function showError(msg) {
    if (fallbackHint) {
      fallbackHint.textContent = msg;
      fallbackHint.hidden = false;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ── Guard: client must be ready ──────────────────────────
  if (!client) {
    console.error("[pet.js] onlypawsClient not available.");
    showError("Could not connect. Please try again later.");
    return;
  }

  // ── Guard: ?id= required ─────────────────────────────────
  const petId = new URLSearchParams(window.location.search).get("id")?.trim();

  if (!petId) {
    console.error("[pet.js] No pet ID in URL.");
    showError("Pet not found.");
    return;
  }

  try {
    // ── Fetch ────────────────────────────────────────────────
    const { data: pet, error } = await client
      .from("pets")
      .select("*")
      .eq("id", petId)
      .maybeSingle();                       // maybeSingle: no throw on 0 rows

    if (error) throw error;

    if (!pet) {
      showError("Pet not found.");
      return;
    }

    // ── Avatar ───────────────────────────────────────────────
    const defaultPetImg =
      PATHS?.assets?.images?.defaultPet || "/assets/images/default_pet.png";

    const avatarUrl = pet.avatar_url?.trim() || defaultPetImg;
    const petName   = pet.name?.trim()       || "Unnamed Pet";

    const petAvatarEl = document.getElementById("petAvatar");
    if (petAvatarEl) {
      petAvatarEl.src = avatarUrl;
      petAvatarEl.alt = `${petName} avatar`;
    }

    // ── Main info ────────────────────────────────────────────
    const species = pet.species?.trim() || "Unknown";
    const breed   = pet.breed?.trim()   || "Unknown";
    const age     = Number(pet.age_years) || 0;

    setText("petName",        petName);
    setText("petSpeciesBreed", `${species} / ${breed}`);
    setText("petAge",          age ? `${age} years old` : "");

    // ── Bio & notes ──────────────────────────────────────────
    setText("petBio",          pet.bio?.trim()           || "No bio available.");
    setText("petHealthNotes",  pet.health_notes?.trim()  || "");
    setText("petSpecialMarks", pet.special_marks?.trim() || "");

    // ── Gallery ──────────────────────────────────────────────
    const galleryEl = document.getElementById("petGallery");
    if (galleryEl) {
      galleryEl.innerHTML = "";

      if (pet.avatar_url?.trim()) {
        const img = document.createElement("img");
        img.src     = pet.avatar_url.trim();
        img.alt     = petName;
        img.loading = "lazy";
        img.decoding = "async";
        galleryEl.appendChild(img);
      } else {
        galleryEl.textContent = "No images available.";
      }
    }

  } catch (err) {
    console.error("[pet.js] Error loading pet:", err);
    showError("Error loading pet. Please try again.");
  }
})();
