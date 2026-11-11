# Reel tools

Free, local Python and ffmpeg scripts used to build YNSG Reels (1080×1920, 30 fps). No paid services.

- `reel.py`: renders a Reel from scenes: a waving-flag background, kinetic text, full-screen color flashes, photo scenes with a slow push-in, and a logo end card. Each Reel is a `build_*` function. `build_vo` is the Veterans Day 2026 cut, timed to `marketing/audio/vo-veterans-day-2026-hale.mp3`.
  - Run: `python3 reel.py vo out.mp4`, or `--frames 1,5,10` to preview stills first.
  - It needs Pillow, numpy, ffmpeg and the Outfit font (Google Fonts, OFL) at `fonts/Outfit.ttf`.
  - Photo paths point at `marketing/job-photos/`. Update `PHOTOS`, `HERE` and the logo path to your checkout.
- `music.py`: synthesizes a simple royalty-free piano and strings bed. It's a placeholder only; licensed music sounds better.
