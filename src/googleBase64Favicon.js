import { Buffer } from 'node:buffer';

export default {
	async fetch(request) {
		let contentType = 'text/plain;charset=utf-8';
		const searchParams = new URL(request.url).searchParams;
		const domain = searchParams.get('domain') || '';
		if (!domain) {
			return new Response('domain required', {
				status: 400,
				headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
			});
		}

		const faviconUrl = `https://www.google.com/s2/favicons?sz=96&domain=${domain}`;

		try {
			const response = await fetch(faviconUrl);
			contentType = response.headers.get('content-type') || 'application/octet-stream';
			if (!response.ok) {
				return new Response(response.statusText, {
					status: response.status,
					headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
				});
			}
			const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
			return new Response(`data:${contentType};base64,${base64}`, {
				status: 200,
				headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
			});
		} catch (error) {
			return new Response(error.message, {
				status: 400,
				headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
			});
		}
	},
};
