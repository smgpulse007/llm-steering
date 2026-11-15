import { Activity, ArrowRight, Play, Terminal } from "lucide-react";
import { parseNumericInput, numericInputValue } from "../lib/experimentDraft";
import { steeringPresets } from "../lib/presets";
import { draftDiffersFromRun } from "../lib/experimentRecord";
import type { LabController } from "../hooks/useLab";
import { ConsoleRail, Metric, OutputPane, SweepPanel } from "./WorkbenchPanels";

export function Workbench({ lab }: { lab: LabController }) {
  const { payload, setPayload, selectedModel, result, runRecord } = lab;
  const busy = lab.busy || lab.sweepBusy;
  return (
    <section className="page-section workbench-page">
      <div className="page-heading">
        <h1>Make the intervention yours.</h1>
        <p>Define the contrast. Run locally. Keep the evidence.</p>
      </div>
      <div className="runtime-status">
        <Terminal size={19} />
        <span>
          {lab.apiMode === "local"
            ? "Local API connected · Model loading happens when you run"
            : lab.apiMode === "checking"
              ? "Checking local API availability…"
              : "Static preview · Start the workbench locally to run experiments"}
        </span>
        <a href="#setup">
          Local setup <ArrowRight size={17} />
        </a>
      </div>
      <div className="workbench-layout">
        <section className="experiment-draft">
          <h2>Experiment draft</h2>
          {Object.keys(lab.draftErrors).length > 0 && (
            <div id="draft-errors" role="alert" className="draft-errors">
              <strong>Check the draft</strong>
              <ul>
                {Object.entries(lab.draftErrors).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <label>
            Model
            <select
              value={lab.selectedId}
              onChange={(event) => lab.setSelectedId(event.target.value)}
            >
              {lab.models.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.display_name} ·{" "}
                  {model.support_status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <small className="field-help">{selectedModel.steering_notes}</small>
            <small className="field-help">
              Registry readiness describes the model path; validate your local
              model before running.
            </small>
          </label>
          <label>
            Behavior
            <select
              value={lab.selectedPresetId}
              onChange={(event) => {
                const preset = steeringPresets.find(
                  (item) => item.id === event.target.value,
                );
                if (preset) lab.choosePreset(preset);
              }}
            >
              {steeringPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            User prompt
            <textarea
              rows={3}
              value={payload.user_prompt}
              aria-invalid={Boolean(lab.draftErrors.user_prompt)}
              aria-describedby={
                lab.draftErrors.user_prompt ? "draft-errors" : undefined
              }
              onChange={(event) =>
                setPayload({ ...payload, user_prompt: event.target.value })
              }
            />
          </label>
          <div className="control-grid primary-controls">
            <label>
              Layer
              <input
                type="number"
                min="0"
                step="1"
                value={numericInputValue(payload.layer)}
                aria-invalid={Boolean(lab.draftErrors.layer)}
                aria-describedby={
                  lab.draftErrors.layer ? "draft-errors" : undefined
                }
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    layer: parseNumericInput(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Coefficient
              <input
                type="number"
                step="0.1"
                value={numericInputValue(payload.coefficient)}
                aria-invalid={Boolean(lab.draftErrors.coefficient)}
                aria-describedby={
                  lab.draftErrors.coefficient ? "draft-errors" : undefined
                }
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    coefficient: parseNumericInput(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <details className="control-disclosure">
            <summary>Prompt pairs & system instruction</summary>
            <div>
              <label>
                System instruction
                <textarea
                  value={payload.system_prompt}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      system_prompt: event.target.value,
                    })
                  }
                />
              </label>
              {payload.prompt_pairs.map((pair, index) => (
                <fieldset className="pair-fields" key={index}>
                  <legend>Contrast pair {index + 1}</legend>
                  <label>
                    Positive direction
                    <textarea
                      value={pair.positive}
                      aria-invalid={Boolean(lab.draftErrors.prompt_pairs)}
                      aria-describedby={
                        lab.draftErrors.prompt_pairs
                          ? "draft-errors"
                          : undefined
                      }
                      onChange={(event) =>
                        lab.updatePair(index, "positive", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Negative contrast
                    <textarea
                      value={pair.negative}
                      aria-invalid={Boolean(lab.draftErrors.prompt_pairs)}
                      aria-describedby={
                        lab.draftErrors.prompt_pairs
                          ? "draft-errors"
                          : undefined
                      }
                      onChange={(event) =>
                        lab.updatePair(index, "negative", event.target.value)
                      }
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </details>
          <details className="control-disclosure">
            <summary>Advanced intervention & decoding</summary>
            <div className="control-grid">
              <label>
                Hook stage
                <select
                  value={payload.hook_stage}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      hook_stage: event.target.value as "pre" | "post",
                    })
                  }
                >
                  <option value="post">Post-block</option>
                  <option value="pre">Pre-block</option>
                </select>
              </label>
              <label>
                Token scope
                <select
                  value={payload.apply_to}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      apply_to: event.target.value as
                        "last_token" | "all_tokens",
                    })
                  }
                >
                  <option value="last_token">Last token</option>
                  <option value="all_tokens">All tokens</option>
                </select>
              </label>
              <label>
                Max tokens
                <input
                  type="number"
                  min="1"
                  value={numericInputValue(payload.max_new_tokens)}
                  aria-invalid={Boolean(lab.draftErrors.max_new_tokens)}
                  aria-describedby={
                    lab.draftErrors.max_new_tokens ? "draft-errors" : undefined
                  }
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      max_new_tokens: parseNumericInput(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={numericInputValue(payload.temperature)}
                  aria-invalid={Boolean(lab.draftErrors.temperature)}
                  aria-describedby={
                    lab.draftErrors.temperature ? "draft-errors" : undefined
                  }
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      temperature: parseNumericInput(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Top-p
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={numericInputValue(payload.top_p)}
                  aria-invalid={Boolean(lab.draftErrors.top_p)}
                  aria-describedby={
                    lab.draftErrors.top_p ? "draft-errors" : undefined
                  }
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      top_p: parseNumericInput(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Top-k
                <input
                  type="number"
                  min="0"
                  value={numericInputValue(payload.top_k)}
                  aria-invalid={Boolean(lab.draftErrors.top_k)}
                  aria-describedby={
                    lab.draftErrors.top_k ? "draft-errors" : undefined
                  }
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      top_k: parseNumericInput(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Sampling seed
                <input
                  type="number"
                  min="0"
                  max="4294967295"
                  step="1"
                  value={numericInputValue(payload.seed ?? 0)}
                  aria-invalid={Boolean(lab.draftErrors.seed)}
                  aria-describedby={
                    lab.draftErrors.seed ? "draft-errors" : undefined
                  }
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      seed: parseNumericInput(event.target.value),
                    })
                  }
                />
                <small className="field-help">
                  The same seed is used for each sampled arm. It is saved with
                  the submitted request.
                </small>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={payload.normalize}
                  onChange={(event) =>
                    setPayload({ ...payload, normalize: event.target.checked })
                  }
                />
                Normalize vector
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={payload.do_sample}
                  onChange={(event) =>
                    setPayload({ ...payload, do_sample: event.target.checked })
                  }
                />
                Sample output
              </label>
              <p className="field-help wide">
                Greedy decoding helps compare the three arms. Sampling can
                introduce differences unrelated to the intervention.{" "}
                <a href="#explain/controls">Learn the controls</a>
              </p>
            </div>
          </details>
          <details className="control-disclosure">
            <summary>Model checks & sweeps</summary>
            <div>
              <p className="field-help">
                {selectedModel.runtime_notes} {selectedModel.steering_notes}
              </p>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={lab.hookSmokeLoadModel}
                  onChange={(event) =>
                    lab.setHookSmokeLoadModel(event.target.checked)
                  }
                  disabled={busy}
                />
                Load model for live hook smoke
              </label>
              <p className="field-help">
                Off returns a registry-only report without loading weights.
              </p>
              <div className="action-row">
                <button
                  className="secondary-button compact"
                  disabled={busy || lab.apiMode !== "local"}
                  onClick={lab.handleIntrospect}
                >
                  Introspect
                </button>
                <button
                  className="secondary-button compact"
                  disabled={busy || lab.apiMode !== "local"}
                  onClick={lab.handleHookSmoke}
                >
                  <Activity size={16} />
                  Hook smoke
                </button>
              </div>
              {lab.introspection && (
                <p>
                  Last completed introspection for {lab.introspection.model_id}:{" "}
                  {lab.introspection.status}.{" "}
                  {lab.introspection.warnings.join(" ")}
                </p>
              )}
              {lab.hookSmokeReport && (
                <section className="hook-smoke-report">
                  <p className="field-help">
                    Last completed check for {lab.hookSmokeReport.model_id};
                    edit controls and run another check to validate new inputs.
                  </p>
                  <Metric
                    label="Hook smoke"
                    value={lab.hookSmokeReport.status}
                  />
                  <Metric label="Mode" value={lab.hookSmokeReport.mode} />
                  <Metric
                    label="Checks passed"
                    value={`${lab.hookSmokeReport.checks.filter((check) => check.passed).length}/${lab.hookSmokeReport.checks.length}`}
                  />
                  <p>{lab.hookSmokeReport.warnings.join(" ")}</p>
                  <code>{lab.hookSmokeReport.reproduce_command}</code>
                </section>
              )}
              <SweepPanel
                apiMode={lab.apiMode}
                selectedModel={selectedModel}
                layersText={lab.sweepLayersText}
                coefficientsText={lab.sweepCoefficientsText}
                onLayersTextChange={lab.setSweepLayersText}
                onCoefficientsTextChange={lab.setSweepCoefficientsText}
                onPlan={lab.handlePlanSweep}
                onRun={lab.handleRunSweep}
                busy={busy}
                plan={lab.sweepPlanResult}
                result={lab.sweepResult}
              />
            </div>
          </details>
          <div className="action-row run-actions">
            <button
              className="primary-button"
              onClick={lab.handleRun}
              disabled={busy || lab.runBlocked}
            >
              <Play size={17} />
              {busy ? "Working…" : "Run experiment"}
            </button>
            <button
              className="secondary-button"
              onClick={() => lab.choosePreset(lab.selectedPreset)}
            >
              Reset preset
            </button>
          </div>
          {lab.apiMode === "local" && lab.runBlocked && (
            <p className="warning-copy">
              This model is visible for research but is not validated for
              steering. Experiment execution stays disabled.
            </p>
          )}
        </section>
        <section className="workbench-results">
          <h2>Comparison</h2>
          {runRecord && result ? (
            <>
              <section
                className="result-provenance"
                aria-label="Result provenance"
                aria-live="polite"
              >
                <p className="mono">Last completed local run</p>
                <h3>Run from {runRecord.presetName}</h3>
                <p>
                  <code>{result.experiment_id}</code> · {result.created_at_utc}
                </p>
                <p>
                  {runRecord.request.model_id} · layer {runRecord.request.layer}{" "}
                  · coefficient {runRecord.request.coefficient} ·{" "}
                  {runRecord.request.hook_stage} / {runRecord.request.apply_to}
                </p>
                {draftDiffersFromRun(runRecord, payload) && (
                  <p className="warning-copy">
                    Draft settings have changed. The outputs, diagnostics and
                    exports below still belong to this completed run.
                  </p>
                )}
              </section>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={lab.autoDiff}
                  onChange={(event) => lab.setAutoDiff(event.target.checked)}
                />
                Highlight changes against prompt-only control
              </label>
              <div className="completed-comparison" key={result.experiment_id}>
                <OutputPane
                  title="Baseline"
                  text={result.baseline}
                  tone="baseline"
                  diffResult={null}
                  side="left"
                />
                <OutputPane
                  title="Prompt-only control"
                  text={result.prompt_only}
                  tone="prompt"
                  diffResult={lab.autoDiff ? lab.activationDiff : null}
                  side="left"
                />
                <OutputPane
                  title="Activation-steered"
                  text={result.steered}
                  tone="steered"
                  diffResult={lab.autoDiff ? lab.activationDiff : null}
                  side="right"
                />
              </div>
            </>
          ) : (
            <div className="empty-comparison">
              <dl>
                {["Baseline", "Prompt-only control", "Activation-steered"].map(
                  (title) => (
                    <div key={title}>
                      <dt>{title}</dt>
                      <dd>—</dd>
                    </div>
                  ),
                )}
              </dl>
              <div className="empty-message">
                <h3>Your next result starts here.</h3>
                <p>
                  Run an experiment through your local API to compare all three
                  arms and inspect the saved request.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="workbench-footer">
        <span>
          {runRecord
            ? "Results retain their submitted configuration."
            : "Nothing has been run in this session."}
        </span>
        <a href="#experiments">
          Explore recorded examples <ArrowRight size={17} />
        </a>
        <a href="#explain/controls">
          Learn the controls <ArrowRight size={17} />
        </a>
      </div>
      <p className="workbench-log" role="status">
        {lab.logs[0]}
      </p>
      <details className="run-evidence" open={Boolean(result)}>
        <summary>Diagnostics, artifacts & session log</summary>
        <ConsoleRail
          key={result?.experiment_id ?? "not-run"}
          record={runRecord}
          payload={payload}
          introspection={lab.introspection}
          logs={lab.logs}
          artifactPreview={lab.artifactPreview}
          onFetchArtifact={lab.handleFetchArtifact}
        />
      </details>
    </section>
  );
}
