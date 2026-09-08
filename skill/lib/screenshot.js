/**
 * perfect-tweet Puppeteer 渲染 pipeline
 * 加载 HTML → 等待字体/图片就绪 → 按倍率高清截图导出 PNG。
 * deviceScaleFactor 对应原版 html2canvas 的 scale（默认 3x）。
 */

import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

/**
 * 解析可用的 Chrome 可执行文件（按优先级）：
 * 1. 环境变量 PUPPETEER_EXECUTABLE_PATH
 * 2. puppeteer 自带缓存 Chromium（校验二进制完整，>10MB；下载截断时自动跳过）
 * 3. 系统安装的 Chrome / Edge / Chromium（免下载 500MB）
 */
function resolveExecutable() {
    // 环境变量优先
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        const env = process.env.PUPPETEER_EXECUTABLE_PATH;
        if (fs.existsSync(env)) return env;
        console.error(`⚠️  PUPPETEER_EXECUTABLE_PATH 指向的文件不存在：${env}`);
    }
    // puppeteer 自带缓存 Chromium：校验二进制 >10MB（下载截断时自动跳过）
    try {
        const p = puppeteer.executablePath();
        if (fs.existsSync(p) && fs.statSync(p).size > 10 * 1024 * 1024) return p;
    } catch { /* 未下载 */ }
    // 系统浏览器（macOS Chrome 主二进制是数百 KB 的 launcher，存在即可用）
    const systemPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ];
    for (const p of systemPaths) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(
        '未找到可用的 Chrome/Chromium。请任选其一：\n' +
        '  1) 在 Skill 目录运行 npx puppeteer browsers install chrome 下载自带浏览器\n' +
        '  2) 安装系统 Google Chrome\n' +
        '  3) 设置环境变量 PUPPETEER_EXECUTABLE_PATH 指向已有浏览器'
    );
}

/** 等待页面内所有图片与字体加载完成（头像、蓝标、背景图均为内联/base64 或远程 URL） */
async function waitAssets(page) {
    await page.evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map(img => img.complete ? Promise.resolve() :
            new Promise(resolve => { img.onload = img.onerror = resolve; })));
        if (document.fonts?.ready) await document.fonts.ready;
    });
    // 双保险：网络空闲（base64 大图解码 + 远程头像）
    await new Promise(r => setTimeout(r, 120));
}

/**
 * 渲染单张卡片 HTML 并截图。
 * @param {import('puppeteer').Browser} browser
 * @param {string} html renderCardHTML 输出的完整 HTML
 * @param {string} outPath 输出 PNG 路径
 * @param {number} scale 导出倍率（deviceScaleFactor）
 */
export async function screenshotCard(browser, html, outPath, scale = 3) {
    const page = await browser.newPage();
    try {
        // viewport 只需容纳卡片；倍率由 deviceScaleFactor 控制
        await page.setViewport({ width: 1400, height: 1600, deviceScaleFactor: scale });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
        await waitAssets(page);

        const card = await page.$('#card');
        if (!card) throw new Error('页面中未找到 #card 元素');

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        await card.screenshot({ path: outPath, omitBackground: true });
        return outPath;
    } finally {
        await page.close();
    }
}

/**
 * 批量渲染：一个 Browser 实例依次渲染多张卡片（稳定且省资源）。
 * @param {Array<{html: string, outPath: string}>} jobs
 * @param {number} scale
 * @returns {Promise<Array<string>>} 成功输出的文件路径列表
 */
export async function screenshotBatch(jobs, scale = 3) {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: resolveExecutable(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--force-color-profile=srgb',   // 与浏览器预览色彩一致
            '--hide-scrollbars',
        ],
    });
    try {
        const done = [];
        for (const job of jobs) {
            const out = await screenshotCard(browser, job.html, job.outPath, scale);
            done.push(out);
        }
        return done;
    } finally {
        await browser.close();
    }
}
