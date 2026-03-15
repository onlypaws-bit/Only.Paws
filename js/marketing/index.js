/* =========================================================
   OnlyPaws
   File: /js/marketing/index.js
   Purpose: logic for OnlyPaws marketing home page
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   - window.OPMarketing
   - window.initSupportUsButton
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};
  const client = window.onlypawsClient;

  function applyIndexPaths() {
    const explorePackLink = document.getElementById("explorePackLink");
    const fanAreaLink = document.getElementById("fanAreaLink");
    const fanFaqLink = document.getElementById("fanFaqLink");
    const creatorAreaLink = document.getElementById("creatorAreaLink");
    const creatorFaqLink = document.getElementById("creatorFaqLink");
    const indexHeroImage = document.getElementById("indexHeroImage");

    if (explorePackLink) {
      explorePackLink.href = PATHS?.marketing?.thePack || "/html/marketing/the-pack.html";
    }

    if (fanAreaLink) {
      fanAreaLink.href = PATHS?.marketing?.fans || "/html/marketing/fans.html";
    }

    if (fanFaqLink) {
      fanFaqLink.href = PATHS?.faq?.fans || "/html/marketing/faq/faq-fans.html";
    }

    if (creatorAreaLink) {
      creatorAreaLink.href = PATHS?.marketing?.creators || "/html/marketing/creators.html";
    }

    if (creatorFaqLink) {
      creatorFaqLink.href = PATHS?.faq?.creators || "/html/marketing/faq/faq-creators.html";
    }

    if (indexHeroImage) {
      indexHeroImage.src =
        PATHS?.assets?.indexImage ||
        "/assets/images/onlypaws-index.png";
    }
  }

  async function initMarketingIndex() {
    applyIndexPaths();

    if (window.OPPartials?.loadMarketingLayout) {
      await window.OPPartials.loadMarketingLayout();
    }

    if (window.OPMarketing?.hideCurrentMarketingLink) {
      window.OPMarketing.hideCurrentMarketingLink();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    if (typeof window.initSupportUsButton === "function") {
      await window.initSupportUsButton({
        buttonId: "supportUsBtn",
        messageId: "supportUsMsg",
        loginRedirect:
          (PATHS?.marketing?.fans || "/html/marketing/fans.html") + "?support=1",
        successPath:
          PATHS?.thanks?.supportUs || "/html/thanks/thanks-support-us.html",
        cancelPath:
          PATHS?.marketing?.index || "/html/marketing/index.html",
      });
    }

    try {
      const { data } = await client.auth.getSession();

      if (data?.session) {
        window.location.href =
          PATHS?.app?.feed || "/html/app/feed.html";
      }
    } catch (error) {
      console.warn("auto-redirect skipped:", error);
    }
  }

  window.addEventListener("DOMContentLoaded", initMarketingIndex);
})();