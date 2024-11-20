bootstrap: bootstrap-web bootstrap-server

bootstrap-web:
	cd web && pnpm install --frozen-lockfile

bootstrap-server:
	# cd server && cargo check

run-server:
	cd server && cargo run

run-web:
	cd web && pnpm start

build-server:
	cd server && HOMEBOX_ENV=production cargo build --locked --release

build-web:
	cd web && pnpm run build

build: build-web build-server

build-arch:
	rustup target add $(TARGET)
	rustup toolchain install stable-$(TARGET)
	cd server && HOMEBOX_ENV=production cargo build --locked --release --target $(TARGET)
	mkdir -p build/arch
	cp server/target/$(TARGET)/release/homebox build/arch/homebox-$(FILE)

pack-arch:
	bash ./script/pack-arch.sh $(TAG)

build-all-arch: build-darwin build-windows build-linux build-android

build-darwin:
	make build-arch TARGET=aarch64-apple-darwin FILE=darwin-arm64
	make build-arch TARGET=x86_64-apple-darwin FILE=darwin-amd64

build-windows:
	make build-arch TARGET=x86_64-pc-windows-msvc FILE=windows-amd64.exe
	make build-arch TARGET=i686-pc-windows-msvc FILE=windows-386.exe

build-linux:
	make build-arch TARGET=x86_64-unknown-linux-gnu FILE=linux-amd64
	make build-arch TARGET=aarch64-unknown-linux-gnu FILE=linux-arm64
	make build-arch TARGET=i686-unknown-linux-gnu FILE=linux-386
