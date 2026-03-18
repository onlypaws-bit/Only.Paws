/* =========================================================
   OnlyPaws
   File: /js/partials.js
   Purpose: load shared HTML partials and highlight nav state
   Dependencies:
   - window.OP_PATHS
   - window.OPNav
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};

  function getMount(...ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function prepareMount(el, type) {
    if (!el) return null;

    el.classList.add("partialMount");

    if (type === "header") {
      el.classList.add("partialHeaderMount");
    }

    if (type === "footer") {
      el.classList.add("partialFooterMount");
    }

    return el;
  }

  async function loadPartial(targetOrId, url) {
    const target =
      typeof targetOrId === "string"
        ? document.getElementById(targetOrId)
        : targetOrId;

    if (!target || !url) return;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load partial: ${url}`);
    }

    target.innerHTML = await res.text();
    return target;
  }

  function highlightMarketingNav() {
    const currentPage = (document.body?.dataset?.page || "").trim();
    if (!currentPage) return;

    document.querySelectorAll("[data-page]").forEach((el) => {
      const page = (el.dataset.page || "").trim();
      el.classList.toggle("activeMarketingTextLink", page === currentPage);
    });
  }

  async function hydrateLoadedNav() {
    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }
  }

  async function loadLayout() {
    const headerMount = prepareMount(
      getMount("header-placeholder", "header", "headerMount"),
      "header"
    );

    const footerMount = prepareMount(
      getMount("footer-placeholder", "footer", "footerMount"),
      "footer"
    );

    await loadPartial(
      headerMount,
      PATHS?.components?.header || "/components/header.html"
    );

    await hydrateLoadedNav();

    await loadPartial(
      footerMount,
      PATHS?.components?.footer || "/components/footer.html"
    );
  }

  async function loadMarketingLayout() {
    const headerMount = prepareMount(
      getMount("header-placeholder", "header", "headerMount"),
      "header"
    );

    const footerMount = prepareMount(
      getMount("footer-placeholder", "footer", "footerMount"),
      "footer"
    );

    await loadPartial(
      headerMount,
      PATHS?.components?.headerMarketing || "/components/header-marketing.html"
    );

    highlightMarketingNav();
    await hydrateLoadedNav();

    await loadPartial(
      footerMount,
      PATHS?.components?.footerMarketing || "/components/footer-marketing.html"
    );
  }

  async function loadStripeLayout() {
    const headerMount = prepareMount(
      getMount("header-placeholder", "header", "headerMount"),
      "header"
    );

    const footerMount = prepareMount(
      getMount("footer-placeholder", "footer", "footerMount"),
      "footer"
    );

    await loadPartial(
      headerMount,
      PATHS?.components?.headerStripe || "/components/header-stripe.html"
    );

    await hydrateLoadedNav();

    await loadPartial(
      footerMount,
      PATHS?.components?.footerMarketing || "/components/footer-marketing.html"
    );
  }

  window.OPPartials = {
    loadPartial,
    loadLayout,
    loadMarketingLayout,
    loadStripeLayout,
    highlightMarketingNav,
  };
})();
