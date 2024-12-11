import clashConverter from './clashConverter.js';

export default {
	async fetch(request) {
		const pathname = new URL(request.url).pathname;
        const route = pathname.split('/')[1];
        switch (route) {
            case 'clash_converter':
                return clashConverter.fetch(request);
        }
        return new Response('api not found', {
            status: 404
        });
	},
  };
  