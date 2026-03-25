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
    document.querySelector(".petDetails").textContent = "Pet not found";
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
      document.querySelector(".petDetails").textContent = "Pet not found";
      return;
    }

    // Populate main info
    document.getElementById("petAvatar").src = pet.avatar_url || OP_PATHS.assets.images.defaultPet || "/assets/images/default_pet.png";
    document.getElementById("petName").textContent = pet.name || "Unnamed Pet";
    document.getElementById("petSpeciesBreed").textContent = `${pet.species || "Unknown"} / ${pet.breed || "Unknown"}`;
    document.getElementById("petAge").textContent = pet.age ? `${pet.age} years old` : "";

    // Populate bio and notes
    document.getElementById("petBio").textContent = pet.bio || "No bio available.";
    document.getElementById("petHealthNotes").textContent = pet.health_notes || "";
    document.getElementById("petSpecialMarks").textContent = pet.special_marks || "";

    // Populate gallery
    const galleryEl = document.getElementById("petGallery");
    galleryEl.innerHTML = ""; // clear first

    if (pet.media && pet.media.length > 0) {
      pet.media.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = pet.name || "Pet image";
        galleryEl.appendChild(img);
      });
    } else {
      galleryEl.textContent = "No images available.";
    }
  } catch (err) {
    console.error("Unexpected error loading pet:", err);
    document.querySelector(".petDetails").textContent = "Error loading pet.";
  }
})();
