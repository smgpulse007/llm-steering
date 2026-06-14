import type { ExperimentPayload } from "./types";

export type SteeringPreset = {
  id: string;
  name: string;
  domain: string;
  description: string;
  payload: Pick<ExperimentPayload, "system_prompt" | "user_prompt" | "prompt_pairs" | "layer" | "coefficient" | "apply_to" | "hook_stage" | "normalize" | "max_new_tokens" | "do_sample" | "temperature" | "top_p" | "top_k">;
};

export const steeringPresets: SteeringPreset[] = [
  {
    id: "support_empathy",
    name: "Support Empathy",
    domain: "Customer operations",
    description: "Calmer, accountable replies with concrete next steps.",
    payload: {
      system_prompt: "You are a precise assistant. Keep the factual content stable while adjusting style.",
      user_prompt: "Draft a response to a customer whose replacement part arrived late.",
      prompt_pairs: [
        {
          positive: "Write a calm, accountable customer support reply with clear next steps.",
          negative: "Write a curt, defensive customer support reply that avoids ownership."
        },
        {
          positive: "Respond with empathy, a concrete fix, and concise reassurance.",
          negative: "Respond with irritation, vague language, and no next step."
        }
      ],
      layer: 18,
      coefficient: 1.5,
      apply_to: "last_token",
      hook_stage: "post",
      normalize: true,
      max_new_tokens: 512,
      do_sample: false,
      temperature: 0.8,
      top_p: 0.95,
      top_k: 64
    }
  },
  {
    id: "tutor_scaffold",
    name: "Tutor Scaffolding",
    domain: "Education",
    description: "Step-by-step explanations with learner-friendly checks.",
    payload: {
      system_prompt: "You are a tutoring assistant. Preserve correctness while changing teaching style.",
      user_prompt: "Explain why dividing by a fraction is equivalent to multiplying by its reciprocal.",
      prompt_pairs: [
        {
          positive: "Explain with encouragement, simple steps, and a quick self-check.",
          negative: "Give a terse answer with no scaffolding or learner support."
        },
        {
          positive: "Use a concrete example and invite the learner to verify the pattern.",
          negative: "Use abstract language only and skip examples."
        }
      ],
      layer: 18,
      coefficient: 1.3,
      apply_to: "last_token",
      hook_stage: "post",
      normalize: true,
      max_new_tokens: 512,
      do_sample: false,
      temperature: 0.75,
      top_p: 0.95,
      top_k: 64
    }
  },
  {
    id: "risk_calibration",
    name: "Risk Calibration",
    domain: "Product launch",
    description: "More explicit rollout risk, mitigations, and decision posture.",
    payload: {
      system_prompt: "You are an operations advisor. Keep the recommendation practical and explicit about uncertainty.",
      user_prompt: "Should we launch a new checkout flow on Friday afternoon if conversion is up but support tickets also increased?",
      prompt_pairs: [
        {
          positive: "Give calibrated rollout advice with risks, mitigations, and monitoring thresholds.",
          negative: "Give overconfident launch advice with no caveats or monitoring plan."
        },
        {
          positive: "Recommend staged rollout, owner assignment, rollback criteria, and support readiness.",
          negative: "Recommend an immediate full launch and ignore operational risk."
        }
      ],
      layer: 18,
      coefficient: 1.4,
      apply_to: "last_token",
      hook_stage: "post",
      normalize: true,
      max_new_tokens: 512,
      do_sample: false,
      temperature: 0.7,
      top_p: 0.95,
      top_k: 64
    }
  },
  {
    id: "code_review_precision",
    name: "Code Review Precision",
    domain: "Engineering",
    description: "Concise review findings with concrete severity and fixes.",
    payload: {
      system_prompt: "You are a senior code reviewer. Prioritize bugs, risks, and missing tests.",
      user_prompt: "Review a patch that adds caching to a payment calculation service but does not include invalidation tests.",
      prompt_pairs: [
        {
          positive: "Write a precise code review with severity, evidence, and concrete test requests.",
          negative: "Write a vague approval with no risk analysis or test guidance."
        },
        {
          positive: "Focus on correctness, cache invalidation, edge cases, and rollback risk.",
          negative: "Focus only on style and ignore behavioral regressions."
        }
      ],
      layer: 18,
      coefficient: 1.2,
      apply_to: "last_token",
      hook_stage: "post",
      normalize: true,
      max_new_tokens: 512,
      do_sample: false,
      temperature: 0.7,
      top_p: 0.95,
      top_k: 64
    }
  }
];
