/* global window, document, location */

const ModPanel = (() => {
  // ✅ CHANGE THIS to your Cloudflare Worker URL
  // Example: "https://roblox-modpanel-api.yourname.workers.dev"
  const API_BASE = "https://YOUR-WORKER.your-subdomain.workers.dev";

  function qs(id){ return document.getElementById(id); }

  function setMsg(el, text, kind){
    if(!el) return;
    el.classList.remove("ok","bad");
    if(kind) el.classList.add(kind);
    el.textContent = text || "";
  }

  async function apiFetch(path, options = {}){
    const url = API_BASE.replace(/\/$/,"") + path;
    const res = await fetch(url, {
      ...options,
      credentials: "include", // session cookie
      headers: {
        "Content-Type":"application/json",
        ...(options.headers || {})
      },
    });

    // auto-handle auth failures
    if (res.status === 401 || res.status === 403) {
      // If we’re on the panel, bounce to login
      if (location.pathname.endsWith("panel.html")) {
        location.href = "./index.html";
      }
    }

    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      data = text ? { text } : null;
    }

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

    // If already logged in, go to panel (best-effort)
    try {
      await apiFetch("/me", { method: "GET" });
      location.href = "./panel.html";
      return;
    } catch (_) {
      // ignore
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(msg, "Logging in…");

      try {
        await apiFetch("/login", {
          method: "POST",
          body: JSON.stringify({ password: password.value })
        });

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
      const v = (userId.value || "").trim();
      if(!/^\d+$/.test(v)) throw new Error("Enter a valid numeric UserId.");
      return Number(v);
    }

    async function loadState(){
      statusText.textContent = "Connected";
      setMsg(shutdownMsg, "");
      setMsg(announceMsg, "");
      setMsg(playerMsg, "");

      // Best-effort: /state endpoint recommended; fallback to /shutdown/state
      try {
        const st = await apiFetch("/state", { method: "GET" });
        applyState(st);
      } catch (_) {
        try {
          const st = await apiFetch("/shutdown/state", { method: "GET" });
          applyState(st);
        } catch {
          shutdownStateHint.textContent = "State endpoint not available.";
        }
      }
    }

    function applyState(st){
      // expect: { shutdownEnabled: boolean, updatedAt?: number }
      const enabled = !!(st && (st.shutdownEnabled ?? st.enabled));
      shutdownEnabled.checked = enabled;
      shutdownStateHint.textContent = enabled ? "ON (new joins blocked)" : "OFF (normal)";
      stateOut.textContent = JSON.stringify(st, null, 2);
    }

    // Wire buttons
    refreshBtn.addEventListener("click", loadState);

    logoutBtn.addEventListener("click", async () => {
      try { await apiFetch("/logout", { method: "POST" }); } catch (_) {}
      location.href = "./index.html";
    });

    applyShutdownBtn.addEventListener("click", async () => {
      setMsg(shutdownMsg, "Applying…");
      try {
        const enabled = shutdownEnabled.checked;
        const payload = { enabled, kickExisting: kickExisting.checked };

        // preferred endpoint
        try {
          await apiFetch("/cmd/shutdown", { method:"POST", body: JSON.stringify(payload) });
        } catch (_) {
          // fallback endpoint
          await apiFetch("/shutdown", { method:"POST", body: JSON.stringify(payload) });
        }

        setMsg(shutdownMsg, `Shutdown Mode is now ${enabled ? "ON" : "OFF"}.`, "ok");
        await loadState();
      } catch (err) {
        setMsg(shutdownMsg, err.message, "bad");
      }
    });

    sendAnnounceBtn.addEventListener("click", async () => {
      setMsg(announceMsg, "Sending…");
      try {
        const payload = {
          message: (announceMessage.value || "").trim(),
          duration: Number(announceDuration.value || 8)
        };
        if (!payload.message) throw new Error("Enter an announcement message.");

        try {
          await apiFetch("/cmd/announce", { method:"POST", body: JSON.stringify(payload) });
        } catch (_) {
          await apiFetch("/announce", { method:"POST", body: JSON.stringify(payload) });
        }

        setMsg(announceMsg, "Announcement sent.", "ok");
        announceMessage.value = "";
      } catch (err) {
        setMsg(announceMsg, err.message, "bad");
      }
    });

    warnBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Sending warning…");
      try {
        const payload = { userId: requireUserId(), reason: (reason.value||"").trim() };
        await apiFetch("/cmd/warn", { method:"POST", body: JSON.stringify(payload) });
        setMsg(playerMsg, "Warn sent.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    kickBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Kicking…");
      try {
        const payload = { userId: requireUserId(), reason: (reason.value||"").trim() };
        await apiFetch("/cmd/kick", { method:"POST", body: JSON.stringify(payload) });
        setMsg(playerMsg, "Kick command sent.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    banBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Banning…");
      try {
        const minutes = Number(banMinutes.value || 0);
        if (minutes < 0) throw new Error("Ban minutes must be 0 or higher.");

        const payload = {
          userId: requireUserId(),
          reason: (reason.value||"").trim(),
          durationSeconds: Math.floor(minutes * 60)
        };
        await apiFetch("/cmd/ban", { method:"POST", body: JSON.stringify(payload) });
        setMsg(playerMsg, minutes === 0 ? "Permanent ban set." : `Banned for ${minutes} minutes.`, "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    unbanBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Unbanning…");
      try {
        const payload = { userId: requireUserId() };
        await apiFetch("/cmd/unban", { method:"POST", body: JSON.stringify(payload) });
        setMsg(playerMsg, "Unbanned.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    clearWarnsBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Clearing warnings…");
      try {
        const payload = { userId: requireUserId() };
        await apiFetch("/cmd/clearwarns", { method:"POST", body: JSON.stringify(payload) });
        setMsg(playerMsg, "Warnings cleared.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    whoamiBtn.addEventListener("click", async () => {
      whoamiOut.textContent = "Loading…";
      try {
        const me = await apiFetch("/me", { method:"GET" });
        whoamiOut.textContent = JSON.stringify(me, null, 2);
      } catch (err) {
        whoamiOut.textContent = JSON.stringify({ error: err.message }, null, 2);
      }
    });

    getStateBtn.addEventListener("click", async () => {
      stateOut.textContent = "Loading…";
      try {
        const st = await apiFetch("/state", { method:"GET" });
        stateOut.textContent = JSON.stringify(st, null, 2);
      } catch (err) {
        stateOut.textContent = JSON.stringify({ error: err.message }, null, 2);
      }
    });

    // initial connect
    try {
      statusText.textContent = "Connecting…";
      // If your backend has /me, this is a nice session check
      await apiFetch("/me", { method: "GET" });
      await loadState();
    } catch (err) {
      statusText.textContent = "Not logged in";
      location.href = "./index.html";
    }
  }

  return { initLogin, initPanel };
})();

window.ModPanel = ModPanel;
