import yaml from "js-yaml";
import { ClashConfig } from "./types";


async function loadR2Rules(
	requestParams: Record<string, string>,
	r2_storgae: R2Bucket,
): Promise<string[]> {
	const rules = (requestParams["rules"] || "").split("|");
	delete requestParams["rules"];
	let result: string[] = [];
	if (!rules) {
		return result;
	}
	for (const rule of rules) {
		const rs = await r2_storgae.get(`clash_converter_rule/${rule}.yaml`);
		if (!rs) {
			continue;
		}
		result.push(...(yaml.load(await rs.text()) as string[]));
	}
	return result;
}

export async function buildRule(
	config: ClashConfig,
	requestParams: Record<string, any>,
	r2_storgae: R2Bucket,
) {
	const customRules = await loadR2Rules(requestParams, r2_storgae);
	// 在模板 rules 前面添加自定义规则
	config.rules.unshift(...customRules);

	// 替换规则中的代理组名称
	config.rules = config.rules.map((r) =>
		r.replace("PROXY", "🚀 节点选择"),
	);
}
