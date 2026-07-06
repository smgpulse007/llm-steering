from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import re

from .config import project_root


@dataclass(frozen=True, slots=True)
class LocalDocSection:
    id: str
    title: str
    level: int

    def to_dict(self) -> dict[str, str | int]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class LocalDoc:
    doc_id: str
    title: str
    path: str
    summary: str
    category: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


LOCAL_DOCS: tuple[LocalDoc, ...] = (
    LocalDoc(
        doc_id="lesson_transformers",
        title="Lesson 1: Transformer Basics",
        path="docs/lessons/01_transformers.md",
        summary="Beginner introduction to tokens, layers, residual stream, and hidden states.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_prompt_steering",
        title="Lesson 2: Prompt Steering",
        path="docs/lessons/02_prompt_steering.md",
        summary="Why prompt steering is the first baseline and how it differs from activation edits.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_activation_steering",
        title="Lesson 3: Activation Steering",
        path="docs/lessons/03_activation_steering.md",
        summary="Plain-language explanation of inference-time activation edits.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_actadd",
        title="Lesson 4: ActAdd",
        path="docs/lessons/04_actadd.md",
        summary="Positive/negative prompt pairs, steering vectors, and tuning knobs.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_caa",
        title="Lesson 5: CAA-Style Mean Difference",
        path="docs/lessons/05_caa.md",
        summary="Using multiple contrast pairs to build more stable directions.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_evaluation",
        title="Lesson 6: Evaluation",
        path="docs/lessons/06_evaluation.md",
        summary="Baseline, prompt-only control, sweeps, diagnostics, and review artifacts.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="lesson_advanced_methods",
        title="Lesson 7: Advanced Methods",
        path="docs/lessons/07_advanced_methods.md",
        summary="Activation patching, SEA, SAE-guided steering, and support rules.",
        category="lessons",
    ),
    LocalDoc(
        doc_id="glossary",
        title="Glossary",
        path="docs/glossary.md",
        summary="Short definitions for activation steering terms used by the repo.",
        category="docs",
    ),
    LocalDoc(
        doc_id="methodology",
        title="Methodology",
        path="docs/methodology.md",
        summary="Math, hook stages, token targeting, and the recommended steering evaluation loop.",
        category="docs",
    ),
    LocalDoc(
        doc_id="literature",
        title="Steering Vectors Literature Review",
        path="research/steering_vectors_literature_review.md",
        summary="Source-backed research arc covering ActAdd, CAA, RepE, SEA, activation patching, and SAE directions.",
        category="research",
    ),
    LocalDoc(
        doc_id="gemma_runtime",
        title="Gemma 4 Runtime Notes",
        path="research/gemma4_runtime_notes.md",
        summary="Runtime, model-size, and deployment notes for Gemma 4 experiments.",
        category="research",
    ),
    LocalDoc(
        doc_id="diffusion_qwen_ui",
        title="DiffusionGemma/Qwen UI Research Notes",
        path="research/2026-06-14_diffusiongemma_qwen_ui_research_notes.md",
        summary="Handoff research for DiffusionGemma, Qwen3.6, Qwen3-Coder-Next, reliability, and UI direction.",
        category="research",
    ),
)


def list_local_docs() -> list[dict[str, str]]:
    return [doc.to_dict() for doc in LOCAL_DOCS]


_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+?)\s*#*\s*$")
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MARKDOWN_DECORATION_RE = re.compile(r"[*_`~]")
_NON_SLUG_CHARS_RE = re.compile(r"[^a-z0-9]+")


def _clean_heading(text: str) -> str:
    heading = text.strip()
    heading = _MARKDOWN_LINK_RE.sub(r"\1", heading)
    heading = _MARKDOWN_DECORATION_RE.sub("", heading)
    return heading.strip()


def _slugify_heading(text: str, seen: dict[str, int]) -> str:
    base = _NON_SLUG_CHARS_RE.sub("-", text.lower()).strip("-") or "section"
    count = seen.get(base, 0)
    seen[base] = count + 1
    if count:
        return f"{base}-{count + 1}"
    return base


def extract_markdown_sections(content: str) -> list[dict[str, str | int]]:
    sections: list[LocalDocSection] = []
    seen: dict[str, int] = {}
    in_fence = False

    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        match = _HEADING_RE.match(line)
        if not match:
            continue
        level = len(match.group(1))
        title = _clean_heading(match.group(2))
        if not title:
            continue
        sections.append(LocalDocSection(id=_slugify_heading(title, seen), title=title, level=level))

    return [section.to_dict() for section in sections]


def get_local_doc(doc_id: str) -> tuple[LocalDoc, str, list[dict[str, str | int]]]:
    for doc in LOCAL_DOCS:
        if doc.doc_id == doc_id:
            doc_path = (project_root() / Path(doc.path)).resolve()
            root = project_root().resolve()
            if root not in doc_path.parents and doc_path != root:
                raise ValueError(f"Document path escapes project root: {doc.path}")
            content = doc_path.read_text(encoding="utf-8")
            return doc, content, extract_markdown_sections(content)
    raise KeyError(f"Unknown document id: {doc_id}")
