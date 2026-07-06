import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Braces,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  FunctionSquare,
  Gauge,
  Globe2,
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
  planSweep,
  runExperiment,
  runSweep
} from "./lib/api";
import { steeringPresets, type SteeringPreset } from "./lib/presets";
import { showcaseUseCases, staticSiteNotes } from "./lib/showcase";
import type {
  ExperimentPayload,
  ExperimentResult,
  IntrospectionReport,
  LocalDoc,
  LocalDocContent,
  LocalDocSection,
  ModelRegistryEntry,
  RuntimeStatus,
  SweepPlan,
  SweepResult
} from "./lib/types";

type ActiveTab = "learn" | "console" | "explain";
type ExplainTab = "math" | "controls" | "docs" | "roadmap";

const DEFAULT_DOC_ID = "lesson_transformers";

const docCategoryLabels: Record<string, string> = {
  lessons: "Beginner lessons",
  docs: "Reference docs",
  research: "Research notes"
};

function readHashRoute(): { activeTab?: ActiveTab; explainTab?: ExplainTab; docId?: string; docSectionId?: string } {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.replace(/^#/, "");
  const [section, value, docSectionId] = hash.split("/");
  if (section === "docs") {
    return { activeTab: "learn", docId: value || DEFAULT_DOC_ID, docSectionId };
  }
  if (section === "workbench") {
    return { activeTab: "console" };
  }
  if (section === "explain") {
    const tabs: ExplainTab[] = ["math", "controls", "docs", "roadmap"];
    return { activeTab: "explain", explainTab: tabs.includes(value as ExplainTab) ? (value as ExplainTab) : "math" };
  }
  return {};
}

function replaceHash(hash: string) {
  if (typeof window === "undefined") return;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", hash);
  }
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "llm-steering";
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text.trim() || typeof window === "undefined") return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function downloadTextFile(filename: string, text: string, mimeType = "text/plain;charset=utf-8") {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function vectorMetadataJson(result: ExperimentResult, payload: ExperimentPayload): string {
  return JSON.stringify(
    {
      artifact_kind: "vector_metadata",
      experiment_id: result.experiment_id,
      created_at_utc: result.created_at_utc,
      model_id: payload.model_id,
      vector_path: result.vector_path,
      layer: payload.layer,
      coefficient: payload.coefficient,
      hook_stage: payload.hook_stage,
      apply_to: payload.apply_to,
      normalize: payload.normalize,
      prompt_pair_count: payload.prompt_pairs.length,
      prompt_control: result.prompt_control,
      diagnostics: result.diagnostics,
      artifact_path: result.artifact_path,
      reproduce_command: result.reproduce_command
    },
    null,
    2
  );
}

const initialPayload: ExperimentPayload = {
  model_id: "google/gemma-4-E2B-it",
  ...steeringPresets[0].payload
};

const demoResult: ExperimentResult = {
  experiment_id: "preview_not_run",
  created_at_utc: new Date().toISOString(),
  baseline:
    "## Customer reply\n\nI can check the order details and see what happened with the shipment. Please send the tracking number and order ID.\n\n- confirm the order\n- review the shipment\n- reply with the next step",
  prompt_only:
    "## Customer reply\n\nI am sorry the replacement part arrived late. I can check the order details and help identify the next step.\n\n- confirm the order\n- review the shipment\n- explain the next step",
  steered:
    "## Customer reply\n\nI am sorry the replacement part arrived late. I will check the order, confirm the delivery issue, and outline the fastest next step so this gets resolved cleanly.\n\n- confirm the order\n- review the shipment\n- provide a clear resolution path",
  prompt_control: {
    strategy: "positive_negative_prompt_pair_instructions",
    system_prompt:
      "Prompt-only steering control: follow the positive prompt-pair directions using ordinary instructions only."
  },
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
  control_delta: {
    changed: true,
    baseline_chars: 190,
    steered_chars: 222,
    char_delta: 32,
    word_jaccard: 0.56
  },
  steering_delta: {
    changed: true,
    baseline_chars: 222,
    steered_chars: 247,
    char_delta: 25,
    word_jaccard: 0.64
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

function parseSweepNumbers(value: string, kind: "layer" | "coefficient"): number[] {
  const values = value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));
  if (!values.length) {
    throw new Error(`Add at least one ${kind}.`);
  }
  if (values.some((item) => Number.isNaN(item))) {
    throw new Error(`${kind === "layer" ? "Layers" : "Coefficients"} must be numeric.`);
  }
  if (kind === "layer" && values.some((item) => !Number.isInteger(item))) {
    throw new Error("Layers must be whole numbers.");
  }
  return values;
}

function aggregateText(value: unknown, fallback = "0"): string {
  return typeof value === "number" ? String(value) : fallback;
}

export function App() {
  const initialRoute = useMemo(() => readHashRoute(), []);
  const [models, setModels] = useState<ModelRegistryEntry[]>(fallbackModels);
  const [payload, setPayload] = useState<ExperimentPayload>(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload.model_id);
  const [selectedPresetId, setSelectedPresetId] = useState(steeringPresets[0].id);
  const [introspection, setIntrospection] = useState<IntrospectionReport | null>(null);
  const [result, setResult] = useState<ExperimentResult>(demoResult);
  const [logs, setLogs] = useState<string[]>(["Workbench initialized with local fallback registry."]);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialRoute.activeTab ?? "learn");
  const [explainTab, setExplainTab] = useState<ExplainTab>(initialRoute.explainTab ?? "math");
  const [apiMode, setApiMode] = useState<"checking" | "local" | "static">("checking");
  const [autoDiff, setAutoDiff] = useState(true);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(initialRoute.docId ?? DEFAULT_DOC_ID);
  const [selectedDocSectionId, setSelectedDocSectionId] = useState(initialRoute.docSectionId ?? "");
  const [docContent, setDocContent] = useState<LocalDocContent | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [artifactPreview, setArtifactPreview] = useState("");
  const [sweepLayersText, setSweepLayersText] = useState("12, 18");
  const [sweepCoefficientsText, setSweepCoefficientsText] = useState("0.5, 1.0, 1.5");
  const [sweepPlanResult, setSweepPlanResult] = useState<SweepPlan | null>(null);
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [sweepBusy, setSweepBusy] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const route = readHashRoute();
      if (route.activeTab) setActiveTab(route.activeTab);
      if (route.explainTab) setExplainTab(route.explainTab);
      if (route.docId) setSelectedDocId(route.docId);
      setSelectedDocSectionId(route.docSectionId ?? "");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    fetchModels().then((items) => {
      setModels(items);
      setLogs((current) => [`Loaded ${items.length} model registry entries.`, ...current]);
    });
    fetchRuntimeStatus()
      .then((status) => {
        setRuntimeStatus(status);
        setApiMode("local");
        setLogs((current) => [`Runtime default: ${status.hf_model_id}, layer ${status.default_layer}.`, ...current]);
      })
      .catch((error) => {
        setApiMode("static");
        setLogs((current) => [
          `Static mode: local API unavailable (${(error as Error).message}).`,
          ...current
        ]);
      });
    fetchDocs()
      .then((items) => {
        setDocs(items);
        setSelectedDocId((current) =>
          items.some((item) => item.doc_id === current) ? current : items[0]?.doc_id ?? DEFAULT_DOC_ID
        );
      })
      .catch((error) => setLogs((current) => [`Doc index unavailable: ${(error as Error).message}`, ...current]));
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    fetchDoc(selectedDocId)
      .then(setDocContent)
      .catch((error) => setLogs((current) => [`Doc load failed: ${(error as Error).message}`, ...current]));
  }, [selectedDocId]);

  useEffect(() => {
    if (!docContent || !selectedDocSectionId || docContent.doc.doc_id !== selectedDocId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`doc-section-${selectedDocSectionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [docContent, selectedDocId, selectedDocSectionId]);

  const selectedModel = useMemo(
    () => models.find((model) => model.model_id === selectedId) ?? models[0],
    [models, selectedId]
  );

  const selectedPreset = useMemo(
    () => steeringPresets.find((preset) => preset.id === selectedPresetId) ?? steeringPresets[0],
    [selectedPresetId]
  );

  const activationDiff = useMemo(
    () => safeDiffTokens(result.prompt_only, result.steered),
    [result.prompt_only, result.steered]
  );

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

  function selectDoc(docId: string, scroll = false, sectionId = "") {
    setSelectedDocId(docId);
    setSelectedDocSectionId(sectionId);
    setActiveTab("learn");
    replaceHash(`#docs/${docId}${sectionId ? `/${sectionId}` : ""}`);
    if (scroll) {
      window.requestAnimationFrame(() => {
        document.getElementById("docs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function selectAttachedDoc(docId: string, sectionId = "") {
    setSelectedDocId(docId);
    setSelectedDocSectionId(sectionId);
  }

  function openConsole() {
    setActiveTab("console");
    replaceHash("#workbench");
  }

  function openExplain(tab: ExplainTab = explainTab) {
    setActiveTab("explain");
    setExplainTab(tab);
    replaceHash(`#explain/${tab}`);
  }

  function choosePreset(preset: SteeringPreset) {
    setSelectedPresetId(preset.id);
    setPayload(applyPreset(preset, selectedModel.model_id));
    setLogs((current) => [`Preset loaded: ${preset.name}.`, ...current]);
  }

  async function handleIntrospect() {
    if (apiMode !== "local") {
      setLogs((current) => ["Introspection is local-only. Start the FastAPI server to inspect runtime hooks.", ...current]);
      return;
    }
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
    if (apiMode !== "local") {
      setLogs((current) => ["Run blocked: public Pages mode is static; start the local API for real steering.", ...current]);
      return;
    }
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

  async function handlePlanSweep() {
    if (apiMode !== "local") {
      setLogs((current) => ["Sweep planning is local-only. Start the FastAPI server to preview the grid.", ...current]);
      return;
    }
    setSweepBusy(true);
    try {
      const layers = parseSweepNumbers(sweepLayersText, "layer");
      const coefficients = parseSweepNumbers(sweepCoefficientsText, "coefficient");
      const plan = await planSweep(payload, layers, coefficients);
      setSweepPlanResult(plan);
      setLogs((current) => [`Sweep plan ready: ${plan.count} runs.`, ...current]);
    } catch (error) {
      setLogs((current) => [`Sweep plan failed: ${(error as Error).message}`, ...current]);
    } finally {
      setSweepBusy(false);
    }
  }

  async function handleRunSweep() {
    if (apiMode !== "local") {
      setLogs((current) => ["Sweep blocked: public Pages mode is static; start the local API for real steering.", ...current]);
      return;
    }
    if (!selectedModel.steering_ready) {
      setLogs((current) => [`Sweep blocked: ${selectedModel.steering_notes}`, ...current]);
      return;
    }
    setSweepBusy(true);
    try {
      const layers = parseSweepNumbers(sweepLayersText, "layer");
      const coefficients = parseSweepNumbers(sweepCoefficientsText, "coefficient");
      const next = await runSweep(payload, layers, coefficients);
      setSweepResult(next);
      setSweepPlanResult({
        status: "planned",
        count: next.run_count,
        runs: next.runs.map((run) => ({
          model_id: payload.model_id,
          layer: run.layer,
          coefficient: run.coefficient,
          hook_stage: run.hook_stage,
          apply_to: run.apply_to
        }))
      });
      setLogs((current) => [`Sweep ${next.sweep_id} completed with ${next.run_count} runs.`, ...current]);
    } catch (error) {
      setLogs((current) => [`Sweep failed: ${(error as Error).message}`, ...current]);
    } finally {
      setSweepBusy(false);
    }
  }

  async function handleFetchArtifact() {
    if (apiMode !== "local") {
      setArtifactPreview("Artifact readback is local-only. Public Pages mode displays checked-in showcase artifacts.");
      return;
    }
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

  const runBlocked = apiMode !== "local" || !selectedModel?.steering_ready;

  return (
    <main className="app-shell">
      <section className="topbar glass-band">
        <div>
          <p className="eyebrow">activation steering workbench</p>
          <h1>LLM Steering Lab</h1>
        </div>
        <div className="runtime-strip">
          <span><Activity size={16} /> {apiMode === "local" ? "local API" : apiMode === "static" ? "static Pages" : "checking API"}</span>
          <span><Gauge size={16} /> {runtimeStatus?.hf_model_id ?? "HF local / served"}</span>
          <span><CheckCircle2 size={16} /> gated controls</span>
        </div>
      </section>

      <nav className="tabbar glass-band" aria-label="Workbench tabs">
        <button className={activeTab === "learn" ? "active" : ""} onClick={() => selectDoc(selectedDocId)}>
          <Globe2 size={16} /> Docs
        </button>
        <button className={activeTab === "console" ? "active" : ""} onClick={openConsole}>
          <SlidersHorizontal size={16} /> Console
        </button>
        <button className={activeTab === "explain" ? "active" : ""} onClick={() => openExplain()}>
          <GraduationCap size={16} /> Explainability
        </button>
      </nav>

      {activeTab === "learn" ? (
        <LearningHome
          apiMode={apiMode}
          docs={docs}
          selectedDocId={selectedDocId}
          onSelectDoc={(docId, sectionId) => selectDoc(docId, false, sectionId)}
          docContent={docContent}
          onOpenConsole={openConsole}
          onOpenDocs={() => selectDoc(DEFAULT_DOC_ID, true)}
        />
      ) : activeTab === "console" ? (
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
                  {apiMode !== "local"
                    ? "Static Pages mode: run the local API for real experiments"
                    : runBlocked
                      ? "Steering locked until validation passes"
                      : "Ready for Gemma 4 E2B experiment"}
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

            <SweepPanel
              apiMode={apiMode}
              selectedModel={selectedModel}
              layersText={sweepLayersText}
              coefficientsText={sweepCoefficientsText}
              onLayersTextChange={setSweepLayersText}
              onCoefficientsTextChange={setSweepCoefficientsText}
              onPlan={handlePlanSweep}
              onRun={handleRunSweep}
              busy={busy || sweepBusy}
              plan={sweepPlanResult}
              result={sweepResult}
            />

            <div className="comparison-grid">
              <OutputPane title="Baseline" text={result.baseline} tone="baseline" diffResult={null} side="left" />
              <OutputPane
                title="Prompt-only Control"
                text={result.prompt_only}
                tone="prompt"
                diffResult={autoDiff ? activationDiff : null}
                side="left"
              />
              <OutputPane
                title="Activation-steered"
                text={result.steered}
                tone="steered"
                diffResult={autoDiff ? activationDiff : null}
                side="right"
              />
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
          setExplainTab={openExplain}
          docs={docs}
          selectedDocId={selectedDocId}
          onSelectDoc={selectAttachedDoc}
          docContent={docContent}
        />
      )}
    </main>
  );
}

function SweepPanel({
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
  result
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
    setSweepAction(copied ? "Sweep manifest copied" : "Sweep manifest unavailable");
  }

  function handleDownloadManifest() {
    downloadTextFile(`${manifestBaseName}.json`, manifestJson, "application/json;charset=utf-8");
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
          <input value={layersText} onChange={(event) => onLayersTextChange(event.target.value)} />
          <small className="field-help">Comma or space separated block numbers.</small>
        </label>
        <label>
          Coefficients
          <input value={coefficientsText} onChange={(event) => onCoefficientsTextChange(event.target.value)} />
          <small className="field-help">Strength values for the selected direction.</small>
        </label>
        <div className="sweep-actions">
          <button className="secondary-button compact" onClick={onPlan} disabled={busy || apiMode !== "local"}>
            <SlidersHorizontal size={16} /> Plan
          </button>
          <button className="primary-button" onClick={onRun} disabled={busy || runBlocked}>
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
        {plan ? <strong>{plan.count} planned runs</strong> : <strong>No grid planned</strong>}
      </div>

      {plan ? (
        <div className="sweep-plan-list" aria-label="Planned sweep runs">
          {plan.runs.slice(0, 8).map((run, index) => (
            <span key={`${run.layer}-${run.coefficient}-${index}`}>
              L{run.layer} / {run.coefficient}
            </span>
          ))}
          {plan.runs.length > 8 ? <span>+{plan.runs.length - 8} more</span> : null}
        </div>
      ) : null}

      {result ? (
        <section className="sweep-result">
          <div className="sweep-metrics">
            <Metric label="Status" value={result.status} />
            <Metric label="Completed" value={aggregateText(result.aggregate_diagnostics.completed_runs, String(result.run_count))} />
            <Metric label="Activation changed" value={aggregateText(result.aggregate_diagnostics.activation_changed_runs)} />
            <Metric label="Prompt changed" value={aggregateText(result.aggregate_diagnostics.prompt_control_changed_runs)} />
            <Metric label="Manifest" value={result.artifact_path ?? "not saved"} />
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
                    <td>{run.steering_delta.char_delta >= 0 ? "+" : ""}{run.steering_delta.char_delta} chars</td>
                    <td>{run.artifact_path ?? "not saved"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.runs.length > 12 ? <p className="sweep-footnote">Showing 12 of {result.runs.length} runs.</p> : null}
          <code>{result.reproduce_command}</code>
        </section>
      ) : null}
    </section>
  );
}

function LearningHome({
  apiMode,
  docs,
  selectedDocId,
  onSelectDoc,
  docContent,
  onOpenConsole,
  onOpenDocs
}: {
  apiMode: "checking" | "local" | "static";
  docs: LocalDoc[];
  selectedDocId: string;
  onSelectDoc: (docId: string, sectionId?: string) => void;
  docContent: LocalDocContent | null;
  onOpenConsole: () => void;
  onOpenDocs: () => void;
}) {
  return (
    <section className="public-home">
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="eyebrow">open source activation steering lab</p>
          <h2>Learn the basics, then run real local steering experiments.</h2>
          <p>
            This project teaches prompt steering, activation steering, ActAdd, prompt-pair vectors,
            hook stages, and evaluation discipline. Public Pages mode uses checked-in artifacts; the
            local workbench connects to FastAPI and a supported Hugging Face model.
          </p>
          <div className="public-actions">
            <button className="primary-button" onClick={onOpenDocs}>
              <GraduationCap size={16} /> Start Lessons
            </button>
            <button className="secondary-button compact" onClick={onOpenConsole}>
              <TerminalSquare size={16} /> Open Workbench
            </button>
            <div className="public-links" aria-label="Project links">
              <a href="https://github.com/smgpulse007/llm-steering" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href="https://github.com/smgpulse007/llm-steering#readme" target="_blank" rel="noreferrer">
                README
              </a>
              <a href="https://github.com/smgpulse007/llm-steering/tree/main/research" target="_blank" rel="noreferrer">
                Research
              </a>
            </div>
          </div>
        </div>
        <figure className="public-hero-visual">
          <img src={showcaseUseCases[0].assetUrl} alt="Activation steering use-case artifact preview" />
          <figcaption>
            <strong>Pages preview mode</strong>
            <span>Read the curriculum, inspect checked-in artifacts, then switch to the local API for live runs.</span>
          </figcaption>
        </figure>
      </section>

      <section className="public-proof-strip" aria-label="Repository proof points">
        <article>
          <BookOpen size={18} />
          <span>Beginner curriculum</span>
          <strong>7 lessons</strong>
        </article>
        <article>
          <ScrollText size={18} />
          <span>Bundled references</span>
          <strong>Docs + research</strong>
        </article>
        <article>
          <FlaskConical size={18} />
          <span>Experiment surface</span>
          <strong>Static + local</strong>
        </article>
        <article>
          <CheckCircle2 size={18} />
          <span>Validation gates</span>
          <strong>Artifacts + smoke tests</strong>
        </article>
      </section>

      <section className="section-kicker">
        <p className="eyebrow">docs library</p>
        <h2>Use the docs pane as the table of contents.</h2>
        <p>
          The public site bundles the same local lessons, methodology notes, glossary, and research trail that ship
          with the repo. The center outline keeps long docs navigable without sending readers back to GitHub.
        </p>
      </section>

      <DocsExplorer
        title="Learning Path"
        docs={docs}
        selectedDocId={selectedDocId}
        onSelectDoc={onSelectDoc}
        docContent={docContent}
        className="public-docs"
      />

      <section className="public-grid">
        <section className="glass-panel">
          <div className="panel-title">
            <BookOpen size={18} />
            <span>Beginner Path</span>
          </div>
          <ol className="lesson-steps">
            <li>Transformer basics: tokens, layers, hidden states, residual stream.</li>
            <li>Prompt steering: useful baseline, but not the same as activation edits.</li>
            <li>ActAdd: positive minus negative hidden states creates a direction.</li>
            <li>Evaluation: compare baseline, prompt-only control, and steered output.</li>
          </ol>
          <pre className="command-block">python -m pip install -e .[dev]{`\n`}llm-steering demo --toy --json</pre>
        </section>

        <section className="glass-panel">
          <div className="panel-title">
            <FlaskConical size={18} />
            <span>Advanced Local Path</span>
          </div>
          <ol className="lesson-steps">
            <li>Configure Hugging Face access and download a supported model.</li>
            <li>Start the FastAPI workbench API.</li>
            <li>Run a preset or custom prompt-pair experiment.</li>
            <li>Inspect diagnostics, diffs, and exported artifacts.</li>
          </ol>
          <pre className="command-block">llm-steering api{`\n`}cd apps/web && npm run dev</pre>
          <p className={apiMode === "local" ? "ready-note" : "blocked-note"}>
            {apiMode === "local" ? "Local API detected." : "Public/static mode detected."}
          </p>
        </section>
      </section>

      <section className="showcase-grid">
        {showcaseUseCases.map((useCase) => (
          <article className="glass-panel showcase-card" key={useCase.slug}>
            <img src={useCase.assetUrl} alt={`${useCase.title} steering demo`} loading="lazy" />
            <strong>{useCase.title}</strong>
            <span>{useCase.category}</span>
            <p>{useCase.whatToNotice}</p>
            <details>
              <summary>Show artifact text</summary>
              <p><b>Prompt:</b> {useCase.userPrompt}</p>
              <p><b>Baseline:</b> {useCase.baseline}</p>
              <p><b>Steered:</b> {useCase.steered}</p>
            </details>
          </article>
        ))}
      </section>

      <section className="glass-panel public-notes">
        <div className="panel-title">
          <AlertTriangle size={18} />
          <span>Honest Support Boundaries</span>
        </div>
        {staticSiteNotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </section>
    </section>
  );
}

function DocsExplorer({
  title,
  docs,
  selectedDocId,
  onSelectDoc,
  docContent,
  className = ""
}: {
  title: string;
  docs: LocalDoc[];
  selectedDocId: string;
  onSelectDoc: (docId: string, sectionId?: string) => void;
  docContent: LocalDocContent | null;
  className?: string;
}) {
  const categories = Array.from(new Set(docs.map((doc) => doc.category)));
  const sections = docContent?.sections ?? [];

  return (
    <section className={`docs-grid ${className}`} id="docs">
      <aside className="glass-panel docs-list">
        <div className="panel-title">
          <ScrollText size={18} />
          <span>{title}</span>
        </div>
        {categories.map((category) => (
          <div className="doc-group" key={category}>
            <span>{docCategoryLabels[category] ?? category}</span>
            {docs
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
      </aside>
      <DocOutline docId={selectedDocId} sections={sections} onSelectDoc={onSelectDoc} />
      <section className="glass-panel doc-reader">
        <div className="panel-title">
          <BookOpen size={18} />
          <span>{docContent?.doc.title ?? "Loading document"}</span>
        </div>
        <MarkdownOutput text={docContent?.content ?? "Loading local documentation..."} headingIdPrefix="doc-section-" />
      </section>
    </section>
  );
}

function DocOutline({
  docId,
  sections,
  onSelectDoc
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
        <p className="outline-empty">Section outline will appear after the document loads.</p>
      )}
    </aside>
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
  const [artifactAction, setArtifactAction] = useState("");
  const artifactBaseName = safeFileName(result.experiment_id);
  const artifactJson =
    artifactPreview.trim().startsWith("{") ? artifactPreview : JSON.stringify(result, null, 2);
  const vectorJson = vectorMetadataJson(result, payload);

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
          <span>Diagnostics</span>
        </div>
        <Metric label="Vector norm" value={formatNumber(result.diagnostics.vector_norm)} />
        <Metric label="Pair count" value={String(result.diagnostics.pair_count)} />
        <Metric label="Cosine mean" value={formatNumber(result.diagnostics.pairwise_cosine_mean)} />
        <Metric label="Separability" value={formatNumber(result.diagnostics.separability_score)} />
        <Metric label="Reliability" value={result.diagnostics.reliability_label} />
        <Metric label="Prompt-only delta" value={`${result.control_delta.char_delta >= 0 ? "+" : ""}${result.control_delta.char_delta} chars`} />
        <Metric label="Activation delta" value={`${result.steering_delta.char_delta >= 0 ? "+" : ""}${result.steering_delta.char_delta} chars`} />
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
        <p>
          Prompt-only control uses the same prompt-pair direction as ordinary instructions, then activation steering
          compares against that control.
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
        <div className="artifact-actions" aria-label="Artifact export actions">
          <button className="icon-action" onClick={() => handleCopyArtifact(artifactJson, "Result JSON")}>
            <Copy size={15} /> Copy JSON
          </button>
          <button
            className="icon-action"
            onClick={() => handleDownloadArtifact(`${artifactBaseName}.experiment.json`, artifactJson)}
          >
            <Download size={15} /> Download JSON
          </button>
          <button className="icon-action" onClick={() => handleCopyArtifact(vectorJson, "Vector metadata")}>
            <Copy size={15} /> Copy vector
          </button>
          <button
            className="icon-action"
            onClick={() => handleDownloadArtifact(`${artifactBaseName}.vector-metadata.json`, vectorJson)}
          >
            <Download size={15} /> Download vector
          </button>
        </div>
        {artifactAction ? <p className="action-status">{artifactAction}</p> : null}
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
  onSelectDoc,
  docContent
}: {
  payload: ExperimentPayload;
  result: ExperimentResult;
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
        {tone === "steered" ? <Sparkles size={18} /> : tone === "prompt" ? <ScrollText size={18} /> : <AlertTriangle size={18} />}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
