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

async function loadClashProxies(
    url: string,
    storage?: R2Bucket,
    useCache: boolean = false,
): Promise<ClashProxy[]> {
    const urlTrimmed = url.trim();
    let respText = "";

    if (useCache && storage) {
        const cacheKey = `clash_converter_cache/${await sha256(urlTrimmed)}`;
        try {
            const res = await fetchAsClashClient(urlTrimmed);
            if (res.ok) {
                respText = await res.text();
                await storage.put(cacheKey, respText);
            } else {
                throw new Error(`Fetch failed with status ${res.status}`);
            }
        } catch (e) {
            console.error(`Failed to fetch ${urlTrimmed}, trying cache:`, e);
            const cacheObject = await storage.get(cacheKey);
            if (cacheObject) {
                respText = await cacheObject.text();
            } else {
                throw e;
            }
        }
    } else {
        const res = await fetchAsClashClient(urlTrimmed);
        if (!res.ok) {
            throw new Error(`Fetch failed with status ${res.status}`);
        }
        respText = await res.text();
    }

    const config = yaml.load(respText) as ClashConfig;
    return config.proxies || [];
}

export async function buildProxy(config: ClashConfig,
    requestParams: Record<string, any>,
    r2_storgae: R2Bucket,
): Promise<ClashConfig> {
    const rawUrls: string[] = requestParams["url"] ? requestParams["url"].split("|") : [];
    // 从所有 URL 加载 proxies

    let proxies: ClashProxy[] = [];
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
                requestParams["cache"] === "1"
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

    return config;
}
