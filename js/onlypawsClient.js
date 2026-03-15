/* =========================================================
   OnlyPaws
   File: /js/onlypawsClient.js
   Purpose: initialize Supabase client
   Dependencies:
   - https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
   ========================================================= */

(function () {

  if (window.onlypawsClient) {
    return;
  }

  if (!window.supabase) {
    throw new Error(
      "Supabase JS not loaded. Include first: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    );
  }

  const SUPABASE_URL = "https://sdhpbwkhdovyunvtdtbq.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaHBid2toZG92eXVudnRkdGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NTU1NDMsImV4cCI6MjA4NTUzMTU0M30.QuEhO3G7U0ScHrHqgIGnwm0uqtlfs2qXvGXPh1UKsRo";

  const onlypawsClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
      global: {
        headers: {
          "X-Client-Info": "onlypaws-web",
        },
      },
    }
  );

  window.onlypawsClient = onlypawsClient;

})();