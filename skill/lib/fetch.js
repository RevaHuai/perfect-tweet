/**
 * perfect-tweet 推文抓取模块
 * 通过 fxtwitter 公开 API 抓取推文数据（与原 React 版 fetchTweets 一致）。
 * 可选配置 X_API_BEARER_TOKEN 环境变量走官方 API（增强：官方统计字段更全）。
 */

import { formatDate, randomViralStats } from './render.js';

/** 从任意文本中提取去重后的推文 ID 列表 */
export function extractTweetIds(text) {
    if (!text) return [];
    const matches = [...String(text).matchAll(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/g)];
    return [...new Set(matches.map(m => m[1]))];
}

/** 把 fxtwitter 的推文对象转换为渲染所需的 tweet 结构 */
function toTweet(t, timeZone) {
    return {
        name: t.author?.name ?? '',
        handle: `@${t.author?.screen_name ?? 'unknown'}`,
        content: t.text ?? '',
        avatar: t.author?.avatar_url ?? '',
        date: formatDate(t.created_at, timeZone),
        createdAt: t.created_at,
        tweetId: t.id,
        stats: {
            replies: t.replies ?? 0,
            retweets: t.retweets ?? 0,
            likes: t.likes ?? 0,
            bookmarks: t.bookmarks ?? 0,
            views: t.views ?? 0,
        },
    };
}

/**
 * 抓取单条推文。
 * @param {string} id 推文 ID
 * @param {object} opts { timeZone, bearerToken }
 */
export async function fetchTweet(id, opts = {}) {
    const { timeZone = 'Asia/Shanghai', bearerToken = null } = opts;

    // 路线 1：官方 X API v2（配了 Bearer Token 时优先，字段更权威）
    if (bearerToken) {
        try {
            const res = await fetch(
                `https://api.twitter.com/2/tweets/${id}?` + new URLSearchParams({
                    'tweet.fields': 'created_at,public_metrics,non_public_metrics',
                    'user.fields': 'profile_image_url,verified',
                    expansions: 'author_id',
                }),
                { headers: { Authorization: `Bearer ${bearerToken}` } }
            );
            if (res.ok) {
                const data = await res.json();
                if (data?.data) {
                    const u = data.includes?.users?.find(x => x.id === data.data.author_id) || {};
                    const m = data.data.public_metrics || {};
                    return toTweet({
                        id,
                        created_at: data.data.created_at,
                        text: data.data.text,
                        author: {
                            name: u.name,
                            screen_name: u.username,
                            avatar_url: u.profile_image_url ? u.profile_image_url.replace('_normal', '_200x200') : '',
                        },
                        replies: m.reply_count ?? 0,
                        retweets: m.retweet_count ?? 0,
                        likes: m.like_count ?? 0,
                        bookmarks: m.bookmark_count ?? 0,
                        views: (data.data.non_public_metrics?.impression_count) || m.impression_count || 0,
                    }, timeZone);
                }
            }
            // 官方 API 失败（权限/限流）→ 静默回退 fxtwitter
        } catch { /* 回退 */ }
    }

    // 路线 2：fxtwitter 公开 API（默认，无需任何凭证）
    const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { 'User-Agent': 'perfect-tweet-skill/1.0 (+https://github.com)' },
    });
    if (!res.ok) throw new Error(`fxtwitter HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.tweet) throw new Error(data?.message || 'Tweet not found');
    return toTweet(data.tweet, timeZone);
}

/**
 * 批量抓取推文（逐条进行，单条失败不影响其他）。
 * @returns {Promise<{tweets: Array, failed: Array<{id, error}>}>}
 */
export async function fetchTweets(ids, opts = {}) {
    const tweets = [];
    const failed = [];
    for (const id of ids) {
        try {
            const tweet = await fetchTweet(id, opts);
            tweets.push(tweet);
            console.log(`  ✅ ${tweet.handle} · ${tweet.content.slice(0, 30).replace(/\n/g, ' ')}${tweet.content.length > 30 ? '…' : ''}`);
        } catch (err) {
            failed.push({ id, error: err.message });
            console.error(`  ❌ ${id}: ${err.message}`);
        }
    }
    return { tweets, failed };
}

/**
 * 应用互动数据覆盖。
 * @param {object} tweet 渲染用 tweet
 * @param {object|null} statsOverride { replies, retweets, likes, bookmarks, views } 部分覆盖
 * @param {boolean} viral true 时随机生成爆款数据
 */
export function applyStatsOverride(tweet, { statsOverride = null, viral = false } = {}) {
    if (viral) {
        tweet.stats = randomViralStats();
        return tweet;
    }
    if (statsOverride && typeof statsOverride === 'object') {
        for (const k of Object.keys(tweet.stats)) {
            if (statsOverride[k] !== undefined && statsOverride[k] !== null) {
                tweet.stats[k] = Math.max(0, Number(statsOverride[k]) || 0);
            }
        }
    }
    return tweet;
}
