/* =========================================================
   OnlyPaws
   File: /js/partials.js
   Purpose: load shared header/footer partials and hydrate marketing nav state
   ========================================================= */

async function loadPartial(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }

  el.innerHTML = await res.text();
}

function highlightMarketingNav() {
  const links = document.querySelectorAll(".marketingTextLink");
  if (!links.length) return;

  const path = window.location.pathname.toLowerCase();

  links.forEach(link => {
    link.classList.remove("activeMarketingTextLink");

    const page = (link.dataset.page || "").toLowerCase();
    if (!page) return;

    const isHome =
      page === "index" &&
      (
        path === "/" ||
        path.endsWith("/index.html") ||
        path.endsWith("/html/marketing/pages/index.html")
      );

    const isPagesMatch = path.endsWith(`/html/marketing/pages/${page}.html`);
    const isFaqMatch = path.endsWith(`/html/marketing/faq/${page}.html`);
    const isLegalMatch = path.endsWith(`/html/marketing/legal/${page}.html`);

    if (isHome || isPagesMatch || isFaqMatch || isLegalMatch) {
      link.classList.add("activeMarketingTextLink");
    }
  });
}

async function loadLayout() {
  await Promise.all([
    loadPartial("#header-placeholder", OP_PATHS.components.header),
    loadPartial("#footer-placeholder", OP_PATHS.components.footer)
  ]);
}

async function loadMarketingLayout() {
  await Promise.all([
    loadPartial("#header-placeholder", OP_PATHS.components.headerMarketing),
    loadPartial("#footer-placeholder", OP_PATHS.components.footerMarketing)
  ]);

  highlightMarketingNav();
}
