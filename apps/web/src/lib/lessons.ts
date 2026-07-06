import type { LocalDoc, LocalDocContent } from "./types";

import lessonTransformers from "../../../../docs/lessons/01_transformers.md?raw";
import lessonPromptSteering from "../../../../docs/lessons/02_prompt_steering.md?raw";
import lessonActivationSteering from "../../../../docs/lessons/03_activation_steering.md?raw";
import lessonActadd from "../../../../docs/lessons/04_actadd.md?raw";
import lessonCaa from "../../../../docs/lessons/05_caa.md?raw";
import lessonEvaluation from "../../../../docs/lessons/06_evaluation.md?raw";
import lessonAdvancedMethods from "../../../../docs/lessons/07_advanced_methods.md?raw";
import glossary from "../../../../docs/glossary.md?raw";
import methodology from "../../../../docs/methodology.md?raw";
import gemmaRuntime from "../../../../research/gemma4_runtime_notes.md?raw";
import literatureReview from "../../../../research/steering_vectors_literature_review.md?raw";
import diffusionQwenUi from "../../../../research/2026-06-14_diffusiongemma_qwen_ui_research_notes.md?raw";

export const staticDocs: LocalDoc[] = [
  {
    doc_id: "lesson_transformers",
    title: "Lesson 1: Transformer Basics",
    path: "docs/lessons/01_transformers.md",
    summary: "Tokens, embeddings, layers, residual stream, and hidden states.",
    category: "lessons"
  },
  {
    doc_id: "lesson_prompt_steering",
    title: "Lesson 2: Prompt Steering",
    path: "docs/lessons/02_prompt_steering.md",
    summary: "Prompt-only controls and why they remain the first baseline.",
    category: "lessons"
  },
  {
    doc_id: "lesson_activation_steering",
    title: "Lesson 3: Activation Steering",
    path: "docs/lessons/03_activation_steering.md",
    summary: "Inference-time hidden-state edits without retraining weights.",
    category: "lessons"
  },
  {
    doc_id: "lesson_actadd",
    title: "Lesson 4: ActAdd",
    path: "docs/lessons/04_actadd.md",
    summary: "Positive/negative prompt pairs and steering-vector construction.",
    category: "lessons"
  },
  {
    doc_id: "lesson_caa",
    title: "Lesson 5: CAA-Style Mean Difference",
    path: "docs/lessons/05_caa.md",
    summary: "Multiple contrast pairs for more stable steering directions.",
    category: "lessons"
  },
  {
    doc_id: "lesson_evaluation",
    title: "Lesson 6: Evaluation",
    path: "docs/lessons/06_evaluation.md",
    summary: "Baseline, prompt-only control, sweeps, diagnostics, and artifacts.",
    category: "lessons"
  },
  {
    doc_id: "lesson_advanced_methods",
    title: "Lesson 7: Advanced Methods",
    path: "docs/lessons/07_advanced_methods.md",
    summary: "Activation patching, SEA, SAE-guided steering, and support rules.",
    category: "lessons"
  },
  {
    doc_id: "glossary",
    title: "Glossary",
    path: "docs/glossary.md",
    summary: "Short definitions for activation steering terms used by the repo.",
    category: "docs"
  },
  {
    doc_id: "methodology",
    title: "Methodology",
    path: "docs/methodology.md",
    summary: "Math, hook stages, token targeting, and the recommended evaluation loop.",
    category: "docs"
  },
  {
    doc_id: "literature",
    title: "Steering Vectors Literature Review",
    path: "research/steering_vectors_literature_review.md",
    summary: "Source-backed research arc covering ActAdd, CAA, RepE, SEA, activation patching, and SAE directions.",
    category: "research"
  },
  {
    doc_id: "gemma_runtime",
    title: "Gemma 4 Runtime Notes",
    path: "research/gemma4_runtime_notes.md",
    summary: "Runtime, model-size, and deployment notes for Gemma 4 experiments.",
    category: "research"
  },
  {
    doc_id: "diffusion_qwen_ui",
    title: "DiffusionGemma/Qwen UI Research Notes",
    path: "research/2026-06-14_diffusiongemma_qwen_ui_research_notes.md",
    summary: "Handoff research for DiffusionGemma, Qwen3.6, Qwen3-Coder-Next, reliability, and UI direction.",
    category: "research"
  }
];

const lessonBodies: Record<string, string> = {
  lesson_transformers: lessonTransformers,
  lesson_prompt_steering: lessonPromptSteering,
  lesson_activation_steering: lessonActivationSteering,
  lesson_actadd: lessonActadd,
  lesson_caa: lessonCaa,
  lesson_evaluation: lessonEvaluation,
  lesson_advanced_methods: lessonAdvancedMethods,
  glossary,
  methodology,
  literature: literatureReview,
  gemma_runtime: gemmaRuntime,
  diffusion_qwen_ui: diffusionQwenUi
};

export function extractMarkdownSections(content: string) {
  const sections: Array<{ id: string; title: string; level: number }> = [];
  const seen: Record<string, number> = {};
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const title = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (!title) continue;

    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
    const count = seen[base] ?? 0;
    seen[base] = count + 1;
    sections.push({
      id: count ? `${base}-${count + 1}` : base,
      title,
      level: match[1].length
    });
  }

  return sections;
}

export function getStaticDoc(docId: string): LocalDocContent {
  const doc = staticDocs.find((item) => item.doc_id === docId) ?? staticDocs[0];
  const content = lessonBodies[doc.doc_id] ?? "Static documentation is not bundled for this entry.";
  return {
    doc,
    content,
    sections: extractMarkdownSections(content)
  };
}
