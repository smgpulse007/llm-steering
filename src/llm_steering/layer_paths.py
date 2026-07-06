"""Shared transformer layer-path candidates without optional ML imports."""

LAYER_PATH_CANDIDATES = (
    "model.language_model.layers",
    "model.language_model.model.layers",
    "model.layers",
    "language_model.model.layers",
    "language_model.layers",
    "transformer.h",
    "gpt_neox.layers",
    "model.decoder.layers",
)
