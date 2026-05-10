# Bundled FFmpeg Resources

This directory contains the redistributable `ffmpeg` and `ffprobe` binaries used by the packaged desktop app.

## Policy

- Use LGPL builds only.
- Do not bundle binaries whose version output contains `--enable-gpl` or `--enable-nonfree`.
- macOS ships Apple Silicon (`darwin/`) binaries.
- Windows ships Windows 10/11 x64 (`win32/`) binaries plus the shared DLLs required by the LGPL shared build.

## Current Sources

### macOS arm64

- Source: official FFmpeg 8.1 source archive.
- URL: `https://ffmpeg.org/releases/ffmpeg-8.1.tar.xz`
- Source SHA-256: `b072aed6871998cce9b36e7774033105ca29e33632be5b6347f3206898e0756a`
- Build host: macOS arm64, Apple clang 17.0.0.
- Configure flags:

```bash
./configure \
  --prefix=/tmp/roster-ffmpeg-build/install-darwin-arm64 \
  --disable-doc \
  --disable-debug \
  --disable-network \
  --disable-autodetect \
  --disable-x86asm \
  --enable-ffmpeg \
  --enable-ffprobe \
  --disable-ffplay
```

The configure output reported `License: LGPL version 2.1 or later`.

### Windows x64

- Source: BtbN FFmpeg Builds, LGPL shared build.
- URL: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-shared-8.1.zip`
- Archive SHA-256: `8a69657009c7aa61c13a013bf120e5b0df78f2e2b7abc41f5259eaa18fa7e537`
- Version: `n8.1.1-20260509`
- License files: see `licenses/`.

The Windows shared build version output does not contain `--enable-gpl` or `--enable-nonfree`.

## Bundled File SHA-256

```text
075357d122a016568bdecdc3db7690423295388914943611d96f36278765128a  darwin/ffmpeg
78551b65f4951376b54ea86626569890672ff1ac7e4a36318ca52a19514ccd52  darwin/ffprobe
d59777a07ffa80dfc4e6b2db6267a7e05be36dcbd9e31de9f76f24a93f05e8b1  win32/avcodec-62.dll
a761925e26a362d059de075913b873a96f34ced77fe93cbdb9f42ff9269a956d  win32/avdevice-62.dll
d25c94bf38e684e1abc7c85e9014ae31592f7f9808f676e3869e252f6cde56e4  win32/avfilter-11.dll
e16dd6400fb2fd3e232ac2ebfb32300bce9d0353bb55c3ea4bb485cfce05ade1  win32/avformat-62.dll
b7a5daa31a002fc9e9703c32d81e89f1783d856456e893a75fe7b2a391b2843e  win32/avutil-60.dll
68a51d53e5f6e7e04f45497e40b67aacc77ac035ecb9ccfca4899999ed721810  win32/ffmpeg.exe
d1e5ec33521b142518e2590b67679962f8b463d8da29f11be3a0c3066cd7a98a  win32/ffprobe.exe
dc289a235a0197f362b0094d37b92f6f7ff3d2c6b44059ebea8c0ee3737707b9  win32/swresample-6.dll
68eb2a5d029e190780c008e3914ebc1ea8829f58f3bdb04030c1d79ad5596c43  win32/swscale-9.dll
```

## Verification Commands

```bash
tools/ffmpeg/darwin/ffmpeg -version
tools/ffmpeg/darwin/ffprobe -version
tools/ffmpeg/darwin/ffmpeg -version | rg -- '--enable-(gpl|nonfree)' && exit 1 || true
tools/ffmpeg/darwin/ffprobe -version | rg -- '--enable-(gpl|nonfree)' && exit 1 || true
strings tools/ffmpeg/win32/ffmpeg.exe tools/ffmpeg/win32/ffprobe.exe tools/ffmpeg/win32/*.dll | rg -- '--enable-(gpl|nonfree)' && exit 1 || true
```
