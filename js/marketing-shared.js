/* =========================================================
   OnlyPaws
   File: /js/marketing-shared.js
   Purpose: shared helpers for public marketing pages
   ========================================================= */

(function () {

  function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("creators")) return "creators";
    if (path.includes("fans")) return "fans";
    if (path.includes("the-pack")) return "the-pack";
    if (path.includes("reset-password")) return "reset-password";
    if (path.includes("email-confirmed")) return "email-confirmed";

    return "index";
  }

  function hideCurrentNavLink() {
    const current = getCurrentPage();

    document.querySelectorAll("[data-page]").forEach(el => {
      if (el.dataset.page === current) {
        el.style.display = "none";
      }
    });
  }

  function highlightCurrentNavLink() {
    const current = getCurrentPage();

    document.querySelectorAll("[data-page]").forEach(el => {
      if (el.dataset.page === current) {
        el.classList.add("active");
      }
    });
  }

  function initMarketingShared() {
    hideCurrentNavLink();
    highlightCurrentNavLink();
  }

  document.addEventListener("DOMContentLoaded", initMarketingShared);

  window.OPMarketing = {
    getCurrentPage
  };

})();
