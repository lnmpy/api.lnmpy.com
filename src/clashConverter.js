import yaml from 'js-yaml';

const pddRules = {
	'pddg.net': 'DIRECT',
	'testdev.ltd': 'DIRECT',
	'temu.team': 'DIRECT',
	'htjdemo.net': 'DIRECT',
	'kwcdn.com': 'DIRECT',
	'pdd.net': 'DIRECT',
	'test.net': 'DIRECT',
	'yiran.com': 'DIRECT',
	'pddpic.com': 'DIRECT',
	'moremorepin.com': 'DIRECT',
	'yangkeduo.com': 'DIRECT',
	'pinduoduo.com': 'DIRECT',
	'hutaojie.com': 'DIRECT',
	'vgunxpkt.com': 'DIRECT',

	// 国内网站, 被公司屏蔽, 从hk节点回源较快
	'zijieapi.com': '🇭🇰 香港节点',
	'docs.qq.com': '🇭🇰 香港节点',
	'processon.com': '🇭🇰 香港节点',
	'docin.com': '🇭🇰 香港节点',
	'douding.cn': '🇭🇰 香港节点',
	'live.com': '🇭🇰 香港节点',
	'office365.com': '🇭🇰 香港节点',
	'www.upyun.com': '🇭🇰 香港节点',
	'weibo.com': '🇭🇰 香港节点',
	'weibo.cn': '🇭🇰 香港节点',
	'maimai.cn': '🇭🇰 香港节点',
	'taou.com': '🇭🇰 香港节点',
};

const globalRules = {
	'account.jetbrains.com': 'REJECT', // 阻拦jetbrains激活

	'fonts.gstatic.com': '🐟 漏网之鱼',
	'adobe.com': '🐟 漏网之鱼',
};

function updateConfig(config, rules, disableDns = false) {
	if (Object.keys(rules).length === 0) return;

	// 覆盖规则
	config.rules = config.rules.filter((rule) => {
		return !(rule.startsWith('DOMAIN-SUFFIX,') && rules[rule.split(',')[1]]);
	});

	const newRules = Object.entries(rules).map(([domain, proxy]) => `DOMAIN-SUFFIX,${domain},${proxy}`);
	config.rules = [...newRules, ...config.rules];

	// 禁用 DNS
	if (disableDns) {
		delete config.dns;
	}

	return yaml.dump(config, { indent: 2 });
}

function filterValidRules(rules, config) {
	const validProxies = config.proxies?.map((p) => p.name) || [];
	const validProxyGroups = config['proxy-groups']?.map((p) => p.name) || [];
	const validActions = ['DIRECT', 'REJECT', ...validProxies, ...validProxyGroups];

	return Object.fromEntries(Object.entries(rules).filter(([_, action]) => validActions.includes(action)));
}

function updateProxyGroup(config) {
	const proxies = config.proxies || [];
	const baseCostProxies = proxies
		.filter((proxy) => {
			const match = proxy.name.match(/.*(\d+)x.*/);
			return !match || match[1] === '1';
		})
		.map((proxy) => proxy.name);

	config['proxy-groups'] = [
		{
			name: '🚀 节点选择',
			type: 'select',
			proxies: ['♻️ 自动选择', '🚀 手动切换', '🇭🇰 香港节点', '🇸🇬 狮城节点', '🇺🇸 美国节点', '🇯🇵 日本节点'],
		},
		{
			name: '♻️ 自动选择',
			type: 'url-test',
			url: 'http://www.gstatic.com/generate_204',
			interval: 300,
			tolerance: 50,
			proxies: baseCostProxies,
		},
		{
			name: '🚀 手动切换',
			type: 'select',
			proxies: proxies.map((p) => p.name),
		},
		{
			name: '🎯 全球直连',
			type: 'select',
			proxies: ['DIRECT', '🚀 节点选择'],
		},
		{
			name: '🛑 全球拦截',
			type: 'select',
			proxies: ['REJECT', 'DIRECT'],
		},
		{
			name: '🐟 漏网之鱼',
			type: 'select',
			proxies: ['🚀 节点选择', '🎯 全球直连'],
		},
		{
			name: '🇭🇰 香港节点',
			type: 'url-test',
			url: 'http://www.gstatic.com/generate_204',
			interval: 300,
			tolerance: 50,
			proxies: baseCostProxies.filter((n) => n.includes('🇭🇰')),
		},
		{
			name: '🇸🇬 狮城节点',
			type: 'url-test',
			url: 'http://www.gstatic.com/generate_204',
			interval: 300,
			tolerance: 50,
			proxies: baseCostProxies.filter((n) => n.includes('🇸🇬')),
		},
		{
			name: '🇺🇸 美国节点',
			type: 'url-test',
			url: 'http://www.gstatic.com/generate_204',
			interval: 300,
			tolerance: 50,
			proxies: baseCostProxies.filter((n) => n.includes('🇺🇸')),
		},
		{
			name: '🇯🇵 日本节点',
			type: 'url-test',
			url: 'http://www.gstatic.com/generate_204',
			interval: 300,
			tolerance: 50,
			proxies: baseCostProxies.filter((n) => n.includes('🇯🇵')),
		},
	];
}
export default {
	async fetch(request) {
		const searchParams = new URL(request.url).searchParams;
		const profile = searchParams.get('profile') || '';
		// 参考 https://suburl.v1.mk
		const endpoint = searchParams.get('endpoint') || 'https://sub.xeton.dev/sub';
		const configParam = searchParams.get('config') || 'ACL4SSR_Online_Mini_AdblockPlus.ini';

		if (configParam.startsWith('ACL4SSR_Online_')) {
			searchParams.set('config', `https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/${configParam}`);
		}
		searchParams.set('target', 'clash');
		searchParams.set('emoji', 'true');
		let disableDns = searchParams.get('disable_dns') === 'true';
		try {
			const resp = await fetch(endpoint + '?' + searchParams.toString()).then((r) => r.text());
			const clashConfig = yaml.load(resp);
			let rules = filterValidRules(globalRules, clashConfig);
			updateProxyGroup(clashConfig);

			if (profile === 'pdd') {
				rules = { ...rules, ...filterValidRules(pddRules, clashConfig) };
				disableDns = true; // 公司网络需使用内置dns
			}

			return new Response(updateConfig(clashConfig, rules, disableDns), {
				status: 200,
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
			});
		} catch (error) {
			return new Response(error.message, {
				status: 400,
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
			});
		}
	},
};
