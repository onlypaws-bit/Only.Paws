/*
OnlyPaws global paths map
Used for JS navigation (redirects, buttons, auth flows, etc.)

Structure reference:
html/
  app/
  creators/
  fans/
  faq/
  legal/
  marketing/
  thanks/
*/

window.OP_PATHS = {

  /* -------------------- MARKETING -------------------- */

  marketing: {
    index: "/html/marketing/index.html",
    creators: "/html/marketing/creators.html",
    fans: "/html/marketing/fans.html",
    thePack: "/html/marketing/the-pack.html",
    emailConfirmed: "/html/marketing/email-confirmed.html",
    resetPassword: "/html/marketing/reset-password.html"
  },


  /* -------------------- APP CORE -------------------- */

  app: {
    feed: "/html/app/feed.html",
    profile: "/html/app/profile.html",
    post: "/html/app/post.html",
    authCallback: "/html/app/auth-callback.html"
  },


  /* -------------------- CREATOR AREA -------------------- */

  creators: {
    dash: "/html/creators/creator-dash.html",
    createPost: "/html/creators/create-post.html",
    profile: "/html/creators/creator-profile.html",
    pets: "/html/creators/pets.html",
    payoutsSetup: "/html/creators/payouts-setup.html"
  },


  /* -------------------- FAN AREA -------------------- */

  fans: {
    dash: "/html/fans/fan-dash.html",
    profile: "/html/fans/fan-profile.html",
    subscriptions: "/html/fans/subscriptions.html",
    purchasedPosts: "/html/fans/purchased-posts.html"
  },


  /* -------------------- FAQ -------------------- */

  faq: {
    creators: "/html/faq/faq-creators.html",
    fans: "/html/faq/faq-fans.html"
  },


  /* -------------------- LEGAL -------------------- */

  legal: {
    terms: "/html/legal/terms.html",
    privacy: "/html/legal/privacy-policy.html",
    contentPolicy: "/html/legal/content-policy.html",
    stripe: "/html/legal/stripe.html"
  },


  /* -------------------- THANK YOU PAGES -------------------- */

  thanks: {
    creatorMembership: "/html/thanks/thanks-creator-membership.html",
    creatorPlan: "/html/thanks/thanks-creator-plan.html",
    fanMembership: "/html/thanks/thanks-fan-membership.html",
    supportUs: "/html/thanks/thanks-support-us.html"
  }

};


/* ---------------------------------------------------------- */
/* Helper functions */
/* ---------------------------------------------------------- */

window.OP_NAV = {

  go(path) {
    window.location.href = path;
  },

  goFeed() {
    window.location.href = OP_PATHS.app.feed;
  },

  goProfile() {
    window.location.href = OP_PATHS.app.profile;
  },

  goCreatorDash() {
    window.location.href = OP_PATHS.creators.dash;
  },

  goFanDash() {
    window.location.href = OP_PATHS.fans.dash;
  },

  goHome() {
    window.location.href = OP_PATHS.marketing.index;
  }

};