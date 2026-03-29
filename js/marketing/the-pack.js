/* =========================================================
   OnlyPaws
   File: /js/marketing/the-pack.js
   Purpose: logic for The Pack marketing page
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   - window.OPMarketing
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  function escapeHtml(value = "") {
    return String(value)
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
        slug: "lola",
      },
      {
        name: "Pablito",
        tag: "dog",
        meta: "tiny menace • @pablito",
        bio: "emotionally powered by treats, attention, and suspiciously loud zoomies.",
        avatar: null,
        slug: "pablito",
      },
      {
        name: "Your pet here",
        tag: "pet",
        meta: "future icon",
        bio: "create a page for your pet and become part of the pack.",
        avatar: null,
        slug: null,
      },
    ];
  }

  function cardHref(creator) {
    const fansPath = PATHS?.marketing?.fans || "/html/marketing/fans.html";

    if (creator?.slug) {
      return `${fansPath}?creator=${encodeURIComponent(creator.slug)}`;
    }

    return fansPath;
  }

  function createPetCard(creator) {
    const thumbMarkup = creator.avatar
      ? `<img src="${escapeHtml(creator.avatar)}"
          alt="${escapeHtml(creator.name)}"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer">`
      : `<span aria-hidden="true">${speciesEmoji(creator.tag)}</span>`;

    return `
      <a class="packCard" href="${cardHref(creator)}">
        <div class="packCardMedia">
          ${thumbMarkup}
        </div>

        <div class="packCardTop">
          <h3 class="packCardTitle">${escapeHtml(creator.name)}</h3>
          <span class="packCardBadge">${escapeHtml(creator.tag)}</span>
        </div>

        <div class="packCardMeta">${escapeHtml(creator.meta)}</div>
        <p class="packCardBio">${escapeHtml(creator.bio)}</p>

        <div class="packCardFooter">view profile after signup →</div>
      </a>
    `;
  }

  async function fetchPets() {
    const { data, error } = await client
      .from("pets")
      .select(`
        id,
        name,
        species,
        breed,
        bio,
        avatar_url,
        created_at,
        profiles (
          username,
          display_name,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    return data || [];
  }

  function mapPetsToCreators(pets) {
    return pets.map((pet) => {
      const profile = pet.profiles || {};

      const name = pet.name?.trim() || "unnamed pet";
      const tag = pet.species?.trim() || "pet";

      const metaParts = [];
      if (pet.breed?.trim()) metaParts.push(pet.breed.trim());
      if (profile.username?.trim()) metaParts.push(`@${profile.username.trim()}`);
      else if (profile.display_name?.trim()) metaParts.push(profile.display_name.trim());

      const bio = truncateText(
        pet.bio?.trim() ||
        "one of the adorable creators hanging around OnlyPaws."
      );

      return {
        name,
        tag,
        meta: metaParts.join(" • ") || "pet creator",
        bio,
        avatar: pet.avatar_url || profile.avatar_url || null,
        slug: profile.username || null,
      };
    });
  }

  function renderFallback(statusEl, gridEl, showErrorMessage) {
    const creators = fallbackCreators();

    gridEl.innerHTML = creators.map(createPetCard).join("");
    gridEl.hidden = false;

    if (!statusEl) return;

    if (showErrorMessage) {
      statusEl.className = "packEmpty";
      statusEl.textContent =
        "Could not load live creators right now, so here is a preview of The Pack instead.";
      statusEl.hidden = false;
    } else {
      statusEl.hidden = true;
    }
  }

  async function loadPack() {
    const statusEl = document.getElementById("packStatus");
    const gridEl = document.getElementById("packGrid");

    if (!gridEl) return;

    if (!client) {
      console.error("[ThePack] onlypawsClient missing");
      renderFallback(statusEl, gridEl, true);
      return;
    }

    try {
      const pets = await fetchPets();
      console.log("[ThePack] pets fetched:", pets);

      if (!pets.length) {
        console.warn("[ThePack] no pets found — rendering fallback");
        renderFallback(statusEl, gridEl, false);
        return;
      }

      const creators = mapPetsToCreators(pets);
      console.log("[ThePack] creators mapped:", creators);

      gridEl.innerHTML = creators.map(createPetCard).join("");
      gridEl.hidden = false;

      if (statusEl) statusEl.hidden = true;
    } catch (error) {
      console.error("[ThePack] failed to load the pack:", error);
      renderFallback(statusEl, gridEl, true);
    }
  }

  async function initMarketingThePack() {
    if (window.OPPartials?.loadMarketingLayout) {
      await window.OPPartials.loadMarketingLayout();
    }

    if (window.OPMarketing?.hideCurrentMarketingLink) {
      window.OPMarketing.hideCurrentMarketingLink();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    await loadPack();
  }

  window.addEventListener("DOMContentLoaded", initMarketingThePack);
})();
