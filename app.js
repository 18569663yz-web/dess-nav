/* ============================================================================
   Dess · 工具索引 —— 交互层
   只做五件事：筛条目、键盘操作、切主题、切语言、探测站点可达性。
   没有框架、没有依赖、没有隐藏的网络去向（探测是浏览器直接发起的）。

   页面里的静态文案是"中英两份都写死在 HTML 里、由 CSS 按 data-lang 挑一份"，
   所以这里只负责那些 JS 会重写的字：按钮状态、提示气泡、属性类文案、
   document.title，以及按语言挑搜索索引。两套文案的中枢在下面的 STR 里。
   ========================================================================== */
(function () {
  "use strict";

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var root    = document.documentElement;
  var lang    = root.dataset.lang === "en" ? "en" : "zh";

  var input   = $("#q");
  var field   = $(".field");
  var clearBt = $("#clear");
  var entries = $$(".entry");
  var groups  = $$(".group");
  var noneMsg = $("#none");
  var chips   = $$(".chip");
  var probeBt = $("#probe");
  var probeLb = $("#probe-label");
  var themeBt = $("#theme");
  var langBt  = $("#lang");
  var noteEl  = $("#probe-note");
  var yearEl  = $("#year");

  var cat      = "all";
  var active   = -1;   // 键盘选中的可见条目下标

  /* ── 会被 JS 重写的文案 ─────────────────────────────────────────────── */
  var STR = {
    zh: {
      probe:      "检查可达性",
      probing:    "检测中…",
      again:      "重新检测",
      langLabel:  "EN",
      langAria:   "Switch to English",
      dotIdle:    "还没检测",
      dotBusy:    "检测中…",
      dotOk:      "够得着（浏览器直接发起，读不到状态码）",
      dotTimeout: "超时：{n} 秒内没有响应",
      dotBad:     "连不上（网络层就失败了）",
      noteIdle:   "可达性检测由浏览器直接发起，结果仅供参考",
      noteDone:   "{ok} 个里 {total} 个够得着 · 检测于 {t}"
    },
    en: {
      probe:      "Check reachability",
      probing:    "Checking…",
      again:      "Check again",
      langLabel:  "中文",
      langAria:   "切换到中文",
      dotIdle:    "Not checked yet",
      dotBusy:    "Checking…",
      dotOk:      "Reachable (sent by your browser; the status code is unreadable)",
      dotTimeout: "Timed out: no response within {n}s",
      dotBad:     "Unreachable (it failed at the network layer)",
      noteIdle:   "Reachability is probed by your browser directly; results are indicative only",
      noteDone:   "{ok} of {total} reachable · checked at {t}"
    }
  };

  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] === undefined ? m : vars[k];
    });
  }

  /* ── 语言 ────────────────────────────────────────────────────────────── */
  // 探测器上一次跑完的结果，切语言时要拿它重画页脚
  var lastProbe = null;

  function refreshDots() {
    $$(".dot").forEach(function (d) {
      var reason = d.dataset.reason || "idle";
      d.title = fill(STR[lang][{
        idle: "dotIdle", busy: "dotBusy", ok: "dotOk",
        timeout: "dotTimeout", net: "dotBad"
      }[reason] || "dotIdle"], { n: TIMEOUT / 1000 });
    });
  }

  function refreshNote() {
    if (!noteEl) return;
    noteEl.textContent = lastProbe
      ? fill(STR[lang].noteDone, lastProbe)
      : STR[lang].noteIdle;
  }

  function applyLang() {
    var s = STR[lang];

    // 属性类文案就地写在元素上：data-aria-zh / data-aria-en 这种。
    // kind 是数据属性里那段，attr 是真正要写的属性名 —— "aria" 落下来是
    // aria-label，不是 aria。
    var ATTR = { aria: "aria-label", ph: "placeholder", title: "title" };
    ["aria", "ph", "title"].forEach(function (kind) {
      $$("[data-" + kind + "-zh]").forEach(function (el) {
        var v = el.getAttribute("data-" + kind + "-" + lang);
        if (v != null) el.setAttribute(ATTR[kind], v);
      });
    });

    document.title = root.getAttribute("data-doc-title-" + lang) || document.title;
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", root.getAttribute("data-doc-desc-" + lang) || md.content);

    if (probeLb && !probeBt.dataset.busy) probeLb.textContent = s.probe;
    langBt.textContent = s.langLabel;
    langBt.setAttribute("aria-label", s.langAria);

    refreshDots();
    refreshNote();
  }

  langBt.addEventListener("click", function () {
    lang = lang === "zh" ? "en" : "zh";
    root.dataset.lang = lang;
    root.lang = lang === "zh" ? "zh-CN" : "en";
    try { localStorage.setItem("dess-lang", lang); } catch (e) {}
    applyLang();
    // 搜索索引跟着界面语言走，所以得重筛一遍
    apply();
  });

  /* ── 筛选 ────────────────────────────────────────────────────────────── */
  function visible() { return entries.filter(function (el) { return !el.hidden; }); }

  function apply() {
    var q = (input.value || "").trim().toLowerCase();
    var idx = lang === "en" ? "searchEn" : "search";
    var shown = 0;

    entries.forEach(function (el) {
      var catOK  = cat === "all" || el.dataset.cat === cat;
      var textOK = !q || (el.dataset[idx] || "").indexOf(q) !== -1;
      var show   = catOK && textOK;
      el.hidden = !show;
      if (show) shown++;
    });

    // 一个分组里全被筛掉，连标题一起收起来
    groups.forEach(function (g) {
      var any = $$(".entry", g).some(function (el) { return !el.hidden; });
      g.hidden = !any;
    });

    noneMsg.hidden = shown > 0;
    clearBt.hidden = !q;
    $(".search").dataset.filled = q ? "1" : "";

    setActive(-1);
  }

  /* ── 分类 ────────────────────────────────────────────────────────────── */
  chips.forEach(function (btn) {
    btn.addEventListener("click", function () {
      cat = btn.dataset.cat;
      chips.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      apply();
    });
  });

  /* ── 搜索 ────────────────────────────────────────────────────────────── */
  input.addEventListener("input", apply);

  clearBt.addEventListener("click", function () {
    input.value = "";
    apply();
    input.focus();
  });

  /* ── 键盘 ────────────────────────────────────────────────────────────── */
  function setActive(i) {
    var list = visible();
    entries.forEach(function (el) { el.classList.remove("is-active"); });

    if (!list.length) { active = -1; return; }

    if (i < 0) i = -1;
    if (i >= list.length) i = 0;
    active = i;

    if (active >= 0) {
      var el = list[active];
      el.classList.add("is-active");
      var box = el.getBoundingClientRect();
      if (box.top < 90 || box.bottom > window.innerHeight - 40) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  function move(delta) {
    var list = visible();
    if (!list.length) return;

    // 还没选过：往下就进第一条，往上就进最后一条
    if (active === -1) { setActive(delta > 0 ? 0 : list.length - 1); return; }

    setActive((active + delta + list.length) % list.length);
  }

  document.addEventListener("keydown", function (e) {
    var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    if (e.key === "/" && !inField) {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }

    if (e.key === "Escape") {
      if (input.value) { input.value = ""; apply(); }
      input.blur();
      setActive(-1);
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (e.key === "Enter" && active >= 0) {
      var list = visible();
      if (list[active]) {
        e.preventDefault();
        window.open(list[active].href, "_blank", "noopener");
      }
    }
  });

  // 鼠标掠过就接管选中态，避免键盘和鼠标各指一条
  entries.forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      entries.forEach(function (x) { x.classList.remove("is-active"); });
      active = -1;
    });
  });

  /* ── 主题 ────────────────────────────────────────────────────────────── */
  themeBt.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("dess-theme", next); } catch (e) {}
  });

  // 没手动选过就跟着系统走
  var mq = window.matchMedia("(prefers-color-scheme: light)");
  (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function (e) {
    var saved = null;
    try { saved = localStorage.getItem("dess-theme"); } catch (err) {}
    if (!saved) root.dataset.theme = e.matches ? "light" : "dark";
  });

  /* ── 可达性探测 ──────────────────────────────────────────────────────
     用 no-cors 发一个请求：跨域读不到状态码，但网络层通不通是能分辨的。
     DNS 挂掉、连接被重置、超时 —— 这些都会 reject；能连上就是 opaque 的
     resolve。所以这里只能说「够得着」，不能说「200」。页脚也是这么写的。 */
  var TIMEOUT = 9000;

  function setDot(el, state, reason) {
    var dot = $(".dot", el);
    if (!dot) return;
    dot.dataset.state = state;
    dot.dataset.reason = reason;
    dot.title = fill(STR[lang][{
      idle: "dotIdle", busy: "dotBusy", ok: "dotOk",
      timeout: "dotTimeout", net: "dotBad"
    }[reason] || "dotIdle"], { n: TIMEOUT / 1000 });
  }

  function probeOne(el) {
    setDot(el, "busy", "busy");

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);

    return fetch(el.href, {
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: ctrl.signal
    }).then(function () {
      setDot(el, "ok", "ok");
    }).catch(function (err) {
      setDot(el, "bad", err && err.name === "AbortError" ? "timeout" : "net");
    }).then(function () {
      clearTimeout(timer);
    });
  }

  probeBt.addEventListener("click", function () {
    var list = visible();
    if (!list.length) return;

    probeBt.disabled = true;
    probeBt.dataset.busy = "1";
    probeLb.textContent = STR[lang].probing;

    Promise.all(list.map(probeOne)).then(function () {
      probeBt.disabled = false;
      delete probeBt.dataset.busy;
      probeLb.textContent = STR[lang].again;

      var t = new Date();
      lastProbe = {
        ok:    $$('.dot[data-state="ok"]').length,
        total: list.length,
        t:     String(t.getHours()).padStart(2, "0") + ":" +
               String(t.getMinutes()).padStart(2, "0")
      };
      refreshNote();
    });
  });

  /* ── 杂项 ────────────────────────────────────────────────────────────── */
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  applyLang();
  apply();
})();
