/**
 * perfect-tweet 模板配置模块
 * 配置持久化到 Skill 自身目录的 config.json —— 无论装到哪个 Agent 的
 * skills 目录（Claude Code / NewMax / Cursor / 任意位置）都自包含；
 * 需要多个 Agent 共享一份配置时，可用环境变量 PERFECT_TWEET_CONFIG 指定。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEMPLATE, TEMPLATE_FIELDS, DIMENSIONS, THEMES } from './render.js';

/** Skill 安装根目录（本文件位于 lib/ 下，上一级即 skill 根） */
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 配置文件路径：默认在 skill 根目录；PERFECT_TWEET_CONFIG 可覆盖（绝对或相对路径均可） */
export const CONFIG_PATH = process.env.PERFECT_TWEET_CONFIG
    ? path.resolve(process.env.PERFECT_TWEET_CONFIG)
    : path.join(SKILL_ROOT, 'config.json');
export const CONFIG_DIR = path.dirname(CONFIG_PATH);

/** 读取模板配置（不存在时返回默认模板，不落盘） */
export function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            // 与默认模板合并：新增字段自动补全，历史字段保留
            return { ...DEFAULT_TEMPLATE, ...saved };
        }
    } catch (err) {
        console.error(`⚠️  配置文件损坏（${err.message}），将使用默认模板重新初始化`);
    }
    return { ...DEFAULT_TEMPLATE };
}

/** 保存模板配置（原子写入：先写临时文件再 rename） */
export function saveConfig(config) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const tmp = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmp, CONFIG_PATH);
    return CONFIG_PATH;
}

/** 重置为默认模板 */
export function resetConfig() {
    return saveConfig({ ...DEFAULT_TEMPLATE });
}

/**
 * 校验并归一化一个 patch 对象（key=value 形式设置的值）。
 * 返回 { ok, patch, errors }：ok=false 时 errors 为人类可读的错误列表。
 */
export function validatePatch(patch) {
    const errors = [];
    const clean = {};
    for (const [key, value] of Object.entries(patch || {})) {
        const rule = TEMPLATE_FIELDS[key];
        if (!rule) { errors.push(`未知字段 "${key}"（可用：${Object.keys(TEMPLATE_FIELDS).join(', ')}）`); continue; }

        if (rule === 'boolean') {
            if (typeof value === 'boolean') clean[key] = value;
            else if (value === 'true' || value === '1') clean[key] = true;
            else if (value === 'false' || value === '0') clean[key] = false;
            else errors.push(`${key} 应为 true/false`);
        } else if (rule === 'color') {
            if (/^#[0-9a-fA-F]{6}$/.test(value)) clean[key] = value;
            else errors.push(`${key} 应为 #RRGGBB 格式的颜色（收到 "${value}"）`);
        } else if (Array.isArray(rule)) {
            if (rule.includes(value)) clean[key] = value;
            else errors.push(`${key} 应为 ${rule.join(' / ')} 之一（收到 "${value}"）`);
        } else if (rule === 'number') {
            const n = Number(value);
            if (Number.isFinite(n)) clean[key] = Math.round(n);
            else errors.push(`${key} 应为数字（收到 "${value}"）`);
        } else if (rule === 'string' || rule === 'string|null') {
            clean[key] = value === 'null' || value === '' ? null : String(value);
        } else if (typeof rule === 'object' && rule.min !== undefined) {
            const n = Number(value);
            if (!Number.isFinite(n)) errors.push(`${key} 应为数字（收到 "${value}"）`);
            else if (n < rule.min || n > rule.max) errors.push(`${key} 应在 ${rule.min}~${rule.max} 之间（收到 ${n}）`);
            else clean[key] = Math.round(n);
        } else {
            clean[key] = value;
        }
    }
    return { ok: errors.length === 0, patch: clean, errors };
}

/** 设置主题时联动卡片/文字颜色（与原 React 版行为一致） */
export function applyTheme(patch, config) {
    if (patch.theme && THEMES[patch.theme] && patch.cardColor === undefined && patch.textColor === undefined) {
        patch.cardColor = THEMES[patch.theme].card;
        patch.textColor = THEMES[patch.theme].text;
    }
    return patch;
}

/** 把配置渲染成人类可读的摘要（config show / set 回显用） */
export function describeConfig(c) {
    const dim = DIMENSIONS[c.dimension] || DIMENSIONS.instagram;
    const theme = THEMES[c.theme] || THEMES.black;
    const lines = [
        `主题 (theme):        ${c.theme}（${theme.label}）`,
        `卡片颜色 (cardColor): ${c.cardColor}`,
        `文字颜色 (textColor): ${c.textColor}`,
        `尺寸 (dimension):    ${c.dimension}（${dim.label}，${Math.round(dim.height * dim.aspect)}×${dim.height}px）`,
        `字号缩放 (fontScale):     ${c.fontScale}%`,
        `内容缩放 (contentScale):  ${c.contentScale}%`,
        `内容宽度 (contentWidth):  ${c.contentWidth}%`,
        `显示日期 (showDate):      ${c.showDate ? '开' : '关'}`,
        `显示浏览量 (showViews):   ${c.showViews ? '开' : '关'}`,
        `翻译链接 (showTranslate): ${c.showTranslate ? '开' : '关'}`,
        `互动行 (showStats):       ${c.showStats ? '开' : '关'}`,
        `背景图 (bgImage):        ${c.bgImage || '无'}`,
        `卡片透明度 (cardOpacity): ${c.cardOpacity}%`,
        `浮层偏移 X/Y:            ${c.cardOffsetX}, ${c.cardOffsetY} px`,
        `输出目录 (outputDir):    ${c.outputDir}`,
        `导出倍率 (scale):        ${c.scale}x`,
        `时区 (timeZone):         ${c.timeZone}`,
    ];
    return lines.join('\n');
}
