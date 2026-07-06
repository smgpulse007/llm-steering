const customerSupportAsset = new URL("../../../../docs/assets/use_case_customer_support_empathy.gif", import.meta.url).href;
const tutorAsset = new URL("../../../../docs/assets/use_case_tutor_encouragement.gif", import.meta.url).href;
const releaseRiskAsset = new URL("../../../../docs/assets/use_case_release_risk_calibration.gif", import.meta.url).href;

export const showcaseUseCases = [
  {
    slug: "customer_support_empathy",
    title: "Customer support de-escalation",
    category: "Support / operations",
    userPrompt: "A customer says: \"My package arrived damaged and I need a replacement before Friday.\" Reply in two sentences.",
    baseline:
      "I am so sorry to hear that your package arrived damaged. I can certainly help you arrange for a replacement; could you please provide your order number so I can look into this immediately?",
    steered:
      "I am so sorry to hear that your package arrived damaged; I can certainly help you arrange a replacement right away. Please provide your order number so I can process this for you immediately.",
    whatToNotice: "The steered reply keeps the same task but sounds more immediate and supportive.",
    assetUrl: customerSupportAsset
  },
  {
    slug: "tutor_encouragement",
    title: "Encouraging tutoring explanations",
    category: "Education / tutoring",
    userPrompt:
      "A student says: \"I do not get why dividing by a fraction means multiplying by its reciprocal.\" Reply in two sentences.",
    baseline:
      "Think of dividing by a fraction as asking \"how many times does this smaller piece fit into the whole?\" Multiplying by the reciprocal flips the fraction, which essentially turns the division problem into a multiplication problem that finds that same answer.",
    steered:
      "Think of dividing by a fraction as asking, \"How many of this fraction fit into the other number?\" To solve this, you flip the divisor to its reciprocal, which turns the division problem into a multiplication problem.",
    whatToNotice: "The steered answer becomes more scaffolded and explanatory instead of just terse correctness.",
    assetUrl: tutorAsset
  },
  {
    slug: "release_risk_calibration",
    title: "Risk-aware launch recommendations",
    category: "Product / release ops",
    userPrompt:
      "Write a two-sentence recommendation on whether to roll out a new billing feature to all users next week after only a small internal beta.",
    baseline:
      "Given the small internal beta, I recommend a phased rollout, starting with a small segment of users to monitor for unexpected issues before a full launch next week.",
    steered:
      "**Recommendation:** Proceed with a phased rollout to a small segment of users next week to monitor performance and gather real-world feedback before a full launch.",
    whatToNotice: "The steered answer leans harder into phased rollout language and operational validation.",
    assetUrl: releaseRiskAsset
  }
];

export const staticSiteNotes = [
  "GitHub Pages runs in static mode with checked-in showcase artifacts.",
  "Real activation steering runs require the local FastAPI API and local model access.",
  "Unsupported models stay visible but gated until validation evidence exists."
];
