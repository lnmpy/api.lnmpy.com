import { Hono, Context } from "hono";
import yaml from "js-yaml";
import { ClashConfig, ClashProxy } from "./types";

function fetchAsClashClient(url: string): Promise<Response> {
	const urlObj = new URL(url);
	return fetch(urlObj.toString(), {
		headers: {
			"User-Agent": "ClashMeta/1.8.0",
		},
	});
}

async function loadClashProxies(url: string): Promise<ClashProxy[]> {
	return fetchAsClashClient(url)
		.then((res) => res.text())
		.then((resp) => yaml.load(resp) as ClashConfig)
		.then((c) => c.proxies || []);
}

function addProxyEmoji(proxies: ClashProxy[]) {
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
		if (emoji) {
			proxy.name = emoji + " " + proxy.name;
		}
	}
}

function updateProxyGroup(config: ClashConfig) {
	const proxies = config.proxies.map((p) => p.name);

	config["proxy-groups"] = [
		{
			name: "🚀 节点选择",
			type: "select",
			proxies: [
				"♻️ 自动选择",
				"🔁 故障转移",
				"🚀 手动切换",
				"🇭🇰 香港节点",
				"🇸🇬 狮城节点",
				"🇺🇸 美国节点",
				"🇯🇵 日本节点",
			],
		},
		{
			// ss,vmess,vless等轻量协议优先使用该模式
			// 每隔internal秒进行测试, 若存在更优节点, 则切换到更优节点
			// 更优定义: 延迟小于 当前节点 + tolerance
			name: "♻️ 自动选择",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies,
		},
		{
			// trojan等较重协议优先使用该模式
			// 每隔internal秒进行测试, 若当前节点是否可用, 若不可用才切换至下一个节点
			// 可用定义: 延迟小于 最低延迟节点 + tolerance
			name: "🔁 故障转移",
			type: "fallback",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies,
		},
		{
			name: "🚀 手动切换",
			type: "select",
			proxies: (config.proxies || []).map((p) => p.name),
		},
		{
			name: "🇭🇰 香港节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("香港")),
		},
		{
			name: "🇸🇬 狮城节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("新加坡")),
		},
		{
			name: "🇺🇸 美国节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("美国")),
		},
		{
			name: "🇯🇵 日本节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("日本")),
		},
		{
			name: "🇪🇺 欧洲节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) =>
				["德国", "英国", "荷兰", "意大利", "法国"].some((c) => n.includes(c)),
			),
		},
	];
	// 移除empty proxy-groups
	const emptyProxyGroups = config["proxy-groups"]
		.filter((group) => group.proxies?.length == 0)
		.map((group) => group.name);

	config["proxy-groups"] = config["proxy-groups"]
		.filter((group) => !emptyProxyGroups.includes(group.name))
		.map((group) => ({
			...group,
			proxies: group.proxies?.filter(
				(proxy) => !emptyProxyGroups.includes(proxy),
			),
		}));
}

function updateRules(config: ClashConfig, rules: string[]) {
	// 在模板 rules 前面添加自定义规则
	config.rules.unshift(...rules);

	// 替换规则中的代理组名称
	config.rules = config.rules.map((r) =>
		r.replace("PROXY", "🚀 节点选择"),
	);
}

async function loadR2Profile(
	c: Context,
	requestParams: Record<string, string>,
): Promise<string> {
	const profile = requestParams["profile"];
	delete requestParams["profile"];
	if (!profile) {
		return "";
	}
	const profileObject = await c.env.r2_storgae.get(
		`clash_converter_profile/${profile}.yaml`,
	);
	if (!profileObject) {
		return "";
	}
	return profileObject.text();
}

async function loadR2Rules(
	c: Context,
	requestParams: Record<string, string>,
): Promise<string[]> {
	const rules = (requestParams["rules"] || "").split("|");
	delete requestParams["rules"];
	let result: string[] = [];
	if (!rules) {
		return result;
	}
	for (const rule of rules) {
		const rs = await c.env.r2_storgae.get(`clash_converter_rule/${rule}.yaml`);
		if (!rs) {
			continue;
		}
		result.push(...(yaml.load(await rs.text()) as string[]));
	}
	return result;
}

async function loadR2Template(
	c: Context,
	requestParams: Record<string, string>,
): Promise<string> {
	const template = requestParams["template"] || "base";
	delete requestParams["template"];
	const templateObject = await c.env.r2_storgae.get(
		`clash_converter_template/${template}.yaml`,
	);
	if (!templateObject) {
		throw new Error(`Template '${template}' not found`);
	}
	return templateObject.text();
}

type Bindings = {
	r2_storgae: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();
app.get("/", async (c) => {
	const requestParams = c.req.query();
	const profile = await loadR2Profile(c, requestParams);
	if (!!profile) {
		return c.text(profile, 200, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}

	const customRules = await loadR2Rules(c, requestParams);

	if (!requestParams["url"]) {
		return c.text("url parameter missing", 404, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}

	// 解析参数
	const urls = requestParams["url"].split("|");
	const exclude = (requestParams["exclude"] || "").split(",").filter(Boolean);
	const proxyCostMin = parseFloat(requestParams["proxy_cost_min"] || "0");
	const proxyCostMax = parseFloat(requestParams["proxy_cost_max"] || "2");

	try {
		// 加载模板
		const clashTemplate = await loadR2Template(c, requestParams);
		const clashConfig = yaml.load(clashTemplate) as ClashConfig;

		// 从所有 URL 加载 proxies
		let allProxies: ClashProxy[] = [];
		for (let i = 0; i < urls.length; i++) {
			const url = urls[i];
			try {
				const proxies = await loadClashProxies(url.trim());
				proxies.forEach((p) => (p.providerNumber = i));
				allProxies.push(...proxies);
			} catch (e) {
				console.error(`Failed to load proxies from ${url}:`, e);
			}
		}

		if (allProxies.length === 0) {
			throw new Error("No proxies loaded from any URL");
		}

		// 过滤排除的节点
		if (exclude.length > 0) {
			allProxies = allProxies.filter(
				(p) => !exclude.some((e) => p.name.includes(e)),
			);
		}

		// 按倍率过滤节点
		allProxies = allProxies.filter((p) => {
			const filterReg = /(\d+(?:\.\d+)?)\s*x/g;
			for (const match of p.name.matchAll(filterReg)) {
				const number = parseFloat(match[1]);
				if (number < proxyCostMin || number > proxyCostMax) {
					return false;
				}
			}
			return true;
		});

		// 添加 emoji
		addProxyEmoji(allProxies);

		// 填充到配置
		clashConfig.proxies = allProxies;
		updateRules(clashConfig, customRules);
		updateProxyGroup(clashConfig);

		// 序列化输出
		const dumpString = yaml.dump(JSON.parse(JSON.stringify(clashConfig)), {
			indent: 2,
		});

		return c.text(dumpString, 200, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	} catch (error: any) {
		return c.text(`Internal Server Error: ${error.message}`, 500, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}
});
export default app;
