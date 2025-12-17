import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Link as LinkIcon, Loader2, MoreHorizontal, Calendar, Languages } from 'lucide-react';

// ✅ 引用你的本地图片
import verifiedIcon from './assets/verified.png';

const TweetGenerator = () => {
    const [urlInput, setUrlInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [config, setConfig] = useState({
        name: 'Reva Huai 瑞娃怀',
        handle: '@RevaHuai',
        content: `How do you balance writing from the heart with writing for the market?\n\nHow do you stay true to your voice and build a business around it?`,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Reva',
        bgColor: '#000000',
        textColor: '#d9d9d9',
        secondaryColor: '#6e767d',
        dimension: 'instagram',
        date: '10:41 AM · Dec 16, 2025',
        showDate: true,
        showTranslate: false
    });

    const previewRef = useRef(null);

    const safeFormatDate = (tweet) => {
        try {
            if (!tweet || !tweet.created_at) return "10:00 AM · Jan 1, 2025";
            let dateObj = new Date(tweet.created_at);
            if (isNaN(dateObj.getTime())) dateObj = new Date(tweet.created_at * 1000);
            if (isNaN(dateObj.getTime())) dateObj = new Date();
            return dateObj.toLocaleString('en-US', {
                hour: 'numeric', minute: 'numeric', hour12: true,
                month: 'short', day: 'numeric', year: 'numeric'
            }).replace(',', ' ·');
        } catch (e) {
            return "10:00 AM · Jan 1, 2025";
        }
    };

    const fetchTweetData = async () => {
        const match = urlInput.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
        if (!match) {
            alert("请输入有效的推文链接");
            return;
        }
        const tweetId = match[1];
        setIsLoading(true);

        try {
            const response = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
            const data = await response.json();
            if (data.code === 404) throw new Error("Tweet not found");
            const tweet = data.tweet;

            setConfig(prev => ({
                ...prev,
                name: tweet.author.name,
                handle: `@${tweet.author.screen_name}`,
                content: tweet.text,
                avatar: tweet.author.avatar_url,
                date: safeFormatDate(tweet)
            }));
        } catch (error) {
            alert("抓取失败: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 🔥🔥🔥 核心修改区：handleDownload 🔥🔥🔥
    const handleDownload = async () => {
        if (previewRef.current) {
            const canvas = await html2canvas(previewRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,

                // ✨ Magic happens here: 只在截图时修改样式
                onclone: (clonedDoc) => {
                    // 1. 在克隆出的“隐形”网页里找到蓝标
                    const badge = clonedDoc.getElementById('verified-badge');

                    // 2. 如果找到了，给它加上偏移量
                    if (badge) {
                        // 👇👇👇【在这里修改你的参数】👇👇👇
                        // 如果你测试出来是 -14px 刚好，就写 '-14px'
                        // 如果是往下移，就写 '4px'
                        badge.style.marginTop = '14px';
                    }
                }
            });

            const link = document.createElement('a');
            link.download = `tweet-${config.handle.replace('@', '')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    };

    return (
        <div className="min-h-screen bg-[#15202b] flex flex-col md:flex-row text-sm font-sans">

            {/* 左侧预览区 */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#22303c] relative overflow-hidden">

                {/* 输入框 */}
                <div className="absolute top-8 z-20 w-full max-w-lg px-4">
                    <div className="bg-white rounded-full p-1.5 shadow-xl flex items-center pl-4 transition-transform hover:scale-[1.01]">
                        <LinkIcon size={16} className="text-gray-400 mr-2" />
                        <input
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="Paste Tweet link here..."
                            className="flex-1 outline-none text-gray-700 placeholder-gray-400"
                        />
                        <button
                            onClick={fetchTweetData}
                            disabled={isLoading}
                            className="bg-sky-500 hover:bg-sky-600 text-white rounded-full px-5 py-2 font-bold text-xs disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : 'Import'}
                        </button>
                    </div>
                </div>

                {/* 截图区域 */}
                <div
                    ref={previewRef}
                    style={{ backgroundColor: config.bgColor }}
                    className={`relative mt-12 shadow-2xl transition-all duration-500 flex items-center justify-center
             ${config.dimension === 'instagram' ? 'aspect-[9/16] h-[750px]' : 'aspect-square h-[600px]'}
          `}
                >
                    <div className="w-[85%]">

                        {/* Header: User Info */}
                        <div className="flex items-start mb-5">
                            <img src={config.avatar} crossOrigin="anonymous" className="w-12 h-12 rounded-full border border-white/10 mr-3 object-cover block" />

                            <div>
                                {/* Flex 居中布局 */}
                                <div className="flex items-center gap-1.5">
                                    <span style={{ color: config.textColor }} className="font-bold text-[15px] leading-tight">
                                        {config.name}
                                    </span>

                                    {/* 🔥 JSX 里没有任何 Margin，保证预览完美居中 🔥 */}
                                    <img
                                        id="verified-badge" // 👈 加上 ID 方便 onclone 抓取
                                        src={verifiedIcon}
                                        alt="verified"
                                        className="w-[19px] h-[19px] block object-contain"
                                    />
                                </div>

                                <div style={{ color: config.secondaryColor }} className="text-[15px] mt-1 leading-tight">{config.handle}</div>
                            </div>

                            <div className="ml-auto text-gray-500"><MoreHorizontal /></div>
                        </div>

                        {/* Body */}
                        <div style={{ color: config.textColor }} className="text-[18px] leading-relaxed whitespace-pre-wrap font-normal mb-4">
                            {config.content}
                        </div>

                        {/* Footer */}
                        {(config.showDate || config.showTranslate) && (
                            <div style={{ color: config.secondaryColor }} className="pt-4 border-t border-white/10 flex gap-2 text-[15px] items-center">
                                {config.showDate && <span>{config.date}</span>}
                                {config.showTranslate && <span className="text-sky-500 font-medium ml-auto cursor-pointer">Translate tweet</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 右侧设置栏 */}
            <div className="w-full md:w-80 bg-white border-l border-gray-200 h-screen overflow-y-auto flex flex-col z-10">
                <div className="p-5 border-b border-gray-100">
                    <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">Settings</h2>
                </div>
                <div className="p-5 space-y-6 flex-1">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dimension</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['instagram', 'square'].map(d => (
                                <button key={d} onClick={() => setConfig({ ...config, dimension: d })} className={`py-2 rounded-md border text-sm capitalize ${config.dimension === d ? 'border-sky-500 bg-sky-50 text-sky-600 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{d}</button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Elements</label>
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setConfig({ ...config, showDate: !config.showDate })}>
                            <div className="flex items-center gap-2 text-gray-700 font-medium"><Calendar size={16} /> Show Date</div>
                            <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ${config.showDate ? 'bg-sky-500' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showDate ? 'translate-x-4' : ''}`}></div></div>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setConfig({ ...config, showTranslate: !config.showTranslate })}>
                            <div className="flex items-center gap-2 text-gray-700 font-medium"><Languages size={16} /> Translate</div>
                            <div className={`w-10 h-6 flex items-center rounded-full p-1 duration-300 ${config.showTranslate ? 'bg-sky-500' : 'bg-gray-300'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showTranslate ? 'translate-x-4' : ''}`}></div></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Content</label>
                        <textarea value={config.content} onChange={e => setConfig({ ...config, content: e.target.value })} rows={6} className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Colors</label>
                        <div className="flex gap-2">
                            <input type="color" value={config.bgColor} onChange={e => setConfig({ ...config, bgColor: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-none" />
                            <input type="color" value={config.textColor} onChange={e => setConfig({ ...config, textColor: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-none" />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t bg-gray-50">
                    <button onClick={handleDownload} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-lg">
                        <Download size={20} /> Download HD
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TweetGenerator;