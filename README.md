# Perfect Tweet Generator

> 一款专业的推特（X）卡片生成器 —— 把推文链接一键转换为适合在其他社交媒体发布的精美卡片。

---

## 功能特性

### 核心功能
- **一键导入**：粘贴 X/Twitter 推文链接，自动抓取内容、头像、互动数据
- **多卡片管理**：同时处理多条推文，批量生成卡片
- **灵活尺寸**：支持 Instagram(9:16)、Square(1:1)、公众号(16:9)、抖音(2:3)等多种比例
- **高清导出**：3x 倍率渲染，生成适合打印和分享的 PNG 图片

### 自定义设计
- **双主题**：Black / White 两种官方配色，支持自定义颜色
- **背景图模式**：上传自定义背景，卡片可拖拽定位、调节透明度
- **元素控制**：自由开关日期、浏览量、翻译链接、互动数据
- **独立样式**：每张卡片可独立配置，脱离全局模板

### 互动数据
- **真实抓取**：自动从 X API 获取点赞、转发、回复、收藏、浏览量
- **病毒式数据**：一键生成高表现力互动数据（对数分布，模拟爆款推文）
- **手动编辑**：支持逐项调整各项互动数字

### 导出与分享
- **单卡导出**：导出当前选中卡片
- **批量导出**：一键导出全部卡片（自动间隔避免浏览器拦截）
- **文件名规范**：自动按 `tweet-{handle}-{序号}.png` 命名

---

## 在线使用

无需安装，直接在浏览器中使用：

**https://vercel.com/wmxfour-6205s-projects**

---

## 快速开始

### 安装依赖

```bash
npm install
# 或
bun install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173` 即可开始使用。

### 生产构建

```bash
npm run build
npm run preview
```

---

## 使用指南

### 1. 导入推文

在左侧输入框粘贴推文链接，支持：
- 单条链接：`https://x.com/username/status/1234567890`
- 多条链接：换行或空格分隔多条链接
- 快捷键：`⌘+Enter` / `Ctrl+Enter` 快速导入

### 2. 调整样式

右侧设置面板支持：
- **Theme**：选择 Black / White，或自定义卡片/文字颜色
- **Dimension**：选择输出尺寸比例
- **Sizes**：调节内容缩放、卡片宽度
- **Elements**：开关日期、浏览量、翻译、互动数据
- **Background**：上传背景图、调节卡片透明度、拖拽定位

### 3. 导出卡片

- 点击左下角 **Download HD** 导出当前卡片
- 多卡模式下点击 **Export All** 批量导出全部卡片

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| Vite | 构建工具 |
| Tailwind CSS | 样式框架 |
| html2canvas | 卡片渲染导出 |
| lucide-react | 图标库 |
| FXTwitter API | 推文数据抓取 |

---

## 项目结构

```
perfect-tweet/
├── src/
│   ├── App.jsx          # 主应用逻辑
│   ├── main.jsx         # 入口文件
│   ├── index.css        # 全局样式
│   └── assets/          # 静态资源（verified 图标等）
├── index.html           # HTML 模板
├── vite.config.js       # Vite 配置
├── tailwind.config.js   # Tailwind 配置
├── package.json
└── README.md            # 本文件
```

---

## Git 配置

本项目已配置 `.gitignore`，以下内容**不会**提交到 GitHub：

- `node_modules/` — 依赖包
- `dist/` — 构建产物
- `.env` / `.env.local` — 环境变量
- `推特卡片项目/` — 本地会话目录（NewMax 生成的临时文件）

---

## 作者

由 [@revahuai](https://x.com/revahuai) 开发

---

## License

MIT License

---

## 致谢

- [FXTwitter API](https://fxtwitter.com) — 提供无限制的推文抓取服务
- [html2canvas](https://html2canvas.hertzen.com) — 强大的 DOM 转 Canvas 工具
- X（Twitter）设计团队 — 优秀的视觉设计灵感

---

**如果这个工具对你有帮助，欢迎 Star ⭐️ 并 @revahuai 分享你的使用体验！**