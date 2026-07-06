# Lesson 1: Transformer Basics

Activation steering only makes sense after the basic transformer loop is clear.

An input prompt is tokenized, embedded, passed through repeated transformer blocks, and decoded into next-token predictions. Each block updates a hidden representation of the sequence. In decoder-only language models, the residual stream carries information forward while attention and MLP layers transform it.

Useful vocabulary:

- Token: a chunk of text represented as an integer id.
- Embedding: the learned vector for a token.
- Hidden state: the model's internal vector representation at a layer.
- Residual stream: the vector path that carries information through the blocks.
- Layer: one repeated transformer block.

The practical point for this repo: activation steering edits a hidden state during inference. It does not retrain model weights.

## Check Yourself

If a prompt is the model input, the hidden state is the model's intermediate workspace. Steering changes that workspace before the final answer is produced.
