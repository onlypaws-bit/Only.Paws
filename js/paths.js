/* =========================================================
   OnlyPaws
   File: /js/paths.js
   Purpose:
   Central source of truth for project paths and lightweight
   route helpers.

   Notes:
   - Uses root-relative paths to avoid folder-level issues.
   - The project has two physical index files for technical reasons:
     - /index.html
     - /html/marketing/index.html
   - Logical aliases:
     - OP_PATHS.index = canonical home entry for navigation
     - OP_PATHS.home  = canonical home entry for navigation
   - Physical marketing entries remain available under OP_PATHS.marketing.
   - Exposed globally as:
     - window.OP_PATHS
     - window.OPRoutes
   ========================================================= */



(function initOnlyPawsPaths() {
  const ROOT = "";

  const OP_PATHS = {
    root: `${ROOT}/`,

    index: `${ROOT}/index.html`,
    home: `${ROOT}/index.html`,

    static: {
      root: `${ROOT}/`,
      html: `${ROOT}/html`,
      css: `${ROOT}/css`,
      js: `${ROOT}/js`,
      assets: `${ROOT}/assets`,
      images: `${ROOT}/assets/images`,
      components: `${ROOT}/components`,
    },

    assets: {
      root: `${ROOT}/assets`,
      images: `${ROOT}/assets/images`,

      logo: `${ROOT}/assets/images/logo.png`,

      indexHero: `${ROOT}/assets/images/onlypaws-index.png`,
      creatorsHero: `${ROOT}/assets/images/onlypaws-creators.png`,
      fansHero: `${ROOT}/assets/images/onlypaws-fans.png`,

      pawCrown: `${ROOT}/assets/images/paw-crown.png`,
      pawDiamond: `${ROOT}/assets/images/paw-diamond.png`,
      pawStars: `${ROOT}/assets/images/paw-stars.png`,
    },

    components: {
      root: `${ROOT}/components`,
      header: `${ROOT}/components/header.html`,
      footer: `${ROOT}/components/footer.html`,
      headerMarketing: `${ROOT}/components/header-marketing.html`,
      footerMarketing: `${ROOT}/components/footer-marketing.html`,
      headerStripe: `${ROOT}/components/header-stripe.html`,
    },

    css: {
      root: `${ROOT}/css`,
      main: `${ROOT}/css/styles.css`,

      marketing: {
        root: `${ROOT}/css/marketing`,
        auth: `${ROOT}/css/marketing/auth.css`,
        creators: `${ROOT}/css/marketing/creators.css`,
        emailConfirmed: `${ROOT}/css/marketing/email-confirmed.css`,
        fans: `${ROOT}/css/marketing/fans.css`,
        home: `${ROOT}/css/marketing/index.css`,
        index: `${ROOT}/css/marketing/index.css`,
        layout: `${ROOT}/css/marketing/layout.css`,
        resetPassword: `${ROOT}/css/marketing/reset-password.css`,
        status: `${ROOT}/css/marketing/status.css`,
        stripe: `${ROOT}/css/marketing/stripe.css`,
        thePack: `${ROOT}/css/marketing/the-pack.css`,
      },

      app: {
        root: `${ROOT}/css/app`,

        comments: `${ROOT}/css/app/comments.css`,
        feed: `${ROOT}/css/app/feed.css`,
        post: `${ROOT}/css/app/post.css`,
        profile: `${ROOT}/css/app/profile.css`,

        creators: {
          root: `${ROOT}/css/app/creators`,
          createPost: `${ROOT}/css/app/creators/create-post.css`,
          creatorDash: `${ROOT}/css/app/creators/creator-dash.css`,
          creatorPlan: `${ROOT}/css/app/creators/creator-plan.css`,
          fanProfile: `${ROOT}/css/app/creators/fan-profile.css`,
          payoutsSetup: `${ROOT}/css/app/creators/payouts-setup.css`,
          pets: `${ROOT}/css/app/creators/pets.css`,
          wallet: `${ROOT}/css/app/creators/wallet.css`,
        },

        fans: {
          root: `${ROOT}/css/app/fans`,
          creatorProfile: `${ROOT}/css/app/fans/creator-profile.css`,
          fanDash: `${ROOT}/css/app/fans/fan-dash.css`,
          purchasedPosts: `${ROOT}/css/app/fans/purchased-posts.css`,
          subscriptions: `${ROOT}/css/app/fans/subscriptions.css`,
          pet: `${ROOT}/css/app/fans/pet.css`,
        },
      },
    },

    js: {
      root: `${ROOT}/js`,

      authGuard: `${ROOT}/js/auth-guard.js`,
      nav: `${ROOT}/js/nav.js`,
      onlypawsClient: `${ROOT}/js/onlypawsClient.js`,
      partials: `${ROOT}/js/partials.js`,
      paths: `${ROOT}/js/paths.js`,
      supportUs: `${ROOT}/js/support-us.js`,

      marketing: {
        root: `${ROOT}/js/marketing`,
        creators: `${ROOT}/js/marketing/creators.js`,
        fans: `${ROOT}/js/marketing/fans.js`,
        home: `${ROOT}/js/marketing/index.js`,
        index: `${ROOT}/js/marketing/index.js`,
        resetPassword: `${ROOT}/js/marketing/reset-password.js`,
        shared: `${ROOT}/js/marketing/shared.js`,
        thePack: `${ROOT}/js/marketing/the-pack.js`,
      },

      app: {
        root: `${ROOT}/js/app`,

        authCallback: `${ROOT}/js/app/auth-callback.js`,
        comments: `${ROOT}/js/app/comments.js`,
        feed: `${ROOT}/js/app/feed.js`,
        likes: `${ROOT}/js/app/likes.js`,
        post: `${ROOT}/js/app/post.js`,
        profile: `${ROOT}/js/app/profile.js`,

        creators: {
          root: `${ROOT}/js/app/creators`,
          createPost: `${ROOT}/js/app/creators/create-post.js`,
          creatorDash: `${ROOT}/js/app/creators/creator-dash.js`,
          creatorPlan: `${ROOT}/js/app/creators/creator-plan.js`,
          fanProfile: `${ROOT}/js/app/creators/fan-profile.js`,
          payoutsSetup: `${ROOT}/js/app/creators/payouts-setup.js`,
          pets: `${ROOT}/js/app/creators/pets.js`,
          wallet: `${ROOT}/js/app/creators/wallet.js`,
        },

        fans: {
          root: `${ROOT}/js/app/fans`,
          creatorProfile: `${ROOT}/js/app/fans/creator-profile.js`,
          fanDash: `${ROOT}/js/app/fans/fan-dash.js`,
          purchasedPosts: `${ROOT}/js/app/fans/purchased-posts.js`,
          subscriptions: `${ROOT}/js/app/fans/subscriptions.js`,
          pet: `${ROOT}/js/app/fans/pet.js`,
        },
      },
    },

    app: {
      root: `${ROOT}/html/app`,

      authCallback: `${ROOT}/html/app/auth-callback.html`,
      feed: `${ROOT}/html/app/feed.html`,
      post: `${ROOT}/html/app/post.html`,
      profile: `${ROOT}/html/app/profile.html`,

      creators: {
        root: `${ROOT}/html/app/creators`,
        createPost: `${ROOT}/html/app/creators/create-post.html`,
        creatorDash: `${ROOT}/html/app/creators/creator-dash.html`,
        creatorPlan: `${ROOT}/html/app/creators/creator-plan.html`,
        fanProfile: `${ROOT}/html/app/creators/fan-profile.html`,
        payoutsSetup: `${ROOT}/html/app/creators/payouts-setup.html`,
        pets: `${ROOT}/html/app/creators/pets.html`,
        wallet: `${ROOT}/html/app/creators/wallet.html`,
      },

      fans: {
        root: `${ROOT}/html/app/fans`,
        creatorProfile: `${ROOT}/html/app/fans/creator-profile.html`,
        fanDash: `${ROOT}/html/app/fans/fan-dash.html`,
        purchasedPosts: `${ROOT}/html/app/fans/purchased-posts.html`,
        subscriptions: `${ROOT}/html/app/fans/subscriptions.html`,
        pet: `${ROOT}/html/app/fans/pet.html`,
      },
    },

    marketing: {
      root: `${ROOT}/html/marketing`,
      index: `${ROOT}/index.html`,
      home: `${ROOT}/html/marketing/index.html`,
      creators: `${ROOT}/html/marketing/creators.html`,
      fans: `${ROOT}/html/marketing/fans.html`,
      emailConfirmed: `${ROOT}/html/marketing/email-confirmed.html`,
      resetPassword: `${ROOT}/html/marketing/reset-password.html`,
      thePack: `${ROOT}/html/marketing/the-pack.html`,
    },

    faq: {
      root: `${ROOT}/html/marketing/faq`,
      creators: `${ROOT}/html/marketing/faq/faq-creators.html`,
      fans: `${ROOT}/html/marketing/faq/faq-fans.html`,
    },

    legal: {
      root: `${ROOT}/html/marketing/legal`,
      contentPolicy: `${ROOT}/html/marketing/legal/content-policy.html`,
      privacyPolicy: `${ROOT}/html/marketing/legal/privacy-policy.html`,
      stripe: `${ROOT}/html/marketing/legal/stripe.html`,
      terms: `${ROOT}/html/marketing/legal/terms.html`,
    },

    thanks: {
      root: `${ROOT}/html/thanks`,
      creatorMembership: `${ROOT}/html/thanks/thanks-creator-membership.html`,
      creatorPlan: `${ROOT}/html/thanks/thanks-creator-plan.html`,
      fanMembership: `${ROOT}/html/thanks/thanks-fan-membership.html`,
      supportUs: `${ROOT}/html/thanks/thanks-support-us.html`,
    },
  };

  function resolvePath(pathKey) {
    if (!pathKey || typeof pathKey !== "string") return "";
    const parts = pathKey.split(".");
    let current = OP_PATHS;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) return "";
      current = current[part];
    }
    return typeof current === "string" ? current : "";
  }

  function buildHref(pathKey, query = {}, hash = "") {
    const base = resolvePath(pathKey);
    if (!base) return "";
    const url = new URL(base, window.location.origin);

    Object.entries(query || {}).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    });

    if (hash) url.hash = hash.startsWith("#") ? hash : `#${hash}`;
    return url.pathname + url.search + url.hash;
  }

  const OPRoutes = {
    get: resolvePath,
    has: (k) => !!resolvePath(k),
    href: buildHref,
    go: (k, q, h) => { const href = buildHref(k, q, h); if (href) window.location.href = href; },
    replace: (k, q, h) => { const href = buildHref(k, q, h); if (href) window.location.replace(href); },
  };

  window.OP_PATHS = Object.freeze(OP_PATHS);
  window.OPRoutes = Object.freeze(OPRoutes);
})();
