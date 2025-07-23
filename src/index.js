import clashConverter from './clashConverter.js';
import googleBase64Favicon from './googleBase64Favicon.js';

export default {
	async fetch(request) {
		const pathname = new URL(request.url).pathname;
		const route = pathname.split('/')[1];
		switch (route) {
			case 'clash_converter':
				return clashConverter.fetch(request);
			case 'google_base64_favicon':
				return googleBase64Favicon.fetch(request);
		}
		return new Response('api not found', {
			status: 404,
		});
	},
};
