/* =========================================================
   OnlyPaws
   File: /js/marketing/fans.js
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  const els = {
    form: document.getElementById("fan-auth-form"),
    msg: document.getElementById("fanMsg"),
    email: document.getElementById("fan-email"),
    password: document.getElementById("fan-password"),
    loginBtn: document.getElementById("fanLoginBtn"),
    signupBtn: document.getElementById("fanSignupBtn"),

    forgotBtn: document.getElementById("forgotBtn"),
    resetBox: document.getElementById("resetBox"),
    sendResetBtn: document.getElementById("sendResetBtn"),
    cancelResetBtn: document.getElementById("cancelResetBtn"),
  };

  function path(...candidates) {
    for (const key of candidates) {
      if (!key) continue;

      if (typeof key === "string" && key.includes("/")) {
        return key;
      }

      const resolved =
        PATHS?.app?.fans?.[key] ||
        PATHS?.app?.creators?.[key] ||
        PATHS?.app?.[key] ||
        PATHS?.marketing?.[key] ||
        PATHS?.thanks?.[key] ||
        PATHS?.faq?.[key] ||
        PATHS?.legal?.[key] ||
        PATHS?.[key];

      if (resolved) return resolved;
    }

    return "";
  }

  function setMsg(text) {
    if (!els.msg) return;
    els.msg.textContent = text || "";
  }

  function setBusy(isBusy) {
    [
      els.signupBtn,
      els.loginBtn,
      els.email,
      els.password,
      els.forgotBtn,
      els.sendResetBtn,
      els.cancelResetBtn,
    ].forEach((el) => {
      if (el) el.disabled = !!isBusy;
    });
  }

  function showResetBox(show) {
    if (!els.resetBox) return;
    els.resetBox.hidden = !show;
  }

  function hideCurrentMarketingLink() {
    const pathname = window.location.pathname.toLowerCase();
    let current = "index";

    if (pathname.includes("creators")) current = "creators";
    else if (pathname.includes("fans")) current = "fans";

    document.querySelectorAll("[data-page]").forEach((link) => {
      if ((link.dataset.page || "").trim() === current) {
        link.remove();
      }
    });
  }

  /* =========================
     🔥 REDIRECT FIX CORE
     ========================= */

  function redirectAfterLogin() {
    try {
      const redirect = sessionStorage.getItem("op_redirect_after_auth");

      if (redirect) {
        sessionStorage.removeItem("op_redirect_after_auth");
        window.location.href = redirect;
        return;
      }
    } catch {}

    window.location.href =
      path("feed") || "/html/app/feed.html";
  }

  function redirectAfterSignup() {
    try {
      const redirect = sessionStorage.getItem("op_redirect_after_auth");

      if (redirect) {
        sessionStorage.removeItem("op_redirect_after_auth");
        window.location.href = redirect;
        return;
      }
    } catch {}

    window.location.href =
      path("profile") || "/html/app/profile.html";
  }

  /* ========================= */

  async function getSessionUser() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  async function ensureProfileAndWallet() {
    const user = await getSessionUser();
    if (!user?.id) throw new Error("No user session");

    const uid = user.id;
    const now = new Date().toISOString();

    const { data: existingProfile } = await client
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", uid)
      .maybeSingle();

    if (!existingProfile?.user_id) {
      await client.from("profiles").insert({
        user_id: uid,
        role: "fan",
        updated_at: now,
      });
    }

    await client.from("wallets").upsert(
      { profile_id: uid },
      { onConflict: "profile_id" }
    );
  }

  async function initMarketingPage() {
    if (window.OPPartials?.loadMarketingLayout) {
      await window.OPPartials.loadMarketingLayout();
    }

    hideCurrentMarketingLink();

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    if (typeof window.initSupportUsButton === "function") {
      await window.initSupportUsButton({
        buttonId: "supportUsBtn",
        messageId: "supportUsMsg",
        loginRedirect:
          `${path("fans") || "/html/marketing/fans.html"}?support=1`,
        successPath:
          path("supportUs") || "/html/thanks/thanks-support-us.html",
        cancelPath:
          path("fans") || "/html/marketing/fans.html",
      });
    }
  }

  async function handlePasswordReset() {
    setBusy(true);

    try {
      const email = (els.email?.value || "").trim();

      if (!email) {
        setMsg("Please enter your email first.");
        return;
      }

      const redirectTo =
        `${window.location.origin}${path("resetPassword") || "/html/marketing/reset-password.html"}`;

      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      setMsg("✅ Email sent!");
      showResetBox(false);
    } finally {
      setBusy(false);
    }
  }

  async function loginFlow() {
    setMsg("Logging in...");
    setBusy(true);

    try {
      const email = (els.email?.value || "").trim();
      const password = els.password?.value || "";

      if (!email || !password) {
        setMsg("Enter email and password.");
        return;
      }

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      if (data?.session) {
        await ensureProfileAndWallet();
        redirectAfterLogin();
      }
    } catch (err) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function signupFlow() {
    setMsg("Creating your account...");
    setBusy(true);

    try {
      const email = (els.email?.value || "").trim();
      const password = els.password?.value || "";

      if (!email || password.length < 6) {
        setMsg("Invalid email or password.");
        return;
      }

      const emailRedirectTo =
        `${window.location.origin}${path("emailConfirmed") || "/html/marketing/email-confirmed.html"}`;

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { role: "fan" },
          emailRedirectTo,
        },
      });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      if (data?.session) {
        await ensureProfileAndWallet();
        redirectAfterSignup();
      } else {
        setMsg("✅ Check your email to confirm 🐾");
      }
    } catch (err) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function bindUi() {
    els.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      loginFlow();
    });

    els.signupBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      signupFlow();
    });

    els.forgotBtn?.addEventListener("click", () => {
      showResetBox(true);
      setMsg("");
    });

    els.cancelResetBtn?.addEventListener("click", () => {
      showResetBox(false);
      setMsg("");
    });

    els.sendResetBtn?.addEventListener("click", handlePasswordReset);
  }

  /* =========================
     🔥 FIX AUTO REDIRECT
     ========================= */

  async function autoRedirectIfLoggedIn() {
    try {
      const params = new URLSearchParams(window.location.search);

      // 🚫 se siamo in auth flow → NON redirect
      if (params.get("auth") === "1") return;

      const { data } = await client.auth.getSession();

      if (data?.session) {
        redirectAfterLogin();
      }
    } catch (err) {
      console.warn("auto redirect skipped", err);
    }
  }

  /* ========================= */

  async function boot() {
    if (!client) {
      console.error("onlypawsClient missing");
      return;
    }

    await initMarketingPage();
    bindUi();
    await autoRedirectIfLoggedIn();
  }

  boot();
})();
