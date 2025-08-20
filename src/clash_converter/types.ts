export interface ClashConfig {
	port?: number;
	socksPort?: number;
	redirPort?: number;
	mixedPort?: number;
	tproxyPort?: number;

	authentication?: string[];
	allowLan?: boolean;
	bindAddress?: string;
	mode?: "global" | "rule" | "direct";
	logLevel?: "info" | "warning" | "error" | "debug" | "silent";

	dns?: ClashDNS;
	proxies: ClashProxy[];
	proxyGroups?: ClashProxyGroup[];
	rules: string[];
}

export interface ClashDNS {
	enable?: boolean;
	listen?: string;
	ipv6?: boolean;
	defaultNameserver?: string[];
	enhancedMode?: "fake-ip" | "redir-host";
	nameserver?: string[];
	fallback?: string[];
	fallbackFilter?: {
		geoip?: boolean;
		ipcidr?: string[];
		domain?: string[];
	};
}

export interface ClashProxy {
	name: string;
	type: string;
	server: string;
	port: number;

	// 常见可选字段（不同 type 不同）
	cipher?: string;
	password?: string;
	uuid?: string;
	alterId?: number;
	tls?: boolean;
	skipCertVerify?: boolean;
	udp?: boolean;
	sni?: string;
	alpn?: string[];
	plugin?: string;
	pluginOpts?: Record<string, any>;
}

export interface ClashProxyGroup {
	name: string;
	type: "select" | "url-test" | "fallback" | "load-balance" | "relay";
	proxies?: string[];
	url?: string;
	interval?: number;
	tolerance?: number;
	lazy?: boolean;
}
