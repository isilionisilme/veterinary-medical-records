# Onboarding Guides

> Quick-start reading paths for different audiences evaluating this codebase.

## Available Guides

| Guide | Audience | What You'll Learn | Time |
|-------|----------|-------------------|------|
| [Staff Engineer Guide](staff-engineer-guide.md) | Staff/principal engineers evaluating the codebase | Architecture, design decisions, system boundaries, confidence model, testing strategy | ~45 min |

## Project Summary

**Veterinary Medical Records** is a document processing system that extracts structured clinical data from veterinary PDF reports, assigns confidence scores to guide human review, and captures correction signals for incremental calibration. The system uses a modular monolith architecture (Python/FastAPI backend, React/TanStack Query frontend, SQLite persistence) with hexagonal boundaries and 11 Architecture Decision Records documenting every significant trade-off.

## How to Use

Start with the **Staff Engineer Guide** for a deep architectural walkthrough. The guide includes a recommended reading order scaled to your available time (15 / 30 / 45 minutes) and Docker instructions to run the system locally.

For product context, see the [Product Design](../projects/01-product/product-design.md) wiki page. For deployment, see the repository [README](https://github.com/isilionisilme/veterinary-medical-records-handoff#readme).
