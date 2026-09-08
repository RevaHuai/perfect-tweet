import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
    Download, Link as LinkIcon, Loader2, MoreHorizontal, Calendar, Languages,
    MessageCircle, Repeat2, Heart, Bookmark, Share, Trash2, Layers,
    Image as ImageIcon, XCircle, Files
} from 'lucide-react';

// ✅ 引用你的本地图片
import verifiedIcon from './assets/verified.png';

/* ================= 常量 ================= */

// 尺寸预设（新增 2:3 竖屏 · 抖音）
const DIMENSIONS = {
    instagram: { label: '9:16 Instagram', class: 'aspect-[9/16] h-[750px]' },
    square: { label: '1:1 Square', class: 'aspect-square h-[600px]' },
    '16:9': { label: '16:9 公众号', class: 'aspect-[16/9] h-[400px]' },
    '3:4': { label: '3:4 图文', class: 'aspect-[3/4] h-[650px]' },
    '4:3': { label: '4:3', class: 'aspect-[4/3] h-[500px]' },
    '2:3': { label: '2:3 抖音', class: 'aspect-[2/3] h-[900px]' },
};

// 主题预设（颜色取自 X 官方设计 tokens）
const THEMES = {
    black: { label: 'Black', card: '#000000', text: '#e7e9ea', secondary: '#71767b', border: '#2f3336', swatch: '#000000' },
    white: { label: 'White', card: '#ffffff', text: '#0f1419', secondary: '#536471', border: '#eff3f4', swatch: '#ffffff' },
};

// X 网页版字体回退链（Chirp 不可公开获取，用官方回退）
const X_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;

// 全局模板默认值
const DEFAULT_TEMPLATE = {
    theme: 'black',
    cardColor: '#000000',
    textColor: '#e7e9ea',
    dimension: 'instagram',
    contentScale: 100,
    contentWidth: 85,
    showDate: true,
    showTranslate: false,
    showStats: true,
    showViews: true,
    bgImage: null,   // 用户上传的背景图 dataURL
    cardOpacity: 100, // 卡片面板透明度 %
    cardOffsetX: 0,  // 背景图模式下卡片浮层的偏移（px，相对卡片中心；可拖拽）
    cardOffsetY: 0
};

/* ================= 工具函数 ================= */

// X 风格数字格式化：1234 -> 1.2K, 1250000 -> 1.3M
const formatCount = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(num);
};

// 随机生成一组"高表现力"互动数据（对数均匀分布，比例参照真实爆款推文）
const randomViralStats = () => {
    const logRandom = (min, max) => Math.round(Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min))));
    const likes = logRandom(20000, 1500000);
    const retweets = Math.round(likes * (0.06 + Math.random() * 0.14));
    const replies = Math.round(likes * (0.02 + Math.random() * 0.08));
    const views = Math.round(likes * (3 + Math.random() * 17)); // 浏览量通常是赞的几倍到十几倍
    return { likes, retweets, replies, views };
};

// X 中文界面时间格式：下午11:13 · 2026年9月2日
const safeFormatDate = (tweet) => {
    try {
        if (!tweet || !tweet.created_at) return "下午10:00 · 2025年1月1日";
        let dateObj = new Date(tweet.created_at);
        if (isNaN(dateObj.getTime())) dateObj = new Date(tweet.created_at * 1000);
        if (isNaN(dateObj.getTime())) dateObj = new Date();
        const time = dateObj.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: 'numeric', hour12: true });
        const day = dateObj.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        return `${time} · ${day}`;
    } catch (e) {
        return "下午10:00 · 2025年1月1日";
    }
};

// 卡片 id 生成
let cardSeq = 0;
const makeCard = (tweet, followTemplate = true) => ({
    id: `card-${++cardSeq}`,
    tweet,                 // 推文数据（每卡独立：文字/头像/互动数）
    followTemplate,        // true=跟随全局模板；false=使用自己的 style 覆盖
    style: {},             // 仅 followTemplate=false 时生效
});

const DEFAULT_TWEET = () => ({
    name: 'Reva Huai 归淮',
    handle: '@RevaHuai',
    content: `如Robert Sardello所言：在一个开放系统中，我们对超越我们的现实保持敏感，这种开放性扩展并深化了生命。我们能够面对不确定性，更重要的是，克服我们对改变的抵抗。\n\n不必惧怕改变，陷入对忒修斯之船的疑虑之中。\n\n自我可以无限的展开。`,
    avatar: 'https://pbs.twimg.com/profile_images/1929477404034301952/a7wApHDR_200x200.jpg',
    date: '下午11:13 · 2026年9月2日',
    stats: { replies: 6, retweets: 12, likes: 89, views: 320 },
});

/* ================= 卡片渲染（一比一复刻 X 详情页排版） ================= */
/*
 * 实测 X 网页版单条推文页（2026-09）：
 * - 头像 40px 圆形，名称块居右（名称 15px/700 + 蓝标 18px；handle 15px 灰）
 * - ⋯ 按钮右上
 * - 正文全宽不缩进，23px / 行高 1.22（详情页放大字号）
 * - 时间行 15px 灰（"23:13 · 2026年9月2日"），Views 紧随其下
 * - 分割线 + 互动行：💬回复 🔁转推 ❤️点赞 均匀分布（间距约80px），🔖书签 ⤴分享 靠右
 * - 颜色 tokens：浅色 #0f1419/#536471/#eff3f4；深色 #e7e9ea/#71767b/#2f3336
 */
const TweetCard = ({ tweet, style, patchStyle, onDragSelect }) => {
    const theme = THEMES[style.theme] || THEMES.black;
    const cardColor = style.cardColor || theme.card;
    const textColor = style.textColor || theme.text;
    const secondary = theme.secondary;
    const border = theme.border;
    const hasBgImage = !!style.bgImage;
    const dim = DIMENSIONS[style.dimension] || DIMENSIONS.instagram;
    const dragRef = useRef(null);

    /* ===== 背景图模式：浮层拖拽定位（pointer capture，clamp 在画布内） ===== */
    const onPointerDown = (e) => {
        e.preventDefault(); // 阻止文字选择 / 图片原生拖拽
        onDragSelect?.();
        const floatEl = e.currentTarget;
        const canvasEl = floatEl.parentElement;
        dragRef.current = {
            sx: e.clientX, sy: e.clientY,
            bx: style.cardOffsetX || 0, by: style.cardOffsetY || 0,
            maxX: Math.max(0, (canvasEl.offsetWidth - floatEl.offsetWidth) / 2),
            maxY: Math.max(0, (canvasEl.offsetHeight - floatEl.offsetHeight) / 2),
        };
        try { floatEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    };
    const onPointerMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        const nx = Math.min(d.maxX, Math.max(-d.maxX, d.bx + (e.clientX - d.sx)));
        const ny = Math.min(d.maxY, Math.max(-d.maxY, d.by + (e.clientY - d.sy)));
        patchStyle?.({ cardOffsetX: Math.round(nx), cardOffsetY: Math.round(ny) });
    };
    const endDrag = () => { dragRef.current = null; };

    /* ===== 卡片内容（两种模式共用） ===== */
    const contentInner = (
        <>
            {/* ===== Header：头像 + 名称 + 蓝标 + handle ===== */}
            <div className="flex items-start">
                <img
                    src={tweet.avatar}
                    crossOrigin="anonymous"
                    className="w-10 h-10 rounded-full object-cover block shrink-0"
                    alt=""
                />
                <div className="ml-3 min-w-0 flex-1">
                    <div className="flex items-center">
                        <span style={{ color: textColor }} className="font-bold text-[15px] leading-5 truncate">
                            {tweet.name}
                        </span>
                        <img
                            data-verified
                            src={verifiedIcon}
                            alt="verified"
                            className="w-[18px] h-[18px] shrink-0 object-contain block ml-1"
                        />
                    </div>
                    <div style={{ color: secondary }} className="text-[15px] leading-5 truncate">
                        {tweet.handle}
                    </div>
                </div>
                <MoreHorizontal size={18} style={{ color: secondary }} className="shrink-0 mt-2" />
            </div>

            {/* ===== 正文（X 详情页 23px） ===== */}
            <div style={{ color: textColor }} className="text-[23px] leading-[1.22] whitespace-pre-wrap mt-3 break-words">
                {tweet.content}
            </div>

            {/* ===== Translate 链接（正文下方） ===== */}
            {style.showTranslate && (
                <div className="text-[15px] leading-5 mt-1.5 cursor-pointer" style={{ color: '#1d9bf0' }}>
                    Translate post
                </div>
            )}

            {/* ===== 时间 + Views（X 中文界面一行式：下午11:13 · 2026年9月2日 · 318 查看） ===== */}
            {(style.showDate || style.showViews) && (
                <div style={{ color: secondary }} className="text-[15px] leading-6 mt-3">
                    {style.showDate && <span>{tweet.date}</span>}
                    {style.showDate && style.showViews && ' · '}
                    {style.showViews && (
                        <span>
                            <span style={{ color: textColor }} className="font-bold">{formatCount(tweet.stats.views)}</span> 查看
                        </span>
                    )}
                </div>
            )}

            {/* ===== 互动行（分割线下方；图标↔数字用 margin 而非 gap，保证 html2canvas 导出一致） ===== */}
            {style.showStats && (
                <div
                    className="mt-3 pt-2 flex items-center select-none"
                    style={{ borderTop: `1px solid ${border}`, color: secondary }}
                >
                    <span className="flex items-center mr-20">
                        <MessageCircle size={19} strokeWidth={1.8} className="shrink-0" />
                        <span className="text-[15px] leading-none ml-1">{formatCount(tweet.stats.replies)}</span>
                    </span>
                    <span className="flex items-center mr-20">
                        <Repeat2 size={22} strokeWidth={1.8} className="shrink-0" />
                        <span className="text-[15px] leading-none ml-1">{formatCount(tweet.stats.retweets)}</span>
                    </span>
                    <span className="flex items-center mr-20">
                        <Heart size={19} strokeWidth={1.8} className="shrink-0" />
                        <span className="text-[15px] leading-none ml-1">{formatCount(tweet.stats.likes)}</span>
                    </span>
                    <span className="ml-auto flex items-center">
                        <Bookmark size={19} strokeWidth={1.8} className="shrink-0" />
                        <Share size={19} strokeWidth={1.8} className="shrink-0 ml-5" />
                    </span>
                </div>
            )}
        </>
    );

    return (
        <div
            className={`relative shadow-2xl ${dim.class}`}
            style={
                hasBgImage
                    ? { backgroundImage: `url(${style.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { backgroundColor: 'transparent' }
            }
        >
            {hasBgImage ? (
                /* ===== 背景图模式：卡片 = 紧凑自适应浮层 =====
                 * 宽度 = 画布宽 × Card size%（画布宽度随 dimension 变，卡片随之变宽变窄）；
                 * 高度完全由内容撑开 —— 只保留展示信息所必需的大小，四周全部露出背景图；
                 * marginLeft/Top 实现拖拽偏移（html2canvas 对盒定位导出一致） */
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <div
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className="relative overflow-hidden cursor-move select-none shadow-2xl touch-none"
                        style={{
                            width: `${style.contentWidth}%`,
                            borderRadius: '20px',
                            backgroundColor: cardColor,
                            opacity: style.cardOpacity / 100,
                            marginLeft: `${style.cardOffsetX || 0}px`,
                            marginTop: `${style.cardOffsetY || 0}px`,
                        }}
                    >
                        <div style={{ padding: '4% 5%', fontFamily: X_FONT, textAlign: 'left' }}>
                            {contentInner}
                        </div>
                    </div>
                </div>
            ) : (
                /* ===== 普通模式：面板铺满画布，透明度在此层调节 ===== */
                <div
                    className="absolute inset-0 overflow-hidden flex items-center justify-center"
                    style={{
                        backgroundColor: cardColor,
                        opacity: style.cardOpacity / 100,
                    }}
                >
                    <div
                        className="transition-all duration-300 origin-center"
                        style={{ width: `${style.contentWidth}%`, transform: `scale(${style.contentScale / 100})`, fontFamily: X_FONT, textAlign: 'left' }}
                    >
                        {contentInner}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ================= 设置面板小组件 ================= */

const Section = ({ title, right, children }) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</label>
            {right}
        </div>
        {children}
    </div>
);

const Toggle = ({ checked, onClick, icon: Icon, label, hint }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={onClick}>
        <div>
            <div className="flex items-center gap-2 text-gray-700 font-medium"><Icon size={16} /> {label}</div>
            {hint && <div className="text-[11px] text-gray-400 mt-0.5 ml-6">{hint}</div>}
        </div>
        <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 shrink-0 ${checked ? 'bg-sky-500' : 'bg-gray-300'}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${checked ? 'translate-x-4' : ''}`}></div>
        </div>
    </div>
);

/* ================= 主组件 ================= */

const TweetGenerator = () => {
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [cards, setCards] = useState(() => [makeCard(DEFAULT_TWEET())]);
    const [selectedId, setSelectedId] = useState('card-1');
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

    const cardRefs = useRef({});     // 每张卡截图容器的 DOM
    const bgFileRef = useRef(null);  // 背景图 file input

    const selected = cards.find(c => c.id === selectedId) || cards[0];

    // 当前生效样式：跟随模板 → 用模板；独立 → 模板基础上叠覆盖
    const effStyle = selected.followTemplate
        ? template
        : { ...template, ...selected.style };

    // 样式编辑入口：跟随模板时改模板，独立时改单卡覆盖
    const setStyle = (patch) => {
        if (selected.followTemplate) {
            setTemplate(t => ({ ...t, ...patch }));
        } else {
            setCards(prev => prev.map(c =>
                c.id === selected.id ? { ...c, style: { ...c.style, ...patch } } : c
            ));
        }
    };

    const updateCard = (id, fn) => setCards(prev => prev.map(c => (c.id === id ? fn(c) : c)));

    // 指定卡的样式编辑入口（拖拽/X-Y 微调用）：跟随模板 → 改模板，独立 → 改单卡覆盖
    const patchCardStyle = (id, patch) => {
        const card = cards.find(c => c.id === id);
        if (!card) return;
        if (card.followTemplate) {
            setTemplate(t => ({ ...t, ...patch }));
        } else {
            updateCard(id, c => ({ ...c, style: { ...c.style, ...patch } }));
        }
    };

    // 切换「跟随模板 / 独立设置」：脱离时快照当前模板，回归时清空覆盖，保证视觉无缝
    const toggleFollow = () => {
        updateCard(selected.id, c =>
            c.followTemplate
                ? { ...c, followTemplate: false, style: { ...template } }
                : { ...c, followTemplate: true, style: {} }
        );
    };

    /* ===== 多链接抓取 ===== */
    const fetchTweets = async () => {
        const ids = [...new Set(
            [...urlInput.matchAll(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/g)].map(m => m[1])
        )];
        if (!ids.length) {
            alert('请输入至少一条有效的推文链接（x.com 或 twitter.com）');
            return;
        }
        setIsLoading(true);
        const added = [];
        const failed = [];
        for (const id of ids) {
            try {
                const response = await fetch(`https://api.fxtwitter.com/status/${id}`);
                const data = await response.json();
                if (!data.tweet) throw new Error(data.message || 'Tweet not found');
                const t = data.tweet;
                added.push(makeCard({
                    name: t.author.name,
                    handle: `@${t.author.screen_name}`,
                    content: t.text,
                    avatar: t.author.avatar_url,
                    date: safeFormatDate(t),
                    stats: {
                        replies: t.replies ?? 0,
                        retweets: t.retweets ?? 0,
                        likes: t.likes ?? 0,
                        views: t.views ?? 0,
                    },
                }));
            } catch (error) {
                failed.push(id);
            }
        }
        if (added.length) {
            setCards(prev => [...prev, ...added]);
            setSelectedId(added[added.length - 1].id);
            setUrlInput('');
        }
        setIsLoading(false);
        if (failed.length) alert(`以下链接抓取失败：\n${failed.join('\n')}`);
    };

    /* ===== 导出 ===== */
    const exportCard = async (card, index) => {
        const node = cardRefs.current[card.id];
        if (!node) return;
        const canvas = await html2canvas(node, {
            scale: 3,
            useCORS: true,
            backgroundColor: null,
            onclone: (clonedDoc) => {
                // html2canvas 渲染 flex 内 img 有基线偏移，蓝标需下移补偿
                clonedDoc.querySelectorAll('img[data-verified]').forEach(b => {
                    b.style.marginTop = '14px';
                });
            },
        });
        const link = document.createElement('a');
        link.download = `tweet-${card.tweet.handle.replace('@', '')}-${index + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleDownload = () => exportCard(selected, cards.indexOf(selected));

    const exportAll = async () => {
        for (let i = 0; i < cards.length; i++) {
            await exportCard(cards[i], i);
            await new Promise(r => setTimeout(r, 300)); // 避免连续下载被浏览器拦截
        }
    };

    /* ===== 卡片管理 ===== */
    const removeCard = (id) => {
        if (cards.length <= 1) return;
        const idx = cards.findIndex(c => c.id === id);
        const next = cards.filter(c => c.id !== id);
        setCards(next);
        if (selectedId === id) setSelectedId(next[Math.max(0, idx - 1)].id);
    };

    /* ===== 背景图上传 ===== */
    const onBgFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setStyle({ bgImage: reader.result });
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const followCount = cards.filter(c => c.followTemplate).length;
    const styleLabel = selected.followTemplate ? `Template · applies to ${followCount} card${followCount > 1 ? 's' : ''}` : 'Card overrides · this card only';

    return (
        <div className="min-h-screen bg-[#15202b] flex flex-col md:flex-row text-sm font-sans">

            {/* ================= 左侧预览区 ================= */}
            <div className="flex-1 relative bg-[#22303c] overflow-hidden">

                {/* 输入框（支持多链接，换行/空格分隔） */}
                <div className="absolute top-6 z-20 w-full max-w-xl px-4 left-1/2 -translate-x-1/2">
                    <div className="bg-white rounded-2xl p-2 shadow-xl flex items-center gap-2 pl-4 transition-transform hover:scale-[1.005]">
                        <LinkIcon size={16} className="text-gray-400 shrink-0" />
                        <textarea
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) fetchTweets(); }}
                            placeholder={'粘贴一条或多条推文链接（换行 / 空格分隔）…\n⌘+Enter 导入'}
                            rows={2}
                            className="flex-1 outline-none text-gray-700 placeholder-gray-400 text-[13px] resize-none leading-relaxed py-1"
                        />
                        <button
                            onClick={fetchTweets}
                            disabled={isLoading}
                            className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-4 py-2.5 font-bold text-xs disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : 'Import'}
                        </button>
                    </div>
                </div>

                {/* 多卡片预览区 */}
                <div className="h-screen overflow-y-auto p-6 pt-28">
                    <div className="flex flex-wrap gap-10 justify-center items-start">
                        {cards.map((card, i) => {
                            const s = card.followTemplate ? template : { ...template, ...card.style };
                            const isSel = card.id === selected.id;
                            return (
                                <div key={card.id} className="relative group">
                                    {/* 选中高亮环 */}
                                    <div className={`absolute -inset-2 rounded-2xl pointer-events-none z-10 transition-all ${isSel ? 'ring-2 ring-sky-500' : 'ring-0 group-hover:ring-1 group-hover:ring-white/20'}`}></div>

                                    {/* 序号 / 独立标记 */}
                                    <div className={`absolute -top-3 left-2 z-20 px-2 py-0.5 rounded-full text-[11px] font-bold ${isSel ? 'bg-sky-500 text-white' : 'bg-black/60 text-white/80'}`}>
                                        #{i + 1}{card.followTemplate ? '' : ' · custom'}
                                    </div>

                                    {/* 删除按钮 */}
                                    {cards.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeCard(card.id); }}
                                            title="删除这张卡片"
                                            className="absolute -top-2.5 -right-2.5 z-20 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}

                                    <button onClick={() => setSelectedId(card.id)} className="block cursor-pointer text-left">
                                        <div ref={el => { cardRefs.current[card.id] = el; }}>
                                            <TweetCard
                                                tweet={card.tweet}
                                                style={s}
                                                patchStyle={(p) => patchCardStyle(card.id, p)}
                                                onDragSelect={() => setSelectedId(card.id)}
                                            />
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ================= 右侧设置栏 ================= */}
            <div className="w-full md:w-80 bg-white border-l border-gray-200 h-screen overflow-y-auto flex flex-col z-10">
                <div className="p-5 border-b border-gray-100">
                    <h2 className="font-black text-xl text-gray-800">Settings</h2>
                    <div className={`mt-1 text-[11px] font-medium ${selected.followTemplate ? 'text-sky-600' : 'text-orange-500'}`}>
                        {styleLabel}
                    </div>
                </div>

                <div className="p-5 space-y-6 flex-1">

                    {/* ===== 卡片管理 ===== */}
                    <Section title={`Cards (${cards.length})`}>
                        <div className="flex flex-wrap gap-2">
                            {cards.map((c, i) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    title={c.tweet.handle}
                                    className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${c.id === selected.id
                                        ? 'bg-sky-500 text-white border-sky-500'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <Toggle
                            checked={!selected.followTemplate}
                            onClick={toggleFollow}
                            icon={Layers}
                            label={selected.followTemplate ? 'Follow Template' : 'Custom Style'}
                            hint={selected.followTemplate ? '此卡跟随全局模板设置' : '此卡使用独立设置（不影响其他卡片）'}
                        />
                    </Section>

                    {/* ===== 主题 ===== */}
                    <Section title="Theme">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(THEMES).map(([key, t]) => (
                                <button
                                    key={key}
                                    onClick={() => setStyle({ theme: key, cardColor: t.card, textColor: t.text })}
                                    className={`py-2.5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${effStyle.theme === key
                                        ? 'border-sky-500 bg-sky-50 text-sky-600'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: t.swatch }}></span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 font-medium">Custom</span>
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                <input type="color" value={effStyle.cardColor} onChange={e => setStyle({ cardColor: e.target.value })} className="h-7 w-7 rounded cursor-pointer border-none" /> Card
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                <input type="color" value={effStyle.textColor} onChange={e => setStyle({ textColor: e.target.value })} className="h-7 w-7 rounded cursor-pointer border-none" /> Text
                            </label>
                        </div>
                    </Section>

                    {/* ===== 尺寸 ===== */}
                    <Section title="Dimension">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(DIMENSIONS).map(([key, { label }]) => (
                                <button
                                    key={key}
                                    onClick={() => setStyle({ dimension: key })}
                                    className={`py-2 rounded-md border text-sm ${effStyle.dimension === key
                                        ? 'border-sky-500 bg-sky-50 text-sky-600 font-bold'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* ===== 缩放 ===== */}
                    <Section title="Sizes">
                        <div className="space-y-4">
                            {!effStyle.bgImage && (
                                <div>
                                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Content scale</span>
                                        <span>{effStyle.contentScale}%</span>
                                    </div>
                                    <input
                                        type="range" min="50" max="150"
                                        value={effStyle.contentScale}
                                        onChange={e => setStyle({ contentScale: Number(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                </div>
                            )}
                            <div>
                                <div className="flex justify-between text-sm text-gray-600 mb-1">
                                    <span>{effStyle.bgImage ? 'Card size（背景图模式）' : 'Content width'}</span>
                                    <span>{effStyle.contentWidth}%</span>
                                </div>
                                <input
                                    type="range" min={effStyle.bgImage ? 30 : 50} max="100"
                                    value={effStyle.contentWidth}
                                    onChange={e => setStyle({ contentWidth: Number(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* ===== 元素开关 ===== */}
                    <Section title="Elements">
                        <div className="space-y-2">
                            <Toggle checked={effStyle.showDate} onClick={() => setStyle({ showDate: !effStyle.showDate })} icon={Calendar} label="Show Date" />
                            <Toggle checked={effStyle.showViews} onClick={() => setStyle({ showViews: !effStyle.showViews })} icon={Files} label="Show Views" />
                            <Toggle checked={effStyle.showTranslate} onClick={() => setStyle({ showTranslate: !effStyle.showTranslate })} icon={Languages} label="Translate" />
                            <Toggle checked={effStyle.showStats} onClick={() => setStyle({ showStats: !effStyle.showStats })} icon={Heart} label="Show Stats" />
                        </div>
                    </Section>

                    {/* ===== 互动数据（作用于选中卡的推文数据） ===== */}
                    <Section
                        title={`Engagement · Card #${cards.indexOf(selected) + 1}`}
                        right={
                            <button
                                onClick={() => updateCard(selected.id, c => ({ ...c, tweet: { ...c.tweet, stats: randomViralStats() } }))}
                                title="随机生成一组高表现力互动数据"
                                className="text-xs font-bold bg-gradient-to-r from-orange-400 to-pink-500 text-white rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity active:scale-95"
                            >
                                🎲 Random Viral
                            </button>
                        }
                    >
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'replies', label: '💬 Replies' },
                                { key: 'retweets', label: '🔁 Retweets' },
                                { key: 'likes', label: '❤️ Likes' },
                                { key: 'views', label: '👁 Views' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <div className="text-[11px] text-gray-500 font-medium mb-1 truncate">{label}</div>
                                    <input
                                        type="number" min="0"
                                        value={selected.tweet.stats[key]}
                                        onChange={e => updateCard(selected.id, c => ({
                                            ...c,
                                            tweet: { ...c.tweet, stats: { ...c.tweet.stats, [key]: Math.max(0, Number(e.target.value) || 0) } }
                                        }))}
                                        className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-sky-500 outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ===== 背景图 + 卡片透明度 ===== */}
                    <Section title="Background">
                        <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={onBgFile} />
                        <div className="flex gap-2">
                            <button
                                onClick={() => bgFileRef.current.click()}
                                className="flex-1 py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-600 text-sm font-medium flex items-center justify-center gap-2 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/50 transition-colors"
                            >
                                <ImageIcon size={15} /> {effStyle.bgImage ? 'Replace Image' : 'Upload Image'}
                            </button>
                            {effStyle.bgImage && (
                                <button
                                    onClick={() => setStyle({ bgImage: null })}
                                    title="移除背景图"
                                    className="px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                >
                                    <XCircle size={16} />
                                </button>
                            )}
                        </div>
                        {effStyle.bgImage && (
                            <div className="h-16 rounded-lg border border-gray-200 bg-cover bg-center" style={{ backgroundImage: `url(${effStyle.bgImage})` }}></div>
                        )}
                        <div>
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Card opacity</span>
                                <span>{effStyle.cardOpacity}%</span>
                            </div>
                            <input
                                type="range" min="10" max="100"
                                value={effStyle.cardOpacity}
                                onChange={e => setStyle({ cardOpacity: Number(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                        </div>
                        {effStyle.bgImage && (
                            <div className="space-y-2 pt-1 border-t border-gray-100">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Position</div>
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <div className="text-[11px] text-gray-500 font-medium mb-1">X (px)</div>
                                        <input
                                            type="number" step="1"
                                            value={effStyle.cardOffsetX}
                                            onChange={e => setStyle({ cardOffsetX: Math.round(Number(e.target.value) || 0) })}
                                            className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-sky-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[11px] text-gray-500 font-medium mb-1">Y (px)</div>
                                        <input
                                            type="number" step="1"
                                            value={effStyle.cardOffsetY}
                                            onChange={e => setStyle({ cardOffsetY: Math.round(Number(e.target.value) || 0) })}
                                            className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-sky-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setStyle({ cardOffsetX: 0, cardOffsetY: 0 })}
                                        title="回到画布中心"
                                        className="px-3 py-2 rounded-md border border-gray-200 text-gray-600 text-xs font-bold hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors shrink-0"
                                    >
                                        Center
                                    </button>
                                </div>
                                <div className="text-[11px] text-gray-400">提示：也可以直接在预览中拖动卡片调整位置</div>
                            </div>
                        )}
                    </Section>

                    {/* ===== 正文（选中卡） ===== */}
                    <Section title={`Content · Card #${cards.indexOf(selected) + 1}`}>
                        <textarea
                            value={selected.tweet.content}
                            onChange={e => updateCard(selected.id, c => ({ ...c, tweet: { ...c.tweet, content: e.target.value } }))}
                            rows={6}
                            className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                        />
                    </Section>
                </div>

                {/* ===== 导出 ===== */}
                <div className="p-5 border-t bg-gray-50 space-y-2">
                    <button onClick={handleDownload} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-lg">
                        <Download size={20} /> Download HD
                    </button>
                    {cards.length > 1 && (
                        <button onClick={exportAll} className="w-full bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors">
                            <Files size={16} /> Export All ({cards.length})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TweetGenerator;
