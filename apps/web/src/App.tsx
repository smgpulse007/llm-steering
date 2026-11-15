import { useEffect, useRef } from "react";
import { ArrowUpRight, Layers } from "lucide-react";
import { useLab } from "./hooks/useLab";
import { Overview } from "./components/Overview";
import { RecordedExperiments } from "./components/RecordedExperiments";
import { Learning } from "./components/Learning";
import { Workbench } from "./components/Workbench";
import { ExplainabilityView } from "./components/WorkbenchPanels";

export function App() {
  const lab = useLab();
  const routeIdentity = `${lab.activeTab}/${lab.recordSlug}/${lab.showLesson}/${lab.selectedDocId}/${lab.explainTab}/${lab.selectedDocSectionId}`;
  const previousRoute = useRef("");
  useEffect(() => {
    if (previousRoute.current === routeIdentity) return;
    previousRoute.current = routeIdentity;
    if (window.location.hash !== "#setup")
      document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [routeIdentity]);
  useEffect(() => {
    const scrollToSetup = () => {
      if (window.location.hash === "#setup")
        window.requestAnimationFrame(() => {
          const setup = document.getElementById("setup");
          setup?.focus({ preventScroll: true });
          setup?.scrollIntoView({ block: "start" });
        });
    };
    window.addEventListener("hashchange", scrollToSetup);
    scrollToSetup();
    return () => window.removeEventListener("hashchange", scrollToSetup);
  }, [lab.activeTab]);
  useEffect(() => {
    if (window.location.hash !== "#setup")
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [lab.activeTab, lab.recordSlug, lab.showLesson]);
  const inLearning = lab.activeTab === "learn" || lab.activeTab === "explain";
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#overview">
          <Layers aria-hidden="true" size={32} strokeWidth={1.8} />
          <span>LLM Steering Lab</span>
        </a>
        <nav aria-label="Main navigation">
          <a
            href="#overview"
            aria-current={lab.activeTab === "overview" ? "page" : undefined}
          >
            Overview
          </a>
          <a
            href="#experiments"
            aria-current={lab.activeTab === "experiments" ? "page" : undefined}
          >
            Experiments
          </a>
          <a href="#learn" aria-current={inLearning ? "page" : undefined}>
            Learn
          </a>
          <a
            className="nav-workbench"
            href="#workbench"
            aria-current={lab.activeTab === "console" ? "page" : undefined}
          >
            Workbench
          </a>
          <a
            href="https://github.com/smgpulse007/llm-steering"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight aria-hidden="true" size={19} />
          </a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {lab.activeTab === "overview" && <Overview />}
        {lab.activeTab === "experiments" && (
          <RecordedExperiments
            key={lab.recordSlug ?? "default"}
            slug={lab.recordSlug}
          />
        )}
        {lab.activeTab === "learn" && <Learning lab={lab} />}
        {lab.activeTab === "console" && <Workbench lab={lab} />}
        {lab.activeTab === "explain" && (
          <section className="page-section reference-page">
            <div className="page-heading">
              <h1>Inside the experiment.</h1>
              <p>
                The intervention, the controls, and the evidence to inspect.
              </p>
            </div>
            <ExplainabilityView
              payload={lab.payload}
              models={lab.models}
              selectedModel={lab.selectedModel}
              explainTab={lab.explainTab}
              setExplainTab={lab.openExplain}
              docs={lab.docs}
              selectedDocId={lab.selectedDocId}
              onSelectDoc={lab.selectAttachedDoc}
              docContent={lab.docContent}
            />
          </section>
        )}
      </main>
    </>
  );
}
