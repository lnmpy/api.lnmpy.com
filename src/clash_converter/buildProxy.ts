import yaml from "js-yaml";
import { ClashConfig, ClashProxy } from "./types";

function fetchAsClashClient(url: string): Promise<Response> {
    return fetch(new URL(url).toString(), {
        headers: {
            "User-Agent": "ClashMeta/1.8.0",
        },
    });
}

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
}

// subscription-userinfo 没有正式规范, 常见格式为 "upload=1; download=2; total=3; expire=1700000000".
// 宽松解析: 分隔符 ; , & 换行, 键值 = 或 :, 忽略大小写/引号/空白, 支持 KB/MB/GB/TB 单位.
function parseUserinfo(info: string): Record<string, number> {
    const units: Record<string, number> = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4, p: 1024 ** 5 };
    const result: Record<string, number> = {};
    for (const part of String(info).split(/[;,&\n]/)) {
        const idx = part.search(/[=:]/);
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim().toLowerCase();
        const v = part.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        const m = v.match(/^(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([kmgtp]?)i?b?$/i);
        if (!k || !m) continue;
        result[k] = Math.round(parseFloat(m[1]) * units[m[2].toLowerCase()]);
    }
    return result;
}

// 规范化并合并多个 subscription-userinfo:
// 每个订阅 total = max(upload + download, total), 再对 upload/download/total 求和, expire 取最早.
export function mergeUserinfo(infos: string[]): string {
    let upload = 0, download = 0, total = 0, expire = 0, found = false;
    for (const info of infos) {
        const u = parseUserinfo(info);
        if (u.upload === undefined && u.download === undefined && u.total === undefined) continue;
        found = true;
        const up = u.upload || 0;
        const down = u.download || 0;
        upload += up;
        download += down;
        total += Math.max(up + down, u.total || 0);
        let exp = u.expire || 0;
        if (exp > 1e11) exp = Math.floor(exp / 1000); // 毫秒时间戳
        if (exp > 0) expire = expire ? Math.min(expire, exp) : exp;
    }
    if (!found) return "";
    return `upload=${upload}; download=${download}; total=${total}` + (expire ? `; expire=${expire}` : "");
}

async function loadClashProxies(
    url: string,
    storage?: R2Bucket,
    useCache: boolean = false,
    userinfos: string[] = [],
): Promise<ClashProxy[]> {
    const urlTrimmed = url.trim();
    const cache = useCache ? storage : undefined;
    const cacheKey = cache ? `clash_converter_cache/${await sha256(urlTrimmed)}` : "";
    let config: ClashConfig;

    try {
        const res = await fetchAsClashClient(urlTrimmed);
        if (!res.ok) {
            throw new Error(`Fetch failed with status ${res.status}`);
        }
        config = yaml.load(await res.text()) as ClashConfig;
        const userinfo = res.headers.get("subscription-userinfo");
        if (userinfo) {
            config["subscription-userinfo"] = userinfo;
        }
        await cache?.put(cacheKey, yaml.dump(config));
    } catch (e) {
        const cacheObject = await cache?.get(cacheKey);
        if (!cacheObject) {
            throw e;
        }
        console.error(`Failed to fetch ${urlTrimmed}, using cache:`, e);
        config = yaml.load(await cacheObject.text()) as ClashConfig;
    }

    if (config["subscription-userinfo"]) {
        userinfos.push(config["subscription-userinfo"]);
    }
    return config.proxies || [];
}

export async function buildProxy(config: ClashConfig,
    requestParams: Record<string, any>,
    r2_storgae: R2Bucket,
): Promise<ClashConfig> {
    const rawUrls: string[] = requestParams["url"] ? requestParams["url"].split("|") : [];
    // 从所有 URL 加载 proxies

    let proxies: ClashProxy[] = [];
    const userinfos: string[] = [];
    for (const rawItem of rawUrls) {
        const trimmedItem = rawItem.trim();
        if (!trimmedItem) continue;

        let name = "";
        let url = trimmedItem;
        const idx = trimmedItem.indexOf("::");
        if (idx !== -1) {
            name = trimmedItem.substring(0, idx).trim();
            url = trimmedItem.substring(idx + 2).trim();
        }

        if (!url) continue;

        try {
            const ps = await loadClashProxies(
                url,
                r2_storgae,
                requestParams["cache"] === "1",
                userinfos,
            );
            ps.forEach((p) => {
                if (name) {
                    p.name = `${p.name.trim()}@${name}`;
                } else {
                    p.name = p.name.trim();
                }
            });
            proxies.push(...ps);
        } catch (e) {
            console.error(`Failed to load proxies from ${url}:`, e);
        }
    }

    {
        const proxyCostMin = parseFloat(requestParams["proxy_cost_min"] || "0");
        const proxyCostMax = parseFloat(requestParams["proxy_cost_max"] || "1.5");
        proxies = proxies.filter((p) => {
            const filterReg = /(\d+(?:\.\d+)?)\s*x/g;
            for (const match of p.name.matchAll(filterReg)) {
                const number = parseFloat(match[1]);
                if (number < proxyCostMin || number > proxyCostMax) {
                    return false;
                }
            }
            return true;
        });
    }

    {
        const exclude: string[] = String(requestParams["exclude"] || "").split(",").filter(Boolean);
        if (exclude.length > 0) {
            proxies = proxies.filter((p) => {
                return !exclude.some((e: string) => p.name.includes(e));
            });
        }
    }

    {
        const emojiMap: Record<string, string> = {
            "香港|Hong Kong|HK|🇭🇰": "🇭🇰",
            "新加坡|Singapore|SG|🇸🇬": "🇸🇬",
            "美国|USA|US|🇺🇸": "🇺🇸",
            "日本|Japan|JP|🇯🇵": "🇯🇵",
            "韩国|South Korea|KR|🇰🇷": "🇰🇷",
            "德国|Germany|DE|🇩🇪": "🇩🇪",
            "英国|United Kingdom|UK|🇬🇧": "🇬🇧",
            "荷兰|Netherlands|NL|🇳🇱": "🇳🇱",
            "意大利|Italy|IT|🇮🇹": "🇮🇹",
            "法国|France|FR|🇫🇷": "🇫🇷",
            "加拿大|Canada|CA|🇨🇦": "🇨🇦",
            "澳大利亚|Australia|AU|🇦🇺": "🇦🇺",
            "新西兰|New Zealand|NZ|🇳🇿": "🇳🇿",
            "土耳其|Turkey|TR|🇹🇷": "🇹🇷",
            "台湾|Taiwan|TW|🇹🇼": "🇹🇼",
            "印度|India|IN|🇮🇳": "🇮🇳",
            "罗马尼亚|Romania|RO|🇷🇴": "🇷🇴",
            "俄罗斯|Russia|RU|🇷🇺": "🇷🇺",
            "西班牙|Spain|ES|🇪🇸": "🇪🇸",
            "希腊|Greece|GR|🇬🇷": "🇬🇷",
            "泰国|Thailand|TH|🇹🇭": "🇹🇭",
            "马来西亚|Malaysia|MY|🇲🇾": "🇲🇾",
            "菲律宾|Philippines|PH|🇵🇭": "🇵🇭",
        };

        for (const proxy of proxies) {
            let emoji = "";
            for (const [keywords, flag] of Object.entries(emojiMap)) {
                for (const keyword of keywords.split("|")) {
                    if (proxy.name.includes(keyword)) {
                        emoji = flag;
                        break;
                    }
                }
            }
            if (emoji) {
                if (proxy.name.startsWith(emoji + " ")) {
                    continue;
                } else if (proxy.name.startsWith(emoji)) {
                    proxy.name = proxy.name.replace(emoji, emoji + " ");
                } else {
                    proxy.name = emoji + " " + proxy.name;
                }
            }
        }
    }
    config.proxies = proxies;
    if (userinfos.length > 0) {
        config["subscription-userinfo"] = mergeUserinfo(userinfos);
    }

    return config;
}
