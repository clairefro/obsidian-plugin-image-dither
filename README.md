# Image Dither - Obsidian Plugin

Intercepts images pasted or dropped into notes so you can aestehtically dither and resize them, saving storage space

![dith-1](https://github.com/user-attachments/assets/6e9f7146-7124-4ac9-9519-023a4d50e9c0)

## Features

### Major storage savings!

<img width="969" height="805" alt="image" src="https://github.com/user-attachments/assets/a0d29f29-9ed7-4f60-a45b-68278c764d9c" />

### Dithering algorithms

Original (2.8MB)

<img width="225" height="337" alt="image" src="https://github.com/user-attachments/assets/0671d3a3-43e1-4416-a02c-7ec6507a4771" />

Photo by <a href="https://unsplash.com/@momentance?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">SwapnIl Dwivedi</a> on <a href="https://unsplash.com/photos/man-wearing-gray-turban-smoking-cigarette-in-closeup-photography-N2IJ31xZ_ks?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>

| Visual Example                                                                                                                           | Algorithm           | Description                                                                               |
| :--------------------------------------------------------------------------------------------------------------------------------------- | :------------------ | :---------------------------------------------------------------------------------------- |
| <img width="240" height="361" alt="image" src="https://github.com/user-attachments/assets/3f18d4b8-db19-465a-b8b4-28a9521c6f5f" /> 272KB | **Floyd-Steinberg** | Error-diffusion; best tonal quality                                                       |
| <img width="240" height="362" alt="image" src="https://github.com/user-attachments/assets/33a9e33b-3d2b-489b-9b08-3a018cc66073" /> 161KB | **Blue Noise**      | Interleaved gradient noise; organic, film-grain-like pattern with no repetition artifacts |
| <img width="238" height="359" alt="image" src="https://github.com/user-attachments/assets/b93a099a-957d-4579-aad7-a8dc6823fb0b" /> 190KB | **Ordered (Bayer)** | Matrix-based; structured pattern                                                          |
| <img width="241" height="361" alt="image" src="https://github.com/user-attachments/assets/8e0fae4b-6db8-42d9-ae80-c1c4aea80345" /> 82KB  | **Threshold**       | Hard cutoff; most aggressive                                                              |
| <img width="240" height="362" alt="image" src="https://github.com/user-attachments/assets/10c4e303-7bd0-40b3-ae81-2cd76588424c" /> 690KB | **Grayscale**       | Smooth grayscale conversion; no dithering                                                 |

### Controls (per image)

- **Threshold** — black/white cut point (0–255)
- **Sharpness** — error spread amount (0–100%)
- **Brightness / Contrast** — pre-dither adjustments (−100 to +100%)
- **Resize** — output scale (10–100% of original dimensions)
- **Invert colors** — flip output black/white

### Presets

- **Natural Dither** — Floyd-Steinberg at full size; best default
- **High Contrast** — Threshold algorithm at full size; bold black/white
- **Blue Noise** — Interleaved gradient noise at full size; organic grain
- **Grayscale** — Smooth grayscale conversion at full size
- **Auto (max compression)** — tests all presets and picks the one with the smallest output

### Transparency support

The alpha channel is never modified. Transparent PNGs remain transparent after dithering.

### Compression feedback

- Live size display for original and dithered output (e.g. `1.2 MB → 48.3 KB`)
- Percentage saved with color-coded indicator (good / warn / danger)
- Running total of bytes saved across all uses, shown in Settings

<img width="378" height="97" alt="image" src="https://github.com/user-attachments/assets/d6191b42-63c2-4467-a2ac-4ecb736d8917" />

### Output filename

The dithered filename is pre-filled in the modal using a configurable template and can be edited before saving. Supported tokens:

| Token         | Replaced with                           |
| ------------- | --------------------------------------- |
| `{original}`  | Original filename without extension     |
| `{algo}`      | Algorithm name (e.g. `floyd-steinberg`) |
| `{resize}`    | Resize percentage (e.g. `75`)           |
| `{timestamp}` | ISO timestamp at time of save           |

Filenames are automatically deduplicated. If the target name already exists in the folder, a numeric suffix is appended.

## Settings

<img width="793" height="491" alt="image" src="https://github.com/user-attachments/assets/b62e212b-2621-4a4a-b797-9379f7d3eb0b" />

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

Images are always saved as **PNG** to the attachment location in specified in your Obsidian preferences > Files and links.

## More examples

![dither-demo1](https://github.com/user-attachments/assets/eb5be8ee-c028-4cf1-b581-482027eb7340)

<img width="658" height="438" alt="image" src="https://github.com/user-attachments/assets/b5a6912b-9698-4c7a-9324-e602ba576d6e" />

<img width="697" height="509" alt="image" src="https://github.com/user-attachments/assets/a069f082-0d0d-4766-a7ed-76789b321ead" />

<img width="696" height="314" alt="image" src="https://github.com/user-attachments/assets/208da55e-507d-4d43-a28b-1328ed74d610" />

<img width="689" height="691" alt="image" src="https://github.com/user-attachments/assets/b6f5dc8b-bdf1-43df-814b-8fa391dabdc2" />

<img width="500" height="413" alt="image" src="https://github.com/user-attachments/assets/27d2fa95-d4c9-46c4-b36f-857e3b5a4c6a" />

<img width="696" height="460" alt="image" src="https://github.com/user-attachments/assets/13c58e03-9806-4eff-806e-3662cab0dad0" />

<img width="818" height="596" alt="image" src="https://github.com/user-attachments/assets/a49aac9b-8857-41f8-b763-b5a4bd3e6654" />
