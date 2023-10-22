tag="$1"

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

gh release create "${tag##*/}" --notes-from-tag "${assets[@]}"
