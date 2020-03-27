bootstrap:
	cd server && go mod download
	cd web && npm i
	mkdir -p build/static
	make build-dev-assets

run-server:
	cd server && go run .

build-server: build-assets
	cd server && CGO_ENABLED=0 go build -ldflags "-X main.ENV=production" -o ../build/server ./

build-web:
	cd web && npm run build

build-assets:
	go-bindata -fs -o server/assets.go -prefix build/static build/static

build-dev-assets:
	go-bindata -fs -debug -o server/assets.go -prefix build/static build/static

build: build-web build-server
