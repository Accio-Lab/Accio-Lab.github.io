# VisualArtifactSpec 1.0 project page

Static GitHub Pages project page at `/VisualArtifactSpec/`. No build step or external JavaScript dependencies.

Run from the repository root:

```sh
python3 -m http.server 8765
```

Open `http://localhost:8765/VisualArtifactSpec/`.

## Content provenance

Content follows the local `paper/vas-1.0/main.tex` and `sections/{introduction,benchmark,experiments,conclusion}.tex`. Hero, overview, result framing, metadata, and evaluation wording were realigned with the current abstract and introduction on 2026-11-16, cross-checked against benchmark and conclusion definitions. The current scope is 211 tasks, 4 families, 14 task types, and 8 purposes. Earlier Markdown drafts use a different scope and were not used for statistics.

Figures are PNG renders of the report's `figures/processed/{overview,introduction-context,construction}.pdf`. They are illustrative report figures, not evaluated agent outputs. The context figure uses the 2026-11-12 update, rendered with `pdftoppm -scale-to 2000 -H 1196 -singlefile -png` to omit the bottom fine print. Its photograph attribution remains in the HTML caption.

Colors, typography, resource styles, and the existing brand assets follow the sibling Neos page. Logo assets are referenced from `../Neos/assets/brand/` and must remain available when deploying this repository.

## Release updates

The Code and Dataset buttons link to https://github.com/Accio-Lab/VisualArtifactSpec and https://huggingface.co/datasets/Accio-Lab/VisualArtifactSpec. The public paper URL is not yet provided, so Paper retains its Coming soon status. The existing report PDF was older than the current TeX source and is not distributed here. Experimental results use the current local snapshot; human validation is pending.

## Embedded artifact cases

Four paired English case studies show eight original evaluated outputs under the current v3 scoring protocol:

- `presentations-001`: eight-slide ResNet research presentation, GPT-6.1 Sol vs DeepSeek V4.1 Flash. Browse all slides and download editable PPTX files; inspect how evidence conditions are attached to claims.
- `static-graphics-099`: five hurricane forecast-cone cards, GPT-6.1 Sol vs Claude Sonnet 5. Browse all five full cards; inspect phone-scale reading limitations, including a weakness in the higher-scoring output.
- `animations-videos-121`: 30-second standing-wave animation, GPT-6 Astra vs Kimi K3. Play both original MP4 files or seek to six seconds to compare marker/curve correspondence.
- `web-interfaces-042`: interactive refraction lab, GPT-6.1 Sol vs Kimi K3. Live controls, saved snapshots, comparison, and export are embedded. Reviews distinguish normal interactions from recorded data-load failure tests.

IDs were checked against `VisualArtifactsSpec/dist/hf-Accio-Lab-VisualArtifactSpec-20261116/data/tasks/*/task.json`, including each legacy-task mapping. Source artifacts and current grouped score files come from the local dashboard. `assets/cases/comparisons/evaluation-evidence.json` contains all displayed scores, criterion ratings, selected original judgments, acceptance-group counts, and original-asset SHA-256 hashes. Artifact copies are unchanged. The Sol lab retains its original module sources and adds `preview.html` plus a concatenated module wrapper for local-file previews; only file-protocol example loading uses embedded original JSON. HTTP hosting retains the original fetch path. Evaluation findings refer to the original output.

Case selection emphasizes specific strengths and failures, not a representative model ranking. No new grading was performed. Original artifacts remain separately downloadable/openable; the previews do not claim to replace native-file evaluation. Previous case assets remain on disk but are no longer displayed.

## Leaderboard

The current results use the dashboard snapshot `2026-11-16T13:32:10.016137+00:00` (16 November 21:32 CST), stored in `.codex-build/experiments-dashboard-20261115-refresh/`. All nine configurations have 211 scores (1,899 records). Overall and family means use all available tasks; with complete coverage, release-count-weighted family means equal the full 211-task means. CP/FN remain means of applicable per-task group pass rates. Leaderboard rows are ordered by total score.

Scoring follows `unified-211-signed-50-50-group-all-pass-v3`, checked against the local report and `VisualArtifactsSpec/src/vsa_bench/benchmark.py`. Map each criterion rating -3/-2/-1/0/+1/+2/+3 to -50/-25/-10/0/+10/+25/+50 before criterion-weighted averaging within each dimension. Then combine dimension point scores at C/O/V/D weights 25%/15%/50%/10%. B remains 50 times the fraction of all-pass acceptance groups. S = B + Δ, without clipping.

`leaderboard-data.js` contains the nine model configurations supplied by the user, in the supplied order. All results are `null` and render as genuinely empty cells, not zero scores or ranks. The three accessible tab views show overall scores (S, B, Δ, valid-task count), dimensions (CP/FN percentages and C/O/V/D dimension point scores), and mean total scores by artifact family. Model harnesses and reasoning settings appear in the Overall view. Update numeric fields when verified results are available; preserve `null` for unavailable results. Before publishing scores, document comparison task subsets, valid coverage per family, aggregation version, and any evaluation failures. Row order is currently fixed, not a ranking.

The figure viewer supports click, Escape, a close button, and native dialog focus management. Figures remain accessible as ordinary image links without JavaScript. Artifact selectors switch among the four cases. Layouts adapt to mobile, with reduced-motion support; SVG playback starts only on explicit request.

Imported HTML summary scores provide weighted dimension contributions; divide by C/O/V/D weights to recover dimension points. CP/FN pass rates for imported summaries use the supplied acceptance_groups_summary passed/total counts; zero-total dimensions are not applicable.

The homepage displays logo-labelled PNG and SVG exports under `assets/results/`. Generate raw charts with `outputs/vas-logo-preview/generate_current_results.py`, then apply logos with `create_preview.py` and `create_task_level_preview.py` in the same directory. Brand mapping follows the computed model order. Icon sources and license are retained under `assets/results/brand-logos-*`.

The task-level figure retains the original LaTeX 38-task selection from `paper/vas-1.0/figures/sources/matched-task-selection.json`: 14 presentations, 16 static graphics, and 8 animations/videos. All nine configurations use this fixed set (342 records), with scores refreshed from the latest dashboard analysis. The four excluded tasks remain excluded. No resampling is applied. The public task list is `assets/results/task-level-sampling.json`.
