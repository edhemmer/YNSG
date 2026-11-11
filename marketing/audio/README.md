# YNSG Audio Library

Voiceovers and background music for Reels and video posts. Not part of the website build.

| File | What it is | Length | Source | Notes |
|------|------------|--------|--------|-------|
| `vo-veterans-day-2026-hale.mp3` | Veterans Day 2026 voiceover, "Look around you…" script | 41s | ElevenLabs, voice "Hale – Smooth, Confident and Persuasive" (stability 50, similarity 68) | Ends on "We're Here to Help." Reusable for future Veterans Day and Memorial Day posts. |
| `vo-holidays-2026-melanie.mp3` | Holiday-prep voiceover ("The holidays are almost here…") | 27s | ElevenLabs, voice "Melanie – Conversational, Trustworthy" | Used in the locked cinematic holiday Reel. |
| `music-veterans-stories.mp3` | "Veterans Stories", patriotic orchestral bed | 60s | Licensed by Ed | Keep a record of the license with this file. Duck it to about −10 dB under voice. |

## Veterans Day 2026 script

> Happy Veterans Day.
> Look around you. The person next to you just may be a veteran… and you may never know it.
> Army. Navy. Air Force. Marines. Coast Guard. Space Force.
> To every one of you who served, thank you for your service and your sacrifice.
> At Your Neighborhood Service Guy, we serve the same neighborhoods you protected, and that means something to us.
> That's why every veteran receives our Community Rate. It's our way of saying thank you.
> Know a veteran? Share their name below… so they know they're appreciated.
> Your Neighborhood Service Guy. We honor our veterans, today and every day.
> We're Here to Help.

## Mixing notes
- Voice at full level and music at about 0.3× with sidechain ducking under the voice. The final mix peaks around −4 dB.
- Voice line timings, used to sync the Reel's scenes, are in `marketing/tools/reels/reel.py` (`build_vo`).
