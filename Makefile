run-server:
	cd server && go run main.go

build-server:
	cd server && CGO_ENABLED=0 go build -ldflags "-X main.ENV=production" -o ../build/server main.go

build-web:
	cd web && npm run build

build: build-server build-web
