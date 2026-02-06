/* global window, document, location */

const ModPanel = (() => {
  // ✅ CHANGE THIS to your Cloudflare Worker URL
  const API_BASE = "https://roblox-modpanel-api.suited-woodsy9d.workers.dev";

  function qs(id){ return document.getElementById(id); }

  function setMsg(el, text, kind){
    if(!el) return;
    el.classList.remove("ok","bad");
    if(kind) el.classList.add(kind);
    el.textContent = text || "";
  }

  async function apiFetch(path, options = {}){
    const url = API_BASE.replace(/\/$/,"") + path;

    const method = (options.method || "GET").toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;

    // ✅ Only set Content-Type when sending JSON body
    const headers = new Headers(options.headers || {});
    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, {
      ...options,
      method,
      credentials: "include",
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      if (location.pathname.endsWith("panel.html")) {
        location.href = "./index.html";
      }
    }

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

  async function initLogin(){
    const form = qs("loginForm");
    const password = qs("password");
    const msg = qs("loginMsg");

    try {
      await apiFetch("/me", { method: "GET" });
      location.href = "./panel.html";
      return;
    } catch (_) {}

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

      const st = await apiFetch("/state", { method: "GET" });
      const enabled = !!(st && (st.shutdownEnabled ?? st.enabled));
      shutdownEnabled.checked = enabled;
      shutdownStateHint.textContent = enabled ? "ON (new joins blocked)" : "OFF (normal)";
      stateOut.textContent = JSON.stringify(st, null, 2);
    }

    refreshBtn.addEventListener("click", loadState);

    logoutBtn.addEventListener("click", async () => {
      try { await apiFetch("/logout", { method: "POST" }); } catch (_) {}
      location.href = "./index.html";
    });

    applyShutdownBtn.addEventListener("click", async () => {
      setMsg(shutdownMsg, "Applying…");
      try {
        const enabled = shutdownEnabled.checked;
        await apiFetch("/cmd/shutdown", {
          method:"POST",
          body: JSON.stringify({ enabled, kickExisting: kickExisting.checked })
        });
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

        await apiFetch("/cmd/announce", { method:"POST", body: JSON.stringify(payload) });
        setMsg(announceMsg, "Announcement sent.", "ok");
        announceMessage.value = "";
      } catch (err) {
        setMsg(announceMsg, err.message, "bad");
      }
    });

    warnBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Sending warning…");
      try {
        await apiFetch("/cmd/warn", {
          method:"POST",
          body: JSON.stringify({ userId: requireUserId(), reason: (reason.value||"").trim() })
        });
        setMsg(playerMsg, "Warn sent.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    kickBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Kicking…");
      try {
        await apiFetch("/cmd/kick", {
          method:"POST",
          body: JSON.stringify({ userId: requireUserId(), reason: (reason.value||"").trim() })
        });
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

        await apiFetch("/cmd/ban", {
          method:"POST",
          body: JSON.stringify({
            userId: requireUserId(),
            reason: (reason.value||"").trim(),
            durationSeconds: Math.floor(minutes * 60)
          })
        });
        setMsg(playerMsg, minutes === 0 ? "Permanent ban set." : `Banned for ${minutes} minutes.`, "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    unbanBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Unbanning…");
      try {
        await apiFetch("/cmd/unban", {
          method:"POST",
          body: JSON.stringify({ userId: requireUserId() })
        });
        setMsg(playerMsg, "Unbanned.", "ok");
      } catch (err) {
        setMsg(playerMsg, err.message, "bad");
      }
    });

    clearWarnsBtn.addEventListener("click", async () => {
      setMsg(playerMsg, "Clearing warnings…");
      try {
        await apiFetch("/cmd/clearwarns", {
          method:"POST",
          body: JSON.stringify({ userId: requireUserId() })
        });
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

    try {
      statusText.textContent = "Connecting…";
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
