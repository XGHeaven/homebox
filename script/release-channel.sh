#!/usr/bin/env bash
# Resolve the publishing channel; reject unknown prereleases before publishing.
set -euo pipefail
release_tag="${1##*/}"
if [[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  printf '%s\n' latest
elif [[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-beta(\.[0-9]+)?$ ]]; then
  printf '%s\n' beta
else
  printf 'Unsupported release tag: %s\n' "$release_tag" >&2
  exit 1
fi
