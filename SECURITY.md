# Security Policy

## Scope

`llm-steering` is a local research repository for activation steering experiments. It is not a hosted service and does not process production user traffic.

## Supported branch

Security fixes are currently targeted at the latest `main` branch.

## Reporting a vulnerability

If you discover a security issue in the repository code, please report it privately before opening a public issue.

Preferred channel:

- GitHub Security Advisories for this repository

When possible, include:

- affected file or script
- steps to reproduce
- expected vs actual behavior
- impact assessment

## What counts as in scope

Examples include:

- accidental secret exposure paths
- unsafe file handling in scripts
- dependency issues with a practical exploit path
- insecure defaults that could surprise contributors

## What is out of scope

The behavior of third-party model weights, hosted inference providers, or external services is outside the direct scope of this repository, though related documentation fixes are always welcome.
