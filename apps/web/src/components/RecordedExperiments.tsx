import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import {
  findRecordedExperiment,
  recordedExperiments,
  recordNotes,
  sourceRecordUrl,
  exportRecordedExperiment,
  missingProvenance,
  type RecordedExperiment,
} from "../lib/recordedExperiments";
import { downloadTextFile } from "../lib/browserFiles";
import { safeDiffTokens, renderDiffTokens } from "../lib/diff";
import { MarkdownOutput } from "../lib/markdown";

export function RecordSettings({ record }: { record: RecordedExperiment }) {
  return (
    <div className="record-settings" aria-label="Original recorded settings">
      <span>Layer {record.layer}</span>
      <span>Coefficient {record.coefficient}</span>
      <span>
        {record.apply_to === "all_tokens" ? "All tokens" : "Last token"}
      </span>
      <span>{record.hook_stage === "post" ? "Post-block" : "Pre-block"}</span>
    </div>
  );
}

export function RecordedComparison({ record }: { record: RecordedExperiment }) {
  return (
    <div className="record-comparison">
      <section>
        <h3>Baseline</h3>
        <MarkdownOutput text={record.baseline} />
      </section>
      <section>
        <h3>Activation-steered</h3>
        <MarkdownOutput text={record.steered} />
      </section>
    </div>
  );
}

export function RecordedExperiments({ slug }: { slug?: string }) {
  const record = findRecordedExperiment(slug);
  if (!record)
    return (
      <section className="page-section">
        <h1>Experiment not found.</h1>
        <p>This link does not match a recorded experiment.</p>
        <a className="text-link" href="#experiments">
          Browse the recorded experiments <ArrowRight size={18} />
        </a>
      </section>
    );
  return <RecordReader key={record.slug} record={record} />;
}

function RecordReader({ record }: { record: RecordedExperiment }) {
  const note = recordNotes[record.slug];
  const [showDiff, setShowDiff] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const diff = useMemo(
    () => safeDiffTokens(record.baseline, record.steered),
    [record],
  );
  return (
    <section className="page-section experiments-page">
      <div className="page-heading">
        <h1>Inspect the change.</h1>
        <p>Three recorded examples. Original outputs, original settings.</p>
      </div>
      <nav className="record-tabs" aria-label="Recorded examples">
        {recordedExperiments.map((item) => (
          <a
            key={item.slug}
            href={`#experiments/${item.slug}`}
            aria-current={record.slug === item.slug ? "page" : undefined}
          >
            {recordNotes[item.slug].tab}
          </a>
        ))}
      </nav>
      <article aria-label="Recorded experiment" key={record.slug}>
        <div className="record-heading">
          <h2>{note.title}</h2>
          <div className="action-row">
            <a
              className="text-link"
              href={sourceRecordUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source JSON <ArrowUpRight size={18} />
            </a>
            <button
              className="secondary-button"
              onClick={() => {
                downloadTextFile(
                  `${record.slug}.recorded.json`,
                  exportRecordedExperiment(record),
                  "application/json",
                );
                setDownloadStatus(`Downloaded ${note.tab} record.`);
              }}
            >
              <Download size={18} /> Download record
            </button>
          </div>
        </div>
        <p className="record-prompt">{record.user_prompt}</p>
        <RecordedComparison record={record} />
        <label className="toggle-row diff-toggle">
          <input
            type="checkbox"
            checked={showDiff}
            onChange={(event) => setShowDiff(event.target.checked)}
          />{" "}
          Highlight changes <span>Raw-text comparison</span>
        </label>
        {showDiff && (
          <div
            className="record-comparison diff-comparison"
            aria-label="Recorded raw-text differences"
          >
            <section>
              <h3>Removed or changed</h3>
              <p>{renderDiffTokens(diff.left)}</p>
            </section>
            <section>
              <h3>Added or changed</h3>
              <p>{renderDiffTokens(diff.right)}</p>
            </section>
          </div>
        )}
        <RecordSettings record={record} />
        <div className="record-reading">
          <section>
            <h2>Read the result, not just the difference.</h2>
            <p>{note.observation}</p>
            {note.tradeoff && (
              <p className="tradeoff">
                <strong>Tradeoff:</strong> {note.tradeoff}
              </p>
            )}
          </section>
          <aside>
            <h3>What this record does not contain</h3>
            <p>
              No {missingProvenance.slice(0, -1).join(", ")} or{" "}
              {missingProvenance.at(-1)} is recorded. These settings belong to
              this saved example, not your workbench draft.
            </p>
            <a className="text-link" href="#docs/lesson_evaluation">
              Design your own controlled comparison <ArrowRight size={18} />
            </a>
          </aside>
        </div>
        <p className="record-source-note">
          Recorded legacy artifact · static preview · no new inference. The
          original file does not capture enough provenance for an exact replay.
        </p>
        <p role="status" className="action-status">
          {downloadStatus}
        </p>
      </article>
    </section>
  );
}
