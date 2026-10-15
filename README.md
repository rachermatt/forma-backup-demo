# Forma Backup Demo

![Browser demo](https://img.shields.io/badge/demo-synthetic_project_data-d5f96b)
![Runtime](https://img.shields.io/badge/runtime-browser_JavaScript-303737)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An interactive browser simulation of Forma Backup, prepared as a standalone Vercel project. Explore a synthetic construction hub, run sync or versioned backups, change sample files, and inspect the results. No Autodesk account or APS credentials are required.

This project implements backup decisions in browser JavaScript. It does not execute the .NET CLI, access Autodesk, perform actual network transfers, or benchmark production performance. The real backup application is available in the [Forma Backup repository](https://github.com/autodesk-platform-services/Forma-Backup).

## Try locally

For a quick preview, double-click `index.html`. It is now self-contained: styling, icons, sample data, and application code are embedded, so it can be opened directly from disk without a server. Refresh any previously open copy after replacing the files. Open `index.html`, not the editable `app-shell.html` template.

For development, use Node.js 22 or newer:

```sh
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. There are no package dependencies to install. To choose a different port, run `npm run dev -- --port 4174`.

Re-run `npm run build` after editing the source modules, stylesheet, or template. This regenerates both `index.html` and the identical `dist/index.html` used by Vercel.

### Why the earlier local preview was bare

The initial package referenced `/styles.css` and `/app.mjs` as web-root assets. Under a `file://` URL those paths do not point to the project folder. In addition, browser module security restricts direct local module loading; [MDN documents that limitation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_classic_scripts).

The new build embeds the CSS and a classic bundled script into the page, with matching Content Security Policy hashes. No external asset loading or module imports are required by the preview. The operational interface also adds portfolio summaries, a source/destination diagram, progress phases, file sizes and versions, an initially expanded explorer, and a rendered drawing preview.

## Suggested walkthrough

1. Leave all four projects selected and choose **Run backup**. The initial sync copies 32 synthetic files.
2. Run again without changing the source. All 32 files are unchanged.
3. Choose **Simulate changes**, then run again. Eight files are downloaded, 24 remain unchanged, and four obsolete tracked files are removed.
4. Expand a project on either side and select a file to inspect its metadata and content.
5. Choose **Export sample backup** to download a real ZIP containing the synthetic files and `DemoManifest.json`.
6. Switch to **Versioned backups**, select retention, and run several times. Complete snapshots are retained according to the selected limit; unchanged files are copied forward.
7. Open **Run history** to compare counters and export a JSON report.
8. For a failure scenario, first complete a baseline backup. Apply a source change, expand **Explore failure handling**, and enable the checkbox before another run. Existing sync files belonging to the failed project are preserved. A failed versioned run does not rotate complete snapshots.
9. Choose **Reset demo** to clear the browser tab’s synthetic state. Downloaded files are unaffected.

## Deploy as a dedicated Vercel project

Suggested project name: `forma-backup-demo`. A requested `forma-backup-demo.vercel.app` hostname is subject to availability; this package does not reserve it.

### From GitHub

1. In Vercel, choose **Add New → Project**.
2. Import [`rachermatt/forma-backup-demo`](https://github.com/rachermatt/forma-backup-demo) into the intended team.
3. Leave **Root Directory** at the repository root, which contains this README and `package.json`.
4. Use the **Other** framework preset. The included `vercel.json` defines `npm run build` and the `dist` output directory.
5. Leave environment variables empty. This demo needs no APS secrets, account IDs, database, or backend service.
6. Deploy. Review the generated preview before promoting changes to production.
7. Open **Project Settings → Domains** to choose the project’s available `vercel.app` hostname or attach a domain you control. For a custom domain, apply the DNS records Vercel specifies and complete verification.

Vercel documents its [project import flow](https://vercel.com/docs/getting-started-with-vercel/import) and [domain configuration](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

### From the Vercel CLI

From this project directory, after signing in to the intended Vercel account/team:

```sh
npx vercel
```

Review the preview deployment. To publish production after review:

```sh
npx vercel --prod
```

Do not add production APS credentials to this project. See the [official CLI documentation](https://vercel.com/docs/cli).

## Files and behavior

| File | Purpose |
| --- | --- |
| `index.html` | Generated self-contained page; double-click preview or deploy |
| `app-shell.html`, `styles.css`, `app.mjs` | Editable UI template, styling, and application logic |
| `model.mjs` | Pure deterministic synthetic backup model |
| `model.test.mjs` | Scenario, retention, filtering, and failure tests |
| `zip.mjs`, `zip.test.mjs` | Dependency-free UTF-8 ZIP export and validation |
| `scripts/build.mjs` | Bundles CSS/JavaScript into root and `dist/` HTML with CSP hashes |
| `build.test.mjs` | Checks standalone loading, bundle syntax, and CSP hash integrity |
| `scripts/serve.mjs` | Local development server bound to loopback |
| `vercel.json` | Static build settings and security headers |

All displayed file byte counts come from the generated UTF-8 payloads. Reuse is calculated as `reused bytes / (downloaded bytes + reused bytes)` for successfully processed files. Animation timing is illustrative.

The initial source has eight files per project. Generation two revises a report, adds a briefing, and removes an archive file in each project. Generation three revises a diagram and schedule and adds a closeout checklist in each project. The model compares file ID, path, version, timestamp, and byte length; it does not simulate corruption or real disk verification.

The sync destination and versioned destinations have separate histories. Sync preserves unselected and failed projects. A successful versioned run retains the configured count of complete snapshots; incomplete snapshots are preserved. Snapshots cover the projects selected for that run.

`DemoManifest.json` has `sourceKind: synthetic-web-demo` and is deliberately distinct from the production CLI manifest. Do not point the real CLI at an exported demo folder.

## Data and privacy

All project names, identities, file contents, and source dates are synthetic. No real credentials are embedded, requested, or stored. The site makes no APS requests and includes no third-party fonts, analytics, or runtime libraries. The deployed Content Security Policy blocks application network connections. GitHub/documentation links open only when selected.

The session uses `sessionStorage` for this browser tab, with an in-memory fallback when storage is unavailable. It does not write a server-side backup. ZIP, log, and report downloads are created locally by explicit user actions.

## Scope

The [production README](https://github.com/autodesk-platform-services/Forma-Backup) describes the real application’s scope as current project-file versions and folder hierarchy exposed through APS Data Management. Historical file versions, Issues, RFIs, account settings, and other non-file records are outside that documented scope. Successful demo runs do not verify live authentication, permissions, API behavior, or connectivity.

## Verification

`npm test` covers baseline/unchanged runs, changed source data, project filters, failed-project preservation, version retention, partial versioned runs, forced downloads, metadata consistency, ZIP structure, CRC values, Unicode paths, and unsafe archive paths. See `VERIFICATION.md` for browser checks performed on the prepared package.

## License

This demo is available under the [MIT license](LICENSE). The production Forma Backup application is maintained in its own repository with its own license and documentation.
