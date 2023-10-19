bootstrap: bootstrap-web bootstrap-server

bootstrap-web:
	cd web && pnpm install

bootstrap-server:
	go install github.com/go-bindata/go-bindata/...@v3
	cd server && go mod download

run-server:
	cd server && go run .

run-web:
	cd web && npm start

build-server: build-assets
	cd server && CGO_ENABLED=0 go build -ldflags "-X main.ENV=production" -o ../build/server ./

build-web:
	cd web && pnpm run build

build-assets:
	go-bindata -fs -o server/assets.go -prefix build/static build/static

build-dev-assets:
	# go-bindata -fs -debug -o server/assets.go -prefix build/static build/static
	go-bindata -fs -o server/assets.go -prefix build/static build/static

build: build-web build-server

build-arch:
	cd server && GOOS=$(OS) GOARCH=$(ARCH) CGO_ENABLED=0 go build -ldflags "-X main.ENV=production" -o ../build/arch/server-$(OS)-$(ARCH)$(EXT) ./

pack-arch:
	bash ./script/pack-arch.sh $(TAG)

build-all-arch: build-darwin build-window build-linux

build-darwin:
	make build-arch OS=darwin ARCH=amd64

build-window:
	make build-arch OS=windows ARCH=amd64 EXT=.exe

build-linux:
	make build-arch OS=linux ARCH=amd64
	make build-arch OS=linux ARCH=arm
	make build-arch OS=linux ARCH=arm64
	make build-arch OS=linux ARCH=mips
	make build-arch OS=linux ARCH=386

build-android:
	make build-arch OS=android ARCH=amd64
	make build-arch OS=android ARCH=arm
	make build-arch OS=android ARCH=386
