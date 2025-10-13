export interface ClashConfig {
	proxies: ClashProxy[];
	"proxy-groups"?: ClashProxyGroup[];
	rules: string[];
	dns: any;
}

export interface ClashProxy {
	name: string;
}

export interface ClashProxyGroup {
	name: string;
	type: "select" | "url-test" | "fallback" | "load-balance" | "relay";
	proxies?: string[];
	url?: string;
	interval?: number;
	tolerance?: number;
}
