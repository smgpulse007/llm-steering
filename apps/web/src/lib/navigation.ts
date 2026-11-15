export type ActiveTab =
  "overview" | "experiments" | "learn" | "console" | "explain";
export type ExplainTab = "math" | "controls" | "docs" | "roadmap";
export type LabRoute = {
  activeTab: ActiveTab;
  explainTab?: ExplainTab;
  docId?: string;
  docSectionId?: string;
  recordSlug?: string;
};

export function parseHashRoute(hash: string): LabRoute {
  const [section, value, docSectionId] = hash.replace(/^#/, "").split("/");
  if (section === "docs")
    return {
      activeTab: "learn",
      docId: value || "lesson_transformers",
      docSectionId,
    };
  if (section === "workbench") return { activeTab: "console" };
  if (section === "experiments")
    return {
      activeTab: "experiments",
      recordSlug: value || "customer_support_empathy",
    };
  if (section === "learn") return { activeTab: "learn" };
  if (section === "explain") {
    const tabs: ExplainTab[] = ["math", "controls", "docs", "roadmap"];
    return {
      activeTab: "explain",
      explainTab: tabs.includes(value as ExplainTab)
        ? (value as ExplainTab)
        : "math",
    };
  }
  return { activeTab: "overview" };
}

export function readHashRoute(): LabRoute {
  return parseHashRoute(
    typeof window === "undefined" ? "" : window.location.hash,
  );
}

export function replaceHash(hash: string) {
  if (typeof window !== "undefined" && window.location.hash !== hash)
    window.history.replaceState(null, "", hash);
}
