app_dir = /home/abi/azonto

.PHONY : default
default:
	DEBUG="*,-connect:*,-express:*,-send" ./node_modules/.bin/nodemon .

.PHONY : update-deps
update-deps:
	npm prune
	npm install
	./node_modules/.bin/bower install

.PHONY : test
test:
	./node_modules/.bin/mocha

.PHONY : rebuild
rebuild:
	npm rebuild

.PHONY : deploy
deploy:
	ssh abi@66.175.221.170 -p 33333 make -f $(app_dir)/Makefile deploy-local

.PHONY : deploy-local
deploy-local:
	cd $(app_dir) && git pull
	sudo supervisorctl reload && sleep 3 && sudo supervisorctl restart all