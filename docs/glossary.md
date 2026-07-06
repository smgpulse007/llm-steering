# Glossary

## Activation

A vector produced inside the model during a forward pass.

## Activation Steering

An inference-time intervention that edits internal activations to nudge model behavior without retraining weights.

## ActAdd

Activation Addition. A steering method that subtracts a negative prompt activation from a positive prompt activation and adds the result during generation.

## CAA

Contrastive Activation Addition. A multi-example extension that uses contrastive positive and negative demonstrations.

## Coefficient

The scalar that controls how strongly the steering vector is added.

## Hidden State

The model's intermediate vector representation for tokens at a layer.

## Hook

A runtime callback that can read or modify tensors during a PyTorch forward pass.

## Pre-Activation Hook

A hook that edits the input to a transformer block.

## Post-Activation Hook

A hook that edits the output of a transformer block.

## Residual Stream

The main vector pathway that carries information through transformer blocks.

## Steering Vector

A direction in activation space used to nudge a model toward or away from a behavior.
