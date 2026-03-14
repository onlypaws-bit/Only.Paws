/* =========================================================
   OnlyPaws
   File: /js/reset-password.js
   Purpose: handle Supabase password reset flow
   ========================================================= */

(function () {

  const form = document.getElementById("resetPasswordForm");
  const msg = document.getElementById("resetPasswordMsg");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const pass1 = document.getElementById("password").value.trim();
    const pass2 = document.getElementById("passwordConfirm").value.trim();

    if (pass1.length < 6) {
      msg.textContent = "Password must be at least 6 characters.";
      return;
    }

    if (pass1 !== pass2) {
      msg.textContent = "Passwords do not match.";
      return;
    }

    try {
      const { error } = await onlypawsClient.auth.updateUser({
        password: pass1
      });

      if (error) throw error;

      msg.textContent = "✅ Password updated. You can now log in.";
      form.reset();

    } catch (err) {
      msg.textContent = err.message || "Password reset failed.";
    }
  });

})();
