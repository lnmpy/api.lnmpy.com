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

export async function buildProxy(config: ClashConfig, requestParams: Record<string, any>, r2_storgae: R2Bucket) {
    const urls = requestParams["url"].split("|");
    const urlNames = requestParams["url_names"]
        ? requestParams["url_names"].split("|").map((s: string) => s.trim())
        : [];
    // 从所有 URL 加载 proxies

    let proxies: ClashProxy[] = [];
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            const ps = await loadClashProxies(
                url,
                r2_storgae,
                requestParams["cache"] === "1"
            );
            ps.forEach((p) => {
                const suffix = urlNames[i];
                if (suffix) {
                    p.name = `${p.name.trim()}@${suffix}`;
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
        const proxyCostMax = parseFloat(requestParams["proxy_cost_max"] || "1");
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
            "香港": "🇭🇰",
            "新加坡": "🇸🇬",
            "美国": "🇺🇸",
            "日本": "🇯🇵",
            "韩国": "🇰🇷",
            "德国": "🇩🇪",
            "英国": "🇬🇧",
            "荷兰": "🇳🇱",
            "意大利": "🇮🇹",
            "法国": "🇫🇷",
            "加拿大": "🇨🇦",
            "澳大利亚": "🇦🇺",
            "新西兰": "🇳🇿",
            "土耳其": "🇹🇷",
            "台湾": "🇹🇼",
            "印度": "🇮🇳",
            "罗马尼亚": "🇷🇴",
            "俄罗斯": "🇷🇺",
            "西班牙": "🇪🇸",
            "希腊": "🇬🇷",
        };

        for (const proxy of proxies) {
            let emoji = "";
            for (const [keyword, flag] of Object.entries(emojiMap)) {
                if (proxy.name.includes(keyword)) {
                    emoji = flag;
                    break;
                }
            }
            if (emoji && !proxy.name.startsWith(emoji)) {
                proxy.name = emoji + " " + proxy.name;
            }
        }
    }
    config.proxies = proxies;
}
