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

  async function initPanel(){
    const statusText = qs("statusText");
    const refreshBtn = qs("refreshBtn");
    const logoutBtn = qs("logoutBtn");

    async function loadState(){
      const st = await apiFetch("/state", { method:"GET" });
      statusText.textContent = "Connected";
      const out = qs("stateOut");
      if (out) out.textContent = JSON.stringify(st, null, 2);
    }

    refreshBtn?.addEventListener("click", loadState);
    logoutBtn?.addEventListener("click", () => {
      clearToken();
      location.href = "./index.html";
    });

    try {
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
