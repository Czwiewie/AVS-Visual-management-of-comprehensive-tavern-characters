# AVS Visual Workshop R2.2.0

SillyTavern 1.19.0+ browser extension, used alongside **unchanged AVS V4.1.10 Core**.

## Entry and install
Only entry: AVS V4.1.10 floating ball → 文生图. No second floating button.
Upload **all repository contents**, including `director.js` and `comic-page.js`, to your GitHub extension repository root. Then update this extension in SillyTavern and reload the browser. GitHub ZIP itself is not an extension URL. Old Core / UI / worldbook should not be re-imported if already installed.

## Director implementation
- Prompt AI produces a **structured scene/cast/interaction/camera/panel plan**, not an unconstrained positive/negative prompt.
- The local `director.js` reconciles IDs against *read-only* V4.1.10 character records, rejects unknown actors, compiles scene, role, camera, physical contact and requested negative terms.
- User camera selections take priority over model camera proposals.
- Group illustration uses per-person identity and region **text descriptions**. Native RP Cast / ControlNet integration is **not** bundled; no claim of spatial guarantee for generic image APIs.
- Comics get two distinct panel prompts and a local Canvas assembled PNG page with optional model-planned Chinese dialogue printed in an additional strip. This is not yet a professional balloon editor or multi-page pipeline.
- Style positive/negative lock: user explicitly selects `使用该图片画风` after visual analysis, or manually edits the locked prompt and saves. Plot API has no style write privileges. Old unconfirmed selections remain legacy presets, **not** locked by an automatic migration.
- OpenAI-compatible image endpoints lack a standardized native negative field; exclusions are appended as natural language. ComfyUI/NovelAI use their configured negative support.
- Gallery records include source chat/floor hash and style revision.

## Non-claims / limits
Real Pixiv top-50 retrieval still depends on GitHub Actions and upstream policies; no fabricated data. Actual image model quality, true native multi-person region control, local long-term persistence and real Termux/SillyTavern 1.19.0 operations are **not verified by the offline mocked tests**. No additional Termux server plugin is installed.

## Source and licensing
AVS R2.2.0 director and comic compositor code is project-authored, based on **ideas and contracts**, not copied third-party source. Research references: Manga-NAI-GPT, StoryDiffusion, RP Cast, ST-BaiBai-Image, zhiku-tavern-helper, ComfyUI-qwenmultiangle, DepthAnythingV2, IC-Light. Their engines, nodes, models and weights are not bundled. Follow each original repo's license before redistributing code or models.
