# Dess · 工具索引

个人主站兼导航页。把散在各处的站点收进一个页面，挂上联系方式，
用作 X 主页的固定链接。

**核心约束：纯静态、零依赖、零第三方请求。**
没有框架、没有构建步骤、没有 CDN、没有统计脚本、没有外部字体。
用系统自带的字体栈渲染，所以国内网络下打开就是秒开，也不会有
「字体加载完跳一下」的问题。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 全部内容都在这里。一个条目 = 一个 `<a class="entry">` 块 |
| `styles.css` | 全部样式。设计变量集中在文件顶部的 `:root` 里 |
| `boot.js` | 只做一件事：在首次绘制前把主题和语言定下来，避免刷新时闪底色、闪中文。必须在 `<head>` 里同步加载 |
| `app.js` | 筛选、键盘操作、主题切换、可达性探测 |
| `favicon.svg` | 图标（SVG，不依赖任何位图） |
| `og.png` | 分享图，1200×630 |
| `_headers` | Cloudflare 专用：安全响应头 + 缓存策略 |
| `robots.txt` | 允许全站抓取 |

## 本地预览

直接双击 `index.html` 也能看，但有两处会降级：

- 浏览器通常禁止 `file://` 页面发跨域请求，所以「检查可达性」会全部报连不上
- `_headers` 不生效（这本来就是部署时才用的）

想看真实效果，起一个静态服务：

```bash
cd dess-nav
python -m http.server 8080
# 或者：npx serve .
```

然后打开 <http://127.0.0.1:8080/>。加 `?lang=en` 直接看英文版。

## 中英双语

不用「JS 目录表 + 重画 DOM」那一套，而是**两套文案都写死在 HTML 里，用 CSS 挑一份显示**：

- 每个可见文案都是一个成对的 `<span data-l="zh">…</span><span data-l="en">…</span>`
- `styles.css` 里一条规则负责切换：`:root[data-lang="zh"] [data-l="en"] { display: none }`，反之亦然
- `<html data-lang="zh">` 由 `boot.js` 在首次绘制前定好，所以不会先闪中文再跳英文
- `app.js` 里的 `applyLang()` 负责那些 CSS 管不到的地方：`aria-label`、`placeholder`、
  `title`、`document.title`、`meta description`，页脚的探测结果文案也跟着重画

好处是切换零延迟、关掉 JS 也能看（**但只能看到中文** —— `?lang=en` 得靠 JS 把
`data-lang` 换掉，CSS 读不到 URL 查询串；`localStorage` 同理）。代价是 HTML 大一倍，改文案要改两处。

语言的优先级：`?lang=`（分享链接，**不写本地**）> `localStorage["dess-lang"]` > `navigator.language`，
认不出来时兜底中文。`?lang=en` 的链接是给推特上英文受众用的，点进去就是英文，
不会把访问者的偏好改掉。

标题和描述这类元信息写在 `<html>` 的 `data-doc-title-zh/en`、`data-doc-desc-zh/en` 上；
元素自己的属性文案就地写成 `data-aria-zh/en`、`data-ph-zh/en`、`data-title-zh/en`
（`data-title-zh` 在 `<html>` 和 `#probe` 上都出现过，所以 `<html>` 那份特意改叫 `data-doc-title-zh`）。

## 自检

仓库上一级目录（`ZRC\`）下有三个开发脚本，都不参与部署：

| 脚本 | 作用 |
| --- | --- |
| `verify.py` | 用无头 Chrome 跑三轮断言：中文交互、中文 + `_headers` 里那份**真实** CSP、英文 + 同一份 CSP。每轮 60 项，共 180 项 |
| `probe-layout.py` | 量指定视口下的真实几何，找横向溢出的元凶。`python probe-layout.py 390` |
| `make-og.py` | 重新生成 `og.png` |

```bash
python verify.py          # 期望输出：全部通过
python probe-layout.py 390
```

`verify.py` 是**外部探针脚本 + `--dump-dom`** 的做法：断言跑在真实浏览器里，
结果写进 `document.title` 再抓出来。探针用 `<script src>` 引入而不是内联，
这样第二轮里它自己也受同一份 CSP 约束，不会因为「测试脚本被豁免」而漏掉问题。

> 有个坑记一下：Chrome headless 的窗口有最小宽度（约 485px），
> `--window-size=390` 不会真的得到 390px 的布局视口，只会把截图裁掉。
> 要看真实窄屏，得用 iframe 套一层 —— `probe-layout.py` 和截图脚本就是这么做的。

## 部署

### Cloudflare Pages（推荐）

域名都在 Cloudflare 上，直接接最省事。

```bash
npx wrangler pages deploy . --project-name dess-nav
```

然后在 Pages 项目里把自定义域名绑成 `dess.lol`。

> ⚠️ `dess.lol` 现在的裸域**证书是坏的**（TLS 报 `SEC_E_WRONG_PRINCIPAL`），
> 但子域 `poolwatch.dess.lol` 正常。说明证书只签了子域没签裸域。
> 绑域名时记得在 Cloudflare 的 SSL/TLS 里确认一下证书覆盖了裸域，
> 否则这个站点的地址就得换成别的。

### 其他静态托管

整个 `dess-nav/` 目录原样丢上去就行 —— GitHub Pages、Vercel、Netlify、
对象存储都能直接用。`_headers` 只有 Cloudflare 会读，其他地方忽略即可。

## 加一个新站点

1. 在 `<main id="entries">` 里找到合适的分组（没有就复制一个 `<section class="group">`）
2. 复制一个 `<a class="entry">` 块，改这几处：
   - `href` —— 站点地址
   - `data-cat` —— `chain` / `tool` / `dsh` / `src`（和上面筛选按钮对应）
   - `data-search` —— **中文界面用的搜索关键词，全部小写**，把域名、技术栈、
     中英文别名都塞进去，用户搜什么都能命中
   - `data-search-en` —— 英文界面用的关键词，同样全小写
   - `class="no"` —— 序号，改完记得把同组后面的顺一遍
   - `.title` / `.desc` / `.host` / `.tag` —— 除了 `.host`，**每处都要写两遍**
     （`<span data-l="zh">` 和 `<span data-l="en">`），漏一个 `verify.py` 的
     `i18n_unpaired` 会报出来
3. 如果新增了分类，还要同步加一个筛选按钮（同样成对写）：
   ```html
   <button class="chip" type="button" data-cat="新分类" aria-pressed="false"><span data-l="zh">显示名</span><span data-l="en">Label</span></button>
   ```
4. 页面底部「最后更新」的日期改一下。

`og.png` 里的域名清单可以通过根目录的 `make-og.py` 重新生成：

```bash
python make-og.py
```

## 待确认

- [x] **Telegram 号** —— `@Despite_zmw`（用户确认与 X 同名），
      已加进 `index.html` 的联系方式区
- [x] **正式域名** —— 用户确认就用 `https://dess.lol/`
- [x] **X 号** —— `@Despite_zmw`，来源 `D:\小程序\web\上线与绑域名-操作手册.md`

> 部署前记得给 `dess.lol` 补一张含裸域的证书 —— 实测裸域 TLS 报
> `SEC_E_WRONG_PRINCIPAL`，证书只签了子域。子域（`poolwatch.dess.lol`）正常。

## 设计取舍

记下来是为了以后改的时候别把方向改歪：

- **暖琥珀 + 近黑**，不是常见的紫蓝渐变。要的是印刷品的气质，不是 SaaS 落地页。
- **发丝级描边和极淡网格**，给纯色背景一点质地。网格用 `body::before`
  的渐变蒙版往下化开，不会在页脚区域变成脏兮兮的噪点。
- **等宽字体只用于元信息**（域名、序号、页脚时间），正文用系统字体栈。
  等宽字体是「这里有台机器」的信号，滥用就变成程序员审美模板了。
- **hover 时左边滑出的一道竖条**是唯一的主视觉动效，其余都克制。
- **不做「点击复制」、不做「访问量」、不做「最近更新」徽章** ——
  一个只有 8 条链接的页面不需要这些。
- 深色是默认，但跟随系统 `prefers-color-scheme`，手动切过之后记进 `localStorage`。
- **英文不是「翻译版」而是同一页面的另一个界面语言** —— 没有 `/en/` 子目录、没有
  第二份 HTML，SEO 靠 `<link rel="alternate" hreflang>` 指向 `?lang=en`。
  一个只有八条链接的页面不值得维护两棵树。
- 「检查可达性」用 `no-cors` 请求探测，**读不到状态码**，只能区分
  「网络层通了」和「连不上/超时」。所以页脚写的是「够得着」而不是「200」，
  别把它当成监控。
