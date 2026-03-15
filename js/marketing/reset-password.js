/* =========================================================
   OnlyPaws
   File: /js/marketing/reset-password.js
   Purpose: handle Supabase password reset flow
   Dependencies:
   - window.OP_PATHS
   - window.onlypawsClient
   - window.OPPartials
   - window.OPNav
   ========================================================= */

(function () {
  const client = window.onlypawsClient;

  const els = {
    form: document.getElementById("resetPasswordForm"),
    msg: document.getElementById("resetPasswordMsg"),
    password: document.getElementById("password"),
    passwordConfirm: document.getElementById("passwordConfirm"),
  };

  function setMsg(text) {
    if (!els.msg) return;
    els.msg.textContent = text || "";
  }

  function setBusy(isBusy) {
    if (els.password) els.password.disabled = !!isBusy;
    if (els.passwordConfirm) els.passwordConfirm.disabled = !!isBusy;

    const submitBtn = els.form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = !!isBusy;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const pass1 = (els.password?.value || "").trim();
    const pass2 = (els.passwordConfirm?.value || "").trim();

    if (pass1.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (pass1 !== pass2) {
      setMsg("Passwords do not match.");
      return;
    }

    if (!client?.auth) {
      setMsg("❌ onlypawsClient not found.");
      return;
    }

    setBusy(true);
    setMsg("Updating password...");

    try {
      const { error } = await client.auth.updateUser({
        password: pass1,
      });

      if (error) throw error;

      setMsg("✅ Password updated. You can now log in.");
      els.form?.reset();
    } catch (err) {
      setMsg(err?.message || "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function initPage() {
    if (window.OPPartials?.loadMarketingLayout) {
      await window.OPPartials.loadMarketingLayout();
    }

    if (window.OPNav?.initNav) {
      await window.OPNav.initNav();
    }

    if (!els.form) return;

    els.form.addEventListener("submit", handleSubmit);
  }

  window.addEventListener("DOMContentLoaded", initPage);
})();