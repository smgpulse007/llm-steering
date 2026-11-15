# LLM Steering Lab experience

The Lab connects a behavior hypothesis to the intervention that tests it. The public front door leads with a readable saved example; the local workbench supplies the execution path. The underlying Python experiment implementation is unchanged by this UI redesign.

## Four connected views

- **Overview:** the purpose, an original two-arm support example, a four-stage intervention diagram and platform-specific no-model setup commands.
- **Experiments:** three complete records imported directly from `showcase/use_case_showcase.json`, original settings, optional raw-text differences, source links and faithful record downloads. Unknown deep links show a missing-record page.
- **Learn:** an explicitly synthetic, interactive 2D vector addition followed by the existing seven-lesson syllabus and documentation reader.
- **Workbench:** a compact draft beside the comparison. Prompt pairs, advanced decoding, model checks and sweeps expand when needed. Existing outputs, diagnostics, artifacts and session logs remain available.

Legacy documentation and workbench hash links remain supported. Navigation moves keyboard focus to the main content; local setup moves focus to its section. Controls have visible focus styles and honor reduced motion.

## Evidence stays attached to its source

The legacy records omit model identity, seed, timestamp, diagnostics and prompt-only output. The reader lists those omissions and never supplies invented values. These records are qualitative examples, not exact-replay receipts or quality benchmarks. The complete tutoring response includes its third sentence and a visible note that it misses the requested two-sentence limit.

Recorded settings never follow the editable draft. New local results retain a copy of the request submitted before the asynchronous API call. Custom edits receive a custom label, while unchanged presets retain their names. Run JSON contains the submitted request and response. Vector metadata is a partial companion artifact; use the full run record for prompts, pairs, seed and decoding settings.

Model selection updates identity and model defaults together. Empty or failed local registries preserve a readable fallback and disable execution. The public Pages build uses its bundled registry without API probes. Blank numeric fields stay missing instead of becoming zero; finite values, integer constraints, sampling parameters and required prompts are checked before run or sweep requests.

## Authentic README tour

`assets/steering-lab-tour.gif` contains five actual browser screenshots of the static build. It shows the overview, source record, vector lesson, a keyboard-driven coefficient change and an unrun workbench. It contains no synthetic API response and no newly generated model result.

Original JPEG captures, routes, durations and SHA-256 hashes are in `assets/lab-tour/recording.json`. Reassemble with Pillow installed:

```sh
python scripts/assemble_lab_tour.py
```

The design concepts are separate working references, not product evidence. The only new runtime media asset is the unmodified, self-hosted Inter font; its upstream commit and SIL Open Font License are included in `apps/web/public/fonts/`.

## November 15, 2026 verification

- 19 Node regressions cover immutable run provenance, record fidelity, missing metadata, deep links, numeric validation, model selection, custom labels, registry loading/shape checks and signed vector arithmetic.
- Local and Pages TypeScript/Vite builds pass, including unused-code checks; the Pages asset validator passes.
- The Python regression suite passed with 93 tests and one CUDA skip. No new GPU experiment or model-quality evaluation was performed.
- Browser checks exercised record switching, full tutoring text, differences, a downloaded JSON record compared with its source, lessons, signed slider values, local setup, copied quickstart commands and route focus.
- A loopback-only synthetic API fixture verified edits during a delayed run, original request exports, a custom seeded run, unvalidated model gating, and empty/failed registry handling. These verify UI behavior, not inference.
- Four primary views had no horizontal document overflow in a 390px iframe (375px content width plus scrollbar) in the actual browser. The browser's viewport override did not apply, so this test used a development-only iframe wrapper. The wrapper is not shipped.

The delayed-registry browser check confirmed execution remains disabled even after runtime status connects, and becomes available only after registry validation. Two independent Codex CLI source-review passes informed the numeric, model identity, registry and focus fixes; the final registry changes are covered by the added tests and browser check. A complete cross-engine accessibility audit and fresh model validation remain outside this UI verification.

## Visual review

Five coordinated concepts informed the overview, method/setup, reader, workbench and lesson. Direct concept-versus-browser image review checked the white/ink/cobalt palette, two-line headline, primary/secondary actions, large comparison, thin rules, progressive controls, original record text and responsive stacking. The implementation uses real HTML, controls, Markdown and SVG rather than rasterized mockups.

Source and interaction requirements refine the concepts: the seven lesson names match actual documents; the toy axes include negative values; recorded outputs remain verbatim without added blue emphasis; the model selector and initial prompt reflect the real registry and preset; and setup uses executable Windows/macOS/Linux commands. No new claim or metric was added above the fold. The workbench's runtime notice states that hosted users must start the local workbench, because Pages cannot connect to a local API itself.
