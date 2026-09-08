#!/usr/bin/env node
/**
 * perfect-tweet CLI
 * 命令：
 *   config  [key=value ...] | --reset     查看 / 设置模板配置（持久化）
 *   generate <链接...> [--out DIR] [--viral] [--set likes=N,views=N] [--dim KEY] [--scale N]
 *                                          批量抓取推文并生成卡片 PNG
 *   preview [--out FILE]                   用示例数据按当前模板渲染一张预览
 *   help                                   帮助
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { loadConfig, saveConfig, resetConfig, validatePatch, applyTheme, describeConfig, CONFIG_PATH } from '../lib/config.js';
import { renderCardHTML, DEFAULT_TWEET, DEFAULT_TEMPLATE, DIMENSIONS } from '../lib/render.js';
import { extractTweetIds, fetchTweets, applyStatsOverride } from '../lib/fetch.js';

// Puppeteer 体积大，仅在真正需要渲染时动态加载（config 等命令不依赖它）
async function getScreenshotBatch() {
    try {
        return (await import('../lib/screenshot.js')).screenshotBatch;
    } catch (err) {
        if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
            throw new Error('缺少依赖 puppeteer。请先在 Skill 目录执行：npm install');
        }
        throw err;
    }
}

const USAGE = `perfect-tweet — X 推文卡片批量生成器

用法：
  perfect-tweet config                       查看当前模板配置
  perfect-tweet config key=value ...         修改配置（立即持久化）
  perfect-tweet config --reset               恢复默认模板
  perfect-tweet generate <链接...>           批量生成卡片（支持多链接混排一段文本）
  perfect-tweet preview                      用示例推文按当前模板渲染预览图

generate 选项：
  --out DIR            输出目录（默认取配置 outputDir）
  --dim KEY            临时尺寸：${Object.keys(DIMENSIONS).join(' | ')}
  --scale N            临时导出倍率 1~5（默认取配置 scale）
  --viral              每张卡随机生成爆款互动数据
  --set k=v,k=v        覆盖互动数据（replies/retweets/likes/bookmarks/views）
  --theme KEY          临时主题 black | white

config 常用字段：
  theme cardColor textColor dimension fontScale contentScale contentWidth
  showDate showViews showTranslate showStats bgImage cardOpacity
  cardOffsetX cardOffsetY outputDir scale timeZone

示例：
  perfect-tweet config dimension=2:3 fontScale=120 showTranslate=true
  perfect-tweet config bgImage=~/Pictures/bg.jpg cardOpacity=85
  perfect-tweet generate https://x.com/user/status/123 https://x.com/other/status/456
  perfect-tweet generate "$(pbpaste)" --viral --out ~/Desktop/cards
`;

/* ---------- 参数解析 ---------- */
// 已知布尔 flag（后跟的参数不会被吞作值）
const BOOL_FLAGS = new Set(['viral', 'reset', 'help']);

function parseArgs(argv) {
    const positional = [];
    const flags = {};
    let key = null;
    for (const a of argv) {
        if (a.startsWith('--') && a.length > 2) {
            const name = a.slice(2);
            if (BOOL_FLAGS.has(name)) { flags[name] = true; key = null; }
            else { key = name; flags[name] = true; } // 悬挂待值，遇下一个 flag 则保持 true
        } else if (key && flags[key] === true) {
            flags[key] = a; key = null;
        } else {
            positional.push(a);
        }
    }
    return { positional, flags };
}

const expandTilde = (p) => (p && p.startsWith('~') ? p.replace(/^~/, os.homedir()) : p);

/** 解析 --set likes=1000,views=5000 */
function parseStatsOverride(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const out = {};
    for (const pair of raw.split(',')) {
        const m = pair.trim().match(/^(\w+)=(\d+)$/);
        if (!m) throw new Error(`--set 格式错误："${pair}"，应为 key=数字（逗号分隔）`);
        out[m[1]] = Number(m[2]);
    }
    return out;
}

/* ---------- 子命令 ---------- */

async function cmdConfig(args) {
    const { positional, flags } = parseArgs(args);

    if (flags.reset) {
        resetConfig();
        console.log('✅ 已恢复默认模板\n');
        console.log(describeConfig(loadConfig()));
        return;
    }

    const config = loadConfig();

    if (!positional.length) {
        console.log(`📄 配置文件：${CONFIG_PATH}\n`);
        console.log(describeConfig(config));
        console.log('\n提示：perfect-tweet config key=value ... 修改；--reset 恢复默认');
        return;
    }

    // key=value 解析
    const patch = {};
    for (const item of positional) {
        const eq = item.indexOf('=');
        if (eq === -1) { console.error(`❌ 参数 "${item}" 应为 key=value 形式`); process.exitCode = 1; return; }
        const k = item.slice(0, eq).trim();
        let v = item.slice(eq + 1).trim();
        if (v.startsWith('~') || /^https?:/.test(v)) v = v; // 路径/URL 原样
        else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);  // 数字
        patch[k] = v;
    }

    const { ok, patch: clean, errors } = validatePatch(patch);
    if (!ok) {
        console.error('❌ 配置校验失败：\n  - ' + errors.join('\n  - '));
        process.exitCode = 1;
        return;
    }
    applyTheme(clean, config);
    const next = { ...config, ...clean };
    if (next.bgImage) next.bgImage = expandTilde(next.bgImage);
    saveConfig(next);

    console.log('✅ 配置已保存：');
    for (const k of Object.keys(clean)) console.log(`  ${k} = ${clean[k]}`);
    console.log(`\n文件：${CONFIG_PATH}`);
    console.log('\n可运行 perfect-tweet preview 查看效果');
}

async function cmdGenerate(args) {
    const { positional, flags } = parseArgs(args);

    // positional 里可能混着一段多链接文本
    const ids = extractTweetIds(positional.join('\n'));
    if (!ids.length) {
        console.error('❌ 未找到有效的推文链接（需要 x.com 或 twitter.com 的 /status/ 链接）');
        process.exitCode = 1;
        return;
    }

    const config = loadConfig();
    // 临时覆盖（不写入持久配置）
    const style = { ...config };
    if (flags.dim) {
        if (!DIMENSIONS[flags.dim]) { console.error(`❌ 未知尺寸 "${flags.dim}"（可用：${Object.keys(DIMENSIONS).join(', ')}）`); process.exitCode = 1; return; }
        style.dimension = flags.dim;
    }
    if (flags.theme) {
        const r = validatePatch({ theme: flags.theme });
        if (!r.ok) { console.error('❌ ' + r.errors.join('; ')); process.exitCode = 1; return; }
        Object.assign(style, applyTheme(r.patch, style));
    }
    if (flags.scale) {
        const r = validatePatch({ scale: flags.scale });
        if (!r.ok) { console.error('❌ ' + r.errors.join('; ')); process.exitCode = 1; return; }
        style.scale = r.patch.scale;
    }

    let statsOverride = null;
    if (flags.set) {
        try { statsOverride = parseStatsOverride(flags.set); }
        catch (e) { console.error('❌ ' + e.message); process.exitCode = 1; return; }
    }

    console.log(`🔍 抓取 ${ids.length} 条推文…`);
    const { tweets, failed } = await fetchTweets(ids, {
        timeZone: style.timeZone,
        bearerToken: process.env.X_API_BEARER_TOKEN || null,
    });
    if (!tweets.length) {
        console.error('❌ 全部链接抓取失败，未生成任何卡片');
        process.exitCode = 1;
        return;
    }

    const outDir = expandTilde(flags.out || style.outputDir || DEFAULT_TEMPLATE.outputDir);
    console.log(`🎨 渲染 ${tweets.length} 张卡片 → ${outDir}`);

    const jobs = tweets.map((tweet, i) => {
        const t = applyStatsOverride(tweet, { statsOverride, viral: !!flags.viral });
        return {
            html: renderCardHTML(t, style),
            outPath: path.join(outDir, `tweet-${t.handle.replace('@', '')}-${i + 1}.png`),
        };
    });

    const screenshotBatch = await getScreenshotBatch();
    const done = await screenshotBatch(jobs, style.scale);

    console.log(`\n✅ 完成 ${done.length}/${ids.length} 张：`);
    for (const f of done) console.log('  ' + f);
    if (failed.length) {
        console.error(`\n⚠️  ${failed.length} 条失败：` + failed.map(f => `${f.id} (${f.error})`).join('、'));
    }
}

async function cmdPreview(args) {
    const { flags } = parseArgs(args);
    const config = loadConfig();
    const tweet = DEFAULT_TWEET();

    const outPath = expandTilde(flags.out || path.join(os.tmpdir(), 'perfect-tweet-preview.png'));
    console.log(`🎨 按当前模板渲染示例卡片（${DIMENSIONS[config.dimension]?.label}）…`);
    const screenshotBatch = await getScreenshotBatch();
    await screenshotBatch([{ html: renderCardHTML(tweet, config), outPath }], config.scale);
    console.log('✅ 预览图：' + outPath);
    console.log('\n' + describeConfig(config));
}

/* ---------- 入口 ---------- */

async function main() {
    const [cmd, ...rest] = process.argv.slice(2);

    switch (cmd) {
        case 'config': await cmdConfig(rest); break;
        case 'generate': case 'gen': await cmdGenerate(rest); break;
        case 'preview': await cmdPreview(rest); break;
        case 'help': case '--help': case '-h': case undefined:
            console.log(USAGE);
            break;
        default:
            console.error(`❌ 未知命令 "${cmd}"\n`);
            console.log(USAGE);
            process.exitCode = 1;
    }
}

main().catch(err => {
    console.error('❌ 运行失败：' + (err && err.stack ? err.stack.split('\n')[0] : err));
    process.exit(1);
});
