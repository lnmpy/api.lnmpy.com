import { Hono } from "hono";
import yaml from "js-yaml";
import { ClashConfig } from "./types";
import { buildProxyGroup } from "./buildProxyGroup";
import { buildRule } from "./buildRules";
import { buildProxy } from "./buildProxy";


async function loadR2Profile(
	requestParams: Record<string, string>,
	r2_storgae: R2Bucket,
): Promise<string> {
	const profile = requestParams["profile"];
	delete requestParams["profile"];
	if (!profile) {
		return "";
	}
	const profileObject = await r2_storgae.get(
		`clash_converter_profile/${profile}.yaml`,
	);
	if (!profileObject) {
		return "";
	}
	return profileObject.text();
}

async function loadR2Template(
	requestParams: Record<string, string>,
	r2_storgae: R2Bucket,
): Promise<string> {
	const template = requestParams["template"] || "base";
	delete requestParams["template"];
	const templateObject = await r2_storgae.get(
		`clash_converter_template/${template}.yaml`,
	);
	if (!templateObject) {
		throw new Error(`Template '${template}' not found`);
	}
	return templateObject.text();
}

const app = new Hono<{
	Bindings: {
		r2_storgae: R2Bucket;
	}
}>();
app.get("/", async (c) => {
	const requestParams: Record<string, any> = { ...c.req.query() };
	const profile = await loadR2Profile(requestParams, c.env.r2_storgae);
	if (!!profile) {
		return c.text(profile, 200, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}

	if (!requestParams["url"]) {
		return c.text("url parameter missing", 404, {
			"Content-Type": "text/plain;charset=utf-8",
		});
	}

	try {
		const clashConfig = yaml.load(await loadR2Template(requestParams, c.env.r2_storgae)) as ClashConfig;

		await buildProxy(clashConfig, requestParams, c.env.r2_storgae);
		if (clashConfig.proxies.length === 0) {
			return c.text("url no proxies", 400, {
				"Content-Type": "text/plain;charset=utf-8",
			});
		}
		await buildRule(clashConfig, requestParams, c.env.r2_storgae);
		buildProxyGroup(clashConfig, requestParams);

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
