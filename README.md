# Bria Arc

**Open Source Tools for Professional Craft**

Bria Arc (`bria-arc`) is a comprehensive monorepo suite of powerful, client-side web applications designed to bridge the gap between creative professionals and generative AI. Built exclusively on top of the [Bria AI](https://bria.ai/) engine.

## The Arc Suite

This repository utilizes an integrated workspace architecture containing multiple specialized tools that share a central core engine:

- **Arc Render** (`apps/render`): A high-fidelity image generation, refinement, and editing terminal. Built to provide granular control over VGL (Visual Generation Language) outputs while seamlessly tracking image lineage and variant editing histories.
- **Arc Drama** (`apps/drama`): A narrative production pipeline platform. Facilitates structured script break-downs, character design consistency, and serialized shot generation for professional storyboarding and dynamic visual storytelling.
- **Core Library** (`packages/core`): The underlying framework that standardizes API interactions, state management, File System IO, and UI components across the Arc suite.

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- A valid **Bria AI API Token** (*You will directly supply this token via the settings UI natively inside the app; no insecure hard-coding into environmental variables is required*).

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:dougbria/bria-arc.git
   cd bria-arc
   ```
2. Install all monorepo dependencies:
   ```bash
   npm install
   ```

### Running Locally
To launch **Arc Render**:
```bash
npm run dev -w @arc/render
```

To launch **Arc Drama**:
```bash
npm run dev -w @arc/drama
```

## Architecture
Bria Arc is a fully un-tethered, client-side progressive web application. The core engine utilizes the modern File System Access API permitting the suite to securely read and write JSON states, projects, and `.png` image variants directly to your local workstation's file system. This results in a lightning-fast, persistent, local-first desktop application experience served entirely through the browser.

## License & Attribution

This software is proudly released as open-source under the [Apache License 2.0](./LICENSE). 

*Please note: Bria Arc is functionally dependent upon the Bria AI framework. To respect the platform, all forks, cross-distributions, and commercial derivations must retain the provided [NOTICE](./NOTICE) file attached to the root of the project to ensure permanent downstream attribution to Bria AI.*
