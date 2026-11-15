import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Copy } from "lucide-react";
import { recordedExperiments } from "../lib/recordedExperiments";
import { copyTextToClipboard } from "../lib/browserFiles";
import { RecordedComparison, RecordSettings } from "./RecordedExperiments";

export function Overview() {
  const [platform, setPlatform] = useState<"windows" | "unix">("windows");
  const [copied, setCopied] = useState(false);
  const command = `git clone https://github.com/smgpulse007/llm-steering.git\ncd llm-steering\n${platform === "windows" ? "py -3.13" : "python3.13"} -m venv .venv\n${platform === "windows" ? ".\\.venv\\Scripts\\Activate.ps1" : "source .venv/bin/activate"}\npython -m pip install -e .\npython -m llm_steering.cli verify --no-model\npython -m llm_steering.cli demo --toy --json`;
  return (
    <div id="overview" className="overview page-section">
      <section className="hero">
        <h1>
          Change the activation.
          <br />
          <span>Inspect the behavior.</span>
        </h1>
        <p>
          A local-first lab for exploring how frozen open models
          <br className="hero-break" /> respond to inference-time edits, without
          retraining weights.
        </p>
        <div className="action-row">
          <a
            className="primary-button"
            href="#experiments/customer_support_empathy"
          >
            Explore recorded experiment <ArrowRight size={21} />
          </a>
          <a className="secondary-button" href="#setup">
            Run locally
          </a>
        </div>
      </section>
      <figure className="hero-record">
        <div className="hero-record-heading">
          <h2>A different response. An inspectable intervention.</h2>
          <p>Recorded example / Customer support</p>
        </div>
        <RecordedComparison record={recordedExperiments[0]} />
        <div className="hero-record-footer">
          <RecordSettings record={recordedExperiments[0]} />
          <a className="text-link" href="#experiments/customer_support_empathy">
            Inspect this record <ArrowRight size={20} />
          </a>
        </div>
      </figure>
      <p className="figure-caption">
        A qualitative example, not a quality benchmark.
      </p>

      <section className="method-section" aria-labelledby="method-heading">
        <h2 id="method-heading">A small edit inside the forward pass.</h2>
        <p className="section-lead">
          Define a contrast. Extract a direction. Test what changes.
        </p>
        <ol className="method-flow">
          <li>
            <h3>
              <span>01</span> Contrast
            </h3>
            <p>
              + helpful, specific
              <br />− vague, dismissive
            </p>
            <ArrowRight className="flow-arrow" aria-hidden="true" />
          </li>
          <li>
            <h3>
              <span>02</span> Extract
            </h3>
            <p>v = mean(h+ − h−)</p>
            <ArrowRight className="flow-arrow" aria-hidden="true" />
          </li>
          <li>
            <h3>
              <span>03</span> Intervene
            </h3>
            <p>h′ = h + αv</p>
            <ArrowRight className="flow-arrow" aria-hidden="true" />
          </li>
          <li>
            <h3>
              <span>04</span> Compare
            </h3>
            <p>
              Baseline
              <br />
              Prompt control
              <br />
              Steered
            </p>
          </li>
        </ol>
        <div className="method-notes">
          <section>
            <h3>Why this lab exists</h3>
            <p>
              Behavior changes are easy to show and harder to explain. This lab
              keeps the prompt pairs, intervention settings, outputs and
              artifacts together so you can inspect the experiment.
            </p>
          </section>
          <section>
            <h3>What the examples establish</h3>
            <p>
              The recorded examples show qualitative changes. They do not
              establish better quality, robust control or generalization.
            </p>
          </section>
        </div>
        <p className="method-reference">
          The contrast above is illustrative. The implementation explores{" "}
          <a
            href="https://arxiv.org/abs/2308.10248"
            target="_blank"
            rel="noreferrer"
          >
            Activation Addition
          </a>{" "}
          and{" "}
          <a
            href="https://arxiv.org/abs/2312.06681"
            target="_blank"
            rel="noreferrer"
          >
            CAA-style mean differences
          </a>
          .{" "}
          <a href="#learn">
            Try the vector arithmetic <ArrowRight size={16} />
          </a>
        </p>
      </section>

      <section
        className="setup-section"
        id="setup"
        tabIndex={-1}
        aria-labelledby="setup-heading"
      >
        <div>
          <h2 id="setup-heading">Run your first experiment.</h2>
          <h3>Start without a model</h3>
          <p>Learn the vector arithmetic before downloading weights.</p>
          <div className="setup-links">
            <a
              className="text-link"
              href="https://github.com/smgpulse007/llm-steering#quick-start"
              target="_blank"
              rel="noreferrer"
            >
              Full local setup <ArrowUpRight size={18} />
            </a>
            <a className="text-link" href="#workbench">
              Open workbench <ArrowRight size={18} />
            </a>
          </div>
          <p className="setup-requirements">
            Python 3.13+ and Git. Model runs additionally need the model extras,
            compatible hardware and access to the chosen weights.
          </p>
        </div>
        <div className="setup-command">
          <div className="command-toolbar">
            <div role="group" aria-label="Quickstart platform">
              <button
                aria-pressed={platform === "windows"}
                onClick={() => {
                  setPlatform("windows");
                  setCopied(false);
                }}
              >
                Windows
              </button>
              <button
                aria-pressed={platform === "unix"}
                onClick={() => {
                  setPlatform("unix");
                  setCopied(false);
                }}
              >
                macOS / Linux
              </button>
            </div>
            <button
              aria-label={
                copied ? "Commands copied" : "Copy quickstart commands"
              }
              onClick={async () =>
                setCopied(await copyTextToClipboard(command))
              }
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <pre>
            <code>{command}</code>
          </pre>
          <span className="sr-only" role="status">
            {copied ? "Quickstart commands copied." : ""}
          </span>
        </div>
      </section>
      <footer className="site-footer">
        <span>Research code. Evaluate changes on your own task.</span>
        <a href="#docs/methodology">
          Methodology <ArrowRight size={16} />
        </a>
      </footer>
    </div>
  );
}
