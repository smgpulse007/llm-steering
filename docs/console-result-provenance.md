# Console results and provenance

The initial console prepares an experiment. It has no generated replies, measured
diagnostics, experiment timestamp, vector file or result export until a local API
run completes. The public Pages build can edit configuration and show checked-in
research artifacts through the learning pages; it cannot execute a model.

Each completed run captures the submitted request before waiting for the API.
Changing a preset, prompt, model or coefficient afterward changes the next draft,
while the previous outputs, diagnostics and exports keep their original request.
An inline notice identifies this difference. The starting preset name is a label;
the captured request contains the exact settings and prompts.

`*.console-run.json` is a client record with schema `console-run.v1`, the submitted
request and the API response. It is distinct from the backend's saved experiment
file. Vector metadata derives from the same captured request. **Fetch saved JSON
artifact** shows the backend artifact only under its matching experiment ID;
delayed responses cannot appear under a newer run. No preview file or vector is
invented.

## Verification

Run the frontend provenance regressions with Node 22.19+ or Node 24:

```sh
cd apps/web
npm ci
npm test
npm run build
npm run build:pages
```

Five tests cover edits during an in-flight request, later edits and export
consistency, delayed artifact responses, the initial empty state, and model-report
identity. Manual
browser QA also used a clearly labeled synthetic API fixture: a Tutor run at
coefficient 1.3 remained Tutor/1.3 in both JSON exports after the draft changed to
Support/9. This verifies UI state handling, not model quality or inference.

The unchanged Python regression suite also passed: 93 tests and one CUDA skip.
Both local and Pages builds passed TypeScript/Vite checks and the Pages asset
validator. Static browser inspection at desktop and 390px mobile widths found no
horizontal overflow, and its console recorded no warnings or errors.

Independent source review found no blocker in the completed-run path and identified
adjacent stale-response races. Document loads now ignore responses after selection
changes, and introspection/hook-smoke reports render only for their matching model.
Completed sweeps identify their saved model and axes separately from the next draft.
Browser checks with three-second synthetic response delays confirmed that document
B remained selected after document A completed, and old Gemma/Qwen validation
reports did not appear in the newly selected model's report panel. Historical log
entries retained the original model IDs, and unvalidated model runs stayed gated.

The README recording is captured from the actual static build. Frames and hashes
are in `assets/console-demo/`; `python scripts/assemble_console_recording.py`
reassembles them using the optional Pillow media dependency. Historical model
research artifacts are separate from this configuration-only recording.

## Dependency audit, November 14, 2026

Compatible lockfile updates removed all five high and one moderate npm audit
reports. Four low-severity reports remain in the KaTeX/remark-math/rehype-katex
chain for [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).
The advisory concerns trust restrictions when prototype pollution already
exists. No forced downgrade or unverified math-library override was applied.
This repository is not represented as having a clean vulnerability audit.
