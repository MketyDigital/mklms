#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <hls-directory> <r2-bucket> <r2-prefix>"
  echo "Required env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
  exit 1
fi

SOURCE_DIR="${1%/}"
BUCKET="$2"
PREFIX="${3#/}"
PREFIX="${PREFIX%/}"

: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required because R2 exposes an S3-compatible API."
  echo "Install on Ubuntu with your preferred AWS CLI v2 package, then retry."
  exit 1
fi

if [ ! -s "$SOURCE_DIR/master.m3u8" ]; then
  echo "Missing HLS master playlist: $SOURCE_DIR/master.m3u8"
  exit 1
fi

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
DESTINATION="s3://${BUCKET}/${PREFIX}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

# Upload transport-stream segments with the correct media MIME type.
aws s3 cp "$SOURCE_DIR" "$DESTINATION" \
  --recursive \
  --endpoint-url "$ENDPOINT" \
  --exclude "*" --include "*.ts" \
  --content-type "video/mp2t" \
  --cache-control "public,max-age=31536000,immutable"

# Upload HLS manifests with the correct HLS MIME type.
aws s3 cp "$SOURCE_DIR" "$DESTINATION" \
  --recursive \
  --endpoint-url "$ENDPOINT" \
  --exclude "*" --include "*.m3u8" \
  --content-type "application/vnd.apple.mpegurl" \
  --cache-control "public,max-age=31536000,immutable"

# Upload any supporting files (poster/subtitles/etc.) without overwriting HLS files.
aws s3 cp "$SOURCE_DIR" "$DESTINATION" \
  --recursive \
  --endpoint-url "$ENDPOINT" \
  --exclude "*.ts" --exclude "*.m3u8" \
  --cache-control "public,max-age=31536000,immutable"

# Fail if the final master object cannot be found using the authenticated S3 API.
aws s3api head-object \
  --bucket "$BUCKET" \
  --key "$PREFIX/master.m3u8" \
  --endpoint-url "$ENDPOINT" >/dev/null

echo "R2 HLS upload verified."
echo "Private playback reference: ${PREFIX}/master.m3u8"
echo "Keep the bucket private; register this opaque path in MkLMS instead of exposing the S3 endpoint."
