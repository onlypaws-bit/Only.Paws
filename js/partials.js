/* =========================================================
   OnlyPaws
   File: js/partials.js
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
        path.endsWith("/marketing/index.html")
      );

    const isMatch =
      path.includes(`/marketing/${page}.html`) ||
      path.endsWith(`/${page}.html`);

    if (isHome || isMatch) {
      link.classList.add("activeMarketingTextLink");
    }
  });
}

async function loadLayout() {
  await Promise.all([
    loadPartial("#header-placeholder", "/components/header.html"),
    loadPartial("#footer-placeholder", "/components/footer.html")
  ]);
}

async function loadMarketingLayout() {
  await Promise.all([
    loadPartial("#header-placeholder", "/components/header-marketing.html"),
    loadPartial("#footer-placeholder", "/components/footer-marketing.html")
  ]);

  highlightMarketingNav();
}
