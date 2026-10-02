/* ============================================================================
   在首次绘制之前定好主题和语言，避免刷新时闪一下相反的底色、或者先出中文再变英文。
   放在 <head> 里同步执行，所以只能是独立文件 —— 内联脚本会被 _headers 里那份
   CSP（script-src 'self'）拦掉。
   ========================================================================== */
(function () {
  var root = document.documentElement;

  /* ── 主题 ────────────────────────────────────────────────────────────── */
  var theme;
  try {
    var savedTheme = localStorage.getItem("dess-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      theme = savedTheme;
    } else {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
  } catch (e) {
    theme = "dark";
  }
  root.dataset.theme = theme;

  /* ── 语言 ────────────────────────────────────────────────────────────────
     优先级：?lang= （分享链接，不写进本地）> localStorage（用户手动选过）
             > navigator.language（中文环境给中文，其余给英文）
     data-lang 决定 CSS 显示哪一套文案；lang 属性给屏幕阅读器和搜索引擎。 */
  function normalize(v) {
    v = String(v || "").toLowerCase();
    if (/^zh\b|-cn|-hans|-sg|-my/.test(v) || v === "zh") return "zh";
    if (/^en\b|-us|-gb/.test(v)) return "en";
    return null;
  }

  var lang = null;
  try {
    var q = /[?&]lang=([^&#]*)/.exec(window.location.search);
    if (q) lang = normalize(decodeURIComponent(q[1]));
  } catch (e) {}
  if (!lang) {
    try { lang = normalize(localStorage.getItem("dess-lang")); } catch (e) {}
  }
  if (!lang) lang = normalize(navigator.language) || "zh";

  root.dataset.lang = lang;
  root.lang = lang === "zh" ? "zh-CN" : "en";
})();
