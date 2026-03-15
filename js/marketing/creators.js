/* =========================================================
   OnlyPaws
   File: /js/marketing/creators.js
   Purpose: marketing creators page logic
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   - window.initSupportUsButton
   ========================================================= */

(function () {
  const client = window.onlypawsClient;
  const PATHS = window.OP_PATHS || {};

  const els = {
    form: document.getElementById("creator-auth-form"),
    msg: document.getElementById("creatorMsg"),
    email: document.getElementById("creator-email"),
    password: document.getElementById("creator-password"),
    loginBtn: document.getElementById("creatorLoginBtn"),
    signupBtn: document.getElementById("creatorSignupBtn"),

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
        PATHS?.app?.creators?.[key] ||
        PATHS?.app?.fans?.[key] ||
        PATHS?.app?.[key] ||
        PATHS?.marketing?.[key] ||
        PATHS?.thanks?.[key] ||
        PATHS?.faq?.[key] ||
        PATHS?.legal?.[key] ||
        PATHS?.[key];

      if (resolved) {
        return resolved;
      }
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
      if (el) {
        el.disabled = !!isBusy;
      }
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
    else if (pathname.includes("the-pack")) current = "the-pack";
    else if (pathname.includes("index") || pathname.endsWith("/")) current = "index";

    document.querySelectorAll("[data-page]").forEach((link) => {
      if ((link.dataset.page || "").trim() === current) {
        link.remove();
      }
    });
  }

  function getNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");

    if (next === "profile") return path("profile") || "/html/app/profile.html";
    if (next === "feed") return path("feed") || "/html/app/feed.html";

    if (next && next.endsWith(".html")) return next;

    return path("feed") || "/html/app/feed.html";
  }

  function redirectAfterAuth() {
    window.location.href = getNextPath();
  }

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

    const { data: existingProfile, error: profileReadError } = await client
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", uid)
      .maybeSingle();

    if (profileReadError) throw profileReadError;

    let profile = existingProfile;

    if (!existingProfile) {
      const insertRes = await client
        .from("profiles")
        .insert({
          user_id: uid,
          role: "fan",
          updated_at: now,
        })
        .select()
        .maybeSingle();

      if (insertRes.error) throw insertRes.error;
      profile = insertRes.data;
    }

    const walletRes = await client
      .from("wallets")
      .upsert(
        { profile_id: uid },
        { onConflict: "profile_id" }
      )
      .select()
      .maybeSingle();

    if (walletRes.error) throw walletRes.error;

    return {
      profile,
      wallet: walletRes.data,
    };
  }

  async function promoteToCreator() {
    const user = await getSessionUser();
    if (!user?.id) throw new Error("No user session");

    const { data, error } = await client
      .from("profiles")
      .update({ role: "creator" })
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
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
        loginRedirect: `${path("fans") || "/html/marketing/fans.html"}?support=1`,
        successPath: path("supportUs") || "/html/thanks/thanks-support-us.html",
        cancelPath: path("creators") || "/html/marketing/creators.html",
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

      setMsg("Sending reset email...");

      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      setMsg("✅ Email sent! Check your inbox (and spam) 🐾");
      showResetBox(false);
    } catch (err) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();

    setMsg("Creating your creator account...");
    setBusy(true);

    try {
      const email = (els.email?.value || "").trim();
      const password = els.password?.value || "";

      if (!email) {
        setMsg("Please enter your email.");
        return;
      }

      if (password.length < 6) {
        setMsg("Password must be at least 6 characters.");
        return;
      }

      const emailRedirectTo =
        `${window.location.origin}${path("emailConfirmed") || "/html/marketing/email-confirmed.html"}`;

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { role: "creator" },
          emailRedirectTo,
        },
      });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      if (data?.session) {
        await ensureProfileAndWallet();
        await promoteToCreator();
        window.location.href = path("profile") || "/html/app/profile.html";
        return;
      }

      setMsg("✅ Account created. Check your email to confirm 🐾");
    } catch (err) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    setMsg("Logging in...");
    setBusy(true);

    try {
      const email = (els.email?.value || "").trim();
      const password = els.password?.value || "";

      if (!email) {
        setMsg("Please enter your email.");
        return;
      }

      if (!password) {
        setMsg("Please enter your password.");
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
        window.location.href = path("feed") || "/html/app/feed.html";
      }
    } catch (err) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function bindUi() {
    if (els.forgotBtn) {
      els.forgotBtn.addEventListener("click", () => {
        showResetBox(true);
        setMsg("");
      });
    }

    if (els.cancelResetBtn) {
      els.cancelResetBtn.addEventListener("click", () => {
        showResetBox(false);
        setMsg("");
      });
    }

    if (els.sendResetBtn) {
      els.sendResetBtn.addEventListener("click", handlePasswordReset);
    }

    if (els.signupBtn) {
      els.signupBtn.addEventListener("click", handleSignup);
    }

    if (els.loginBtn) {
      els.loginBtn.addEventListener("click", handleLogin);
    }

    if (els.form) {
      els.form.addEventListener("submit", handleLogin);
    }
  }

  async function autoRedirectIfLoggedIn() {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session) {
        redirectAfterAuth();
      }
    } catch (error) {
      console.warn("auto-redirect skipped:", error);
    }
  }

  async function boot() {
    if (!client) {
      setMsg("❌ onlypawsClient not found. Check onlypawsClient.js path + script order.");
      console.error("onlypawsClient is undefined.");
      return;
    }

    await initMarketingPage();
    bindUi();
    await autoRedirectIfLoggedIn();
  }

  boot();
})();