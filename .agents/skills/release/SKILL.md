---
name: release
description: >
  Prepare, verify, and publish Homebox releases through the repository's tag-driven GitHub
  Actions workflow. Use whenever the user says “发版”, “发布版本”, “release”, “打 tag”,
  “推 tag”, or invokes /release or $release, including dry-run requests. Always present and
  obtain explicit confirmation of the version, target commit, changelog, validation plan, and
  remote publishing effects before changing version files, creating a tag, or pushing anything.
---

# Homebox Release

Treat a bare “发版” or `/release` as a request to prepare a release proposal, not as permission
to publish. Keep all work read-only until the confirmation gate passes.

## 1. Inspect the release candidate

Run read-only checks and summarize the result:

- Confirm the repository root, current branch, upstream, `HEAD`, and worktree status.
- Fetch no refs unless needed; use `git ls-remote` to check the remote tag without mutating refs.
- Find the latest stable `vMAJOR.MINOR.PATCH` tag and list commits from it through `HEAD`.
- Read the package versions from `server/Cargo.toml` and the `homebox` package entry in
  `server/Cargo.lock`.
- Verify that the proposed tag is absent locally and remotely.
- Inspect `.github/workflows/build.yml`, `.github/workflows/docker.yml`, `Makefile`, and
  `script/pack-arch.sh` if they changed since the previous release.
- Stop and explain any unrelated dirty worktree changes; never overwrite or include them by
  assumption.

Suggest the next patch version after the latest stable tag unless the user supplied a version.
If the commits could justify a minor or major bump, show that as an alternative with a short
reason, but keep the patch version as the default until the user chooses otherwise. Tags include
the `v` prefix; Cargo versions do not. Do not update `web/package.json`, whose historical version
is independent.

When beta is requested, use `vMAJOR.MINOR.PATCH-beta.N` (start at 1, increment for
subsequent betas of the same target version), and set Cargo's version to the same value
without `v`. Preserve an explicitly supplied valid beta version. The publishing scripts
also accept `vMAJOR.MINOR.PATCH-beta`. Beta publishes a GitHub prerelease and Docker
`:beta`, never `:latest`; stable versions publish Docker `:latest`. Unsupported prerelease
suffixes are rejected rather than routed to stable. Inspect existing beta tags before
suggesting a number and include the channel in the confirmation preview.

## 2. Draft the changelog

Draft concise, user-facing release notes from the commits and diffs since the previous release.
Use a short plain-text list of changes. Do not add Markdown headings (`#`, `##`, `###`),
bold markers, or code fences to the tag message. If grouping is useful, use plain labels
such as `Features:` or `Fixes:`. The tag name itself must be only the version, e.g. `v0.1.3`.
Omit merge mechanics and low-value internal detail unless it affects users or release artifacts.
Preserve issue or PR numbers when useful. Clearly label the changelog as a draft the user can edit.

## 3. Require explicit confirmation

Show one release preview in this form before making any change:

```text
发布确认（当前尚未修改或推送任何内容）
- 版本：0.1.2
- Tag：v0.1.2（annotated tag）
- 目标：master @ <short-sha>
- 版本文件：server/Cargo.toml、server/Cargo.lock
- Changelog：
  - ...
- 本地验证：<commands/checks>
- 远端动作：推送 release commit（如需要）和 tag；触发 Build、Docker、GitHub Release
- 发布渠道：stable / beta（beta 的 GitHub Release 标记为 prerelease）
- Docker：stable 更新 xgheaven/homebox:latest；beta 仅更新 xgheaven/homebox:beta，不创建版本镜像 tag

请回复“确认发版”，或指出要修改的版本号、Changelog 或发布范围。
```

Do not treat the triggering phrase, silence, or an ambiguous acknowledgment as confirmation.
If the user chooses `dry-run`, perform only read-only validation and push dry-runs; do not edit,
commit, create tags, or push. If the user chooses “只准备”, update and validate locally only to
the explicitly confirmed extent, then stop before committing or tagging.

## 4. Prepare and validate after confirmation

Recheck that `HEAD`, worktree state, and tag availability still match the preview. Then:

1. Update the `[package]` version in `server/Cargo.toml`.
2. Regenerate `server/Cargo.lock` through Cargo so its `homebox` version matches; do not make a
   broad dependency update.
3. Review the diff and ensure it contains only confirmed release changes.
4. Run `git diff --check` and the repository's current frontend lint, typecheck, format check,
   build, and Rust locked test/check commands. Report failures without bypassing them.
5. Create a focused `chore: release v<version>` commit only when version files needed a new
   commit. Never fold unrelated changes into it.

Use the current CI definitions as the source of truth for exact validation commands. A successful
local check cannot prove every cross-platform matrix build will pass.

## 5. Tag and publish

Match the historical release mechanism:

1. Ensure the release commit is on the intended branch and pushed when necessary.
2. Create an annotated `v<version>` tag whose message contains the confirmed plain-text
   changelog. Write the message to a temporary UTF-8 file and pass it with `git tag -a
   <tag> -F <file>`. Before pushing, inspect `git for-each-ref --format='%(contents)'
   refs/tags/<tag>` to verify the stored text and line breaks; do not use Markdown
   headings in the message, since `--notes-from-tag` reuses it as release notes.
3. Run a push dry-run before each real push.
4. Push the branch first when a release commit was created, then push the tag explicitly.
5. Never use force push, replace an existing tag, or delete a tag without separate explicit
   approval.

Pushing the tag triggers:

- `.github/workflows/build.yml` to build platform archives and create the GitHub Release through
  `make pack-arch` / `gh release create --notes-from-tag`.
- `.github/workflows/docker.yml` to build amd64 and arm64 images and update
  `xgheaven/homebox:latest` for stable releases or `xgheaven/homebox:beta` for betas.
  Beta GitHub Releases use `--prerelease --latest=false`.

## 6. Verify completion

Monitor both tag-triggered workflows to completion. Verify the GitHub Release exists, its notes
match the confirmed changelog as closely as the workflow permits, and the expected archives are
attached. For beta, verify the prerelease flag and `:beta` image; confirm it did not
replace the stable latest release or Docker `:latest`. Report workflow and release links plus any failed matrix targets.

If publishing partially succeeds, stop and describe the exact remote state. Do not delete or
retarget the release/tag as an automatic recovery step.

## Historical precedent

Use `v0.1.1` as the stable precedent: its annotated tag points to commit `fdfad43`, that commit
changed both Cargo version records from `0.1.0` to `0.1.1`, and the tag-triggered workflow created
the GitHub Release assets. Older development tags use `v<version>-dev.<timestamp>`, but do not
infer a prerelease format unless the user requests one.
