import yaml from "js-yaml";

/**
 * 解码可能经过 URL-Safe Base64 编码的链接字符串
 */
export function decodeTargetUrl(encodedUrl: string): string {
	try {
		let base64 = encodedUrl.replace(/-/g, "+").replace(/_/g, "/");
		while (base64.length % 4 !== 0) {
			base64 += "=";
		}
		const decoded = atob(base64);
		if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
			return decoded;
		}
	} catch {
		// 解码失败时保持原始字符串
	}
	return encodedUrl;
}

const CLASH_CLASSICAL_TYPES = [
	"DOMAIN",
	"DOMAIN-SUFFIX",
	"DOMAIN-KEYWORD",
	"IP-CIDR",
	"IP-CIDR6",
	"SRC-IP-CIDR",
	"GEOIP",
	"MATCH",
	"SRC-PORT",
	"DST-PORT",
	"PROCESS-NAME",
];

/**
 * 转换规则集内容为目标格式列表
 */
export function parseRulesetContent(rawText: string, type: number): string[] {
	const trimmedText = rawText.trim();
	// 若上游本身已经是 payload 格式的 YAML，提取其元素
	if (trimmedText.startsWith("payload:")) {
		try {
			const parsed = yaml.load(trimmedText) as { payload?: any[] };
			if (parsed && Array.isArray(parsed.payload)) {
				if (type === 6) {
					return parsed.payload.map((item) => String(item).trim());
				}
				// 针对现有 YAML 列表重新转换为单行文本依次处理
				rawText = parsed.payload.map((item) => String(item).trim()).join("\n");
			}
		} catch {
			// 解析失败时回退到逐行处理
		}
	}

	const lines = rawText.split(/\r?\n/);
	const payload: string[] = [];

	for (let line of lines) {
		line = line.trim();
		if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("//")) {
			continue;
		}

		// 剔除行内双斜杠注释
		const commentIndex = line.indexOf("//");
		if (commentIndex !== -1) {
			line = line.substring(0, commentIndex).trim();
		}

		if (type === 4) {
			// Clash ipcidr rule-provider
			if (line.startsWith("IP-CIDR,") || line.startsWith("IP-CIDR6,")) {
				const parts = line.split(",");
				if (parts[1]) {
					payload.push(parts[1].trim());
				}
			} else if (line.includes("/") && !line.includes(",")) {
				// 纯 CIDR 行直接保留
				payload.push(line);
			}
		} else if (type === 3) {
			// Clash domain rule-provider
			if (line.startsWith("DOMAIN-SUFFIX,")) {
				const parts = line.split(",");
				if (parts[1]) {
					payload.push(`+.${parts[1].trim()}`);
				}
			} else if (line.startsWith("DOMAIN,")) {
				const parts = line.split(",");
				if (parts[1]) {
					payload.push(parts[1].trim());
				}
			} else if (!line.includes(",") && (line.startsWith("+.") || line.startsWith("."))) {
				payload.push(line.startsWith(".") ? `+${line}` : line);
			} else if (!line.includes(",")) {
				payload.push(line);
			}
		} else if (type === 6) {
			// Clash classical rule-provider
			const isValid = CLASH_CLASSICAL_TYPES.some((ruleType) =>
				line.startsWith(`${ruleType},`)
			);
			if (isValid) {
				payload.push(line);
			}
		}
	}

	return payload;
}

/**
 * 处理 ruleset 获取与转换请求
 */
export async function handleGetRuleset(
	requestUrlParam?: string,
	requestTypeParam?: string,
): Promise<string> {
	if (!requestUrlParam) {
		throw new Error("url parameter missing");
	}

	const targetUrl = decodeTargetUrl(requestUrlParam);
	const typeNumber = parseInt(requestTypeParam || "4", 10);

	const response = await fetch(targetUrl, {
		headers: {
			"User-Agent": "ClashMeta/1.8.0",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch upstream rules: ${response.status} ${response.statusText}`);
	}

	const rawContent = await response.text();
	const payload = parseRulesetContent(rawContent, typeNumber);

	return yaml.dump({ payload }, { indent: 2, lineWidth: -1 });
}
