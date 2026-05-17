import { ClashConfig } from "./types";

export function buildProxyGroup(
	config: ClashConfig,
	requestParams: Record<string, any>,
) {
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
			proxies: [
				"🇭🇰 香港节点",
				"🇸🇬 狮城节点",
				"🇺🇸 美国节点",
				"🇯🇵 日本节点",
			],
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
			proxies: [
				"🇭🇰 香港节点",
				"🇸🇬 狮城节点",
				"🇺🇸 美国节点",
				"🇯🇵 日本节点",
			],
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
