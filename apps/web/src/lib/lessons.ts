import type { LocalDoc, LocalDocContent } from "./types";

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
  }
];

const lessonBodies: Record<string, string> = {
  lesson_transformers: `# Lesson 1: Transformer Basics

Activation steering only makes sense after the basic transformer loop is clear.

An input prompt is tokenized, embedded, passed through repeated transformer blocks, and decoded into next-token predictions. Each block updates a hidden representation of the sequence. In decoder-only language models, the residual stream carries information forward while attention and MLP layers transform it.

Useful vocabulary:

- Token: a chunk of text represented as an integer id.
- Embedding: the learned vector for a token.
- Hidden state: the model's internal vector representation at a layer.
- Residual stream: the vector path that carries information through the blocks.
- Layer: one repeated transformer block.

The practical point for this repo: activation steering edits a hidden state during inference. It does not retrain model weights.`,
  lesson_prompt_steering: `# Lesson 2: Prompt Steering

Prompt steering changes model behavior by changing the text given to the model.

Examples:

- A system prompt can ask for a calm tone.
- A few-shot prompt can show examples of desired answers.
- A rubric can ask the model to check for risk before answering.

Prompt steering is easy to use and should usually be the first baseline. Activation steering is only meaningful when compared against simpler controls.`,
  lesson_activation_steering: `# Lesson 3: Activation Steering

Activation steering changes model behavior by editing internal activations at inference time.

Instead of saying "be more empathetic" in the prompt, the system estimates a direction in activation space and adds it to a chosen layer while the model generates text.

\`\`\`text
steered_hidden = hidden + coefficient * steering_vector
\`\`\`

The model weights stay frozen. The edit happens during the forward pass.`,
  lesson_actadd: `# Lesson 4: ActAdd

Activation Addition, or ActAdd, is the first method implemented in this repo.

\`\`\`text
v = hidden(positive_prompt) - hidden(negative_prompt)
\`\`\`

That vector becomes a behavioral direction. During generation, the vector is added at a selected layer with a selected coefficient.

Use contrast pairs that differ mainly in the behavior you want to steer, not in topic, facts, or format.`,
  lesson_caa: `# Lesson 5: CAA-Style Mean Difference Vectors

Single prompt pairs are easy to understand but can be noisy. Contrastive Activation Addition style workflows use multiple positive and negative examples.

\`\`\`text
v = mean_i(hidden(positive_i) - hidden(negative_i))
\`\`\`

More pairs can make a direction more stable when examples agree. Poorly matched examples can make things worse.`,
  lesson_evaluation: `# Lesson 6: Evaluation

Steering needs evaluation discipline because a visible difference is not enough.

Recommended loop:

1. Run the baseline output.
2. Run a prompt-only control.
3. Build the steering vector.
4. Run post-activation steering.
5. Run pre-activation steering.
6. Sweep coefficient and layer.
7. Check whether the output changed in the desired way.
8. Check whether unrelated capabilities degraded.`,
  lesson_advanced_methods: `# Lesson 7: Advanced Methods

The advanced roadmap starts after ActAdd and mean-difference vectors are stable.

Important next methods:

- Activation patching.
- SEA.
- SAE-guided steering.
- Conditional activation steering.

These methods are not claimed as fully implemented in the current release. A method becomes supported only after the repo has code, tests, artifacts, and documentation that prove the implemented behavior.`
};

export function getStaticDoc(docId: string): LocalDocContent {
  const doc = staticDocs.find((item) => item.doc_id === docId) ?? staticDocs[0];
  return {
    doc,
    content: lessonBodies[doc.doc_id] ?? "Static documentation is not bundled for this entry."
  };
}
