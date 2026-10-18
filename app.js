/* AI Office — no LLM calls; polls status.json + board.json every 5s */
(() => {
  "use strict";

  const WORKER_ORDER = [
    "leader", "planner", "marketer",
    "naver_blog", "youtube", "threads_coupang",
    "insta_coupang", "art_insta", "taegye",
  ];

  const WORKER_SHORT = {
    leader: "팀장",
    planner: "기획자",
    marketer: "마케터",
    naver_blog: "블로그",
    youtube: "유튜브",
    threads_coupang: "스레드쿠팡",
    insta_coupang: "인스타쿠팡",
    art_insta: "아트인스타",
    taegye: "태계",
  };

  const COL_LABEL = {
    todo: "할 일",
    doing: "진행 중",
    review: "검토 대기",
    done: "완료",
  };

  const LS_KEY = "ai_office_logged_in";
  let selectedId = null;
  let statusData = null;
  let boardData = null;
  let configData = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  /* ---------- Auth (OAuth placeholder) ---------- */
  /**
   * startOpenAiOAuth()
   * TODO: Real ChatGPT/OpenAI OAuth.
   * When config.openai_oauth.client_id is set, redirect to auth_url with
   * client_id, redirect_uri, response_type=code, scope=openid profile email.
   * On callback, exchange code for tokens and store session.
   * Currently unused — demoLogin() is used when oauth is empty.
   */
  function startOpenAiOAuth(cfg) {
    const o = cfg?.openai_oauth || {};
    if (!o.client_id) {
      console.warn("[oauth] client_id empty → demo login");
      return false;
    }
    const params = new URLSearchParams({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri || window.location.origin + "/",
      response_type: "code",
      scope: "openid profile email",
    });
    window.location.href = (o.auth_url || "https://auth.openai.com/oauth/authorize") + "?" + params;
    return true;
  }

  function isLoggedIn() {
    return localStorage.getItem(LS_KEY) === "1";
  }

  function demoLogin() {
    localStorage.setItem(LS_KEY, "1");
    showOffice();
  }

  function logout() {
    localStorage.removeItem(LS_KEY);
    selectedId = null;
    $("#office-screen").classList.add("hidden");
    $("#login-screen").classList.remove("hidden");
  }

  function showOffice() {
    $("#login-screen").classList.add("hidden");
    $("#office-screen").classList.remove("hidden");
    buildDesks();
    refresh();
  }

  /* ---------- Desks ---------- */
  function buildDesks() {
    const root = $("#desks");
    root.innerHTML = "";
    WORKER_ORDER.forEach((id) => {
      const el = document.createElement("div");
      el.className = "desk idle";
      el.dataset.id = id;
      el.innerHTML = `
        <div class="desk-label">${WORKER_SHORT[id] || id}</div>
        <div class="bubble" data-bubble></div>
        <div class="bang">!</div>
        <div class="char">
          <div class="zz">zZ</div>
          <div class="head"></div>
          <div class="body"></div>
          <div class="arm"></div>
        </div>
        <div class="desk-body">
          <div class="monitor"><div class="screen"></div></div>
        </div>
      `;
      el.addEventListener("click", () => selectWorker(id));
      root.appendChild(el);
    });
  }

  function selectWorker(id) {
    selectedId = id;
    $$(".desk").forEach((d) => d.classList.toggle("selected", d.dataset.id === id));
    const panel = $("#panel");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    renderPanel();
  }

  function closePanel() {
    selectedId = null;
    $$(".desk").forEach((d) => d.classList.remove("selected"));
    const panel = $("#panel");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    $("#panel-body").innerHTML = `<p class="panel-empty">일꾼을 클릭하면<br/>상세 정보가 보여요</p>`;
  }

  function statusLabel(s) {
    return { working: "일하는 중", idle: "쉬는 중", error: "오류" }[s] || s;
  }

  function formatKst(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const get = (t) => parts.find((p) => p.type === t)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} (KST)`;
    } catch {
      return iso;
    }
  }

  function renderPanel() {
    if (!selectedId || !statusData) return;
    const w = statusData.workers?.[selectedId];
    if (!w) {
      $("#panel-body").innerHTML = `<p class="panel-empty">일꾼 정보 없음</p>`;
      return;
    }
    const outs = (w.outputs || []).slice(0, 3);
    const outsHtml = outs.length
      ? `<ul class="outputs">${outs
          .map((o) => {
            const title = typeof o === "string" ? o : o.title || o.name || "결과물";
            const link = typeof o === "object" ? o.link || o.path || "" : "";
            const path = typeof o === "object" ? o.path || "" : "";
            const a = link
              ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`
              : escapeHtml(title);
            const p = path ? `<span class="path">${escapeHtml(path)}</span>` : "";
            return `<li>${a}${p}</li>`;
          })
          .join("")}</ul>`
      : `<div class="val" style="color:var(--muted)">아직 없음</div>`;

    const tokens =
      w.grok_tokens_today === null || w.grok_tokens_today === undefined || w.grok_tokens_today === ""
        ? "-"
        : String(w.grok_tokens_today);

    $("#panel-body").innerHTML = `
      <div class="panel-name">${escapeHtml(w.name || selectedId)}</div>
      <div class="panel-role">${escapeHtml(w.role || "")}</div>
      <span class="badge ${escapeAttr(w.status)}">${statusLabel(w.status)}</span>
      <div class="panel-row">
        <label>현재 작업</label>
        <div class="val">${escapeHtml(w.task || (w.status === "idle" ? "없음" : "-"))}</div>
      </div>
      <div class="panel-row">
        <label>최근 결과물</label>
        ${outsHtml}
      </div>
      <div class="panel-row">
        <label>마지막 업데이트</label>
        <div class="val mono">${escapeHtml(formatKst(w.updated_at))}</div>
      </div>
      <div class="panel-row">
        <label>오늘 그록 토큰</label>
        <div class="val">${escapeHtml(tokens)}</div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  /* ---------- Render status ---------- */
  function renderStatus() {
    if (!statusData) return;
    const workers = statusData.workers || {};
    let working = 0;
    let idle = 0;
    WORKER_ORDER.forEach((id) => {
      const w = workers[id] || { status: "idle", task: "" };
      const desk = $(`.desk[data-id="${id}"]`);
      if (!desk) return;
      desk.classList.remove("working", "idle", "error");
      const st = w.status || "idle";
      desk.classList.add(st);
      if (st === "working") working++;
      else idle++;
      const bubble = desk.querySelector("[data-bubble]");
      if (bubble) {
        bubble.textContent = st === "error" ? w.task || "오류" : w.task || "";
        bubble.title = w.task || "";
      }
    });
    $("#stat-working").textContent = working;
    $("#stat-idle").textContent = idle;
    $("#stat-free").textContent = statusData.free_model_jobs_today ?? 0;

    renderChannels();
    if (selectedId) renderPanel();
  }

  function renderChannels() {
    const bar = $("#channel-bar");
    const ch = statusData.channels || {};
    const rev = statusData.revenue || {};
    const parts = [];

    const order = ["youtube", "blog", "threads", "insta", "art_insta"];
    order.forEach((id) => {
      const c = ch[id];
      if (!c) return;
      const shorts = c.shorts_today ?? 0;
      const posts = c.posts_today ?? 0;
      parts.push(`
        <div class="ch-card">
          <div class="ch-label">${escapeHtml(c.label || id)}</div>
          <div class="ch-nums">쇼츠 <span>${shorts}</span> · 게시물 <span>${posts}</span></div>
        </div>
      `);
    });

    const totalRev =
      (Number(rev.youtube) || 0) +
      (Number(rev.blog) || 0) +
      (Number(rev.coupang) || 0) +
      (Number(rev.other) || 0);
    const fmt = (n) => Number(n || 0).toLocaleString("ko-KR");
    parts.push(`
      <div class="ch-card revenue">
        <div class="ch-label">오늘 수익 ${rev.note ? "(" + escapeHtml(rev.note) + ")" : ""}</div>
        <div class="ch-nums">₩ ${fmt(totalRev)}</div>
        <div class="ch-label" style="margin-top:4px">YT ${fmt(rev.youtube)} · 블로그 ${fmt(rev.blog)} · 쿠팡 ${fmt(rev.coupang)}</div>
      </div>
    `);
    bar.innerHTML = parts.join("");
  }

  /* ---------- Board ---------- */
  function renderBoard() {
    if (!boardData) return;
    const cols = boardData.columns || {};
    $$(".kcol").forEach((colEl) => {
      const key = colEl.dataset.col;
      const cards = cols[key] || [];
      const box = colEl.querySelector(".kcards");
      box.innerHTML = cards
        .map((c) => {
          const sample = c.sample ? " sample" : "";
          const wname = WORKER_SHORT[c.worker] || c.worker || "";
          const link = c.link
            ? ` <a href="${escapeAttr(c.link)}" target="_blank" rel="noopener">링크</a>`
            : "";
          return `<div class="kcard${sample}" title="${escapeAttr(c.title || "")}"><span class="kw">${escapeHtml(
            wname
          )}</span> ${escapeHtml(c.title || "")}${link}</div>`;
        })
        .join("");
    });
  }

  /* ---------- Fetch ---------- */
  async function refresh() {
    try {
      const [sRes, bRes] = await Promise.all([
        fetch("status.json?t=" + Date.now(), { cache: "no-store" }),
        fetch("board.json?t=" + Date.now(), { cache: "no-store" }),
      ]);
      if (sRes.ok) statusData = await sRes.json();
      if (bRes.ok) boardData = await bRes.json();
      renderStatus();
      renderBoard();
      const now = new Date();
      $("#last-refresh").textContent =
        "갱신 " + now.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" }) + " (KST)";
    } catch (e) {
      console.error("refresh failed", e);
    }
  }

  async function loadConfig() {
    try {
      const r = await fetch("config.json", { cache: "no-store" });
      if (r.ok) configData = await r.json();
    } catch {
      configData = null;
    }
  }

  /* ---------- Init ---------- */
  async function init() {
    await loadConfig();

    $("#btn-chatgpt-login").addEventListener("click", () => {
      const o = configData?.openai_oauth;
      if (o?.client_id) {
        startOpenAiOAuth(configData);
      } else {
        demoLogin();
      }
    });
    $("#btn-logout").addEventListener("click", logout);
    $("#panel-close").addEventListener("click", closePanel);

    // Screenshot helper: ?demo=1 auto-enters office
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1") {
      localStorage.setItem(LS_KEY, "1");
    }

    if (isLoggedIn()) {
      showOffice();
      const sel = params.get("select");
      if (sel && WORKER_ORDER.includes(sel)) {
        // Wait one tick so desks exist + status loaded
        setTimeout(() => selectWorker(sel), 200);
      }
    } else {
      $("#login-screen").classList.remove("hidden");
    }

    setInterval(() => {
      if (isLoggedIn()) refresh();
    }, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
