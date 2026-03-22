/* =========================================================
   OnlyPaws
   File: /js/support-us.js
   Purpose:
   Initialize Support Us subscription button state and flow.

   Handles:
   - guest support checkout
   - logged-in support status detection
   - support checkout
   - support cancellation
   - support resume

   Exposes:
   - window.initSupportUsButton

   Dependencies:
   - window.OP_PATHS
   - window.OPRoutes
   - window.onlypawsClient
   ========================================================= */

(function () {
  window.initSupportUsButton = async function initSupportUsButton(options = {}) {
    const client = window.onlypawsClient;
    const PATHS = window.OP_PATHS || {};
    const ROUTES = window.OPRoutes || null;

    const {
      buttonId = "supportUsBtn",
      messageId = "supportUsMsg",
      successPath = PATHS?.thanks?.supportUs || "/html/thanks/thanks-support-us.html",
      cancelPath = window.location.pathname || "/",
      supportLabel = "Support OnlyPaws 🐾",
      cancelLabel = "Cancel support",
      resumeLabel = "Resume support",
    } = options;

    const btn = document.getElementById(buttonId);
    const msg = document.getElementById(messageId);

    if (!btn) return;

    if (!client?.auth) {
      if (msg) {
        msg.textContent = "❌ onlypawsClient not found. Check onlypawsClient.js.";
      }
      return;
    }

    const activeStatuses = ["trialing", "active", "past_due", "unpaid"];

    let currentAction = null;

    function resolvePath(pathOrKey) {
      if (!pathOrKey) return "";

      if (typeof pathOrKey !== "string") return "";

      if (pathOrKey.startsWith("/") || /^https?:\/\//i.test(pathOrKey)) {
        return pathOrKey;
      }

      if (ROUTES?.has?.(pathOrKey)) {
        return ROUTES.get(pathOrKey);
      }

      return pathOrKey;
    }

    function setMsg(text) {
      if (!msg) return;
      msg.textContent = text || "";
    }

    function setButton(label, disabled = false) {
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.classList.toggle("isBusy", !!disabled);
    }

    function setAction(action) {
      currentAction = action;
    }

    function openExternal(url) {
      if (!url) return false;

      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      if (newWindow) {
        return true;
      }

      setMsg("❌ Popup blocked. Please allow popups and try again.");
      return false;
    }

    async function goCheckout() {
      setButton(btn.textContent || supportLabel, true);
      setMsg("Opening Stripe in a new tab...");

      try {
        const { data, error } = await client.functions.invoke("support-us-checkout", {
          body: {
            successPath: resolvePath(successPath),
            cancelPath: resolvePath(cancelPath),
          },
        });

        if (error) {
          setMsg(`❌ ${error.message || "Unable to start checkout."}`);
          setButton(supportLabel, false);
          setAction(goCheckout);
          return;
        }

        if (data?.url) {
          const opened = openExternal(data.url);

          if (opened) {
            setMsg("Stripe opened in a new tab.");
          } else {
            setButton(supportLabel, false);
            setAction(goCheckout);
          }
          return;
        }

        setMsg("❌ Missing checkout URL.");
        setButton(supportLabel, false);
        setAction(goCheckout);
      } catch (err) {
        setMsg(`❌ ${err?.message || String(err)}`);
        setButton(supportLabel, false);
        setAction(goCheckout);
      }
    }

    async function cancelSupport() {
      setButton(cancelLabel, true);
      setMsg("Canceling...");

      try {
        const { error } = await client.functions.invoke("support-us-cancel");

        if (error) {
          setMsg(`❌ ${error.message || "Unable to cancel support."}`);
          setButton(cancelLabel, false);
          setAction(cancelSupport);
          return;
        }

        setMsg("Support will cancel at period end.");
        setButton(resumeLabel, false);
        setAction(resumeSupport);
      } catch (err) {
        setMsg(`❌ ${err?.message || String(err)}`);
        setButton(cancelLabel, false);
        setAction(cancelSupport);
      }
    }

    async function resumeSupport() {
      setButton(resumeLabel, true);
      setMsg("Resuming...");

      try {
        const { error } = await client.functions.invoke("support-us-resume");

        if (error) {
          setMsg(`❌ ${error.message || "Unable to resume support."}`);
          setButton(resumeLabel, false);
          setAction(resumeSupport);
          return;
        }

        setMsg("Support resumed 💜");
        setButton(cancelLabel, false);
        setAction(cancelSupport);
      } catch (err) {
        setMsg(`❌ ${err?.message || String(err)}`);
        setButton(resumeLabel, false);
        setAction(resumeSupport);
      }
    }

    if (btn.dataset.bound !== "1") {
      btn.dataset.bound = "1";

      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        if (btn.disabled) return;
        if (typeof currentAction === "function") {
          await currentAction();
        }
      });
    }

    setButton(supportLabel, false);

    try {
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData?.session?.user || null;

      // Guests can support without logging in.
      if (!user) {
        setAction(goCheckout);
        return;
      }

      const { data: support, error } = await client
        .from("support_us")
        .select("status, cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("support_us read error:", error);
        setMsg("Could not load support status.");
        setAction(goCheckout);
        return;
      }

      if (!support) {
        setAction(goCheckout);
        return;
      }

      const status = (support.status || "").toString().toLowerCase();
      const isActive = activeStatuses.includes(status);
      const isCanceling = isActive && support.cancel_at_period_end === true;
      const isActiveNotCanceling = isActive && support.cancel_at_period_end === false;

      if (isActiveNotCanceling) {
        setButton(cancelLabel, false);
        setAction(cancelSupport);
        return;
      }

      if (isCanceling) {
        setButton(resumeLabel, false);
        setAction(resumeSupport);
        return;
      }

      setButton(supportLabel, false);
      setAction(goCheckout);
    } catch (err) {
      console.error("initSupportUsButton error:", err);
      setMsg("Could not load support status.");
      setButton(supportLabel, false);
      setAction(goCheckout);
    }
  };
})();
