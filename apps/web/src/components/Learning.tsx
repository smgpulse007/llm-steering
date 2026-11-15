import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { intervene2D, toyHiddenState, toyDirection } from "../lib/vectorMath";
import type { LabController } from "../hooks/useLab";
import { DocsExplorer } from "./WorkbenchPanels";

const lessonLabels = [
  "Transformer basics",
  "Prompt steering",
  "Activation steering",
  "ActAdd & extraction",
  "CAA-style mean difference",
  "Evaluation discipline",
  "Advanced methods",
];

export function VectorIllustration() {
  const [coefficient, setCoefficient] = useState(1);
  const edited = intervene2D(toyHiddenState, toyDirection, coefficient);
  const point = ([x, y]: readonly number[]) =>
    `${75 + x * 120},${340 - y * 80}`;
  const origin = point([0, 0]);
  const resultLabel = `(${edited.map((value) => Number(value.toFixed(2))).join(", ")})`;
  return (
    <div className="vector-lesson">
      <figure>
        <svg
          viewBox="0 0 420 460"
          role="img"
          aria-labelledby="vector-title vector-description"
        >
          <title id="vector-title">Synthetic vector addition</title>
          <desc id="vector-description">
            With coefficient {coefficient}, h prime equals {resultLabel}. The
            black arrow is the original hidden state; the blue arrow is the
            edited state.
          </desc>
          <defs>
            <marker
              id="arrow-ink"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
            <marker
              id="arrow-blue"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#385bff" />
            </marker>
          </defs>
          <path
            d="M75 430V45 M75 340H380"
            stroke="currentColor"
            fill="none"
            strokeWidth="1.5"
            markerEnd="url(#arrow-ink)"
          />
          {[-1, 0, 1, 2, 3].map((value) => (
            <g key={value}>
              <line
                x1="70"
                x2="80"
                y1={340 - value * 80}
                y2={340 - value * 80}
                stroke="currentColor"
              />
              <text x="58" y={345 - value * 80} textAnchor="end">
                {value}
              </text>
            </g>
          ))}
          {[0, 1, 2].map((value) => (
            <g key={value}>
              <line
                x1={75 + value * 120}
                x2={75 + value * 120}
                y1="335"
                y2="345"
                stroke="currentColor"
              />
              <text x={75 + value * 120} y="365" textAnchor="middle">
                {value}
              </text>
            </g>
          ))}
          <text x="384" y="350">
            x
          </text>
          <text x="70" y="32">
            y
          </text>
          <polyline
            points={`${origin} ${point(edited)}`}
            fill="none"
            stroke="#385bff"
            strokeWidth="3"
            markerEnd="url(#arrow-blue)"
          />
          <polyline
            points={`${point(toyHiddenState)} ${point(edited)}`}
            fill="none"
            stroke="#385bff"
            strokeWidth="2"
            strokeDasharray="4 5"
          />
          <polyline
            points={`${origin} ${point(toyHiddenState)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            markerEnd="url(#arrow-ink)"
          />
          <text x="190" y="287" fontStyle="italic">
            h
          </text>
          <text
            x={86 + edited[0] * 120}
            y={330 - edited[1] * 80}
            fill="#385bff"
            fontStyle="italic"
          >
            h′
          </text>
        </svg>
        <figcaption>Synthetic 2D illustration · not a model output</figcaption>
      </figure>
      <section className="vector-controls">
        <h2>Try the coefficient</h2>
        <label htmlFor="toy-coefficient">
          Coefficient α <output htmlFor="toy-coefficient">{coefficient}</output>
        </label>
        <div className="slider-row">
          <span>−2</span>
          <input
            id="toy-coefficient"
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={coefficient}
            onChange={(event) => setCoefficient(Number(event.target.value))}
          />
          <span>2</span>
        </div>
        <p className="vector-equation">h′ = h + αv</p>
        <dl>
          <div>
            <dt>h</dt>
            <dd>(1, 1)</dd>
          </div>
          <div>
            <dt>v</dt>
            <dd>(0.5, 1)</dd>
          </div>
          <div>
            <dt>h′</dt>
            <dd aria-live="polite">{resultLabel}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export function Learning({ lab }: { lab: LabController }) {
  if (lab.showLesson)
    return (
      <section className="page-section docs-page">
        <a className="text-link back-link" href="#learn">
          Learning path
        </a>
        <DocsExplorer
          title="Learning path"
          docs={lab.docs}
          selectedDocId={lab.selectedDocId}
          onSelectDoc={(id, section) => lab.selectDoc(id, false, section)}
          docContent={lab.docContent}
        />
      </section>
    );
  const lessons = lab.docs.filter((doc) => doc.category === "lessons");
  return (
    <section className="learn-page page-section">
      <aside className="lesson-rail">
        <h2>The learning path</h2>
        <nav aria-label="Lessons">
          {lessons.map((doc, index) => (
            <a key={doc.doc_id} href={`#docs/${doc.doc_id}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {lessonLabels[index] ?? doc.title}
            </a>
          ))}
        </nav>
        <a className="text-link" href="#docs/methodology">
          Reference & research
        </a>
      </aside>
      <article className="learn-intro">
        <div className="page-heading">
          <h1>An edit to the computation.</h1>
          <p>
            A steering vector changes a hidden state during inference. The model
            weights stay fixed.
          </p>
        </div>
        <VectorIllustration />
        <section className="learning-hypothesis">
          <h2>Direction is a hypothesis.</h2>
          <p>
            Contrastive examples define a direction to test. A different answer
            is not evidence that the answer improved. Compare a baseline, a
            prompt-only control and the activation edit on held-out prompts.
          </p>
          <div className="action-row">
            <a
              className="primary-button"
              href="#docs/lesson_activation_steering"
            >
              Read the full lesson
            </a>
            <a className="secondary-button" href="#experiments">
              Explore recorded examples <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </article>
    </section>
  );
}
