# One-time transcoding options for MkLMS

All supported approaches end in the same final architecture:

```text
source video -> one-time HLS transcoding -> verified HLS package -> R2 -> MkLMS playback
```

The transcoder is replaceable. R2 is the durable storage/delivery layer.

## Option 1: Local FFmpeg — recommended free option

- Cost: no cloud transcoding fee.
- Runs on Windows, macOS, Linux.
- Best control over HLS master/variant playlists and segment layout.
- Good for a few videos when the operator has a capable laptop/desktop.
- See `local-ffmpeg-to-r2.md` for the exact reference workflow.

## Option 2: Shutter Encoder + FFmpeg

- Shutter Encoder is a free desktop GUI built around professional media tooling and is useful for operators who prefer a GUI.
- Use it to create/transcode clean H.264 files/renditions, then use FFmpeg for deterministic HLS packaging if the chosen GUI preset does not produce the exact multi-rendition HLS structure required by MkLMS.

## Option 3: HandBrake + FFmpeg

- HandBrake is free/open-source and useful for producing compressed H.264 renditions.
- It is not the preferred final HLS packager for MkLMS; package the outputs with FFmpeg afterward.

## Option 4: OCI Media Flow

- Paid, asynchronous cloud transcoding.
- Useful when local hardware/time is inconvenient or when many long videos must be processed.
- MkLMS estimates the paid action before acceptance.
- The same source/profile should be transcoded once; retry transfer/verification rather than retranscoding when possible.

## Online “free converters”

Not recommended for production/private training media. Typical risks include upload size/duration limits, uncertain retention/privacy, variable HLS support, forced branding, throttling, and no reliable reproducible output structure.

## Principle

Never pay a transcoder on every view. Once `master.m3u8`, variant playlists and segments are valid in R2, future course/live viewers consume the stored package only.
