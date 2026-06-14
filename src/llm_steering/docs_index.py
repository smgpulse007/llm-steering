from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from .config import project_root


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


def get_local_doc(doc_id: str) -> tuple[LocalDoc, str]:
    for doc in LOCAL_DOCS:
        if doc.doc_id == doc_id:
            doc_path = (project_root() / Path(doc.path)).resolve()
            root = project_root().resolve()
            if root not in doc_path.parents and doc_path != root:
                raise ValueError(f"Document path escapes project root: {doc.path}")
            return doc, doc_path.read_text(encoding="utf-8")
    raise KeyError(f"Unknown document id: {doc_id}")
