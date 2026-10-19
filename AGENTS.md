# Homebox 协作约定

## 项目结构

- `web/`：React / TypeScript 前端，使用 pnpm 和 Rspack。
- `server/`：Rust 后端，提供静态页面、网络测速接口和 LLM 流式转发。
- `web/src/llm/`：LLM 协议、测速调度、指标及配置存储。
- `web/tests/`：Node 测试；后端测试位于 Rust 模块中。
- `build/static/`：前端构建产物，Rust 编译时嵌入；不要提交构建产物。
- `README.md` 面向使用者；开发启动、检查及构建命令放在 `DEVELOPMENT.md`。

## 沟通与界面

- 默认使用简洁中文。直接完成已授权工作，不反复确认常规改动。
- UI 保持简洁，不添加多余描述文字。指标解释放在问号中：桌面悬停提示，移动端点击弹窗。
- LLM 页面沿用网络测速的交互与样式，以网络测速为对齐基准。
- 同时考虑移动端、亮暗主题和中英文；检查按钮间距、换行与溢出。
- README 简述功能即可；Actix 等实现细节放在开发文档，不放进面向用户的说明。

## 开发与验证

启动步骤见 [DEVELOPMENT.md](./DEVELOPMENT.md)。前端端口为 `8086`，后端为 `3300`，前端将 `/api` 代理至后端。

- 启动前检查端口，复用已运行服务，不重复启动或随意结束用户进程。
- 用户要求持续预览时，使用独立后台进程，将日志输出到临时文件，避免临时终端退出后服务消失。记录 PID 和日志路径。
- 启动后验证前端页面及经前端代理的 `/api/ping`，确认响应正常后再报告成功。
- 首次编译后端前生成前端资源；修改前端后，生产二进制也需要重新构建。
- UI 改动验证实际页面和移动端布局，不仅依赖类型检查。验证不应消耗真实 LLM API 用量或覆盖用户配置、结果。
- 不提交密钥、个人配置、日志和临时测试文件。

按改动范围执行检查；功能 PR 提交前运行：

```bash
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
NODE_ENV=production pnpm build
cd ../server
cargo fmt --check
cargo test --locked
```

另运行 `git diff --check`。纯文档修改检查链接、命令和格式即可。不要为使检查通过而跳过失败项。

## Git 与 PR

- 默认基线为 `master`。
- 保留已有工作，避免混入无关改动；提交前检查 staged diff。
- 提交使用简短 Conventional Commits，例如 `feat: add LLM benchmarking`。
- 用户要求提交并创建 PR 时，完成验证、提交、推送和 PR 创建；创建后附上 PR 链接。
- PR 描述写清最终行为、必要限制和实际验证结果，不记录对话过程。
- 本地检查通过不代表 CI 通过；用 `gh pr checks` 确认远端状态。不要自动合并或发版。

## 发布流程

发布以 [.agents/skills/release/SKILL.md](./.agents/skills/release/SKILL.md) 为准。实际发版、打 tag 或发布 dry-run 前必须读取该技能，并核对当前工作流；以下是流程摘要。

1. 检查分支、工作区、目标 commit、最近稳定 tag，以及本地和远端是否已有目标 tag。
2. 根据上次发布后的变更准备简短、面向用户的 changelog。用户未指定版本时，默认建议下一个 patch；不要自行决定 minor 或 major。
3. 修改版本或推送前，展示版本、目标 commit、changelog、验证计划和远端影响，并取得明确发布确认。单独一句“发版”仅表示准备发布方案。
4. 确认后更新 `server/Cargo.toml` 和 `server/Cargo.lock` 中的 Homebox 版本；通过 Cargo 更新锁文件，不顺便升级依赖。不要修改 `web/package.json` 的独立版本号。
5. 运行上述前后端检查，审查发布 diff。版本有变化时创建独立 `chore: release v<version>` 提交。
6. Tag 名只使用 `v<version>`；annotated tag 的注释使用已确认的纯文本变更列表，不带 `#`、`##`、`###` 等 Markdown 标题。通过文件传入注释，推送前核对实际存储的内容及换行。每次实际推送前先 dry-run；先推分支，再显式推送该 tag。
7. 跟进 Build 和 Docker 两个 tag 工作流，核对 GitHub Release、说明和附件，以及镜像发布状态后报告完成。

当前发布机制：

- `.github/workflows/build.yml`：PR 运行前端检查与多平台构建；推送 `v*` tag 时额外通过 `script/pack-arch.sh` 创建 GitHub Release。发布说明来自 tag message（`--notes-from-tag`）。
- `.github/workflows/docker.yml`：推送 `v*` tag 时构建 amd64 / arm64 镜像并合并为 `xgheaven/homebox:latest`，当前不创建版本号镜像 tag。
- PR 的 `release-tag` 任务跳过属于正常情况，不代表发布失败。

发布 dry-run 不修改文件、提交或 tag，不执行真实推送。发布部分成功时报告准确远端状态，不自动删除或重打 tag。禁止未经单独明确授权的 force push、覆盖 tag 或删除发布。
