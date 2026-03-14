/* =========================================================
   OnlyPaws
   File: /js/paths.js
   Purpose: central absolute path map for pages, assets, and components
   ========================================================= */

window.OP_PATHS = {
  app: {
    shared: {
      authCallback: "/html/app/shared/auth-callback.html",
      feed: "/html/app/shared/feed.html",
      post: "/html/app/shared/post.html",
      profile: "/html/app/shared/profile.html"
    },

    creators: {
      createPost: "/html/app/creators/create-post.html",
      creatorDash: "/html/app/creators/creator-dash.html",
      fanProfile: "/html/app/creators/fan-profile.html",
      payoutsSetup: "/html/app/creators/payouts-setup.html",
      pets: "/html/app/creators/pets.html"
    },

    fans: {
      fanDash: "/html/app/fans/fan-dash.html",
      creatorProfile: "/html/app/fans/creator-profile.html",
      purchasedPosts: "/html/app/fans/purchased-posts.html",
      subscriptions: "/html/app/fans/subscriptions.html"
    }
  },

  faq: {
    creators: "/html/marketing/faq/faq-creators.html",
    fans: "/html/marketing/faq/faq-fans.html"
  },

  legal: {
    contentPolicy: "/html/marketing/legal/content-policy.html",
    privacyPolicy: "/html/marketing/legal/privacy-policy.html",
    stripe: "/html/marketing/legal/stripe.html",
    terms: "/html/marketing/legal/terms.html"
  },

  marketing: {
    index: "/index.html",
    home: "/html/marketing/pages/index.html",
    creators: "/html/marketing/pages/creators.html",
    fans: "/html/marketing/pages/fans.html",
    thePack: "/html/marketing/pages/the-pack.html",
    emailConfirmed: "/html/marketing/pages/email-confirmed.html",
    resetPassword: "/html/marketing/pages/reset-password.html",

    faqCreators: "/html/marketing/faq/faq-creators.html",
    faqFans: "/html/marketing/faq/faq-fans.html",

    terms: "/html/marketing/legal/terms.html",
    privacyPolicy: "/html/marketing/legal/privacy-policy.html",
    contentPolicy: "/html/marketing/legal/content-policy.html",
    stripe: "/html/marketing/legal/stripe.html"
  },

  thanks: {
    creatorMembership: "/html/thanks/thanks-creator-membership.html",
    creatorPlan: "/html/thanks/thanks-creator-plan.html",
    fanMembership: "/html/thanks/thanks-fan-membership.html",
    supportUs: "/html/thanks/thanks-support-us.html"
  },

  assets: {
    logo: "/assets/images/logo.png",
    creatorsImage: "/assets/images/onlypaws-creators.png",
    fansImage: "/assets/images/onlypaws-fans.png",
    indexImage: "/assets/images/onlypaws-index.png",
    pawCrown: "/assets/images/paw-crown.png",
    pawDiamond: "/assets/images/paw-diamond.png",
    pawStars: "/assets/images/paw-stars.png"
  },

  components: {
    header: "/components/header.html",
    footer: "/components/footer.html",
    headerMarketing: "/components/header-marketing.html",
    footerMarketing: "/components/footer-marketing.html"
  },

  static: {
    css: "/css/styles.css",

    marketingSharedCss: "/css/pages/marketing-shared.css",
    marketingIndexCss: "/css/pages/marketing-index.css",
    marketingAuthCss: "/css/pages/marketing-auth.css",
    marketingFansCss: "/css/pages/marketing-fans.css",
    marketingCreatorsCss: "/css/pages/marketing-creators.css",
    marketingThePackCss: "/css/pages/marketing-the-pack.css",
    marketingStatusCss: "/css/pages/marketing-status.css",
    marketingResetPasswordCss: "/css/pages/marketing-reset-password.css",

    appFeedCss: "/css/pages/app-feed.css",
    appProfileCss: "/css/pages/app-profile.css",
    appPostCss: "/css/pages/app-post.css",
    creatorDashCss: "/css/pages/creator-dash.css",

    authGuardJs: "/js/auth-guard.js",
    feedJs: "/js/feed.js",
    marketingAuthJs: "/js/marketing-auth.js",
    marketingIndexJs: "/js/marketing-index.js",
    marketingSharedJs: "/js/marketing-shared.js",
    marketingThePackJs: "/js/marketing-the-pack.js",
    navJs: "/js/nav.js",
    onlypawsClientJs: "/js/onlypawsClient.js",
    onlypawsLikesJs: "/js/onlypawsLikes.js",
    partialsJs: "/js/partials.js",
    pathsJs: "/js/paths.js",
    postCardJs: "/js/post-card.js",
    resetPasswordJs: "/js/reset-password.js",
    supportUsJs: "/js/support-us.js",
    walletJs: "/js/wallet.js"
  }
};
