/* =========================================================
   OnlyPaws
   File: /js/app/fans/pet.js
   Purpose:
   - Load and render a pet's data for fan view
   - Uses OP.client (Supabase) and OP_PATHS structure
   ========================================================= */

(async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const petId = urlParams.get("id");

  if (!petId) {
    console.error("No pet ID provided in URL");
    const detailsEl = document.querySelector(".petDetails");
    if (detailsEl) detailsEl.textContent = "Pet not found";
    return;
  }

  try {
    // Fetch pet from Supabase
    const { data: pet, error } = await OP.client
      .from("pets")
      .select("*")
      .eq("id", petId)
      .single();

    if (error || !pet) {
      console.error("Pet fetch error:", error);
      const detailsEl = document.querySelector(".petDetails");
      if (detailsEl) detailsEl.textContent = "Pet not found";
      return;
    }

    // Populate main info
    const avatarUrl = pet.avatar_url || OP_PATHS.assets.images.defaultPet || "/assets/images/default_pet.png";
    const petName = pet.name || "Unnamed Pet";
    const species = pet.species || "Unknown";
    const breed = pet.breed || "Unknown";
    const age = pet.age_years || "";

    const petAvatarEl = document.getElementById("petAvatar");
    if (petAvatarEl) {
      petAvatarEl.src = avatarUrl;
      petAvatarEl.alt = `${petName} avatar`;
    }

    const petNameEl = document.getElementById("petName");
    if (petNameEl) petNameEl.textContent = petName;

    const speciesBreedEl = document.getElementById("petSpeciesBreed");
    if (speciesBreedEl) speciesBreedEl.textContent = `${species} / ${breed}`;

    const petAgeEl = document.getElementById("petAge");
    if (petAgeEl) petAgeEl.textContent = age ? `${age} years old` : "";

    // Populate bio and notes
    const bioEl = document.getElementById("petBio");
    if (bioEl) bioEl.textContent = pet.bio || "No bio available.";

    const healthEl = document.getElementById("petHealthNotes");
    if (healthEl) healthEl.textContent = pet.health_notes || "";

    const marksEl = document.getElementById("petSpecialMarks");
    if (marksEl) marksEl.textContent = pet.special_marks || "";

    // Populate gallery (using avatar only for now)
    const galleryEl = document.getElementById("petGallery");
    if (galleryEl) {
      galleryEl.innerHTML = "";

      if (pet.avatar_url) {
        const img = document.createElement("img");
        img.src = pet.avatar_url;
        img.alt = petName;
        galleryEl.appendChild(img);
      } else {
        galleryEl.textContent = "No images available.";
      }
    }
  } catch (err) {
    console.error("Unexpected error loading pet:", err);
    const detailsEl = document.querySelector(".petDetails");
    if (detailsEl) detailsEl.textContent = "Error loading pet.";
  }
})();
