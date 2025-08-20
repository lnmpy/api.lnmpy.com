import { Hono } from "hono";
import { cors } from "hono/cors";
import { StatusCode } from "hono/utils/http-status";

const app = new Hono();
app.use("*", cors());

app.get("/", async (c) => {
	let contentType = "text/plain;charset=utf-8";
	c.header("Content-Type", contentType);

	const url = new URL(c.req.url);
	const domain = url.searchParams.get("domain") || "";

	if (!domain) {
		return c.text("domain required", 400);
	}

	const faviconUrl = `https://www.google.com/s2/favicons?sz=96&domain=${domain}`;

	try {
		const response = await fetch(faviconUrl);
		console.log(response.headers);
		contentType =
			response.headers.get("content-type") || "application/octet-stream";
		if (!response.ok) {
			c.status(response.status as StatusCode);
			return c.text(response.statusText);
		}

		// Worker 环境里没有 Node.js Buffer，直接用 btoa/Uint8Array 转换即可
		const arrayBuffer = await response.arrayBuffer();
		const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

		return c.text(`data:${contentType};base64,${base64}`, 200);
	} catch (error: any) {
		return c.text(error.message, 400);
	}
});

export default app;
