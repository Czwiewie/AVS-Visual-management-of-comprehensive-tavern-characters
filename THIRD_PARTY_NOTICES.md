# Third-party notices

This extension directly reuses selected data from the following MIT-licensed projects. Their original license texts are preserved in `licenses/`.

- euan-gwd/comfyui-character-prompt-builder: selected categories from `resources/character_prompt.json`; selection, category mapping, provenance and visibility metadata were added.
- perfectmodelslab/ComfyUI-PerfectLab: selected literal option lists from `web/perfectlab_libraries.js`, plus six reviewed category preview files. A rejected seventh reference from the research stage is not distributed.
- andygock/stable-diffusion-style-cheatsheet: four lists of composite look descriptions, preserved as composite entries requiring field separation.
- radianceded/nail-ai-ops: 44 style records and descriptive fields; image paths were resolved against actual repository files; nonexistent thumbnail paths were removed. Its mock try-on behaviour is not included.
- GautamVhavle/OutfitSense: garment-role categories informed the AVS slot-to-region mapping; the full app, API client, photoreal defaults and default pose/background are not copied.

Repository URLs, file paths and Git blob hashes are in `data/source_manifest.json`.

Research-only sources: MatsuriMW/ai-character-design-skill, AntonHu/ai-drama, TianDiHuAng/image_prompt. Their texts and images are not redistributed in this pack. The AVS design notes are independently written and do not impose live-action expression limits or a fixed panel grid.

Each preview is an upstream illustration of one category. It is not an AVS character identity, an approved wardrobe, or a verified NovelAI result. Captions, makeup, clothing and pose outside the selected category must not be automatically inherited.

AVS runtime compiler, director integration, state projection and wire-format handling are independently implemented. NekoAI-JS was inspected to understand public request/response field formats; its SDK source is not redistributed.
