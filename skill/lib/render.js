/**
 * perfect-tweet 渲染模块
 * 把 React 版 TweetCard 组件一比一转写为纯 HTML 字符串生成器。
 * 视觉基准：X 网页版单条推文详情页（2026-09 实测参数）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ================= 常量（与原 App.jsx 完全对齐） ================= */

// 尺寸预设：aspect = 宽/高比，height 为基准渲染高度（px）
export const DIMENSIONS = {
    instagram: { label: '9:16 Instagram', aspect: 9 / 16, height: 750 },
    square:    { label: '1:1 Square',     aspect: 1,       height: 600 },
    '16:9':    { label: '16:9 公众号',    aspect: 16 / 9,   height: 400 },
    '3:4':     { label: '3:4 图文',       aspect: 3 / 4,    height: 650 },
    '4:3':     { label: '4:3',            aspect: 4 / 3,    height: 500 },
    '2:3':     { label: '2:3 抖音',       aspect: 2 / 3,    height: 900 },
};

// 主题预设（颜色取自 X 官方设计 tokens）
export const THEMES = {
    black: { label: 'Black', card: '#000000', text: '#e7e9ea', secondary: '#71767b', border: '#2f3336', swatch: '#000000' },
    white: { label: 'White', card: '#ffffff', text: '#0f1419', secondary: '#536471', border: '#eff3f4', swatch: '#ffffff' },
};

// X 网页版字体回退链（Chirp 不可公开获取，用官方回退）
const X_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;

// 默认模板（与原 DEFAULT_TEMPLATE 对齐 + CLI 扩展字段）
export const DEFAULT_TEMPLATE = {
    theme: 'black',
    cardColor: '#000000',
    textColor: '#e7e9ea',
    dimension: 'instagram',
    contentScale: 100,
    fontScale: 100,    // 字体大小系数（卡片内文字/头像/图标/间距统一缩放）
    contentWidth: 85,
    showDate: true,
    showTranslate: false,
    showStats: true,
    showViews: true,
    bgImage: null,     // 背景图：本地文件路径或 http(s) URL
    cardOpacity: 100,  // 卡片面板透明度 %
    cardOffsetX: 0,    // 背景图模式下卡片浮层偏移（px，相对画布中心）
    cardOffsetY: 0,
    // ---- CLI 扩展 ----
    outputDir: '~/Downloads/tweet-cards',
    scale: 3,          // 导出倍率（对应原 html2canvas scale:3）
    timeZone: 'Asia/Shanghai',
};

// 模板字段白名单 + 类型（用于 config 校验）
export const TEMPLATE_FIELDS = {
    theme: ['black', 'white'],
    cardColor: 'color',
    textColor: 'color',
    dimension: Object.keys(DIMENSIONS),
    contentScale: { min: 50, max: 150 },
    fontScale: { min: 60, max: 160 },
    contentWidth: { min: 30, max: 100 },
    showDate: 'boolean',
    showTranslate: 'boolean',
    showStats: 'boolean',
    showViews: 'boolean',
    bgImage: 'string|null',
    cardOpacity: { min: 10, max: 100 },
    cardOffsetX: 'number',
    cardOffsetY: 'number',
    outputDir: 'string',
    scale: { min: 1, max: 5 },
    timeZone: 'string',
};

/* ================= 工具函数 ================= */

// X 风格数字格式化：1234 -> 1.2K, 1250000 -> 1.3M
export const formatCount = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(num);
};

// 随机生成一组"高表现力"互动数据（对数均匀分布，比例参照真实爆款推文）
export const randomViralStats = () => {
    const logRandom = (min, max) => Math.round(Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min))));
    const likes = logRandom(20000, 1500000);
    const retweets = Math.round(likes * (0.06 + Math.random() * 0.14));
    const replies = Math.round(likes * (0.02 + Math.random() * 0.08));
    const bookmarks = Math.round(likes * (0.04 + Math.random() * 0.10));
    const views = Math.round(likes * (3 + Math.random() * 17));
    return { likes, retweets, replies, bookmarks, views };
};

// X 中文界面时间格式：下午11:13 · 2026年9月2日
export const formatDate = (createdAt, timeZone = 'Asia/Shanghai') => {
    try {
        if (!createdAt) return '下午10:00 · 2025年1月1日';
        let d = new Date(createdAt);
        if (isNaN(d.getTime())) d = new Date(Number(createdAt) * 1000);
        if (isNaN(d.getTime())) d = new Date();
        const opts = { timeZone, hour12: true };
        const time = new Intl.DateTimeFormat('zh-CN', { ...opts, hour: 'numeric', minute: 'numeric' }).format(d);
        const day = new Intl.DateTimeFormat('zh-CN', { ...opts, year: 'numeric', month: 'long', day: 'numeric' }).format(d);
        return `${time} · ${day}`;
    } catch {
        return '下午10:00 · 2025年1月1日';
    }
};

// HTML 转义（正文/名称等用户内容必须转义）
const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// lucide 图标（v0.300.0 官方 path，24x24 viewBox，ISC License）
const ICON_PATHS = {
    messageCircle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    repeat2: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    moreHorizontal: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
};

const icon = (name, size, color, strokeWidth = 2) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}px" height="${size}px" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:inline-block">${ICON_PATHS[name]}</svg>`;

// 蓝标 base64（来自原项目 verified.png，X 官方蓝色认证标）
let _verifiedDataUrl = null;
const verifiedDataUrl = () => {
    if (_verifiedDataUrl) return _verifiedDataUrl;
    const p = path.join(__dirname, '..', 'assets', 'verified.png');
    _verifiedDataUrl = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
    return _verifiedDataUrl;
};

// 背景图路径 → data URL（本地文件读取；http(s) URL 原样返回）
const resolveImage = (src) => {
    if (!src) return null;
    if (/^https?:\/\//.test(src)) return src;
    if (/^data:/.test(src)) return src;
    const p = src.replace(/^~/, process.env.HOME || '~');
    if (!fs.existsSync(p)) return null;
    const ext = path.extname(p).toLowerCase().replace('.', '') || 'png';
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
    return `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
};

/* ================= 卡片内容（两种模式共用） ================= */

const renderContent = (tweet, style, theme) => {
    const textColor = style.textColor || theme.text;
    const secondary = theme.secondary;
    const border = theme.border;
    const k = (style.fontScale || 100) / 100;
    const stats = tweet.stats || {};

    // Header：头像 + 名称 + 蓝标 + handle + ⋯
    const header = `
    <div style="display:flex;align-items:flex-start">
        <img src="${esc(tweet.avatar)}" alt="" style="width:${40 * k}px;height:${40 * k}px;border-radius:9999px;object-fit:cover;display:block;flex-shrink:0">
        <div style="min-width:0;flex:1;margin-left:${12 * k}px">
            <div style="display:flex;align-items:center">
                <span style="color:${textColor};font-size:${15 * k}px;line-height:${20 * k}px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tweet.name)}</span>
                <img src="${verifiedDataUrl()}" alt="verified" style="width:${18 * k}px;height:${18 * k}px;margin-left:${4 * k}px;flex-shrink:0;object-fit:contain;display:block">
            </div>
            <div style="color:${secondary};font-size:${15 * k}px;line-height:${20 * k}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tweet.handle)}</div>
        </div>
        <span style="margin-top:${8 * k}px;flex-shrink:0;display:inline-block">${icon('moreHorizontal', 18 * k, secondary)}</span>
    </div>`;

    // 正文（X 详情页 23px 基准 × 字号系数）
    const body = `
    <div style="color:${textColor};font-size:${23 * k}px;margin-top:${12 * k}px;line-height:1.22;white-space:pre-wrap;overflow-wrap:break-word">${esc(tweet.content)}</div>`;

    // Translate 链接
    const translate = style.showTranslate
        ? `\n    <div style="color:#1d9bf0;font-size:${15 * k}px;margin-top:${6 * k}px">Translate post</div>`
        : '';

    // 时间 + Views（中文界面一行式）
    let metaLine = '';
    if (style.showDate || style.showViews) {
        const datePart = style.showDate ? `<span>${esc(tweet.date)}</span>` : '';
        const sep = style.showDate && style.showViews ? ' · ' : '';
        const viewPart = style.showViews
            ? `<span><span style="color:${textColor};font-weight:700">${formatCount(stats.views)}</span> 查看</span>`
            : '';
        metaLine = `
    <div style="color:${secondary};font-size:${15 * k}px;line-height:${24 * k}px;margin-top:${12 * k}px">${datePart}${sep}${viewPart}</div>`;
    }

    // 互动行：回复 / 转推 / 点赞 / 书签 / 分享
    let statsLine = '';
    if (style.showStats) {
        const item = (iconName, iconSize, value, sw = 1.8) => `
            <span style="display:flex;align-items:center">${icon(iconName, iconSize * k, secondary, sw)}<span style="font-size:${15 * k}px;margin-left:${4 * k}px;line-height:1">${formatCount(value)}</span></span>`;
        statsLine = `
    <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${border};color:${secondary};margin-top:${12 * k}px;padding-top:${8 * k}px">${item('messageCircle', 19, stats.replies)}${item('repeat2', 22, stats.retweets)}${item('heart', 19, stats.likes)}${item('bookmark', 19, stats.bookmarks)}
            <span style="display:flex;align-items:center">${icon('share', 19 * k, secondary, 1.8)}</span>
    </div>`;
    }

    return header + body + translate + metaLine + statsLine;
};

/* ================= 整卡 HTML（对应 React 版两种模式） ================= */

/**
 * 生成单张卡片的完整 HTML 文档字符串。
 * @param {object} tweet  { name, handle, content, avatar, date, stats:{replies,retweets,likes,bookmarks,views} }
 * @param {object} style  模板（DEFAULT_TEMPLATE 结构）
 */
export function renderCardHTML(tweet, style = {}) {
    const s = { ...DEFAULT_TEMPLATE, ...style };
    const theme = THEMES[s.theme] || THEMES.black;
    const cardColor = s.cardColor || theme.card;
    const textColor = s.textColor || theme.text;
    const dim = DIMENSIONS[s.dimension] || DIMENSIONS.instagram;
    const hasBgImage = !!s.bgImage;
    const bgSrc = hasBgImage ? resolveImage(s.bgImage) : null;
    const effectiveBg = hasBgImage ? bgSrc : null;

    const content = renderContent(tweet, { ...s, textColor }, theme);

    // 卡片外框（画布）：shadow-2xl 对应的等价阴影
    const canvasStyle = hasBgImage
        ? `background-image:url('${effectiveBg}');background-size:cover;background-position:center;`
        : `background-color:transparent;`;

    // 两种模式的内层结构（对应原 JSX 分支）
    const inner = hasBgImage
        ? `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <div style="width:${s.contentWidth}%;border-radius:20px;background-color:${cardColor};opacity:${s.cardOpacity / 100};margin-left:${s.cardOffsetX || 0}px;margin-top:${s.cardOffsetY || 0}px;position:relative;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)">
            <div style="padding:4% 5%;font-family:${X_FONT};text-align:left">${content}
            </div>
        </div>
    </div>`
        : `
    <div style="position:absolute;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background-color:${cardColor};opacity:${s.cardOpacity / 100}">
        <div style="width:${s.contentWidth}%;transform:scale(${s.contentScale / 100});transform-origin:center;font-family:${X_FONT};text-align:left">${content}
        </div>
    </div>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; }
    #card {
        position: relative;
        aspect-ratio: ${dim.aspect};
        height: ${dim.height}px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,.25);
        ${canvasStyle}
    }
    img { -webkit-user-drag: none; }
</style>
</head>
<body>
<div id="card">${inner}
</div>
</body>
</html>`;
}

/* ================= 示例推文（preview 用，与原 DEFAULT_TWEET 对齐） ================= */

export const DEFAULT_TWEET = () => ({
    name: 'Reva Huai 归淮',
    handle: '@RevaHuai',
    content: `如Robert Sardello所言：在一个开放系统中，我们对超越我们的现实保持敏感，这种开放性扩展并深化了生命。我们能够面对不确定性，更重要的是，克服我们对改变的抵抗。\n\n不必惧怕改变，陷入对忒修斯之船的疑虑之中。\n\n自我可以无限的展开。`,
    avatar: 'https://pbs.twimg.com/profile_images/1929477404034301952/a7wApHDR_200x200.jpg',
    date: '下午11:13 · 2026年9月2日',
    stats: { replies: 6, retweets: 12, likes: 89, bookmarks: 23, views: 320 },
});
