/* =========================================================
   OnlyPaws
   File: /js/thanks/thanks.js
   Purpose:
   Shared logic for thank-you pages.

   Handles:
   - shared marketing layout init
   - content selection by query param
   - wiring primary CTA via OP_PATHS / OPRoutes

   Supported types:
   - creator-plan
   - creator-membership
   - fan-membership
   - support-us
   ========================================================= */

(function () {
  const PATHS = window.OP_PATHS || {};
  const ROUTES = window.OPRoutes || {};

  const els = {
    icon: document.getElementById("thanksIcon"),
    title: document.getElementById("thanksTitle"),
    text: document.getElementById("thanksText"),
    extraText: document.getElementById("thanksExtraText"),
    featuresWrap: document.getElementById("thanksFeaturesWrap"),
    features: document.getElementById("thanksFeatures"),
    primaryBtn: document.getElementById("thanksPrimaryBtn"),
  };

  function getType() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("type") || "support-us").trim().toLowerCase();
  }

  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html || "";
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text || "";
  }

  function setFeatures(items) {
    if (!els.featuresWrap || !els.features) return;

    if (!Array.isArray(items) || !items.length) {
      els.featuresWrap.hidden = true;
      els.features.innerHTML = "";
      return;
    }

    els.features.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
    els.featuresWrap.hidden = false;
  }

  function resolveHref(pathKey, fallback) {
    if (ROUTES && typeof ROUTES.href === "function") {
      const href = ROUTES.href(pathKey);
      if (href) return href;
    }
    return fallback || "/";
  }

  function getConfig(type) {
    const homeHref = resolveHref("index", PATHS.marketing?.index || "/index.html");

    const configs = {
      "creator-plan": {
        icon: "🎉",
        title: "You're in!",
        text:
          "Thanks for subscribing as a Creator.<br>You’re officially part of OnlyPaws.",
        extraText: "",
        features: [],
        primaryLabel: "Back to home",
        primaryHref: homeHref,
      },

      "creator-membership": {
        icon: "🐾",
        title: "You're in!",
        text:
          "Thanks for getting Creator Membership.<br>You’re supporting OnlyPaws and unlocking creator-only perks.",
        extraText: "",
        features: [
          "<b>Creator badge</b> displayed on your profile and posts",
          "<b>Advanced analytics</b> for posts and audience",
          "<b>Role management</b> for creator customization",
        ],
        primaryLabel: "Back to home",
        primaryHref: homeHref,
      },

      "fan-membership": {
        icon: "🐾",
        title: "You're in!",
        text:
          "Thanks for getting Fan Membership.<br>You’re supporting OnlyPaws and unlocking fan perks.",
        extraText: "",
        features: [
          "<b>Fan badge</b> shown on your profile and interactions",
          "<b>Advanced analytics</b> on followed creators and engagement",
          "<b>Role customization</b> for fan profile settings",
        ],
        primaryLabel: "Back to home",
        primaryHref: homeHref,
      },

      "support-us": {
        icon: "💜",
        title: "Thank you!",
        text:
          "Thanks for supporting OnlyPaws.<br>This does not unlock memberships or features — it simply helps us keep the platform alive, improve it, and support more pets 🐾",
        extraText: '<p class="statusSub">Billed every 3 months • Cancel anytime</p>',
        features: [],
        primaryLabel: "Back to home",
        primaryHref: homeHref,
      },
    };

    return configs[type] || configs["support-us"];
  }

  function applyContent() {
    const type = getType();
    const config = getConfig(type);

    setText(els.icon, config.icon);
    setText(els.title, config.title);
    setHtml(els.text, config.text);
    setHtml(els.extraText, config.extraText);
    setFeatures(config.features);

    if (els.primaryBtn) {
      els.primaryBtn.textContent = config.primaryLabel;
      els.primaryBtn.href = config.primaryHref;
    }

    document.title = `OnlyPaws — ${config.title.replace(/!/g, "")}`;
  }

  async function initPage() {
    if (typeof window.loadMarketingLayout === "function") {
      await window.loadMarketingLayout();
    }

    applyContent();
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();