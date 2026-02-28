<div align="center">
  <img src="/.github/images/github-header-image.webp" alt="GitHub Header Image" width="auto" />
  <p></p>
  <p></p>
  <!-- MIT License -->
  <a href="https://github.com/hadronomy/autographa/blob/main/LICENSE">
    <img
      alt="Content License"
      src="https://img.shields.io/github/license/hadronomy/autographa?style=for-the-badge&logo=starship&color=ee999f&logoColor=D9E0EE&labelColor=302D41"
    />
  </a>

  <!-- GitHub Repo Stars -->
  <a href="https://github.com/hadronomy/autographa/stargazers">
    <img
      alt="Stars"
      src="https://img.shields.io/github/stars/hadronomy/autographa?style=for-the-badge&logo=starship&color=c69ff5&logoColor=D9E0EE&labelColor=302D41"
    />
  </a>
  <p></p>
  <p align="center">
    Create beautiful animated signatures.
  </p>
  <p></p>
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#license">License</a>
  <hr />

</div>

## Getting Started

First, install the dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`
- Format and lint fix: `bun run check`

## Project Structure

```
autographa/
├── apps/
│   └── web/         # Fullstack application (React + TanStack Start)
├── packages/
│   ├── api/         # API layer / business logic
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: Check TypeScript types across all apps
- `bun run check`: Run Oxlint and Oxfmt

## License

MIT
