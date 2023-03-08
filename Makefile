all: serve

install:
	yarn install --frozen-lockfile

deploy:
	@node_modules/.bin/sls deploy -v

serve:
	@node_modules/.bin/sls offline start

remove:
	@node_modules/.bin/sls remove

lint:
	@node_modules/.bin/eslint .

logs:
	@node_modules/.bin/sls logs -f api
