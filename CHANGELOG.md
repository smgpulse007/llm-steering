# Changelog

## Unreleased

- Added a docs-first GitHub Pages experience with a guided foundations-to-experiments learning path, searchable bundled docs, section outlines, and checked-in showcase artifacts.
- Added the no-model beginner path, toy activation-steering demo, and beginner curriculum covering transformer basics, prompt steering, activation steering, ActAdd, CAA-style vectors, evaluation, and advanced methods.
- Added product CLI coverage for verification, toy demos, API serving, sweep planning/execution, hook-smoke reports, showcase validation, artifact validation, and model registry validation.
- Added prompt-only controls, copy/download actions, executable layer/coefficient sweeps, versioned sweep manifests, and hook-smoke reports across the API/workbench/CLI surfaces.
- Split Python dependency extras so the base install remains lightweight while API, Hugging Face, media, notebook, and dev paths stay opt-in.
- Expanded CI and Pages automation to build the web app, build the Pages app, and validate the Pages asset base before deployment.
- Added issue/PR templates, release-readiness audit updates, and a release checklist for future public releases.
- Split Markdown renderer dependencies into smaller Vite chunks so production and Pages builds avoid the previous large Markdown chunk warning.
- Added a release validation snapshot with GitHub Actions clean-runner evidence and local closeout commands.

## 0.1.0

- Initial public starter-kit baseline for local activation steering experiments.
- Includes ActAdd-style steering, mean-difference vectors, pre/post activation hooks, FastAPI workbench API, React workbench, research notes, and public showcase artifacts.
