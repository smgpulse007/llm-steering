import { useEffect, useMemo, useState } from "react";
import { safeDiffTokens } from "../lib/diff";
import {
  modelForRegistryState,
  validateModelRegistry,
  type RegistryState,
} from "../lib/modelRegistry";
import {
  describeDraft,
  parseSweepNumbers,
  selectDraftModel,
  validateExperimentDraft,
} from "../lib/experimentDraft";
import {
  fallbackModels,
  fetchDoc,
  fetchDocs,
  fetchExperiment,
  fetchModels,
  fetchRuntimeStatus,
  hookSmokeModel,
  introspectModel,
  planSweep,
  runExperiment,
  runSweep,
} from "../lib/api";
import { steeringPresets, type SteeringPreset } from "../lib/presets";
import {
  artifactPreviewForRun,
  captureRequest,
  completeRun,
  reportForModel,
  type ArtifactPreview,
  type RunRecord,
} from "../lib/experimentRecord";
import type {
  ExperimentPayload,
  HookSmokeReport,
  IntrospectionReport,
  LocalDoc,
  LocalDocContent,
  ModelRegistryEntry,
  RuntimeStatus,
  SweepPlan,
  SweepResult,
} from "../lib/types";

import {
  readHashRoute,
  replaceHash,
  type ActiveTab,
  type ExplainTab,
} from "../lib/navigation";
const DEFAULT_DOC_ID = "lesson_transformers";
const initialPayload: ExperimentPayload = {
  model_id: "google/gemma-4-E2B-it",
  ...steeringPresets[0].payload,
  seed: 0,
};

function applyPreset(
  preset: SteeringPreset,
  currentModelId: string,
): ExperimentPayload {
  return { model_id: currentModelId, ...preset.payload, seed: 0 };
}

export function useLab() {
  const initialRoute = useMemo(() => readHashRoute(), []);
  const [models, setModels] = useState<ModelRegistryEntry[]>(fallbackModels);
  const [registryState, setRegistryState] = useState<RegistryState>("checking");
  const [payload, setPayload] = useState<ExperimentPayload>(initialPayload);
  const selectedId = payload.model_id;
  const draftErrors = useMemo(
    () => validateExperimentDraft(payload),
    [payload],
  );
  const [selectedPresetId, setSelectedPresetId] = useState(
    steeringPresets[0].id,
  );
  const [rawIntrospection, setIntrospection] =
    useState<IntrospectionReport | null>(null);
  const [rawHookSmokeReport, setHookSmokeReport] =
    useState<HookSmokeReport | null>(null);
  const introspection = reportForModel(selectedId, rawIntrospection);
  const hookSmokeReport = reportForModel(selectedId, rawHookSmokeReport);
  const [hookSmokeLoadModel, setHookSmokeLoadModel] = useState(false);
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const result = runRecord?.result ?? null;
  const [logs, setLogs] = useState<string[]>([
    "Workbench initialized with local fallback registry.",
  ]);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialRoute.activeTab ?? "overview",
  );
  const [showLesson, setShowLesson] = useState(Boolean(initialRoute.docId));
  const [recordSlug, setRecordSlug] = useState(
    initialRoute.recordSlug ?? "customer_support_empathy",
  );
  const [explainTab, setExplainTab] = useState<ExplainTab>(
    initialRoute.explainTab ?? "math",
  );
  const [apiMode, setApiMode] = useState<"checking" | "local" | "static">(
    "checking",
  );
  const [autoDiff, setAutoDiff] = useState(true);
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(
    initialRoute.docId ?? DEFAULT_DOC_ID,
  );
  const [selectedDocSectionId, setSelectedDocSectionId] = useState(
    initialRoute.docSectionId ?? "",
  );
  const [rawDocContent, setDocContent] = useState<LocalDocContent | null>(null);
  const docContent =
    rawDocContent?.doc.doc_id === selectedDocId ? rawDocContent : null;
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(
    null,
  );
  const [fetchedArtifact, setFetchedArtifact] =
    useState<ArtifactPreview | null>(null);
  const artifactPreview = artifactPreviewForRun(runRecord, fetchedArtifact);
  const [sweepLayersText, setSweepLayersText] = useState("12, 18");
  const [sweepCoefficientsText, setSweepCoefficientsText] =
    useState("0.5, 1.0, 1.5");
  const [sweepPlanResult, setSweepPlanResult] = useState<SweepPlan | null>(
    null,
  );
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [sweepBusy, setSweepBusy] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const route = readHashRoute();
      setActiveTab(route.activeTab ?? "overview");
      setShowLesson(Boolean(route.docId));
      setRecordSlug(route.recordSlug ?? "customer_support_empathy");
      if (route.explainTab) setExplainTab(route.explainTab);
      if (route.docId) setSelectedDocId(route.docId);
      setSelectedDocSectionId(route.docSectionId ?? "");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    fetchModels()
      .then((items) => {
        validateModelRegistry(items);
        setRegistryState("ready");
        setModels(items);
        setPayload((current) =>
          items.some((item) => item.model_id === current.model_id)
            ? current
            : selectDraftModel(current, items[0]),
        );
        setLogs((current) => [
          `Loaded ${items.length} model registry entries.`,
          ...current,
        ]);
      })
      .catch((error) => {
        setRegistryState("failed");
        setModels(
          fallbackModels.map((model) => ({
            ...model,
            steering_ready: false,
            steering_notes:
              "Registry unavailable. Restore the local API and reload before running experiments.",
          })),
        );
        setLogs((current) => [
          `Model registry unavailable: ${(error as Error).message}`,
          ...current,
        ]);
      });
    fetchRuntimeStatus()
      .then((status) => {
        setRuntimeStatus(status);
        setApiMode("local");
        setLogs((current) => [
          `Runtime default: ${status.hf_model_id}, layer ${status.default_layer}.`,
          ...current,
        ]);
      })
      .catch((error) => {
        setApiMode("static");
        setLogs((current) => [
          `Static mode: local API unavailable (${(error as Error).message}).`,
          ...current,
        ]);
      });
    fetchDocs()
      .then((items) => {
        setDocs(items);
        setSelectedDocId((current) =>
          items.some((item) => item.doc_id === current)
            ? current
            : (items[0]?.doc_id ?? DEFAULT_DOC_ID),
        );
      })
      .catch((error) =>
        setLogs((current) => [
          `Doc index unavailable: ${(error as Error).message}`,
          ...current,
        ]),
      );
  }, []);

  useEffect(() => {
    if (!selectedDocId) return;
    let active = true;
    setDocContent(null);
    fetchDoc(selectedDocId)
      .then((content) => {
        if (!active) return;
        if (content.doc.doc_id !== selectedDocId)
          throw new Error("Returned document does not match the selected ID.");
        setDocContent(content);
      })
      .catch((error) => {
        if (active)
          setLogs((current) => [
            `Doc load failed for ${selectedDocId}: ${(error as Error).message}`,
            ...current,
          ]);
      });
    return () => {
      active = false;
    };
  }, [selectedDocId]);

  useEffect(() => {
    if (
      !docContent ||
      !selectedDocSectionId ||
      docContent.doc.doc_id !== selectedDocId
    )
      return;
    window.requestAnimationFrame(() => {
      const section = document.getElementById(
        `doc-section-${selectedDocSectionId}`,
      );
      section?.setAttribute("tabindex", "-1");
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [docContent, selectedDocId, selectedDocSectionId]);

  const selectedModel = useMemo(
    () =>
      modelForRegistryState(
        models.find((model) => model.model_id === selectedId) ?? models[0],
        registryState,
      ),
    [models, selectedId, registryState],
  );

  const selectedPreset = useMemo(
    () =>
      steeringPresets.find((preset) => preset.id === selectedPresetId) ??
      steeringPresets[0],
    [selectedPresetId],
  );

  const activationDiff = useMemo(
    () => (result ? safeDiffTokens(result.prompt_only, result.steered) : null),
    [result],
  );

  function setSelectedId(id: string) {
    const model = models.find((item) => item.model_id === id);
    if (!model) return;
    setPayload((current) => selectDraftModel(current, model));
    setIntrospection(null);
    setHookSmokeReport(null);
  }

  function draftIsValid() {
    if (!Object.keys(draftErrors).length) return true;
    setLogs((current) => [
      `Check the experiment draft: ${Object.values(draftErrors).join(" ")}`,
      ...current,
    ]);
    return false;
  }

  function selectDoc(docId: string, scroll = false, sectionId = "") {
    setSelectedDocId(docId);
    setSelectedDocSectionId(sectionId);
    setActiveTab("learn");
    setShowLesson(true);
    replaceHash(`#docs/${docId}${sectionId ? `/${sectionId}` : ""}`);
    if (scroll) {
      window.requestAnimationFrame(() => {
        document
          .getElementById("docs")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setLogs((current) => [
        "Introspection is local-only. Start the FastAPI server to inspect runtime hooks.",
        ...current,
      ]);
      return;
    }
    setBusy(true);
    try {
      const report = await introspectModel(selectedModel.model_id);
      setIntrospection(report);
      setLogs((current) => [
        `Introspection status: ${report.status} for ${report.model_id}.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Introspection failed: ${(error as Error).message}`,
        ...current,
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleHookSmoke() {
    if (busy || sweepBusy || registryState !== "ready" || !draftIsValid())
      return;
    if (apiMode !== "local") {
      setLogs((current) => [
        "Hook smoke reports are local-only. Start the FastAPI server to validate model hooks.",
        ...current,
      ]);
      return;
    }
    setBusy(true);
    try {
      const report = await hookSmokeModel(selectedModel.model_id, {
        loadModel: hookSmokeLoadModel,
        layer: payload.layer,
        systemPrompt: payload.system_prompt,
        userPrompt: payload.user_prompt,
      });
      setHookSmokeReport(report);
      setLogs((current) => [
        `Hook smoke status: ${report.status} for ${report.model_id}.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Hook smoke failed: ${(error as Error).message}`,
        ...current,
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    if (busy || sweepBusy || registryState !== "ready" || !draftIsValid())
      return;
    if (apiMode !== "local") {
      setLogs((current) => [
        "Run blocked: public Pages mode is static; start the local API for real steering.",
        ...current,
      ]);
      return;
    }
    if (!selectedModel.steering_ready) {
      setLogs((current) => [
        `Run blocked: ${selectedModel.steering_notes}`,
        ...current,
      ]);
      return;
    }
    const submittedRequest = captureRequest(payload);
    const submittedPreset = describeDraft(submittedRequest, selectedPreset);
    setBusy(true);
    try {
      const next = await runExperiment(submittedRequest);
      setRunRecord(completeRun(submittedRequest, next, submittedPreset));
      setLogs((current) => [
        `Experiment ${next.experiment_id} completed. Result available for export.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Experiment failed: ${(error as Error).message}`,
        ...current,
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanSweep() {
    if (busy || sweepBusy || registryState !== "ready" || !draftIsValid())
      return;
    if (apiMode !== "local") {
      setLogs((current) => [
        "Sweep planning is local-only. Start the FastAPI server to preview the grid.",
        ...current,
      ]);
      return;
    }
    setSweepBusy(true);
    try {
      const layers = parseSweepNumbers(sweepLayersText, "layer");
      const coefficients = parseSweepNumbers(
        sweepCoefficientsText,
        "coefficient",
      );
      const plan = await planSweep(payload, layers, coefficients);
      setSweepPlanResult(plan);
      setLogs((current) => [
        `Sweep plan ready: ${plan.count} runs.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Sweep plan failed: ${(error as Error).message}`,
        ...current,
      ]);
    } finally {
      setSweepBusy(false);
    }
  }

  async function handleRunSweep() {
    if (busy || sweepBusy || registryState !== "ready" || !draftIsValid())
      return;
    if (apiMode !== "local") {
      setLogs((current) => [
        "Sweep blocked: public Pages mode is static; start the local API for real steering.",
        ...current,
      ]);
      return;
    }
    if (!selectedModel.steering_ready) {
      setLogs((current) => [
        `Sweep blocked: ${selectedModel.steering_notes}`,
        ...current,
      ]);
      return;
    }
    setSweepBusy(true);
    try {
      const layers = parseSweepNumbers(sweepLayersText, "layer");
      const coefficients = parseSweepNumbers(
        sweepCoefficientsText,
        "coefficient",
      );
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
          apply_to: run.apply_to,
        })),
      });
      setLogs((current) => [
        `Sweep ${next.sweep_id} completed with ${next.run_count} runs.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Sweep failed: ${(error as Error).message}`,
        ...current,
      ]);
    } finally {
      setSweepBusy(false);
    }
  }

  async function handleFetchArtifact() {
    if (apiMode !== "local" || !result) return;
    const requestedId = result.experiment_id;
    try {
      const artifact = await fetchExperiment(requestedId);
      if (artifact.experiment_id !== requestedId)
        throw new Error("Artifact identity does not match the requested run.");
      setFetchedArtifact({
        experimentId: requestedId,
        text: JSON.stringify(artifact, null, 2),
      });
      setLogs((current) => [
        `Fetched artifact ${artifact.experiment_id}.`,
        ...current,
      ]);
    } catch (error) {
      setLogs((current) => [
        `Artifact fetch failed: ${(error as Error).message}`,
        ...current,
      ]);
    }
  }

  function updatePair(
    index: number,
    key: "positive" | "negative",
    value: string,
  ) {
    setPayload((current) => ({
      ...current,
      prompt_pairs: current.prompt_pairs.map((pair, pairIndex) =>
        pairIndex === index ? { ...pair, [key]: value } : pair,
      ),
    }));
  }

  const runBlocked =
    apiMode !== "local" ||
    !selectedModel.steering_ready ||
    Object.keys(draftErrors).length > 0;

  function navigate(tab: ActiveTab) {
    setActiveTab(tab);
    setShowLesson(false);
    replaceHash(tab === "console" ? "#workbench" : `#${tab}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return {
    models,
    registryState,
    payload,
    draftErrors,
    setPayload,
    selectedId,
    setSelectedId,
    selectedPresetId,
    selectedPreset,
    selectedModel,
    choosePreset,
    rawIntrospection,
    introspection,
    hookSmokeReport,
    hookSmokeLoadModel,
    setHookSmokeLoadModel,
    runRecord,
    result,
    logs,
    busy,
    activeTab,
    explainTab,
    apiMode,
    autoDiff,
    setAutoDiff,
    docs,
    selectedDocId,
    selectedDocSectionId,
    docContent,
    runtimeStatus,
    artifactPreview,
    sweepLayersText,
    setSweepLayersText,
    sweepCoefficientsText,
    setSweepCoefficientsText,
    sweepPlanResult,
    sweepResult,
    sweepBusy,
    activationDiff,
    selectDoc,
    selectAttachedDoc,
    openConsole,
    openExplain,
    handleIntrospect,
    handleHookSmoke,
    handleRun,
    handlePlanSweep,
    handleRunSweep,
    handleFetchArtifact,
    updatePair,
    runBlocked,
    showLesson,
    recordSlug,
    navigate,
  };
}
export type LabController = ReturnType<typeof useLab>;
