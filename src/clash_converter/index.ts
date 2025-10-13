import { Hono } from "hono";
import yaml from "js-yaml";
import { ClashConfig } from "./types";

function updateProxyGroup(config: ClashConfig) {
	const proxies = (config.proxies || [])
		.filter((proxy) => {
			// 过滤掉小众节点
			if (
				!proxy.name.includes("🇭🇰") &&
				!proxy.name.includes("🇸🇬") &&
				!proxy.name.includes("🇺🇸") &&
				!proxy.name.includes("🇯🇵")
			) {
				return false;
			}
			// 过滤掉倍速节点
			const match = proxy.name.match(/.*(\d+)x.*/);
			return !match || match[1] === "1";
		})
		.map((proxy) => proxy.name);

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
			name: "🎯 全球直连",
			type: "select",
			proxies: ["DIRECT", "🚀 节点选择"],
		},
		{
			name: "🛑 全球拦截",
			type: "select",
			proxies: ["REJECT", "DIRECT"],
		},
		{
			name: "🐟 漏网之鱼",
			type: "select",
			proxies: ["🚀 节点选择", "🎯 全球直连"],
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
	];
	// 移除empty proxy-groups
	const validProxyGroups = config["proxy-groups"]
		.filter((group) => group.proxies?.length)
		.map((group) => group.name);
	config["proxy-groups"] = config["proxy-groups"].filter((group) =>
		validProxyGroups.includes(group.name)
	);
	config["proxy-groups"][0].proxies = config["proxy-groups"][0].proxies?.filter(
		(proxy) => validProxyGroups.includes(proxy)
	);
}

const app = new Hono();
app.get("/", async (c) => {
	const searchParams = c.req.query();
	// 参考 https://suburl.v1.mk
	const endpoint = searchParams["endpoint"] || "https://url.v1.mk/sub";
	const configParam =
		searchParams["config"] || "ACL4SSR_Online_Mini_AdblockPlus.ini";

	if (configParam.startsWith("ACL4SSR_Online_")) {
		searchParams[
			"config"
		] = `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/${configParam}`;
	}

	searchParams["target"] = "clash";
	searchParams["emoji"] = "true";

	try {
		const qs = new URLSearchParams(searchParams).toString();
		const resp = await fetch(`${endpoint}?${qs}`).then((r) => r.text());
		const clashConfig = yaml.load(resp) as ClashConfig;

		updateProxyGroup(clashConfig);

		// 避免yaml序列化出现ref字段, 使用JSON.parse(JSON.stringify)深拷贝打断此优化
		const dumpString = yaml.dump(JSON.parse(JSON.stringify(clashConfig)), {
			indent: 2,
		});

		return c.text(dumpString, 200, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	} catch (error: any) {
		return c.text(error.message, 400, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}
});
export default app;
