# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## Project Overview

The Payment Incident Intelligence Platform is a system for tracking, analyzing, and surfacing insights about payment-related incidents. It combines a frontend dashboard, a backend API/service layer, and cloud infrastructure to help teams detect, investigate, and resolve payment incidents faster.

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js
- **Infrastructure/Platform:** Firebase (hosting, auth, and/or data storage as the project evolves)

## Coding Standards

- Write modular, production-ready code — no throwaway or placeholder implementations.
- Never generate placeholder code (no `TODO` stubs, fake data, or "implement later" scaffolding) — implement things fully or not at all.
- Keep components, modules, and services small and single-purpose.
- Keep documentation in `docs/` updated as the codebase and architecture evolve.

## Knowledge Base

- The project knowledge base lives at [docs/knowledge-base/Payment_Incident_Project_Chatgpt handoff packet.docx](docs/knowledge-base/Payment_Incident_Project_Chatgpt%20handoff%20packet.docx).
- **Always read the knowledge base before making major architectural decisions.** It contains prior context and decisions from earlier project handoffs.
