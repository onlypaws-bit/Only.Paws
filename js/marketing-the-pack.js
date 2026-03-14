/* =========================================================
   OnlyPaws
   File: /js/marketing-the-pack.js
   Purpose: logic for The Pack marketing page
   Requires: onlypawsClient.js + partials.js + nav.js + marketing-shared.js + paths.js
   ========================================================= */

(function () {
  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function speciesEmoji(species = "") {
    const s = String(species).toLowerCase().trim();
    if (s.includes("dog")) return "🐶";
    if (s.includes("cat")) return "🐱";
    if (s.includes("parrot") || s.includes("bird")) return "🦜";
    if (s.includes("rabbit") || s.includes("bunny")) return "🐰";
    if (s.includes("gecko") || s.includes("lizard")) return "🦎";
    if (s.includes("hamster")) return "🐹";
    if (s.includes("snake")) return "🐍";
    if (s.includes("turtle")) return "🐢";
    if (s.includes("fish")) return "🐠";
    return "🐾";
  }

  function truncateText(text = "", max = 120) {
    const clean = String(text).trim();
    if (!clean) return "";
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max).trim()}…`;
  }

  function fallbackCreators() {
    return [
      {
        name: "Lola",
        tag: "dog",
        meta: "good girl • @lola",
        bio: "professional tail wagger. part-time cuddle machine. full-time icon.",
        avatar: null,
        slug: "lola"
      },
      {
        name: "Pablito",
        tag: "dog",
        meta: "tiny menace • @pablito",
        bio: "emotionally powered by treats, attention, and suspiciously loud zoomies.",
        avatar: null,
        slug: "pablito"
      },
      {
        name: "Your pet here",
        tag: "pet",
        meta: "future icon",
        bio: "create a page for your pet and become part of the pack.",
        avatar: null,
        slug: null
      }
    ];
  }

  function cardHref(creator) {
    if (creator.slug) {
      return `${OP_PATHS.marketing.fans}?creator=${encodeURIComponent(creator.slug)}`;
    }
    return OP_PATHS.marketing.fans;
  }

  function createPetCard(creator) {
    const thumbMarkup = creator.avatar
      ? `<img src="${escapeHtml(creator.avatar)}" alt="${escapeHtml(creator.name)}" loading="lazy" />`
      : `<span aria-hidden="true">${speciesEmoji(creator.tag)}</span>`;

    return `
      <a class="petCard" href="${cardHref(creator)}">
        <div class="petThumb">
          ${thumbMarkup}
        </div>

        <div class="petTop">
          <h3 class="petName">${escapeHtml(creator.name)}</h3>
          <span class="petTag">${escapeHtml(creator.tag)}</span>
        </div>

        <div class="petMeta">${escapeHtml(creator.meta)}</div>
        <p class="petBio">${escapeHtml(creator.bio)}</p>

        <div class="petFooter">view profile after signup →</div>
      </a>
    `;
  }

  async function fetchProfiles() {
    let result = await onlypawsClient
      .from("profiles")
      .select("user_id, username, display_name, bio, avatar_url, role, pet, created_at")
      .eq("role", "creator")
      .order("created_at", { ascending: false })
      .limit(12);

    if (result.error) throw result.error;

    if (result.data && result.data.length) {
      return result.data;
    }

    result = await onlypawsClient
      .from("profiles")
      .select("user_id, username, display_name, bio, avatar_url, role, pet, created_at")
      .not("pet", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function fetchPetsByIds(petIds) {
    if (!petIds.length) return [];

    const { data, error } = await onlypawsClient
      .from("pets")
      .select("id, owner_id, name, species, breed, bio, avatar_url, created_at")
      .in("id", petIds);

    if (error) throw error;
    return data || [];
  }

  function mergeProfilesAndPets(profiles, pets) {
    const petsMap = new Map(pets.map(p => [p.id, p]));

    return profiles
      .map(profile => {
        const pet = petsMap.get(profile.pet);
        if (!pet) return null;

        const cardName =
          pet.name?.trim() ||
          profile.display_name?.trim() ||
          profile.username?.trim() ||
          "unnamed pet";

        const tag = pet.species?.trim() || "pet";

        const metaParts = [];
        if (pet.breed?.trim()) metaParts.push(pet.breed.trim());
        if (profile.username?.trim()) metaParts.push(`@${profile.username.trim()}`);
        else if (profile.display_name?.trim()) metaParts.push(profile.display_name.trim());

        const bio = truncateText(
          pet.bio?.trim() ||
          profile.bio?.trim() ||
          "one of the adorable creators hanging around onlypaws."
        );

        return {
          name: cardName,
          tag,
          meta: metaParts.join(" • ") || "pet creator",
          bio,
          avatar: pet.avatar_url || profile.avatar_url || null,
          slug: profile.username || profile.user_id
        };
      })
      .filter(Boolean);
  }

  async function loadPack() {
    const statusEl = document.getElementById("packStatus");
    const gridEl = document.getElementById("packGrid");
    if (!statusEl || !gridEl) return;

    try {
      const profiles = await fetchProfiles();
      const petIds = profiles.map(p => p.pet).filter(Boolean);
      const pets = await fetchPetsByIds(petIds);
      const creators = mergeProfilesAndPets(profiles, pets);

      if (!creators.length) {
        const fallback = fallbackCreators();
        gridEl.innerHTML = fallback.map(createPetCard).join("");
        statusEl.style.display = "none";
        gridEl.style.display = "grid";
        return;
      }

      gridEl.innerHTML = creators.map(createPetCard).join("");
      statusEl.style.display = "none";
      gridEl.style.display = "grid";
    } catch (error) {
      console.error("failed to load the pack:", error);

      const creators = fallbackCreators();
      gridEl.innerHTML = creators.map(createPetCard).join("");
      statusEl.className = "errorState";
      statusEl.textContent = "Could not load live creators right now, so here is a preview of The Pack instead.";
      gridEl.style.display = "grid";
    }
  }

  async function initMarketingThePack() {
    if (typeof loadMarketingLayout === "function") {
      await loadMarketingLayout();
    }

    if (window.OPMarketing?.hideCurrentMarketingLink) {
      window.OPMarketing.hideCurrentMarketingLink();
    }

    if (typeof initNav === "function") {
      await initNav();
    }

    await loadPack();
  }

  window.addEventListener("DOMContentLoaded", initMarketingThePack);
})();
