export PATH := node_modules/.bin/:$(PATH)

SHELL = /bin/bash

all: serve

install:
	yarn install --no-save

deploy:
	@sls deploy -v

serve:
	@sls offline start

remove:
	@sls remove

lint:
	@eslint .

logs:
	@sls logs -f api
