#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input-video> <output-directory>"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffmpeg/ffprobe are required. On Ubuntu: sudo apt-get update && sudo apt-get install -y ffmpeg"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "Input video not found: $INPUT"
  exit 1
fi

if ! ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "$INPUT" | grep -q .; then
  echo "Input video has no audio stream. This live-class HLS profile expects one audio stream."
  exit 1
fi

mkdir -p "$OUTPUT/360p" "$OUTPUT/480p" "$OUTPUT/720p"

ffmpeg -hide_banner -y -i "$INPUT" \
  -filter_complex "[0:v]split=3[v360][v480][v720];[v360]scale=w=-2:h=360[v360o];[v480]scale=w=-2:h=480[v480o];[v720]scale=w=-2:h=720[v720o]" \
  -map "[v360o]" -map 0:a:0 \
  -map "[v480o]" -map 0:a:0 \
  -map "[v720o]" -map 0:a:0 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p \
  -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k \
  -b:v:1 1400k -maxrate:v:1 1498k -bufsize:v:1 2100k \
  -b:v:2 2800k -maxrate:v:2 2996k -bufsize:v:2 4200k \
  -c:a aac -ar 48000 \
  -b:a:0 96k -b:a:1 112k -b:a:2 128k \
  -force_key_frames "expr:gte(t,n_forced*6)" -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p" \
  -hls_segment_filename "$OUTPUT/%v/seg_%06d.ts" \
  "$OUTPUT/%v/index.m3u8"

if [ ! -s "$OUTPUT/master.m3u8" ]; then
  echo "Transcode failed: master.m3u8 was not created."
  exit 1
fi

for rendition in 360p 480p 720p; do
  if [ ! -s "$OUTPUT/$rendition/index.m3u8" ]; then
    echo "Transcode failed: $rendition playlist is missing."
    exit 1
  fi
  if ! find "$OUTPUT/$rendition" -name 'seg_*.ts' -type f -size +0c | grep -q .; then
    echo "Transcode failed: $rendition has no media segments."
    exit 1
  fi
done

echo "HLS package ready: $OUTPUT/master.m3u8"
echo "Do not transcode this source again unless you intentionally change the encoding profile."
