# Reel tools

Free, local Python and ffmpeg scripts used to build YNSG Reels (1080×1920, 30 fps). No paid services.

- `reel.py`: renders a Reel from scenes: a waving-flag background, kinetic text, full-screen color flashes, photo scenes with a slow push-in, and a logo end card. Each Reel is a `build_*` function. `build_vo` is the Veterans Day 2026 cut, timed to `marketing/audio/vo-veterans-day-2026-hale.mp3`.
  - Run: `python3 reel.py vo out.mp4`, or `--frames 1,5,10` to preview stills first.
  - It needs Pillow, numpy, ffmpeg and the Outfit font (Google Fonts, OFL) at `fonts/Outfit.ttf`.
  - Photo paths point at `marketing/job-photos/`. Update `PHOTOS`, `HERE` and the logo path to your checkout.
- `music.py`: synthesizes a simple royalty-free piano and strings bed. It's a placeholder only; licensed music sounds better.

## The quality bar (Veterans Day 2026 voiceover Reel)
The Veterans Day 2026 voiceover cut (`build_vo`) is the standard for every YNSG Reel. Scenes are timed to each spoken line, found by silence detection on the voiceover. Every image matches its words. Licensed music sits ducked under the voice. Real job photos are used throughout, and any crowd is blurred so no one can be identified.
- `marketing/stock/crowd-anonymous-blurred.jpg`: a pre-blurred, cropped crowd image (no stage, no identifiable faces) for "people around you" moments.
