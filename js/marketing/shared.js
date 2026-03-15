/* =========================================================
   OnlyPaws
   File: /js/marketing/shared.js
   Purpose: shared helpers for marketing pages
   Exposes: window.OPMarketing
   ========================================================= */

(function () {

  function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("creators")) return "creators";
    if (path.includes("fans")) return "fans";
    if (path.includes("the-pack")) return "the-pack";
    if (path.includes("reset-password")) return "reset-password";
    if (path.includes("email-confirmed")) return "email-confirmed";

    if (
      path.endsWith("/") ||
      path.endsWith("/index.html") ||
      path.includes("/marketing/index")
    ) {
      return "index";
    }

    return "index";
  }

  function hideCurrentMarketingLink() {
    const current = getCurrentPage();

    document.querySelectorAll("[data-page]").forEach((el) => {
      const page = (el.dataset.page || "").trim();

      if (page === current) {
        el.classList.add("op-hidden");
      }
    });
  }

  function highlightCurrentMarketingLink() {
    const current = getCurrentPage();

    document.querySelectorAll("[data-page]").forEach((el) => {
      const page = (el.dataset.page || "").trim();
      el.classList.toggle("activeMarketingTextLink", page === current);
    });
  }

  function initMarketingShared() {
    hideCurrentMarketingLink();
    highlightCurrentMarketingLink();
  }

  document.addEventListener("DOMContentLoaded", initMarketingShared);

  window.OPMarketing = {
    getCurrentPage,
    hideCurrentMarketingLink,
    highlightCurrentMarketingLink,
    initMarketingShared
  };

})();