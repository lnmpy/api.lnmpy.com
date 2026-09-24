import { ClashConfig } from "./types";

export async function buildProxyGroup(
	config: ClashConfig,
	requestParams: Record<string, any>,
): Promise<ClashConfig> {
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
			name: "♻️ 自动选择",
			type: "url-test",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: [
				"🇭🇰 香港节点",
				"🇸🇬 狮城节点",
				"🇺🇸 美国节点",
				"🇯🇵 日本节点",
			],
			comment: `ss,vmess,vless等轻量协议优先使用该模式. 每隔internal秒进行测试, 若存在更优节点, 则切换到更优节点. 比较原则: 延迟小于 当前节点 + tolerance`,
		},
		{

			name: "🔁 故障转移",
			type: "fallback",
			url: "http://www.gstatic.com/generate_204",
			interval: 600,
			tolerance: 120,
			proxies: [
				"🇭🇰 香港节点",
				"🇸🇬 狮城节点",
				"🇺🇸 美国节点",
				"🇯🇵 日本节点",
			],
			comment: `trojan等较重协议优先使用该模式. 每隔internal秒进行测试, 若当前节点是否可用, 若不可用才切换至下一个节点. 可用原则: 延迟小于 最低延迟节点 + tolerance`
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
				["🇩🇪", "🇬🇧", "🇳🇱", "🇮🇹", "🇫🇷"].some((c) => n.includes(c)),
			),
		},
		{
			name: "GLOBAL",
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

	return config;
}
