# 开发指南

后端使用 Rust / Actix Web，前端使用 React / TypeScript 和 Rspack。

需要 Node.js、pnpm（项目指定版本为 9.12.2）和 Rust / Cargo。以下命令从仓库根目录执行。

首次启动前安装前端依赖并生成静态资源；Rust 编译时会嵌入 `build/static`：

```bash
cd web
pnpm install --frozen-lockfile
NODE_ENV=production pnpm build
cd ..
```

分别在两个终端启动后端和前端，开发期间保持终端运行：

```bash
# 终端 1：后端接口
cd server
cargo run --locked -- serve --host 127.0.0.1 --port 3300
```

```bash
# 终端 2：前端开发服务（热更新）
cd web
pnpm start
```

访问 `http://127.0.0.1:8086/#/llm` 或 `http://127.0.0.1:8086/#/network`。前端将 `/api` 请求代理到 `127.0.0.1:3300`。修改 Rust 代码后需要重启后端。

## 检查与构建

```bash
cd web
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
NODE_ENV=production pnpm build
cd ../server
cargo test --locked
cargo build --locked --release
```

以上构建命令使用 POSIX shell 的环境变量语法。构建后可运行 `server/target/release/homebox serve`（Windows 为 `.exe`），直接在 3300 端口提供页面和接口，无需前端开发服务。修改前端后，应先重新生成静态资源，再构建后端二进制。

## 发布渠道

发布操作遵循 `.agents/skills/release/SKILL.md`，需先确认版本与发布范围。

| Git tag | GitHub Release | Docker tag |
| --- | --- | --- |
| `v1.2.3` | 正式发布 | `latest` |
| `v1.2.3-beta.1`（也支持 `-beta`） | 预发布，不替换 Latest | `beta` |

Cargo 版本保留 beta 后缀但不带 `v`。其他预发布后缀暂不支持，脚本会拒绝发布。Docker 不创建版本号镜像 tag。

运行 `python3 script/test-release.py` 可离线验证渠道判断和 Release 命令参数，不会执行真实发布。
