import { newQuickJSWASMModule } from "quickjs-emscripten";
import { newVariant } from "quickjs-emscripten-core";
import baseVariant from "@jitl/quickjs-wasmfile-release-sync";
// @ts-ignore
import wasmModule from "@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm";
import { ClashConfig } from "./types";

/**
 * Fetches script content directly from a URL (e.g. Gist raw URL or script URL).
 */
async function fetchScriptFromUrl(url: string): Promise<string> {
	let fetchUrl = url.trim();
	const res = await fetch(fetchUrl, {
		headers: { "User-Agent": "ClashConverterWorker" },
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch extension script from URL (${res.status}): ${fetchUrl}`);
	}
	return await res.text();
}

/**
 * Loads external extension script from requestParams (gist or script URL) and safely executes main(config) in QuickJS WASM sandbox.
 */
export async function loadExtConfig(
	config: ClashConfig,
	requestParams: Record<string, any>,
	timeoutMs = 2000
): Promise<ClashConfig> {
	const scriptUrl = requestParams["script"];

	if (!scriptUrl || typeof scriptUrl !== "string" || !scriptUrl.trim()) {
		return config;
	}

	const scriptContent = await fetchScriptFromUrl(scriptUrl);
	if (!scriptContent) {
		return config;
	}

	// Build custom variant passing pre-compiled WASM module to bypass browser/Worker fetch restrictions
	const variant = newVariant(baseVariant, {
		wasmModule: (wasmModule as any)?.default || wasmModule,
	});

	const QuickJS = await newQuickJSWASMModule(variant);
	const vm = QuickJS.newContext();

	// Set interrupt handler for execution timeout protection
	const startTime = Date.now();
	vm.runtime.setInterruptHandler(() => {
		return Date.now() - startTime > timeoutMs;
	});

	try {
		const configJsonStr = JSON.stringify(config);

		const runnerCode = `
			(function() {
				var config = ${configJsonStr};
				${scriptContent}
				if (typeof main !== 'function') {
					throw new Error("Script does not define a 'main(config)' function.");
				}
				var updatedConfig = main(config);
				if (!updatedConfig || typeof updatedConfig !== 'object') {
					throw new Error("'main(config)' must return a valid config object.");
				}
				return JSON.stringify(updatedConfig);
			})();
		`;

		const resultHandle = vm.evalCode(runnerCode);
		if (resultHandle.error) {
			const errorObj = vm.dump(resultHandle.error);
			resultHandle.error.dispose();
			const errMsg = typeof errorObj === "object" && errorObj !== null && "message" in errorObj
				? (errorObj as any).message
				: String(errorObj);
			throw new Error(`Sandbox Execution Error: ${errMsg}`);
		}

		const jsonResult = vm.getString(resultHandle.value);
		resultHandle.value.dispose();

		return JSON.parse(jsonResult) as ClashConfig;
	} finally {
		vm.dispose();
	}
}
