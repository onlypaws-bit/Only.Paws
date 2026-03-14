/* =========================================================
   OnlyPaws
   File: /js/marketing-index.js
   Purpose: logic for OnlyPaws marketing home page
   Requires: paths.js + onlypawsClient.js + partials.js + nav.js + support-us.js + marketing-shared.js
   ========================================================= */

(function () {
  function applyIndexPaths() {
    const explorePackLink = document.getElementById("explorePackLink");
    const fanAreaLink = document.getElementById("fanAreaLink");
    const fanFaqLink = document.getElementById("fanFaqLink");
    const creatorAreaLink = document.getElementById("creatorAreaLink");
    const creatorFaqLink = document.getElementById("creatorFaqLink");
    const indexHeroImage = document.getElementById("indexHeroImage");

    if (explorePackLink) explorePackLink.href = OP_PATHS.marketing.thePack;
    if (fanAreaLink) fanAreaLink.href = OP_PATHS.marketing.fans;
    if (fanFaqLink) fanFaqLink.href = OP_PATHS.faq.fans;
    if (creatorAreaLink) creatorAreaLink.href = OP_PATHS.marketing.creators;
    if (creatorFaqLink) creatorFaqLink.href = OP_PATHS.faq.creators;
    if (indexHeroImage) indexHeroImage.src = OP_PATHS.assets.indexImage;
  }

  async function initMarketingIndex() {
    applyIndexPaths();

    if (typeof loadMarketingLayout === "function") {
      await loadMarketingLayout();
    }

    if (typeof initNav === "function") {
      await initNav();
    }

    if (typeof initSupportUsButton === "function") {
      await initSupportUsButton({
        buttonId: "supportUsBtn",
        messageId: "supportUsMsg",
        loginRedirect: OP_PATHS.marketing.fans + "?support=1",
        successPath: OP_PATHS.thanks.supportUs,
        cancelPath: OP_PATHS.marketing.index
      });
    }

    try {
      const { data } = await onlypawsClient.auth.getSession();
      if (data?.session) {
        window.location.href = OP_PATHS.app.feed;
      }
    } catch (e) {
      console.warn("auto-redirect skipped:", e);
    }
  }

  window.addEventListener("DOMContentLoaded", initMarketingIndex);
})();
