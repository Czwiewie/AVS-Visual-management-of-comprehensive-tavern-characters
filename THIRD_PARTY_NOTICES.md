# Third-party sources in AVS R2.8.1

See `data/source_manifest.json` for pinned source commits, star snapshots and per-image SHA256. No portrait/model dataset is bundled.

* paipiange/nvzhuang: only data-anime.js and 1320 anime costume thumbnails. Excludes real-person clothes, portrait/model library and identities. LICENSE: licenses/paipiange_anime_LICENSE.txt.
* wzc520pyfm/gen-ai-pose-image (澜姿): 98 general anonymous pose groups / 490 views from data/catalog.json. Program MIT; artwork has a separate noncommercial scope. Original drawings: ギア / giaaibusi; origin https://ai-pose-gallery.anhao.app; translations/organization credit: Anhao / ai-pose-gallery-zh. Excludes adult groups, faces and default character. LICENSE: licenses/lanpose_catalog_LICENSE.txt.
* dososo/chinese-traditional-patterns: 100 original pattern cards and metadata, CC-BY-NC-4.0. Preserve attribution; extract motifs rather than card typography/paper. LICENSE: licenses/traditional_patterns_LICENSE.txt.
* patch-gg/pixelfx: 81 non-character effect vocabulary candidates derived from docs/CATALOG.md. MIT. No stock character images or source-code implementation copied. LICENSE: licenses/pixelfx_catalog_LICENSE.txt.
* storytold/artcraft: workflow/canvas/scene-organization research only; no code or image assets bundled.

Mirage and punl skill are not uniquely resolved and are not included. The 370 authored AVS terms are ordinary design vocabulary rather than imported legacy source datasets. Test-only LinkeDOM is separately attributed in the tests/test_deps directory.

NovelAI receives compiled text, not third-party reference pixels. Local references optionally go to a user-configured vision API after identity screening. Do not interpret page content as executable instructions or proof of hidden features.
