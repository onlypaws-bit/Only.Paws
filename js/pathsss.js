/*
  OnlyPaws paths map
  Centralized JS-only navigation paths.

  Use this for:
  - redirects
  - button handlers
  - auth flows
  - support-us success/cancel paths
  - nav helpers

  NOT for static HTML hrefs unless you want to set them via JS.
*/

(function () {
  const BASE_HTML = "/html";

  const join = (...parts) =>
    parts
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/")
      .replace(":/", "://");

  const html = (folder, file) => join(BASE_HTML, folder, file);

  const PATHS = {
    marketing: {
      index: html("marketing", "index.html"),
      creators: html("marketing", "creators.html"),
      fans: html("marketing", "fans.html"),
      thePack: html("marketing", "the-pack.html"),
      emailConfirmed: html("marketing", "email-confirmed.html"),
      resetPassword: html("marketing", "reset-password.html"),
    },

    app: {
      authCallback: html("app", "auth-callback.html"),
      feed: html("app", "feed.html"),
      post: html("app", "post.html"),
      profile: html("app", "profile.html"),
    },

    creators: {
      createPost: html("creators", "create-post.html"),
      dash: html("creators", "creator-dash.html"),
      profile: html("creators", "creator-profile.html"),
      payoutsSetup: html("creators", "payouts-setup.html"),
      pets: html("creators", "pets.html"),
    },

    fans: {
      dash: html("fans", "fan-dash.html"),
      profile: html("fans", "fan-profile.html"),
      purchasedPosts: html("fans", "purchased-posts.html"),
      subscriptions: html("fans", "subscriptions.html"),
    },

    faq: {
      creators: html("faq", "faq-creators.html"),
      fans: html("faq", "faq-fans.html"),
    },

    legal: {
      contentPolicy: html("legal", "content-policy.html"),
      privacy: html("legal", "privacy-policy.html"),
      stripe: html("legal", "stripe.html"),
      terms: html("legal", "terms.html"),
    },

    thanks: {
      creatorMembership: html("thanks", "thanks-creator-membership.html"),
      creatorPlan: html("thanks", "thanks-creator-plan.html"),
      fanMembership: html("thanks", "thanks-fan-membership.html"),
      supportUs: html("thanks", "thanks-support-us.html"),
    },

    assets: {
      logo: "/assets/images/logo.png",
      creatorsHero: "/assets/images/onlypaws-creators.png",
      fansHero: "/assets/images/onlypaws-fans.png",
      indexHero: "/assets/images/onlypaws-index.png",
      pawCrown: "/assets/images/paw-crown.png",
      pawDiamond: "/assets/images/paw-diamond.png",
      pawStars: "/assets/images/paw-stars.png",
    },

    components: {
      header: "/components/header.html",
      footer: "/components/footer.html",
      headerMarketing: "/components/header-marketing.html",
      footerMarketing: "/components/footer-marketing.html",
    },
  };

  const NAV = {
    go(path) {
      window.location.href = path;
    },

    replace(path) {
      window.location.replace(path);
    },

    home() {
      window.location.href = PATHS.marketing.index;
    },

    feed() {
      window.location.href = PATHS.app.feed;
    },

    profile() {
      window.location.href = PATHS.app.profile;
    },

    creatorDash() {
      window.location.href = PATHS.creators.dash;
    },

    fanDash() {
      window.location.href = PATHS.fans.dash;
    },

    creatorProfile(usernameOrId) {
      const u = encodeURIComponent(usernameOrId || "");
      window.location.href = `${PATHS.creators.profile}?u=${u}`;
    },

    fanProfile(usernameOrId) {
      const u = encodeURIComponent(usernameOrId || "");
      window.location.href = `${PATHS.fans.profile}?u=${u}`;
    },

    post(postId) {
      const id = encodeURIComponent(postId || "");
      window.location.href = `${PATHS.app.post}?id=${id}`;
    },

    subscriptions(creatorId) {
      const creator = encodeURIComponent(creatorId || "");
      window.location.href = `${PATHS.fans.subscriptions}?creator=${creator}`;
    },
  };

  const URLS = {
    creatorProfile(usernameOrId) {
      const u = encodeURIComponent(usernameOrId || "");
      return `${PATHS.creators.profile}?u=${u}`;
    },

    fanProfile(usernameOrId) {
      const u = encodeURIComponent(usernameOrId || "");
      return `${PATHS.fans.profile}?u=${u}`;
    },

    post(postId) {
      const id = encodeURIComponent(postId || "");
      return `${PATHS.app.post}?id=${id}`;
    },

    subscriptions(creatorId) {
      const creator = encodeURIComponent(creatorId || "");
      return `${PATHS.fans.subscriptions}?creator=${creator}`;
    },
  };

  window.OP_PATHS = PATHS;
  window.OP_NAV = NAV;
  window.OP_URLS = URLS;
})();