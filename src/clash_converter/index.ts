import { Hono } from "hono";
import yaml from "js-yaml";
import { ClashConfig } from "./types";

const pddRules = [
	"DOMAIN-SUFFIX,pddg.net,🎯 全球直连",
	"DOMAIN-SUFFIX,testdev.ltd,🎯 全球直连",
	"DOMAIN-SUFFIX,temu.team,🎯 全球直连",
	"DOMAIN-SUFFIX,htjdemo.net,🎯 全球直连",
	"DOMAIN-SUFFIX,kwcdn.com,🎯 全球直连",
	"DOMAIN-SUFFIX,pdd.net,🎯 全球直连",
	"DOMAIN-SUFFIX,test.net,🎯 全球直连",
	"DOMAIN-SUFFIX,yiran.com,🎯 全球直连",
	"DOMAIN-SUFFIX,pddpic.com,🎯 全球直连",
	"DOMAIN-SUFFIX,moremorepin.com,🎯 全球直连",
	"DOMAIN-SUFFIX,yangkeduo.com,🎯 全球直连",
	"DOMAIN-SUFFIX,pinduoduo.com,🎯 全球直连",
	"DOMAIN-SUFFIX,hutaojie.com,🎯 全球直连",
	"DOMAIN-SUFFIX,vgunxpkt.com,🎯 全球直连",

	// 国内网站, 被公司屏蔽, 从hk节点回源较快
	"DOMAIN-SUFFIX,docs.qq.com,🚀 节点选择",
	"DOMAIN-SUFFIX,processon.com,🚀 节点选择",
	"DOMAIN-SUFFIX,docin.com,🚀 节点选择",
	"DOMAIN-SUFFIX,douding.cn,🚀 节点选择",
	"DOMAIN-SUFFIX,office365.com,🚀 节点选择",
	"DOMAIN-SUFFIX,www.upyun.com,🚀 节点选择",
	"DOMAIN-SUFFIX,weibo.com,🚀 节点选择",
	"DOMAIN-SUFFIX,weibo.cn,🚀 节点选择",
	"DOMAIN-SUFFIX,maimai.cn,🚀 节点选择",
	"DOMAIN-SUFFIX,taou.com,🚀 节点选择",
	"DOMAIN-SUFFIX,zijieapi.com,🚀 节点选择",
	"DOMAIN-SUFFIX,live.com,🚀 节点选择",
];

const globalRules = [
	"DOMAIN-SUFFIX,account.jetbrains.com,REJECT", // 阻拦jetbrains激活
	"DOMAIN-SUFFIX,gvt1.com,REJECT", // 阻止google chrome自动更新
	"PROCESS-NAME,nsurlsessiond,REJECT", // 阻止后台进程大量下载

	"DOMAIN-SUFFIX,fonts.gstatic.com,🚀 节点选择",
	"DOMAIN-SUFFIX,adobe.com,🚀 节点选择",
];

function updateConfig(
	config: ClashConfig,
	rules: string[],
	disableDns: boolean = true
): string {
	if (Object.keys(rules).length === 0) return "";

	// 覆盖规则
	config.rules = [...rules, ...config.rules];

	// 禁用 DNS
	if (disableDns) {
		delete config.dns;
	}

	// 避免yaml序列化出现ref字段, 使用JSON.parse(JSON.stringify)深拷贝打断此优化
	return yaml.dump(JSON.parse(JSON.stringify(config)), { indent: 2 });
}

function filterValidRules(rules: string[], config: ClashConfig): string[] {
	const validProxies = config.proxies?.map((p) => p.name) || [];
	const validProxyGroups = config.proxyGroups?.map((p) => p.name) || [];
	const validActions = [
		"DIRECT",
		"REJECT",
		...validProxies,
		...validProxyGroups,
	];
	const validPrefix = [
		"DOMAIN-SUFFIX",
		"IP-CIDR",
		"DOMAIN-KEYWORD",
		"DOMAIN",
		"PROCESS-NAME",
	];

	return rules
		.filter((r) => validPrefix.includes(r.split(",")[0]))
		.filter((r) => validActions.includes(r.split(",")[2]));
}

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

	config.proxyGroups = [
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
	const validProxyGroups = config.proxyGroups
		.filter((group) => group.proxies?.length)
		.map((group) => group.name);
	config.proxyGroups = config.proxyGroups.filter((group) =>
		validProxyGroups.includes(group.name)
	);
	config.proxyGroups[0].proxies = config.proxyGroups[0].proxies?.filter(
		(proxy) => validProxyGroups.includes(proxy)
	);
}

const app = new Hono();
app.get("/", async (c) => {
	const searchParams = c.req.query();

	const profile = searchParams["profile"] || "";
	// 参考 https://suburl.v1.mk
	const endpoint = searchParams["endpoint"] || "https://sub.xeton.dev/sub";
	const configParam =
		searchParams["config"] || "ACL4SSR_Online_Mini_AdblockPlus.ini";

	if (configParam.startsWith("ACL4SSR_Online_")) {
		searchParams[
			"config"
		] = `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/${configParam}`;
	}

	searchParams["target"] = "clash";
	searchParams["emoji"] = "true";

	let disableDns = searchParams["disable_dns"] !== "false";

	try {
		const qs = new URLSearchParams(searchParams).toString();
		const resp = await fetch(`${endpoint}?${qs}`).then((r) => r.text());
		const clashConfig = yaml.load(resp) as ClashConfig;

		let rules = filterValidRules(globalRules, clashConfig);
		updateProxyGroup(clashConfig);

		if (profile === "pdd") {
			rules = [...rules, ...filterValidRules(pddRules, clashConfig)];
			disableDns = true; // 公司网络需使用内置dns
		}

		return c.text(updateConfig(clashConfig, rules, disableDns), 200, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	} catch (error: any) {
		return c.text(error.message, 400, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}
});
export default app;
