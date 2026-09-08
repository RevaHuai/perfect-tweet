# perfect-tweet Skill — X 推文卡片批量生成器

把任意 X（Twitter）推文渲染成 **X 官方详情页风格的高清分享卡片**。视觉一比一复刻 X 网页版（Chirp 字体回退链、官方色彩 tokens、lucide 图标、蓝色认证标）。

**核心体验：设置一次模板，之后粘贴任意多条推文链接，一键批量导出高清 PNG。**

本目录是 [perfect-tweet](../README.md) 项目的 Agent Skill 封装——无需打开网页、无需 React 前端，由 Agent（或命令行）直接调用，全自动抓取推文数据并渲染成图。

## 特性

- **视觉一比一复刻 X**：深/浅双主题、蓝标、认证标、互动图标行、官方时间格式（`下午11:13 · 2026年9月2日 · 320 查看`）
- **一次设置，永久生效**：模板持久化到本地 JSON，重启不丢
- **批量处理**：一条命令处理任意多条推文链接，单条失败不影响其余
- **6 种尺寸预设**：Instagram 9:16 / 1:1 方图 / 16:9 公众号 / 3:4 图文 / 4:3 / 2:3 抖音
- **3 倍高清导出**：默认 3x 像素密度，最大 5x
- **背景图模式**：任意图片作背景，卡片变半透明浮层，可调透明度与偏移
- **数据抓取免凭证**：默认走 fxtwitter 公开 API；配置 Bearer Token 可走 X 官方 API v2（可选增强）
- **时区自适应**：推文 UTC 时间自动转换到本地时区显示

## 环境要求

- Node.js ≥ 18
- macOS / Linux / Windows
- Chrome 或 Chromium（Puppeteer 自带下载；若下载受限会自动探测系统 Chrome）

## 安装

本 Skill 采用标准 `SKILL.md` 格式，与宿主无关——**任何支持 Skills 的 Agent 都能装载**，配置跟随安装位置自包含，装到哪都能用。

### 方式一：装入任意 Agent（Claude Code / NewMax / Cursor 等）

把本目录复制到你的 Agent 的 skills 目录，然后安装依赖：

```bash
# Claude Code
cp -R skill/ ~/.claude/skills/perfect-tweet/

# NewMax
cp -R skill/ ~/.newmax/skills/perfect-tweet/

# 其他 Agent：查阅其文档中的 skills / 插件目录，复制到同样位置即可

# 安装依赖（Puppeteer 自动下载 Chromium，约 1~2 分钟）
cd <你的 skills 目录>/perfect-tweet && npm install
```

之后对 Agent 说「帮我把这条推文做成卡片」，Agent 会自动加载本 Skill。

> 多个 Agent 想共享同一份模板配置？设置环境变量 `PERFECT_TWEET_CONFIG=/path/to/config.json`，所有安装实例都会读写这一份。

### 方式二：纯命令行使用（不依赖任何 Agent）

```bash
git clone https://github.com/RevaHuai/perfect-tweet.git
cd perfect-tweet/skill && npm install

# 直接运行
node bin/perfect-tweet.js preview

# 或全局安装命令
npm link
perfect-tweet preview
```

## 快速开始

```bash
# 1. 设置模板（一次即可，持久保存）
perfect-tweet config theme=white dimension=16:9

# 2. 预览确认效果
perfect-tweet preview

# 3. 批量生成——粘贴任意多条链接
perfect-tweet generate \
  https://x.com/elonmusk/status/... \
  https://x.com/TheEllenShow/status/...
```

输出到 `~/Downloads/tweet-cards/`，文件名 `tweet-{handle}-{序号}.png`。

## 命令参考

### `config` — 设置 / 查看模板

```bash
perfect-tweet config                        # 查看当前全部配置
perfect-tweet config theme=white            # 改主题
perfect-tweet config dimension=square fontScale=120   # 一次改多项
perfect-tweet config bgImage=~/Pictures/bg.jpg cardOpacity=85
perfect-tweet config --reset                # 恢复默认
```

### `preview` — 预览当前模板

```bash
perfect-tweet preview                       # 输出示例卡片
perfect-tweet preview --out ~/Desktop/a.png # 指定输出路径
```

用示例数据渲染一张卡片，设置完模板后先跑一次确认视觉效果。

### `generate` — 批量生成（核心命令）

```bash
perfect-tweet generate <url1> <url2> ...            # 多条链接
perfect-tweet generate "$(pbpaste)"                 # 直接处理剪贴板里的多链接文本
perfect-tweet generate <url> --viral                # 随机爆款互动数据
perfect-tweet generate <url> --set likes=999,views=88000   # 精确指定互动数据
perfect-tweet generate <url> --dim 2:3 --out ~/Desktop     # 临时换尺寸/输出目录
```

| 参数 | 说明 |
|---|---|
| `--viral` | 用随机爆款数据替换真实互动数（演示/效果展示用） |
| `--set key=val,...` | 精确覆盖互动数据（`likes` / `retweets` / `replies` / `views` / `bookmarks`） |
| `--dim <预设>` | 本次生成临时使用的尺寸（不改模板） |
| `--out <目录>` | 本次生成临时输出目录（不改模板） |

## 模板配置字段全表

| 字段 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `theme` | `black` / `white` | `black` | 主题（联动卡片底色与文字色） |
| `cardColor` | `#RRGGBB` | 跟随主题 | 自定义卡片底色 |
| `textColor` | `#RRGGBB` | 跟随主题 | 自定义文字色 |
| `dimension` | `instagram` / `square` / `16:9` / `3:4` / `4:3` / `2:3` | `instagram` | 尺寸预设（9:16 ins · 1:1 · 16:9 公众号 · 3:4 图文 · 4:3 · 2:3 抖音） |
| `fontScale` | 60~160 | 100 | 字号系数 %（文字/头像/图标统一缩放） |
| `contentScale` | 50~150 | 100 | 内容整体缩放 %（非背景图模式） |
| `contentWidth` | 30~100 | 85 | 内容区宽度 % |
| `showDate` | `true` / `false` | `true` | 显示推文时间 |
| `showViews` | `true` / `false` | `true` | 显示查看数 |
| `showTranslate` | `true` / `false` | `false` | 显示"翻译推文"链接 |
| `showStats` | `true` / `false` | `true` | 显示底部互动数据行 |
| `bgImage` | 本地路径 / URL / `null` | `null` | 背景图模式：卡片变为浮层 |
| `cardOpacity` | 10~100 | 100 | 背景图模式下卡片透明度 % |
| `cardOffsetX` / `cardOffsetY` | 数字(px) | 0 | 背景图模式下浮层偏移 |
| `outputDir` | 路径 | `~/Downloads/tweet-cards` | 默认输出目录 |
| `scale` | 1~5 | 3 | 导出倍率（3 = 3 倍高清） |
| `timeZone` | IANA 时区 | `Asia/Shanghai` | 推文时间显示时区 |

配置持久化在 Skill 目录的 `config.json`，可手动编辑，重启不丢失。

## 常见问题

**Q：Chromium 启动失败？**
内置 Chrome 智能回退链：优先用 Puppeteer 自带 Chromium，异常时自动探测系统 Chrome（macOS `/Applications/Google Chrome.app`、Linux `google-chrome`、Windows 注册表路径）。确保系统装有任一 Chrome 即可。

**Q：某条推文抓取失败？**
默认走 fxtwitter 公开 API，只能获取**公开推文**。私密账号、已删除推文拿不到。配置环境变量 `X_API_BEARER_TOKEN` 可走 X 官方 API v2（字段更全），失败自动回退 fxtwitter。

**Q：报 `puppeteer` 模块找不到？**
先在 Skill 目录执行 `npm install`。

## 目录结构

```
skill/
├── SKILL.md               # Agent 视角的 Skill 说明（NewMax/Claude 加载入口）
├── README.md              # 本文档
├── package.json
├── bin/
│   └── perfect-tweet.js   # CLI 入口（config / generate / preview）
├── lib/
│   ├── render.js          # HTML 生成器（一比一复刻 X 详情页排版）
│   ├── config.js          # 模板读写 + 校验
│   ├── fetch.js           # fxtwitter 抓取（+ 可选 X 官方 API）
│   └── screenshot.js      # Puppeteer headless 高清截图 + Chrome 回退链
└── assets/
    └── verified.png       # X 蓝色认证标
```

## License

MIT
