export PATH := node_modules/.bin/:$(PATH)

SHELL = /bin/bash

all: serve

install:
	yarn install

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

# only in circle ci
transcrypt:
	wget https://raw.githubusercontent.com/elasticdog/transcrypt/master/transcrypt -O node_modules/.bin/transcrypt
	chmod +x node_modules/.bin/transcrypt
	transcrypt -c aes-256-cbc -y -p $(TRANSCRYPT_KEY)
