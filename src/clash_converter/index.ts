import { Hono, Context } from "hono";
import yaml from "js-yaml";
import { ClashConfig } from "./types";
import { providers } from "./config.json";

function updateProxy(
	config: ClashConfig,
	requestParams: Record<string, string>
) {
	const multiMin = parseFloat(requestParams["node_cost_min"]);
	const multiMax = parseFloat(requestParams["node_cost_max"]);
	if (!config.proxies) {
		return;
	}
	config.proxies = config.proxies.filter((n) => {
		const filterReg = /(\d+(?:\.\d+)?)\s*x/g; // 匹配基于 1.7x  0.9x  3x 这样的倍率定义
		for (const match of n.name.matchAll(filterReg)) {
			const numberStr = match[1];
			const number = parseFloat(numberStr);
			if (number < multiMin || number > multiMax) {
				return false;
			}
		}
		return true;
	});
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
			proxies: proxies.filter((n) => n.includes("🇭🇰")),
		},
		{
			name: "🇸🇬 狮城节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("🇸🇬")),
		},
		{
			name: "🇺🇸 美国节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("🇺🇸")),
		},
		{
			name: "🇯🇵 日本节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) => n.includes("🇯🇵")),
		},
		{
			name: "🇪🇺 欧洲节点",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: proxies.filter((n) =>
				["🇩🇪", "🇬🇧", "🇳🇱", "🇸🇪", "🇫🇷", "🇩🇪"].some((c) => n.includes(c))
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
				(proxy) => !emptyProxyGroups.includes(proxy)
			),
		}));
}

function updateRule(config: ClashConfig, rules: string[]) {
	config.rules.unshift(...rules);

	// 遍历所有的rule将其中的全球拦截等规则替换, 减少proxy-groups的数量
	config.rules = config.rules.map((r) => r.replace("🛑 全球拦截", "REJECT"));
	config.rules = config.rules.map((r) => r.replace("🎯 全球直连", "DIRECT"));
	config.rules = config.rules.map((r) =>
		r.replace("🐟 漏网之鱼", "🚀 节点选择")
	);
}

// 将形如{运通}=token的形式替换为对应的endpoint, 减少多设备间的维护
function replaceUrlVar(urlParam: string) {
	if (!urlParam) {
		return urlParam;
	}
	const matches = [...urlParam.matchAll(/\{([^}]+)\}/g)];
	let newUrlParam = urlParam;
	for (const m of matches) {
		const key = m[1];
		const val = providers[key as keyof typeof providers];
		if (val) {
			newUrlParam = newUrlParam.replace(`{${key}}=`, val);
		}
	}
	return newUrlParam;
}

async function loadR2Profile(
	c: Context,
	requestParams: Record<string, string>
): Promise<string> {
	const profile = requestParams["profile"];
	delete requestParams["profile"];
	if (!profile) {
		return "";
	}
	const profileObject = await c.env.r2_storgae.get(
		`clash_converter_profile/${profile}.yaml`
	);
	if (!profileObject) {
		return "";
	}
	return profileObject.text();
}

async function loadR2Rules(
	c: Context,
	requestParams: Record<string, string>
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

	const rules = await loadR2Rules(c, requestParams);

	requestParams["url"] = replaceUrlVar(requestParams["url"]);
	if (!requestParams["url"]) {
		return c.text("url parameter missing", 404, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}

	// 默认参数
	// 转换服务 参考 https://acl4ssr-sub.github.io
	const endpoint = requestParams["endpoint"] || "https://sub.xeton.dev/sub";
	const configParam =
		requestParams["config"] || "ACL4SSR_Online_Mini_AdblockPlus.ini";
	if (configParam.startsWith("ACL4SSR_Online_")) {
		requestParams[
			"config"
		] = `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/${configParam}`;
	}
	requestParams["node_cost_min"] = requestParams["node_cost_min"] || "0";
	requestParams["node_cost_max"] = requestParams["node_cost_max"] || "2";
	requestParams["target"] = "clash";
	requestParams["emoji"] = "true";

	try {
		const qs = new URLSearchParams(requestParams).toString();
		const resp = await fetch(`${endpoint}?${qs}`).then((r) => r.text());
		const clashConfig = yaml.load(resp) as ClashConfig;

		if (!clashConfig || !clashConfig.rules) {
			throw Error("Config invalid");
		}

		updateRule(clashConfig, rules);
		updateProxy(clashConfig, requestParams);
		updateProxyGroup(clashConfig);

		// 避免yaml序列化出现ref字段, 使用JSON.parse(JSON.stringify)深拷贝打断此优化
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
