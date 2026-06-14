import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Braces,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  FunctionSquare,
  Gauge,
  GraduationCap,
  Layers,
  Play,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Wrench
} from "lucide-react";
import { renderDiffTokens, safeDiffTokens, type DiffResult } from "./lib/diff";
import { MarkdownOutput } from "./lib/markdown";
import {
  fallbackModels,
  fetchDoc,
  fetchDocs,
  fetchExperiment,
  fetchModels,
  fetchRuntimeStatus,
  introspectModel,
  runExperiment
} from "./lib/api";
import { steeringPresets, type SteeringPreset } from "./lib/presets";
import type {
  ExperimentPayload,
  ExperimentResult,
  IntrospectionReport,
  LocalDoc,
  LocalDocContent,
  ModelRegistryEntry,
  RuntimeStatus
} from "./lib/types";

const initialPayload: ExperimentPayload = {
  model_id: "google/gemma-4-E2B-it",
  ...steeringPresets[0].payload
};

const demoResult: ExperimentResult = {
  experiment_id: "preview_not_run",
  created_at_utc: new Date().toISOString(),
  baseline:
    "## Customer reply\n\nI can check the order details and see what happened with the shipment. Please send the tracking number and order ID.\n\n- confirm the order\n- review the shipment\n- reply with the next step",
  steered:
    "## Customer reply\n\nI am sorry the replacement part arrived late. I will check the order, confirm the delivery issue, and outline the fastest next step so this gets resolved cleanly.\n\n- confirm the order\n- review the shipment\n- provide a clear resolution path",
  diagnostics: {
    vector_norm: 1,
    pair_count: 2,
    pairwise_cosine_mean: 0.42,
    pairwise_cosine_min: 0.31,
    separability_score: 1.14,
    reliability_label: "directionally coherent"
  },
  output_delta: {
    changed: true,
    baseline_chars: 190,
    steered_chars: 247,
    char_delta: 57,
    word_jaccard: 0.42
  },
  vector_path: "vectors/preview.pt",
  artifact_path: "results/preview.json",
  reproduce_command:
    "python scripts/run_actadd.py --config configs/prompt_pairs/customer_support_empathy.yaml --layer 18 --coefficient 1.5 --hook-stage post"
};

const supportCandidates = [
  {
    model: "google/gemma-4-E4B-it",
    priority: "next",
    path: "Same Gemma 4 adapter family as E2B; validate local download, layer count, and coefficient sweep.",
    source: "Google/Hugging Face Gemma 4 cards list E2B and E4B as current family members."
  },
  {
    model: "google/gemma-4-12B-it",
    priority: "near",
    path: "Likely compatible after memory validation; useful quality jump for the same steering math.",
    source: "Google Gemma 4 docs list 12B alongside E2B/E4B and larger variants."
  },
  {
    model: "microsoft/Phi-4-mini-instruct",
    priority: "near",
    path: "Small causal LM candidate; should be faster to make hook-compatible than MoE/multimodal models.",
    source: "Microsoft model card describes a lightweight Phi-4 mini instruction model."
  },
  {
    model: "mistralai/Ministral-3-3B-Instruct-2512",
    priority: "near",
    path: "Small Mistral-family model; likely `model.layers` style discovery, but license/runtime must be checked.",
    source: "Mistral model card describes a 3B instruction model with vision-capable family context."
  },
  {
    model: "Qwen/Qwen3.6-27B",
    priority: "research",
    path: "Validate processor formatting, hidden states, and qwen3_5 layer paths before enabling controls.",
    source: "Qwen3.6 cards are current open Qwen targets, but architecture is not yet locally proven here."
  },
  {
    model: "google/diffusiongemma-26B-A4B-it",
    priority: "research",
    path: "Keep generation-first. Steering needs diffusion-phase intervention design, not a causal-LM shortcut.",
    source: "Google docs describe block diffusion/canvas denoising rather than ordinary autoregressive decoding."
  }
];

const knobGuides = [
  {
    name: "Layer",
    plain: "Chooses which transformer block receives the activation edit.",
    how: "The backend reads hidden states from `hidden_states[layer + 1]` and registers a hook on the matching block.",
    tuning: "Start in middle layers. Earlier layers can be too syntactic; later layers can be too output-specific."
  },
  {
    name: "Coefficient",
    plain: "Controls how strongly the steering vector is added.",
    how: "`direction = normalized_vector * coefficient`, then `h' = h + direction`.",
    tuning: "Sweep small values first. Too high can make text repetitive, brittle, or off-task."
  },
  {
    name: "Hook stage",
    plain: "Chooses whether the vector is added before or after the selected block runs.",
    how: "Pre-hook edits block input. Post-hook edits block output/residual stream.",
    tuning: "Compare both. Post is more direct; pre lets attention/MLP transform the intervention."
  },
  {
    name: "Token scope",
    plain: "Chooses whether to edit only the final prompt token or every token position.",
    how: "`last_token` updates `hidden[:, -1, :]`; `all_tokens` broadcasts the vector across sequence positions.",
    tuning: "Last-token is conservative. All-token is stronger and easier to see, but can disturb more behavior."
  },
  {
    name: "Normalize",
    plain: "Controls whether the vector is scaled to unit length before coefficient scaling.",
    how: "Uses L2 normalization so coefficient values are easier to compare across prompt pairs.",
    tuning: "Keep on for sweeps. Turn off only when vector magnitude itself is part of the experiment."
  },
  {
    name: "Max tokens",
    plain: "Caps how long each generation can be.",
    how: "Passed to the model generation call as `max_new_tokens`.",
    tuning: "Use short caps for sweeps and longer caps for qualitative review."
  },
  {
    name: "Top-p / Top-k / Temperature",
    plain: "Sampling controls. They matter only when sampling is enabled.",
    how: "Temperature rescales logits; top-p and top-k restrict candidate tokens before sampling.",
    tuning: "Use greedy decoding for controlled comparisons, then sample for product feel."
  },
  {
    name: "Prompt pairs",
    plain: "Define the behavioral direction you want to move toward and away from.",
    how: "The vector is the mean difference between positive and negative hidden states.",
    tuning: "Use matched pairs that differ mainly in the target behavior, not in topic or length."
  }
];

function statusTone(status: string): string {
  if (status === "supported") return "good";
  if (status === "generation_only") return "info";
  if (status === "experimental") return "warn";
  return "neutral";
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "pending";
  return value.toFixed(2);
}

function applyPreset(preset: SteeringPreset, currentModelId: string): ExperimentPayload {
  return { model_id: currentModelId, ...preset.payload };
}

export function App() {
  const [models, setModels] = useState<ModelRegistryEntry[]>(fallbackModels);
  const [payload, setPayload] = useState<ExperimentPayload>(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload.model_id);
  const [selectedPresetId, setSelectedPresetId] = useState(steeringPresets[0].id);
  const [introspection, setIntrospection] = useState<IntrospectionReport | null>(null);
  const [result, setResult] = useState<ExperimentResult>(demoResult);
  const [logs, setLogs] = useState<string[]>(["Workbench initialized with local fallback registry."]);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"console" | "explain">("console");
  const [explainTab, setExplainTab] = useState<"math" | "controls" | "docs" | "roadmap">("math");
  const [autoDiff, setAutoDiff] = useState(true);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("methodology");
  const [docContent, setDocContent] = useState<LocalDocContent | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [artifactPreview, setArtifactPreview] = useState("");

  useEffect(() => {
    fetchModels().then((items) => {
      setModels(items);
      setLogs((current) => [`Loaded ${items.length} model registry entries.`, ...current]);
    });
    fetchRuntimeStatus()
      .then((status) => {
        setRuntimeStatus(status);
        setLogs((current) => [`Runtime default: ${status.hf_model_id}, layer ${status.default_layer}.`, ...current]);
      })
      .catch((error) => setLogs((current) => [`Runtime status unavailable: ${(error as Error).message}`, ...current]));
    fetchDocs()
      .then((items) => {
        setDocs(items);
        setSelectedDocId(items[0]?.doc_id ?? "methodology");
      })
      .catch((error) => setLogs((current) => [`Doc index unavailable: ${(error as Error).message}`, ...current]));
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    fetchDoc(selectedDocId)
      .then(setDocContent)
      .catch((error) => setLogs((current) => [`Doc load failed: ${(error as Error).message}`, ...current]));
  }, [selectedDocId]);

  const selectedModel = useMemo(
    () => models.find((model) => model.model_id === selectedId) ?? models[0],
    [models, selectedId]
  );

  const selectedPreset = useMemo(
    () => steeringPresets.find((preset) => preset.id === selectedPresetId) ?? steeringPresets[0],
    [selectedPresetId]
  );

  const diff = useMemo(() => safeDiffTokens(result.baseline, result.steered), [result.baseline, result.steered]);

  useEffect(() => {
    if (!selectedModel) return;
    setPayload((current) => ({
      ...current,
      model_id: selectedModel.model_id,
      layer: selectedModel.default_layer ?? current.layer,
      coefficient: selectedModel.default_coefficient ?? current.coefficient
    }));
    setIntrospection(null);
  }, [selectedModel]);

  function choosePreset(preset: SteeringPreset) {
    setSelectedPresetId(preset.id);
    setPayload(applyPreset(preset, selectedModel.model_id));
    setLogs((current) => [`Preset loaded: ${preset.name}.`, ...current]);
  }

  async function handleIntrospect() {
    setBusy(true);
    try {
      const report = await introspectModel(selectedModel.model_id);
      setIntrospection(report);
      setLogs((current) => [`Introspection status: ${report.status} for ${report.model_id}.`, ...current]);
    } catch (error) {
      setLogs((current) => [`Introspection failed: ${(error as Error).message}`, ...current]);
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    if (!selectedModel.steering_ready) {
      setLogs((current) => [`Run blocked: ${selectedModel.steering_notes}`, ...current]);
      return;
    }
    setBusy(true);
    try {
      const next = await runExperiment(payload);
      setResult(next);
      setLogs((current) => [`Experiment ${next.experiment_id} completed and exported.`, ...current]);
    } catch (error) {
      setLogs((current) => [`Experiment failed: ${(error as Error).message}`, ...current]);
    } finally {
      setBusy(false);
    }
  }

  async function handleFetchArtifact() {
    if (result.experiment_id === "preview_not_run") {
      setArtifactPreview("Run an experiment first, then fetch the saved JSON artifact.");
      return;
    }
    try {
      const artifact = await fetchExperiment(result.experiment_id);
      setArtifactPreview(JSON.stringify(artifact, null, 2));
      setLogs((current) => [`Fetched artifact ${artifact.experiment_id}.`, ...current]);
    } catch (error) {
      setLogs((current) => [`Artifact fetch failed: ${(error as Error).message}`, ...current]);
    }
  }

  function updatePair(index: number, key: "positive" | "negative", value: string) {
    setPayload((current) => ({
      ...current,
      prompt_pairs: current.prompt_pairs.map((pair, pairIndex) =>
        pairIndex === index ? { ...pair, [key]: value } : pair
      )
    }));
  }

  const runBlocked = !selectedModel?.steering_ready;

  return (
    <main className="app-shell">
      <section className="topbar glass-band">
        <div>
          <p className="eyebrow">activation steering workbench</p>
          <h1>Model Steering Console</h1>
        </div>
        <div className="runtime-strip">
          <span><Activity size={16} /> API-aware</span>
          <span><Gauge size={16} /> {runtimeStatus?.hf_model_id ?? "HF local / served"}</span>
          <span><CheckCircle2 size={16} /> gated controls</span>
        </div>
      </section>

      <nav className="tabbar glass-band" aria-label="Workbench tabs">
        <button className={activeTab === "console" ? "active" : ""} onClick={() => setActiveTab("console")}>
          <SlidersHorizontal size={16} /> Console
        </button>
        <button className={activeTab === "explain" ? "active" : ""} onClick={() => setActiveTab("explain")}>
          <GraduationCap size={16} /> Explainability
        </button>
      </nav>

      {activeTab === "console" ? (
        <section className="workspace-grid">
          <aside className="left-rail glass-panel">
            <div className="panel-title">
              <BrainCircuit size={18} />
              <span>Models</span>
            </div>
            <div className="model-list">
              {models.map((model) => (
                <button
                  className={`model-row ${model.model_id === selectedId ? "selected" : ""}`}
                  key={model.model_id}
                  onClick={() => setSelectedId(model.model_id)}
                >
                  <span>
                    <strong>{model.display_name}</strong>
                    <small>{model.role}</small>
                  </span>
                  <em className={`badge ${statusTone(model.support_status)}`}>{model.support_status}</em>
                </button>
              ))}
            </div>
            <div className="model-detail">
              <p>{selectedModel.runtime_notes}</p>
              <p className="warning-copy">{selectedModel.steering_notes}</p>
            </div>
            <button className="secondary-button" onClick={handleIntrospect} disabled={busy}>
              <Layers size={16} /> Introspect
            </button>
          </aside>

          <section className="center-stack">
            <section className="glass-panel preset-panel">
              <div className="panel-title">
                <ScrollText size={18} />
                <span>Preset Use Cases</span>
              </div>
              <div className="preset-grid">
                {steeringPresets.map((preset) => (
                  <button
                    className={`preset-card ${preset.id === selectedPreset.id ? "selected" : ""}`}
                    key={preset.id}
                    onClick={() => choosePreset(preset)}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.domain}</span>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel control-panel">
              <div className="panel-title">
                <SlidersHorizontal size={18} />
                <span>Steering Controls</span>
              </div>
              <div className="control-grid">
                <label>
                  Layer
                  <input
                    type="number"
                    value={payload.layer}
                    onChange={(event) => setPayload({ ...payload, layer: Number(event.target.value) })}
                  />
                  <small className="field-help">Transformer block that receives the edit.</small>
                </label>
                <label>
                  Coefficient
                  <input
                    type="number"
                    step="0.1"
                    value={payload.coefficient}
                    onChange={(event) => setPayload({ ...payload, coefficient: Number(event.target.value) })}
                  />
                  <small className="field-help">Scales the steering vector strength.</small>
                </label>
                <label>
                  Hook stage
                  <select
                    value={payload.hook_stage}
                    onChange={(event) => setPayload({ ...payload, hook_stage: event.target.value as "post" | "pre" })}
                  >
                    <option value="post">post activation</option>
                    <option value="pre">pre activation</option>
                  </select>
                  <small className="field-help">Pre edits block input; post edits block output.</small>
                </label>
                <label>
                  Token scope
                  <select
                    value={payload.apply_to}
                    onChange={(event) =>
                      setPayload({ ...payload, apply_to: event.target.value as "last_token" | "all_tokens" })
                    }
                  >
                    <option value="last_token">last token</option>
                    <option value="all_tokens">all tokens</option>
                  </select>
                  <small className="field-help">Apply to prompt boundary or all positions.</small>
                </label>
                <label>
                  Max tokens
                  <input
                    type="number"
                    value={payload.max_new_tokens}
                    onChange={(event) => setPayload({ ...payload, max_new_tokens: Number(event.target.value) })}
                  />
                  <small className="field-help">Caps generated answer length.</small>
                </label>
                <label>
                  Top-p
                  <input
                    type="number"
                    step="0.01"
                    value={payload.top_p}
                    onChange={(event) => setPayload({ ...payload, top_p: Number(event.target.value) })}
                  />
                  <small className="field-help">Sampling nucleus cutoff when sampling is on.</small>
                </label>
                <label>
                  Temperature
                  <input
                    type="number"
                    step="0.05"
                    value={payload.temperature}
                    onChange={(event) => setPayload({ ...payload, temperature: Number(event.target.value) })}
                  />
                  <small className="field-help">Higher values make sampled text more variable.</small>
                </label>
                <label>
                  Top-k
                  <input
                    type="number"
                    value={payload.top_k}
                    onChange={(event) => setPayload({ ...payload, top_k: Number(event.target.value) })}
                  />
                  <small className="field-help">Limits sampling to the top k token candidates.</small>
                </label>
                <label className="checkbox-field">
                  <span>Normalize vector</span>
                  <input
                    type="checkbox"
                    checked={payload.normalize}
                    onChange={(event) => setPayload({ ...payload, normalize: event.target.checked })}
                  />
                  <small className="field-help">Makes coefficient sweeps comparable.</small>
                </label>
                <label className="checkbox-field">
                  <span>Sample output</span>
                  <input
                    type="checkbox"
                    checked={payload.do_sample}
                    onChange={(event) => setPayload({ ...payload, do_sample: event.target.checked })}
                  />
                  <small className="field-help">Off keeps baseline comparisons deterministic.</small>
                </label>
              </div>
              <label className="wide-field">
                User prompt
                <textarea
                  value={payload.user_prompt}
                  onChange={(event) => setPayload({ ...payload, user_prompt: event.target.value })}
                />
              </label>
              <div className="action-row">
                <button className="primary-button" onClick={handleRun} disabled={busy || runBlocked}>
                  <Play size={16} /> Run Steering
                </button>
                <label className="toggle-row">
                  <input type="checkbox" checked={autoDiff} onChange={(event) => setAutoDiff(event.target.checked)} />
                  Auto diff
                </label>
                <span className={runBlocked ? "blocked-note" : "ready-note"}>
                  {runBlocked ? "Steering locked until validation passes" : "Ready for Gemma 4 E2B experiment"}
                </span>
              </div>
            </section>

            <section className="glass-panel pairs-panel">
              <div className="panel-title">
                <FlaskConical size={18} />
                <span>Prompt Pair Dataset</span>
              </div>
              {payload.prompt_pairs.map((pair, index) => (
                <div className="pair-row" key={index}>
                  <label>
                    Positive direction
                    <textarea value={pair.positive} onChange={(event) => updatePair(index, "positive", event.target.value)} />
                  </label>
                  <label>
                    Negative contrast
                    <textarea value={pair.negative} onChange={(event) => updatePair(index, "negative", event.target.value)} />
                  </label>
                </div>
              ))}
            </section>

            <div className="comparison-grid">
              <OutputPane title="Baseline" text={result.baseline} tone="baseline" diffResult={autoDiff ? diff : null} side="left" />
              <OutputPane title="Steered" text={result.steered} tone="steered" diffResult={autoDiff ? diff : null} side="right" />
            </div>
          </section>

          <ConsoleRail
            result={result}
            payload={payload}
            introspection={introspection}
            logs={logs}
            artifactPreview={artifactPreview}
            onFetchArtifact={handleFetchArtifact}
          />
        </section>
      ) : (
        <ExplainabilityView
          payload={payload}
          result={result}
          models={models}
          selectedModel={selectedModel}
          explainTab={explainTab}
          setExplainTab={setExplainTab}
          docs={docs}
          selectedDocId={selectedDocId}
          setSelectedDocId={setSelectedDocId}
          docContent={docContent}
        />
      )}
    </main>
  );
}

function ConsoleRail({
  result,
  payload,
  introspection,
  logs,
  artifactPreview,
  onFetchArtifact
}: {
  result: ExperimentResult;
  payload: ExperimentPayload;
  introspection: IntrospectionReport | null;
  logs: string[];
  artifactPreview: string;
  onFetchArtifact: () => void;
}) {
  return (
    <aside className="right-rail">
      <section className="glass-panel">
        <div className="panel-title">
          <BarChart3 size={18} />
          <span>Diagnostics</span>
        </div>
        <Metric label="Vector norm" value={formatNumber(result.diagnostics.vector_norm)} />
        <Metric label="Pair count" value={String(result.diagnostics.pair_count)} />
        <Metric label="Cosine mean" value={formatNumber(result.diagnostics.pairwise_cosine_mean)} />
        <Metric label="Separability" value={formatNumber(result.diagnostics.separability_score)} />
        <Metric label="Reliability" value={result.diagnostics.reliability_label} />
      </section>

      <section className="glass-panel explain-panel">
        <div className="panel-title">
          <BookOpen size={18} />
          <span>Explainability</span>
        </div>
        <p>
          <code>v = mean(h+ - h-)</code>
          <code>h' = h + alpha * v</code>
        </p>
        <p>
          Layer {payload.layer}, {payload.hook_stage}-activation, {payload.apply_to.replace("_", " ")}.
        </p>
        {introspection ? (
          <p className="warning-copy">
            Introspection: {introspection.status}. {introspection.warnings[0] ?? "No warning returned."}
          </p>
        ) : (
          <p className="warning-copy">Run introspection before treating non-Gemma models as steerable.</p>
        )}
      </section>

      <section className="glass-panel artifact-panel">
        <div className="panel-title">
          <Braces size={18} />
          <span>Artifacts</span>
        </div>
        <code>{result.reproduce_command}</code>
        <span><ChevronRight size={14} /> {result.vector_path ?? "vector not saved"}</span>
        <span><ChevronRight size={14} /> {result.artifact_path ?? "result not saved"}</span>
        <button className="secondary-button compact" onClick={onFetchArtifact}>
          <Braces size={15} /> Fetch JSON artifact
        </button>
        {artifactPreview ? <pre className="artifact-json">{artifactPreview}</pre> : null}
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

function ExplainabilityView({
  payload,
  result,
  models,
  selectedModel,
  explainTab,
  setExplainTab,
  docs,
  selectedDocId,
  setSelectedDocId,
  docContent
}: {
  payload: ExperimentPayload;
  result: ExperimentResult;
  models: ModelRegistryEntry[];
  selectedModel: ModelRegistryEntry;
  explainTab: "math" | "controls" | "docs" | "roadmap";
  setExplainTab: (tab: "math" | "controls" | "docs" | "roadmap") => void;
  docs: LocalDoc[];
  selectedDocId: string;
  setSelectedDocId: (docId: string) => void;
  docContent: LocalDocContent | null;
}) {
  return (
    <section className="learning-shell">
      <nav className="subtabbar glass-panel" aria-label="Explainability tabs">
        <button className={explainTab === "math" ? "active" : ""} onClick={() => setExplainTab("math")}>
          <FunctionSquare size={16} /> Math & Architecture
        </button>
        <button className={explainTab === "controls" ? "active" : ""} onClick={() => setExplainTab("controls")}>
          <Wrench size={16} /> Control Knobs
        </button>
        <button className={explainTab === "docs" ? "active" : ""} onClick={() => setExplainTab("docs")}>
          <BookOpen size={16} /> Local Docs
        </button>
        <button className={explainTab === "roadmap" ? "active" : ""} onClick={() => setExplainTab("roadmap")}>
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
                The console estimates a direction in residual-stream space. A positive prompt and a negative prompt
                are run through the frozen model, their layer activations are subtracted, and the resulting vector is
                injected during generation.
              </p>
              <p>
                Pre-activation hooks edit the input to a block. Post-activation hooks edit the block output. Coefficient
                sweeps test whether the same direction has a smooth behavioral effect or collapses output quality.
              </p>
            </div>
          </section>

          <section className="glass-panel architecture-panel">
            <div className="panel-title">
              <Layers size={18} />
              <span>Current Run</span>
            </div>
            <Metric label="Selected model" value={selectedModel.display_name} />
            <Metric label="Layer" value={String(payload.layer)} />
            <Metric label="Coefficient" value={String(payload.coefficient)} />
            <Metric label="Hook" value={`${payload.hook_stage} / ${payload.apply_to}`} />
            <Metric label="Reliability" value={result.diagnostics.reliability_label} />
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
        <section className="docs-grid">
          <aside className="glass-panel docs-list">
            <div className="panel-title">
              <ScrollText size={18} />
              <span>Attached Local Docs</span>
            </div>
            {docs.map((doc) => (
              <button
                className={`doc-row ${doc.doc_id === selectedDocId ? "selected" : ""}`}
                key={doc.doc_id}
                onClick={() => setSelectedDocId(doc.doc_id)}
              >
                <strong>{doc.title}</strong>
                <small>{doc.path}</small>
                <span>{doc.summary}</span>
              </button>
            ))}
          </aside>
          <section className="glass-panel doc-reader">
            <div className="panel-title">
              <BookOpen size={18} />
              <span>{docContent?.doc.title ?? "Loading document"}</span>
            </div>
            <MarkdownOutput text={docContent?.content ?? "Loading local documentation..."} />
          </section>
        </section>
      )}

      {explainTab === "roadmap" && (
        <section className="learning-grid">
          <section className="glass-panel research-panel">
            <div className="panel-title">
              <ScrollText size={18} />
              <span>Research Trail</span>
            </div>
            <div className="research-list">
              <ResearchItem title="ActAdd" detail="Prompt-pair activation addition. Best first baseline for this repo." />
              <ResearchItem title="CAA" detail="Dataset-averaged contrast vectors. Next step for robust steering." />
              <ResearchItem title="Reliability" detail="Pair agreement and separability predict whether a vector is likely to work." />
              <ResearchItem title="SAE-guided steering" detail="Later path for feature-level control and side-effect reduction." />
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

function OutputPane({
  title,
  text,
  tone,
  diffResult,
  side
}: {
  title: string;
  text: string;
  tone: "baseline" | "steered";
  diffResult: DiffResult | null;
  side: "left" | "right";
}) {
  const diffContent = diffResult?.available ? diffResult[side] : null;
  return (
    <section className={`glass-panel output-pane ${tone}`}>
      <div className="panel-title">
        {tone === "steered" ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
        <span>{title}</span>
      </div>
      <MarkdownOutput text={text} />
      {diffContent ? (
        <details className="diff-panel" open>
          <summary>Automatic diff highlights</summary>
          <div className="diff-body">{renderDiffTokens(diffContent)}</div>
        </details>
      ) : diffResult && !diffResult.available ? (
        <p className="diff-skipped">{diffResult.reason}</p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
