# zlhad.top

张凌豪的学术主页。顶部导航分五页：首页、论文、研究、项目、简历。全站是一块深色的仪器面板，空天地的垂直剖面留在每页的页头：首页是轨道上的实时天空，论文页在轨道，研究页在空中，项目页落到地面和地层，页脚是地心。

纯静态站（[Astro](https://astro.build)），部署在 GitHub Pages。

## 结构

本质是一个学术主页。论文部分是模块，加一篇只要写一个数据文件；首页和研究页是单独设计的。

| 层 | 包括 | 怎么改 |
|---|---|---|
| 模块化 | 论文列表、弹窗、论文详情页、搜索、BibTeX、首页的论文方阵、研究页里每篇论文的位置；项目、专利、奖项 | 改数据文件，全站同步 |
| 个性化 | 首页、研究页 | 直接改页面和组件 |
| 单篇论文的个性化 | 某篇想单独展示的论文 | 首页卡片用 `selected`、`homeFigure`、`highlights`；详情页加一篇深入解读，见下文 |
| 归档 | `/blog/`、`/LoveU/` | 旧站，不再维护，站内没有入口 |

## 本地运行

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 输出到 dist/，内容字段写错会直接报错
```

需要 Node 22.12 以上。

## 日常更新

### 加一篇论文

新建 `src/content/papers/<slug>.yaml`，复制一篇改字段就行。它会自动出现在论文页、弹窗、自己的详情页（`/publications/<slug>/`）、研究页、BibTeX 下载和简历里。

```yaml
title: 论文题目
authors: [Linghao Zhang, Bo Xu, Haitao Zhao]
venue: IEEE Transactions on Mobile Computing
venueShort: IEEE TMC
kind: journal            # journal | magazine | letter | correspondence | conference | preprint
status: published        # published | early-access | online-first | preprint
date: 2026-10-15         # 首次公开日期
year: 2026
doi: 10.1109/...
tiers: [space, air, ground]   # 论文系统模型涉及的网络层
stratum: space           # 论文起作用的高度，决定详情页顶部的横幅：space | control | air | ground
mechanism: infer         # 研究页体系图里的列：control | train | infer | offload
altitudes: UAV 150 m · LEO 550 km   # 只写论文自己给出的高度
summary:                 # 列表里的一句话
  en: 一两句英文
  zh: 一两句中文
abstract:                # 弹窗里的摘要，用论文原文
  en: 英文摘要
firstPage: true          # 有 public/figures/<slug>/first-page.webp
figures:                 # 弹窗里的主要图片；第一张同时是列表缩略图
  - file: scenario.webp
    width: 1400
    height: 1188
    caption: { en: 图注, zh: 图注 }
highlights:              # 可选：放大显示的数字，必须能追溯到运行数据文件
  - value: "+31.9%"
    label: { en: 说明, zh: 说明 }
selected: 1              # 可选：出现在首页的“代表论文”里，数字是顺序
```

网站只放已经公开的论文。在投论文不要加到这里，公开之后再加。

### 导入首页图和主图

从 PDF 渲染，输出到 `public/figures/<slug>/`：

```bash
npm run page -- <slug> first-page paper.pdf --page=1 --footer=0.045
npm run page -- <slug> scenario paper.pdf --page=3 --crop=0.03,0.07,0.49,0.37
```

`--crop` 是相对页面的 `x0,y0,x1,y1`。从 IEEE Xplore 下载的 PDF 用 `--footer=0.045`，它会切掉底部的下载水印。学号形式的邮箱会自动遮盖，其他要遮的内容用 `--redact=<正则>`。**导入后一定用眼睛看一遍**：首页图是图片，文本检查查不到里面的内容。把输出的像素尺寸填进 yaml 的 `figures`。

矢量原图（比如自己的 Fig.pdf）用 `npm run figure -- <slug> scenario /path/to/fig1.pdf --width=1400`。

### 论文状态变了

只改这篇的 `status`，补上 `doi`、`volume`、`pages`，再加上摘要和图片。

### 给论文加深入解读

详情页默认只有概览。要在下面加一段长文：

1. 在 yaml 里加 `dossier: true`。
2. 写 `src/content/dossiers/<slug>-en.mdx` 和 `<slug>-zh.mdx`，可以照着现有的改。可用组件：`Plate`（论文原图）、`Eq`（公式）、`Bars`、`Lines`（图表）。也可以写一个新组件放进 `src/components/widgets/`，在 MDX 里 `import` 进来，动画和交互模型都走这条路。

技术细节和交互部件只放在这里，不放到列表和首页。

### 首页近况

`src/data/news.ts`，新的写在最前面，只写能核实的事。

### 项目、专利、奖项、个人信息

| 内容 | 文件 |
|---|---|
| 开源项目 | `src/content/projects/*.yaml` |
| 专利 | `src/data/patents.yaml` |
| 奖项 | `src/data/awards.yaml` |
| 简介、教育、邮箱、链接 | `src/data/profile.ts` |
| 首页近况 | `src/data/news.ts` |

Google Scholar、ORCID 这些链接在 `profile.ts` 里留了空，填上就会显示。

### 加了中文内容之后

```bash
npm run fonts
```

它会重新生成只含站内用字的中文字体。不跑也不会出错，新字只是暂时用系统字体显示。

## 部署

推送到 `main` 后，GitHub Actions 自动构建并发布（`.github/workflows/deploy.yml`）。它每周一还会自动重建一次，刷新 GitHub star 和引用数，这些数字来自 `npm run metrics`，写在 `src/data/generated/metrics.json`。

## 旧博客和 LoveU

`public/blog/` 和 `public/LoveU/` 是旧站的归档，由 `scripts/import-legacy.mjs` 生成一次，不用再动。博客从根路径搬到了 `/blog/`，旧地址（比如 `/2021/04/03/...`）会经 `src/pages/404.astro` 自动跳过去。LoveU 地址不变。两者站内都没有入口，页面都标了 `noindex`，不进站点地图。

## 目录

```
src/
  content/         论文、深入解读、项目（改内容主要在这里）
  data/            个人信息、近况、专利、奖项、图表数据
  components/
    chrome/        顶部导航、页头、页脚、图标、搜索面板、图片查看器
    papers/        论文卡片、列表、缩略图、概览、弹窗
    home/          首页 hero
    blocks/        项目页的工具、记录和电子书
    research/      研究页的下降叙事和各层线稿
    widgets/       研究页的图、论文方阵和深入解读里的交互部件
    dossier/       深入解读用的图版、公式、图表
  scripts/sky/     大气着色器、相机、卫星壳层
  scripts/sky/run.ts   首页和研究页共用的渲染循环
  scripts/hero-sky.ts  首页 hero 怎么用天空
  scripts/descent.ts   研究页的滚动下降怎么用天空
  pages/[...lang]/ 所有页面，en 在根路径，zh 在 /zh/
public/blog/       旧博客归档
public/LoveU/      LoveU 归档
scripts/           字体子集、原图和首页图导入、等高线、肖像点画、指标抓取、旧站迁移
```

## 内容纪律

- **放大展示的数字和图表，都要能追溯到运行数据文件。**
- **只放已经公开的论文**：已发表、Early Access、网络首发或预印本。在投论文和它们的代码、数据都不放。
- **这个仓库是公开的。** `hidden: true` 只是不显示，文件内容仍然可见。没有公开的内容不要提交进来。
- 不放手机号、生日、学号。论文首页图里的也算。

## 设计

论文列表是全站最显眼的东西，技术细节放在详情页。颜色、字号、圆角和动效的取值都在 `src/styles/tokens.css`。

| 方面 | 做法 | 参考了谁 |
|---|---|---|
| 首屏 | 实时大气加低轨壳层和星间链路，名字细体宽字距，星球融进页面 | SpaceX、Starlink |
| 底色与字 | 近黑偏冷，Archivo 宽体做标题，Geist 做正文和界面，Geist Mono 做数据 | Linear |
| 论文列表 | 细线分行，时间和数据等宽，悬停时其他行退后 | DeepMind 的论文页、Brittany Chiang |
| 论文图 | 首页卡片反相成深色线稿，其他地方都是 PDF 原图 | 没有直接参考，试出来的 |
| 数据 | 一格一篇的方阵，直接标注，只有一个强调色 | Artificial Analysis、Epoch AI |
| 弹窗和搜索 | 图片舞台加信息栏，⌘K 命令面板 | Linear |

字号下限 13px，正文 16px，列表标题 20px，页面标题 40–72px。

首页卡片的深色线稿是 CSS 滤镜（`.plate.dark`），原文件没有改动。其他地方不要给论文图加任何处理。想让首页卡片用另一张图，在 yaml 里写 `homeFigure: <文件名>`。
