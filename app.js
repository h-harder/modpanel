const ModPanel = (() => {
  const API_BASE = "https://roblox-modpanel-api.suited-woodsy9d.workers.dev";
  const TOKEN_KEY = "modpanel_token_v1";

  function qs(id){ return document.getElementById(id); }

  function setMsg(el, text, kind){
    if(!el) return;
    el.classList.remove("ok","bad");
    if(kind) el.classList.add(kind);
    el.textContent = text || "";
  }

  function getToken(){ return localStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
  function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

  async function apiFetch(path, options = {}){
    const url = API_BASE.replace(/\/$/,"") + path;
    const method = (options.method || "GET").toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;

    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const res = await fetch(url, { ...options, method, headers });

    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) data = await res.json().catch(() => null);
    else data = { text: await res.text().catch(() => "") };

    if (!res.ok) {
      const message = (data && (data.error || data.message)) || `Request failed: ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ---------- Login ----------
  async function initLogin(){
    const form = qs("loginForm");
    const password = qs("password");
    const msg = qs("loginMsg");

    // If token already valid, go to panel
    try {
      await apiFetch("/me", { method: "GET" });
      location.href = "./panel.html";
      return;
    } catch (_) {}

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(msg, "Logging in…");

      try {
        const out = await apiFetch("/login", {
          method: "POST",
          body: JSON.stringify({ password: password.value })
        });
        if (!out.token) throw new Error("No token returned from server.");
        setToken(out.token);

        setMsg(msg, "Logged in. Redirecting…", "ok");
        location.href = "./panel.html";
      } catch (err) {
        setMsg(msg, err.message || "Login failed.", "bad");
      }
    });
  }

  // ---------- Panel ----------
  async function initPanel(){
    const statusText = qs("statusText");

    const shutdownEnabled = qs("shutdownEnabled");
    const shutdownStateHint = qs("shutdownStateHint");
    const kickExisting = qs("kickExisting");
    const applyShutdownBtn = qs("applyShutdownBtn");
    const shutdownMsg = qs("shutdownMsg");

    const announceMessage = qs("announceMessage");
    const announceDuration = qs("announceDuration");
    const sendAnnounceBtn = qs("sendAnnounceBtn");
    const announceMsg = qs("announceMsg");

    const userId = qs("userId");
    const reason = qs("reason");
    const banMinutes = qs("banMinutes");
    const warnBtn = qs("warnBtn");
    const kickBtn = qs("kickBtn");
    const banBtn = qs("banBtn");
    const unbanBtn = qs("unbanBtn");
    const clearWarnsBtn = qs("clearWarnsBtn");
    const playerMsg = qs("playerMsg");

    const refreshBtn = qs("refreshBtn");
    const logoutBtn = qs("logoutBtn");

    const whoamiBtn = qs("whoamiBtn");
    const whoamiOut = qs("whoamiOut");
    const getStateBtn = qs("getStateBtn");
    const stateOut = qs("stateOut");

    function requireUserId(){
      const v = (userId?.value || "").trim();
      if(!/^\d+$/.test(v)) throw new Error("Enter a valid numeric UserId.");
      return Number(v);
    }

    function clearMsgs(){
      setMsg(shutdownMsg, "");
      setMsg(announceMsg, "");
      setMsg(playerMsg, "");
    }

    function applyState(st){
      const enabled = !!(st && (st.shutdownEnabled ?? st.enabled));
      if (shutdownEnabled) shutdownEnabled.checked = enabled;
      if (shutdownStateHint) shutdownStateHint.textContent = enabled ? "ON (new joins blocked)" : "OFF (normal)";
      if (stateOut) stateOut.textContent = JSON.stringify(st, null, 2);
    }

    async function loadState(){
      const st = await apiFetch("/state", { method: "GET" });
      statusText.textContent = "Connected";
      applyState(st);
    }

    // Top bar
    refreshBtn?.addEventListener("click", async () => {
      clearMsgs();
      statusText.textContent = "Refreshing…";
      try {
        await loadState();
      } catch (e) {
        statusText.textContent = "Error";
      }
    });

    logoutBtn?.addEventListener("click", () => {
      clearToken();
      location.href = "./index.html";
    });

    // Shutdown
    applyShutdownBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(shutdownMsg, "Applying…");
      try {
        const enabled = !!shutdownEnabled?.checked;
        const payload = { enabled, kickExisting: !!kickExisting?.checked };

        await apiFetch("/cmd/shutdown", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        setMsg(shutdownMsg, `Shutdown Mode is now ${enabled ? "ON" : "OFF"}.`, "ok");
        await loadState();
      } catch (err) {
        setMsg(shutdownMsg, err.message || "Failed to apply.", "bad");
      }
    });

    // Announcement
    sendAnnounceBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(announceMsg, "Sending…");
      try {
        const message = (announceMessage?.value || "").trim();
        const duration = Number(announceDuration?.value || 8);

        if (!message) throw new Error("Enter an announcement message.");

        await apiFetch("/cmd/announce", {
          method: "POST",
          body: JSON.stringify({ message, duration })
        });

        setMsg(announceMsg, "Announcement sent.", "ok");
        if (announceMessage) announceMessage.value = "";
      } catch (err) {
        setMsg(announceMsg, err.message || "Failed to send.", "bad");
      }
    });

    // Player actions
    warnBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(playerMsg, "Sending warning…");
      try {
        await apiFetch("/cmd/warn", {
          method: "POST",
          body: JSON.stringify({
            userId: requireUserId(),
            reason: (reason?.value || "").trim()
          })
        });
        setMsg(playerMsg, "Warn sent.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message || "Warn failed.", "bad");
      }
    });

    kickBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(playerMsg, "Kicking…");
      try {
        await apiFetch("/cmd/kick", {
          method: "POST",
          body: JSON.stringify({
            userId: requireUserId(),
            reason: (reason?.value || "").trim()
          })
        });
        setMsg(playerMsg, "Kick command sent.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message || "Kick failed.", "bad");
      }
    });

    banBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(playerMsg, "Banning…");
      try {
        const minutes = Number(banMinutes?.value || 0);
        if (minutes < 0) throw new Error("Ban minutes must be 0 or higher.");

        await apiFetch("/cmd/ban", {
          method: "POST",
          body: JSON.stringify({
            userId: requireUserId(),
            reason: (reason?.value || "").trim(),
            durationSeconds: Math.floor(minutes * 60)
          })
        });

        setMsg(playerMsg, minutes === 0 ? "Permanent ban set." : `Banned for ${minutes} minutes.`, "ok");
      } catch (err) {
        setMsg(playerMsg, err.message || "Ban failed.", "bad");
      }
    });

    unbanBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(playerMsg, "Unbanning…");
      try {
        await apiFetch("/cmd/unban", {
          method: "POST",
          body: JSON.stringify({ userId: requireUserId() })
        });
        setMsg(playerMsg, "Unbanned.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message || "Unban failed.", "bad");
      }
    });

    clearWarnsBtn?.addEventListener("click", async () => {
      clearMsgs();
      setMsg(playerMsg, "Clearing warnings…");
      try {
        await apiFetch("/cmd/clearwarns", {
          method: "POST",
          body: JSON.stringify({ userId: requireUserId() })
        });
        setMsg(playerMsg, "Warnings cleared.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message || "Clear failed.", "bad");
      }
    });

    // Quick checks
    whoamiBtn?.addEventListener("click", async () => {
      if (whoamiOut) whoamiOut.textContent = "Loading…";
      try {
        const me = await apiFetch("/me", { method: "GET" });
        if (whoamiOut) whoamiOut.textContent = JSON.stringify(me, null, 2);
      } catch (err) {
        if (whoamiOut) whoamiOut.textContent = JSON.stringify({ error: err.message }, null, 2);
      }
    });

    getStateBtn?.addEventListener("click", async () => {
      if (stateOut) stateOut.textContent = "Loading…";
      try {
        const st = await apiFetch("/state", { method: "GET" });
        applyState(st);
      } catch (err) {
        if (stateOut) stateOut.textContent = JSON.stringify({ error: err.message }, null, 2);
      }
    });

    // Initial auth check + state load
    try {
      statusText.textContent = "Connecting…";
      await apiFetch("/me", { method:"GET" });
      await loadState();
    } catch (err) {
      clearToken();
      location.href = "./index.html";
    }
  }

  return { initLogin, initPanel };
})();

window.ModPanel = ModPanel;
