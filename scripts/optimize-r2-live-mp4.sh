#!/usr/bin/env bash
# Run on a trusted GitHub Actions runner with scoped R2 S3 credentials.
# Never overwrites the source and never modifies an MkLMS media record.
set -Eeuo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <source-r2-object-key> <quality-crf:18|20|22> <unique-output-key>" >&2
  exit 2
fi
SOURCE_KEY="$1"
CRF="$2"
OUTPUT_KEY="$3"

[[ "$SOURCE_KEY" =~ ^media/[a-zA-Z0-9_/-]+\.mp4$ ]] || { echo "Invalid source MP4 key" >&2; exit 2; }
[[ "$OUTPUT_KEY" =~ ^media/optimized/[a-zA-Z0-9_/-]+\.mp4$ ]] || { echo "Invalid optimized MP4 key" >&2; exit 2; }
[[ "$SOURCE_KEY" != *".."* && "$OUTPUT_KEY" != *".."* && "$SOURCE_KEY" != *"//"* && "$OUTPUT_KEY" != *"//"* ]] || { echo "Unsafe object key" >&2; exit 2; }
[[ "$SOURCE_KEY" != "$OUTPUT_KEY" ]] || { echo "Output must differ from original" >&2; exit 2; }
[[ "$CRF" == 18 || "$CRF" == 20 || "$CRF" == 22 ]] || { echo "CRF must be 18, 20 or 22" >&2; exit 2; }

: "${R2_ACCOUNT_ID:?Missing R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?Missing R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Missing R2_SECRET_ACCESS_KEY}"
: "${R2_BUCKET:?Missing R2_BUCKET}"
[[ "$R2_ACCOUNT_ID" =~ ^[a-fA-F0-9]{32}$ ]] || { echo "Invalid Cloudflare account ID" >&2; exit 2; }
[[ "$R2_BUCKET" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]] || { echo "Invalid bucket name" >&2; exit 2; }

for command in aws ffmpeg ffprobe python3; do
  command -v "$command" >/dev/null || { echo "Required program missing: $command" >&2; exit 2; }
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
export AWS_EC2_METADATA_DISABLED=true
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
INPUT="$WORKDIR/original.mp4"
OUTPUT="$WORKDIR/optimized.mp4"

# Guard against running out of disk on GitHub's standard hosted runner.
source_bytes="$(aws s3api head-object --bucket "$R2_BUCKET" --key "$SOURCE_KEY" --endpoint-url "$ENDPOINT" --query ContentLength --output text)"
[[ "$source_bytes" =~ ^[0-9]+$ ]] || { echo "Could not determine source size" >&2; exit 1; }
(( source_bytes > 0 && source_bytes <= 2147483648 )) || { echo "Source outside safe 1 byte - 2 GiB range for hosted runner" >&2; exit 1; }

# Output key includes GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT. Never overwrite.
if aws s3api head-object --bucket "$R2_BUCKET" --key "$OUTPUT_KEY" --endpoint-url "$ENDPOINT" >/dev/null 2>&1; then
  echo "Refusing to overwrite an existing optimized object" >&2
  exit 1
fi

free_kib="$(df -Pk "$WORKDIR" | awk 'NR==2 {print $4}')"
required_kib="$((source_bytes * 4 / 1024 + 1048576))"
(( free_kib >= required_kib )) || { echo "Insufficient runner disk capacity" >&2; exit 1; }

aws s3 cp "s3://$R2_BUCKET/$SOURCE_KEY" "$INPUT" --endpoint-url "$ENDPOINT" --no-progress

ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,width,height -of json "$INPUT" > "$WORKDIR/before.json"

# Keep original dimensions and frame rate. CRF is quality-targeted, not a fixed percentage.
# Explicit MP4 faststart moves the moov atom forward for progressive web playback.
ffmpeg -hide_banner -nostdin -v warning -stats -i "$INPUT" \
  -map 0:v:0 -map 0:a:0? \
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -movflags +faststart -map_metadata 0 -y "$OUTPUT"

ffprobe -v error -show_entries format=duration -show_entries stream=codec_type,codec_name,width,height -of json "$OUTPUT" > "$WORKDIR/after.json"

python3 - "$WORKDIR/before.json" "$WORKDIR/after.json" "$INPUT" "$OUTPUT" <<'PY'
import json
import os
import sys

before, after = (json.load(open(p, encoding="utf-8")) for p in sys.argv[1:3])
def first_video(metadata):
    return next((s for s in metadata.get("streams", []) if s.get("codec_type") == "video"), None)
old_video, new_video = first_video(before), first_video(after)
assert old_video and new_video, "Video stream missing"
assert new_video["codec_name"] == "h264", "Expected H.264 output"
assert (old_video["width"], old_video["height"]) == (new_video["width"], new_video["height"]), "Video dimensions changed"
old_audio = any(s.get("codec_type") == "audio" for s in before.get("streams", []))
new_audio = any(s.get("codec_type") == "audio" for s in after.get("streams", []))
assert old_audio == new_audio, "Audio stream presence changed"
old_duration, new_duration = float(before["format"]["duration"]), float(after["format"]["duration"])
assert old_duration > 0 and abs(old_duration - new_duration) <= max(1.0, old_duration * 0.005), "Video duration mismatch"
old_bytes, new_bytes = os.path.getsize(sys.argv[3]), os.path.getsize(sys.argv[4])
assert new_bytes > 0 and new_bytes < old_bytes * 0.97, "Output must save at least 3% before upload"
print(f"Source: {old_bytes / 1024**2:.1f} MiB; optimized: {new_bytes / 1024**2:.1f} MiB; saved: {(1 - new_bytes / old_bytes) * 100:.1f}%")
print(f"Duration: {old_duration:.1f}s -> {new_duration:.1f}s; resolution: {new_video['width']}x{new_video['height']}; audio preserved: {old_audio}")
PY

# Upload only the validated output, never the source.
aws s3 cp "$OUTPUT" "s3://$R2_BUCKET/$OUTPUT_KEY" \
  --endpoint-url "$ENDPOINT" --content-type "video/mp4" \
  --cache-control "private,no-store" --no-progress

local_bytes="$(wc -c < "$OUTPUT" | tr -d '[:space:]')"
remote_bytes="$(aws s3api head-object --bucket "$R2_BUCKET" --key "$OUTPUT_KEY" --endpoint-url "$ENDPOINT" --query ContentLength --output text)"
[[ "$remote_bytes" == "$local_bytes" ]] || { echo "Uploaded object size mismatch: DO NOT register" >&2; exit 1; }

echo "Validated R2 output: $OUTPUT_KEY"
echo "Original remains untouched: $SOURCE_KEY"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### One-time MP4 optimization completed"
    echo ""
    echo "- Source: \`$SOURCE_KEY\`"
    echo "- Optimized: \`$OUTPUT_KEY\`"
    echo "- Original retained, no media assignments changed."
    echo "- Verify playback in a separate test session before manual replacement."
  } >> "$GITHUB_STEP_SUMMARY"
fi
