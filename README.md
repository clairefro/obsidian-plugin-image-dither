# Image Dither — Obsidian Plugin

Intercepts images pasted or dropped into a note and lets you dither and resize them before saving, keeping your vault lean.

Adjust the settings, then choose to save the dithered version or fall back to the original

## Features

### Dithering algorithms

| Algorithm       | Description                               |
| --------------- | ----------------------------------------- |
| Floyd-Steinberg | Error-diffusion; best tonal quality       |
| Ordered (Bayer) | Matrix-based; structured pattern          |
| Threshold       | Hard cutoff; most aggressive              |
| Grayscale       | Smooth grayscale conversion; no dithering |

### Controls (per image)

- **Threshold** — black/white cut point (0–255)
- **Sharpness** — error spread amount (0–100%)
- **Brightness / Contrast** — pre-dither adjustments (−100 to +100%)
- **Resize** — output scale (10–100% of original dimensions)
- **Invert colors** — flip output black/white

### Presets

- **Natural Dither** — Floyd-Steinberg at full size; best default
- **High Contrast** — Threshold algorithm at full size; bold black/white
- **Grayscale** — Smooth grayscale conversion at full size
- **Auto (max compression)** — tests all presets and picks the one with the smallest output

### Compression feedback

- Live size display for original and dithered output (e.g. `1.2 MB → 48.3 KB`)
- Percentage saved with color-coded indicator (good / warn / danger)
- Running total of bytes saved across all uses, shown in Settings

## Settings

| Setting                    | Default             | Description                                                                            |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| Enabled                    | On                  | Toggle paste/drop interception                                                         |
| Default preset             | Natural Dither      | Preset applied when the modal opens                                                    |
| Default output width (px)  | 700                 | Snaps resize % to the closest value for each image; leave blank to keep original width |
| Dithered filename template | `{original}-dither` | Tokens: `{original}`, `{algo}`, `{resize}`, `{timestamp}`                              |

## Commands

- **Image Dither: Enable** — turn interception on
- **Image Dither: Disable** — turn interception off

The ribbon icon also toggles the plugin on/off.

## Output format

Images are always saved as **PNG** to the attachment location in specified in your Obsidian preferences.
