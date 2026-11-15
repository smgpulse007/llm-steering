import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Braces,
  BrainCircuit,
  ChevronRight,
  Copy,
  Download,
  FunctionSquare,
  Layers,
  Play,
  ScrollText,
  Search,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { renderDiffTokens, type DiffResult } from "../lib/diff";
import { MarkdownOutput } from "../lib/markdown";
import {
  runRecordJson,
  vectorMetadataJson,
  type RunRecord,
} from "../lib/experimentRecord";
import type {
  ExperimentPayload,
  IntrospectionReport,
  LocalDoc,
  LocalDocContent,
  LocalDocSection,
  ModelRegistryEntry,
  SweepPlan,
  SweepResult,
} from "../lib/types";

import {
  safeFileName,
  copyTextToClipboard,
  downloadTextFile,
} from "../lib/browserFiles";
type ExplainTab = "math" | "controls" | "docs" | "roadmap";
const docCategoryLabels: Record<string, string> = {
  lessons: "Beginner lessons",
  docs: "Reference docs",
  research: "Research notes",
};

const supportCandidates = [
  {
    model: "google/gemma-4-E4B-it",
    priority: "next",
    path: "Same Gemma 4 adapter family as E2B; validate local download, layer count, and coefficient sweep.",
    source:
      "Google/Hugging Face Gemma 4 cards list E2B and E4B as current family members.",
  },
  {
    model: "google/gemma-4-12B-it",
    priority: "near",
    path: "Likely compatible after memory validation; useful quality jump for the same steering math.",
    source:
      "Google Gemma 4 docs list 12B alongside E2B/E4B and larger variants.",
  },
  {
    model: "microsoft/Phi-4-mini-instruct",
    priority: "near",
    path: "Small causal LM candidate; should be faster to make hook-compatible than MoE/multimodal models.",
    source:
      "Microsoft model card describes a lightweight Phi-4 mini instruction model.",
  },
  {
    model: "mistralai/Ministral-3-3B-Instruct-2512",
    priority: "near",
    path: "Small Mistral-family model; likely `model.layers` style discovery, but license/runtime must be checked.",
    source:
      "Mistral model card describes a 3B instruction model with vision-capable family context.",
  },
  {
    model: "Qwen/Qwen3.6-27B",
    priority: "research",
    path: "Validate processor formatting, hidden states, and qwen3_5 layer paths before enabling controls.",
    source:
      "Qwen3.6 cards are current open Qwen targets, but architecture is not yet locally proven here.",
  },
  {
    model: "google/diffusiongemma-26B-A4B-it",
    priority: "research",
    path: "Keep generation-first. Steering needs diffusion-phase intervention design, not a causal-LM shortcut.",
    source:
      "Google docs describe block diffusion/canvas denoising rather than ordinary autoregressive decoding.",
  },
];

const knobGuides = [
  {
    name: "Layer",
    plain: "Chooses which transformer block receives the activation edit.",
    how: "The backend reads hidden states from `hidden_states[layer + 1]` and registers a hook on the matching block.",
    tuning:
      "Start in middle layers. Earlier layers can be too syntactic; later layers can be too output-specific.",
  },
  {
    name: "Coefficient",
    plain: "Controls how strongly the steering vector is added.",
    how: "`direction = normalized_vector * coefficient`, then `h' = h + direction`.",
    tuning:
      "Sweep small values first. Too high can make text repetitive, brittle, or off-task.",
  },
  {
    name: "Hook stage",
    plain:
      "Chooses whether the vector is added before or after the selected block runs.",
    how: "Pre-hook edits block input. Post-hook edits block output/residual stream.",
    tuning:
      "Compare both. Post is more direct; pre lets attention/MLP transform the intervention.",
  },
  {
    name: "Token scope",
    plain:
      "Chooses whether to edit only the final prompt token or every token position.",
    how: "`last_token` updates `hidden[:, -1, :]`; `all_tokens` broadcasts the vector across sequence positions.",
    tuning:
      "Last-token is conservative. All-token is stronger and easier to see, but can disturb more behavior.",
  },
  {
    name: "Normalize",
    plain:
      "Controls whether the vector is scaled to unit length before coefficient scaling.",
    how: "Uses L2 normalization so coefficient values are easier to compare across prompt pairs.",
    tuning:
      "Keep on for sweeps. Turn off only when vector magnitude itself is part of the experiment.",
  },
  {
    name: "Max tokens",
    plain: "Caps how long each generation can be.",
    how: "Passed to the model generation call as `max_new_tokens`.",
    tuning: "Use short caps for sweeps and longer caps for qualitative review.",
  },
  {
    name: "Top-p / Top-k / Temperature",
    plain: "Sampling controls. They matter only when sampling is enabled.",
    how: "Temperature rescales logits; top-p and top-k restrict candidate tokens before sampling.",
    tuning:
      "Use greedy decoding for controlled comparisons, then sample for product feel.",
  },
  {
    name: "Prompt pairs",
    plain:
      "Define the behavioral direction you want to move toward and away from.",
    how: "The vector is the mean difference between positive and negative hidden states.",
    tuning:
      "Use matched pairs that differ mainly in the target behavior, not in topic or length.",
  },
];

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "pending";
  return value.toFixed(2);
}

function aggregateText(value: unknown, fallback = "0"): string {
  return typeof value === "number" ? String(value) : fallback;
}

export function SweepPanel({
  apiMode,
  selectedModel,
  layersText,
  coefficientsText,
  onLayersTextChange,
  onCoefficientsTextChange,
  onPlan,
  onRun,
  busy,
  plan,
  result,
}: {
  apiMode: "checking" | "local" | "static";
  selectedModel: ModelRegistryEntry;
  layersText: string;
  coefficientsText: string;
  onLayersTextChange: (value: string) => void;
  onCoefficientsTextChange: (value: string) => void;
  onPlan: () => void;
  onRun: () => void;
  busy: boolean;
  plan: SweepPlan | null;
  result: SweepResult | null;
}) {
  const [sweepAction, setSweepAction] = useState("");
  const runBlocked = apiMode !== "local" || !selectedModel.steering_ready;
  const manifestJson = result ? JSON.stringify(result, null, 2) : "";
  const manifestBaseName = safeFileName(result?.sweep_id ?? "sweep-result");

  async function handleCopyManifest() {
    const copied = await copyTextToClipboard(manifestJson);
    setSweepAction(
      copied ? "Sweep manifest copied" : "Sweep manifest unavailable",
    );
  }

  function handleDownloadManifest() {
    downloadTextFile(
      `${manifestBaseName}.json`,
      manifestJson,
      "application/json;charset=utf-8",
    );
    setSweepAction(`${manifestBaseName}.json downloaded`);
  }

  return (
    <section className="glass-panel sweep-panel">
      <div className="panel-title">
        <Layers size={18} />
        <span>Layer / Coefficient Sweep</span>
      </div>
      <div className="sweep-controls">
        <label>
          Layers
          <input
            value={layersText}
            onChange={(event) => onLayersTextChange(event.target.value)}
          />
          <small className="field-help">
            Comma or space separated block numbers.
          </small>
        </label>
        <label>
          Coefficients
          <input
            value={coefficientsText}
            onChange={(event) => onCoefficientsTextChange(event.target.value)}
          />
          <small className="field-help">
            Strength values for the selected direction.
          </small>
        </label>
        <div className="sweep-actions">
          <button
            className="secondary-button compact"
            onClick={onPlan}
            disabled={busy || apiMode !== "local"}
          >
            <SlidersHorizontal size={16} /> Plan
          </button>
          <button
            className="primary-button"
            onClick={onRun}
            disabled={busy || runBlocked}
          >
            <Play size={16} /> Run Sweep
          </button>
        </div>
      </div>

      <div className="sweep-status-row">
        <span className={runBlocked ? "blocked-note" : "ready-note"}>
          {apiMode !== "local"
            ? "Static Pages mode"
            : runBlocked
              ? "Model is not steering-ready"
              : "Ready to execute grid"}
        </span>
        {plan ? (
          <strong>Last saved plan: {plan.count} runs</strong>
        ) : (
          <strong>No grid planned</strong>
        )}
      </div>

      {plan ? (
        <>
          <p className="field-help">
            Saved plan models:{" "}
            {[...new Set(plan.runs.map((run) => run.model_id))].join(", ") ||
              "none"}
            . Editing controls configures the next plan and run; this preview
            retains its submitted values.
          </p>
          <div className="sweep-plan-list" aria-label="Planned sweep runs">
            {plan.runs.slice(0, 8).map((run, index) => (
              <span key={`${run.layer}-${run.coefficient}-${index}`}>
                L{run.layer} / {run.coefficient}
              </span>
            ))}
            {plan.runs.length > 8 ? (
              <span>+{plan.runs.length - 8} more</span>
            ) : null}
          </div>
        </>
      ) : null}

      {result ? (
        <section className="sweep-result">
          <p>
            <strong>Last completed sweep: {result.sweep_id}</strong>
          </p>
          <p>
            Model: {String(result.base_request.model_id ?? "not recorded")}.
            Layers: {result.axes.layers.join(", ")}. Coefficients:{" "}
            {result.axes.coefficients.join(", ")}.
          </p>
          <p>
            These results and the exported manifest describe this saved sweep.
            Editing controls configures the next run.
          </p>
          <div className="sweep-metrics">
            <Metric label="Status" value={result.status} />
            <Metric
              label="Completed"
              value={aggregateText(
                result.aggregate_diagnostics.completed_runs,
                String(result.run_count),
              )}
            />
            <Metric
              label="Activation changed"
              value={aggregateText(
                result.aggregate_diagnostics.activation_changed_runs,
              )}
            />
            <Metric
              label="Prompt changed"
              value={aggregateText(
                result.aggregate_diagnostics.prompt_control_changed_runs,
              )}
            />
            <Metric
              label="Manifest"
              value={result.artifact_path ?? "not saved"}
            />
          </div>
          <div className="artifact-actions" aria-label="Sweep manifest actions">
            <button className="icon-action" onClick={handleCopyManifest}>
              <Copy size={15} /> Copy manifest
            </button>
            <button className="icon-action" onClick={handleDownloadManifest}>
              <Download size={15} /> Download manifest
            </button>
          </div>
          {sweepAction ? <p className="action-status">{sweepAction}</p> : null}
          <div className="sweep-table-wrap">
            <table className="sweep-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Layer</th>
                  <th>Coeff</th>
                  <th>Activation delta</th>
                  <th>Artifact</th>
                </tr>
              </thead>
              <tbody>
                {result.runs.slice(0, 12).map((run) => (
                  <tr key={run.experiment_id}>
                    <td>{run.index + 1}</td>
                    <td>{run.layer}</td>
                    <td>{run.coefficient}</td>
                    <td>
                      {run.steering_delta.char_delta >= 0 ? "+" : ""}
                      {run.steering_delta.char_delta} chars
                    </td>
                    <td>{run.artifact_path ?? "not saved"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.runs.length > 12 ? (
            <p className="sweep-footnote">
              Showing 12 of {result.runs.length} runs.
            </p>
          ) : null}
          <code>{result.reproduce_command}</code>
        </section>
      ) : null}
    </section>
  );
}

export function DocsExplorer({
  title,
  docs,
  selectedDocId,
  onSelectDoc,
  docContent,
  className = "",
}: {
  title: string;
  docs: LocalDoc[];
  selectedDocId: string;
  onSelectDoc: (docId: string, sectionId?: string) => void;
  docContent: LocalDocContent | null;
  className?: string;
}) {
  const [docQuery, setDocQuery] = useState("");
  const normalizedDocQuery = docQuery.trim().toLowerCase();
  const filteredDocs = useMemo(
    () =>
      normalizedDocQuery
        ? docs.filter((doc) =>
            [doc.title, doc.summary, doc.path, doc.category]
              .join(" ")
              .toLowerCase()
              .includes(normalizedDocQuery),
          )
        : docs,
    [docs, normalizedDocQuery],
  );
  const categories = Array.from(
    new Set(filteredDocs.map((doc) => doc.category)),
  );
  const sections = docContent?.sections ?? [];

  return (
    <section className={`docs-grid ${className}`} id="docs">
      <aside className="glass-panel docs-list">
        <div className="panel-title">
          <ScrollText size={18} />
          <span>{title}</span>
        </div>
        <label className="doc-search">
          <Search size={16} />
          <input
            aria-label={`${title} search`}
            placeholder="Search docs"
            value={docQuery}
            onChange={(event) => setDocQuery(event.target.value)}
          />
        </label>
        <p className="doc-count">
          Showing {filteredDocs.length} of {docs.length} docs
        </p>
        {categories.map((category) => (
          <div className="doc-group" key={category}>
            <span>
              {docCategoryLabels[category] ?? category}
              <em>
                {filteredDocs.filter((doc) => doc.category === category).length}
              </em>
            </span>
            {filteredDocs
              .filter((doc) => doc.category === category)
              .map((doc) => (
                <button
                  className={`doc-row ${doc.doc_id === selectedDocId ? "selected" : ""}`}
                  key={doc.doc_id}
                  onClick={() => onSelectDoc(doc.doc_id)}
                >
                  <strong>{doc.title}</strong>
                  <small>{doc.path}</small>
                  <span>{doc.summary}</span>
                </button>
              ))}
          </div>
        ))}
        {!filteredDocs.length ? (
          <p className="doc-empty">No bundled docs match that search.</p>
        ) : null}
      </aside>
      <DocOutline
        docId={selectedDocId}
        sections={sections}
        onSelectDoc={onSelectDoc}
      />
      <section className="glass-panel doc-reader">
        <div className="panel-title">
          <BookOpen size={18} />
          <span>{docContent?.doc.title ?? "Loading document"}</span>
        </div>
        <MarkdownOutput
          text={docContent?.content ?? "Loading local documentation..."}
          headingIdPrefix="doc-section-"
        />
      </section>
    </section>
  );
}

function DocOutline({
  docId,
  sections,
  onSelectDoc,
}: {
  docId: string;
  sections: LocalDocSection[];
  onSelectDoc: (docId: string, sectionId?: string) => void;
}) {
  return (
    <aside className="glass-panel doc-outline" aria-label="Document sections">
      <div className="panel-title">
        <ChevronRight size={18} />
        <span>On This Page</span>
      </div>
      {sections.length ? (
        <nav>
          {sections.map((section) => (
            <a
              className={`outline-row level-${Math.min(Math.max(section.level, 1), 4)}`}
              href={`#docs/${docId}/${section.id}`}
              key={section.id}
              onClick={(event) => {
                event.preventDefault();
                onSelectDoc(docId, section.id);
              }}
            >
              {section.title}
            </a>
          ))}
        </nav>
      ) : (
        <p className="outline-empty">
          Section outline will appear after the document loads.
        </p>
      )}
    </aside>
  );
}

export function ConsoleRail({
  record,
  payload,
  introspection,
  logs,
  artifactPreview,
  onFetchArtifact,
}: {
  record: RunRecord | null;
  payload: ExperimentPayload;
  introspection: IntrospectionReport | null;
  logs: string[];
  artifactPreview: string;
  onFetchArtifact: () => void;
}) {
  const [artifactAction, setArtifactAction] = useState("");
  const result = record?.result;
  const artifactBaseName = safeFileName(result?.experiment_id ?? "not-run");
  const artifactJson = record ? runRecordJson(record) : "";
  const vectorJson = record ? vectorMetadataJson(record) : "";

  async function handleCopyArtifact(text: string, label: string) {
    const copied = await copyTextToClipboard(text);
    setArtifactAction(copied ? `${label} copied` : `${label} unavailable`);
  }
  function handleDownloadArtifact(filename: string, text: string) {
    downloadTextFile(filename, text, "application/json;charset=utf-8");
    setArtifactAction(`${filename} downloaded`);
  }

  return (
    <aside className="right-rail">
      <section className="glass-panel">
        <div className="panel-title">
          <BarChart3 size={18} />
          <span>Last completed diagnostics</span>
        </div>
        {result ? (
          <>
            <p>
              <code>{result.experiment_id}</code>
            </p>
            <Metric
              label="Vector norm"
              value={formatNumber(result.diagnostics.vector_norm)}
            />
            <Metric
              label="Pair count"
              value={String(result.diagnostics.pair_count)}
            />
            <Metric
              label="Cosine mean"
              value={formatNumber(result.diagnostics.pairwise_cosine_mean)}
            />
            <Metric
              label="Separability"
              value={formatNumber(result.diagnostics.separability_score)}
            />
            <Metric
              label="Reliability"
              value={result.diagnostics.reliability_label}
            />
            <Metric
              label="Prompt-only delta"
              value={`${result.control_delta.char_delta >= 0 ? "+" : ""}${result.control_delta.char_delta} chars`}
            />
            <Metric
              label="Activation delta"
              value={`${result.steering_delta.char_delta >= 0 ? "+" : ""}${result.steering_delta.char_delta} chars`}
            />
          </>
        ) : (
          <p>
            No measurements yet. Diagnostics appear after a local experiment
            completes.
          </p>
        )}
      </section>
      <section className="glass-panel explain-panel">
        <div className="panel-title">
          <BookOpen size={18} />
          <span>Draft configuration</span>
        </div>
        <p>
          <code>v = mean(h+ - h-)</code>
          <code>h' = h + alpha * v</code>
        </p>
        <p>
          Layer {payload.layer}, {payload.hook_stage}-activation,{" "}
          {payload.apply_to.replace("_", " ")}.
        </p>
        <p>
          Prompt-only control uses the prompt-pair direction as ordinary
          instructions, then activation steering compares against that control.
        </p>
        {introspection ? (
          <p className="warning-copy">
            Last completed introspection for {introspection.model_id}:{" "}
            {introspection.status}.{" "}
            {introspection.warnings[0] ?? "No warning returned."}
          </p>
        ) : (
          <p className="warning-copy">
            Run introspection before treating non-Gemma models as steerable.
          </p>
        )}
      </section>
      <section className="glass-panel artifact-panel">
        <div className="panel-title">
          <Braces size={18} />
          <span>Completed-run artifacts</span>
        </div>
        {result ? (
          <>
            <p>
              Exports use the submitted configuration for{" "}
              <code>{result.experiment_id}</code>, even when the draft changes.
            </p>
            <code>{result.reproduce_command}</code>
            <span>
              <ChevronRight size={14} />{" "}
              {result.vector_path ?? "vector not saved"}
            </span>
            <span>
              <ChevronRight size={14} />{" "}
              {result.artifact_path ?? "result not saved"}
            </span>
            <button
              className="secondary-button compact"
              onClick={onFetchArtifact}
            >
              <Braces size={15} /> Fetch saved JSON artifact
            </button>
            <div
              className="artifact-actions"
              aria-label="Artifact export actions"
            >
              <button
                className="icon-action"
                onClick={() => handleCopyArtifact(artifactJson, "Run record")}
              >
                <Copy size={15} /> Copy run JSON
              </button>
              <button
                className="icon-action"
                onClick={() =>
                  handleDownloadArtifact(
                    `${artifactBaseName}.console-run.json`,
                    artifactJson,
                  )
                }
              >
                <Download size={15} /> Download run JSON
              </button>
              <button
                className="icon-action"
                onClick={() =>
                  handleCopyArtifact(vectorJson, "Vector metadata")
                }
              >
                <Copy size={15} /> Copy vector metadata
              </button>
              <button
                className="icon-action"
                onClick={() =>
                  handleDownloadArtifact(
                    `${artifactBaseName}.vector-metadata.json`,
                    vectorJson,
                  )
                }
              >
                <Download size={15} /> Download vector metadata
              </button>
            </div>
            {artifactAction && (
              <p className="action-status">{artifactAction}</p>
            )}
            {artifactPreview && (
              <pre className="artifact-json">{artifactPreview}</pre>
            )}
          </>
        ) : (
          <p>
            No result or vector artifact exists yet. Export actions appear after
            a completed local run.
          </p>
        )}
      </section>
      <section className="glass-panel logs-panel">
        <div className="panel-title">
          <TerminalSquare size={18} />
          <span>Logs</span>
        </div>
        {logs.slice(0, 6).map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
      </section>
    </aside>
  );
}

export function ExplainabilityView({
  payload,
  models,
  selectedModel,
  explainTab,
  setExplainTab,
  docs,
  selectedDocId,
  onSelectDoc,
  docContent,
}: {
  payload: ExperimentPayload;
  models: ModelRegistryEntry[];
  selectedModel: ModelRegistryEntry;
  explainTab: "math" | "controls" | "docs" | "roadmap";
  setExplainTab: (tab: ExplainTab) => void;
  docs: LocalDoc[];
  selectedDocId: string;
  onSelectDoc: (docId: string, sectionId?: string) => void;
  docContent: LocalDocContent | null;
}) {
  return (
    <section className="learning-shell">
      <nav className="subtabbar glass-panel" aria-label="Explainability tabs">
        <button
          className={explainTab === "math" ? "active" : ""}
          onClick={() => setExplainTab("math")}
        >
          <FunctionSquare size={16} /> Math & Architecture
        </button>
        <button
          className={explainTab === "controls" ? "active" : ""}
          onClick={() => setExplainTab("controls")}
        >
          <Wrench size={16} /> Control Knobs
        </button>
        <button
          className={explainTab === "docs" ? "active" : ""}
          onClick={() => setExplainTab("docs")}
        >
          <BookOpen size={16} /> Local Docs
        </button>
        <button
          className={explainTab === "roadmap" ? "active" : ""}
          onClick={() => setExplainTab("roadmap")}
        >
          <BrainCircuit size={16} /> Model Roadmap
        </button>
      </nav>

      {explainTab === "math" && (
        <section className="learning-grid">
          <section className="glass-panel learning-main">
            <div className="panel-title">
              <FunctionSquare size={18} />
              <span>Activation Steering Math</span>
            </div>
            <div className="math-stack">
              <div className="equation-card">
                <span>Contrast vector</span>
                <code>v_l = mean_i(h_l(x_i+) - h_l(x_i-))</code>
              </div>
              <div className="equation-card">
                <span>Normalized direction</span>
                <code>v_hat = v / ||v||_2</code>
              </div>
              <div className="equation-card">
                <span>Intervention</span>
                <code>h'_l,t = h_l,t + alpha * v_hat</code>
              </div>
            </div>
            <div className="diagram-row">
              <div>Prompt pair</div>
              <span />
              <div>Hidden states</div>
              <span />
              <div>Vector</div>
              <span />
              <div>Hooked generation</div>
            </div>
            <div className="learning-copy">
              <p>
                The console estimates a direction in residual-stream space. A
                positive prompt and a negative prompt are run through the frozen
                model, their layer activations are subtracted, and the resulting
                vector is injected during generation.
              </p>
              <p>
                Pre-activation hooks edit the input to a block. Post-activation
                hooks edit the block output. Coefficient sweeps test whether the
                same direction has a smooth behavioral effect or collapses
                output quality.
              </p>
            </div>
          </section>

          <section className="glass-panel architecture-panel">
            <div className="panel-title">
              <Layers size={18} />
              <span>Draft configuration</span>
            </div>
            <Metric label="Selected model" value={selectedModel.display_name} />
            <Metric label="Layer" value={String(payload.layer)} />
            <Metric label="Coefficient" value={String(payload.coefficient)} />
            <Metric
              label="Hook"
              value={`${payload.hook_stage} / ${payload.apply_to}`}
            />
            <Metric label="Registry size" value={String(models.length)} />
          </section>
        </section>
      )}

      {explainTab === "controls" && (
        <section className="knob-grid">
          {knobGuides.map((guide) => (
            <article className="glass-panel knob-card" key={guide.name}>
              <strong>{guide.name}</strong>
              <p>{guide.plain}</p>
              <dl>
                <dt>How it works</dt>
                <dd>{guide.how}</dd>
                <dt>How to tune it</dt>
                <dd>{guide.tuning}</dd>
              </dl>
            </article>
          ))}
        </section>
      )}

      {explainTab === "docs" && (
        <DocsExplorer
          title="Attached Local Docs"
          docs={docs}
          selectedDocId={selectedDocId}
          onSelectDoc={onSelectDoc}
          docContent={docContent}
        />
      )}

      {explainTab === "roadmap" && (
        <section className="learning-grid">
          <section className="glass-panel research-panel">
            <div className="panel-title">
              <ScrollText size={18} />
              <span>Research Trail</span>
            </div>
            <div className="research-list">
              <ResearchItem
                title="ActAdd"
                detail="Prompt-pair activation addition. Best first baseline for this repo."
              />
              <ResearchItem
                title="CAA"
                detail="Dataset-averaged contrast vectors. Next step for robust steering."
              />
              <ResearchItem
                title="Reliability"
                detail="Pair agreement and separability predict whether a vector is likely to work."
              />
              <ResearchItem
                title="SAE-guided steering"
                detail="Later path for feature-level control and side-effect reduction."
              />
            </div>
          </section>

          <section className="glass-panel support-panel">
            <div className="panel-title">
              <BrainCircuit size={18} />
              <span>Support Roadmap</span>
            </div>
            <div className="candidate-list">
              {supportCandidates.map((candidate) => (
                <article className="candidate-card" key={candidate.model}>
                  <strong>{candidate.model}</strong>
                  <em>{candidate.priority}</em>
                  <p>{candidate.path}</p>
                  <small>{candidate.source}</small>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
    </section>
  );
}

function ResearchItem({ title, detail }: { title: string; detail: string }) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function OutputPane({
  title,
  text,
  tone,
  diffResult,
  side,
}: {
  title: string;
  text: string;
  tone: "baseline" | "prompt" | "steered";
  diffResult: DiffResult | null;
  side: "left" | "right";
}) {
  const renderedRef = useRef<HTMLDivElement>(null);
  const [outputAction, setOutputAction] = useState("");
  const diffContent = diffResult ? diffResult[side] : null;
  const diffLabel =
    diffResult?.mode === "exact"
      ? "Exact word-level diff"
      : diffResult?.mode === "line"
        ? "Long response line-level diff"
        : "Long response streaming diff";
  const fileBaseName = safeFileName(title.toLowerCase());

  async function handleCopyRendered() {
    const renderedText = renderedRef.current?.innerText ?? text;
    const copied = await copyTextToClipboard(renderedText);
    setOutputAction(copied ? "Rendered text copied" : "Copy unavailable");
  }

  async function handleCopyRaw() {
    const copied = await copyTextToClipboard(text);
    setOutputAction(copied ? "Raw Markdown copied" : "Copy unavailable");
  }

  function handleDownloadRaw() {
    downloadTextFile(`${fileBaseName}.md`, text);
    setOutputAction(`${fileBaseName}.md downloaded`);
  }

  return (
    <section className={`glass-panel output-pane ${tone}`}>
      <div className="panel-title">
        {tone === "steered" ? (
          <Sparkles size={18} />
        ) : tone === "prompt" ? (
          <ScrollText size={18} />
        ) : (
          <AlertTriangle size={18} />
        )}
        <span>{title}</span>
      </div>
      <div className="output-actions" aria-label={`${title} export actions`}>
        <button className="icon-action" onClick={handleCopyRendered}>
          <Copy size={15} /> Copy rendered
        </button>
        <button className="icon-action" onClick={handleCopyRaw}>
          <Copy size={15} /> Copy raw
        </button>
        <button className="icon-action" onClick={handleDownloadRaw}>
          <Download size={15} /> Download
        </button>
      </div>
      {outputAction ? <p className="action-status">{outputAction}</p> : null}
      <div ref={renderedRef}>
        <MarkdownOutput text={text} />
      </div>
      {diffContent ? (
        <details className="diff-panel" open>
          <summary>Automatic diff highlights</summary>
          <small className="diff-mode">{diffLabel}</small>
          <div className="diff-body">{renderDiffTokens(diffContent)}</div>
        </details>
      ) : null}
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
