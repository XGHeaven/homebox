#!/usr/bin/env bash
set -euo pipefail

tag="${1##*/}"
channel=$(bash "$(dirname "$0")/release-channel.sh" "$tag")
release_title="${tag#v}"
release_flags=(--title "$release_title" --notes-from-tag)
if [[ "$channel" == beta ]]; then
  release_flags+=(--prerelease --latest=false)
fi

mkdir -p ./build/pack
cd ./build/arch
for file in *; do
  filename=$(basename "$file")
  tar czf "../pack/$filename.tar.gz" "$file"
done

assets=( )

cd ../pack
for file in *; do
  echo $file
  assets+=("$file")
done

gh release create "$tag" "${release_flags[@]}" "${assets[@]}"
