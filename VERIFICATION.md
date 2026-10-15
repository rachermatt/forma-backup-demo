# Forma Backup browser demo verification

Prepared on October 15, 2026.

## Passed

- `npm test`: all 12 tests passed. Coverage includes first/unchanged sync, modified/new/deleted files, selected projects, failure preservation, versioned retention, incomplete versions, force-full downloads, file metadata, ZIP validation, standalone bundle syntax, and Content Security Policy hash integrity.
- `npm run build`: generates a self-contained `index.html` at the project root and an identical `dist/index.html` for deployment. The page has embedded CSS, icons, and classic JavaScript, with no external asset loaders or module imports.
- `node --check app.mjs`: JavaScript syntax check passed.
- DOM wiring smoke checks passed using the actual HTML and application module in a virtual DOM: startup, initial sync, unchanged sync, source changes, preview dialog, switching modes, running versioned backups, selecting older snapshots and checking their counters, simulated failure, empty project selection, and reset.
- Local HTTP checks confirmed the application and its public resources are served successfully. Unknown paths and private source files are not exposed by the local development server.
- ZIP export tests verify stored-entry headers, CRC32, Unicode byte lengths, directory offsets, deterministic output, and rejection of unsafe archive paths.

The DOM smoke-test harness is a workspace verification tool, not an application runtime dependency. The distributed application has no npm dependencies.

## Browser review of the revised version

The revised application was verified through the local HTTP preview in the in-app browser:

- Desktop layout renders the sidebar, hub context, portfolio summary, project scope, mode selection, source/destination topology, file explorers, counters, and activity console.
- Initial sync: 32 files copied. Following the first sample changes: eight downloaded, 24 reused, four obsolete tracked files removed.
- Versioned mode: initial snapshot downloads 32 files; subsequent unchanged snapshot copies 32 files forward. Selecting the earlier snapshot shows its own 32 downloaded / zero reused statistics.
- Drawing preview: the synthetic SVG loaded at its expected 960-pixel native width. It displays as an image; raw SVG markup is hidden.
- Responsive checks at viewport widths 1280, 390, and 320 showed no horizontal page overflow. The temporary viewport override was reset afterward.
- No browser errors or warnings were recorded during the tested workflows.

The before screenshot in the user-provided PDF showed plain, unstyled HTML and empty project lists. The initial package used root-relative assets and module scripts unsuitable for a direct `file://` opening. The replacement bundle embeds all of those resources and has regression checks preventing that packaging error.

Browser automation does not permit direct `file://` observation. The standalone package was therefore checked structurally and for bundle execution in a virtual DOM; real-browser visual and interaction checks used HTTP. Refresh the open local `index.html` to load the replacement.

## Deployment status

Vercel deployment and hostname availability have not been verified. No Vercel project or domain was created or modified. Import this package into the intended Vercel team and review its preview deployment before publishing.

This demo verifies synthetic browser behavior only. It does not validate APS connectivity or execute the production .NET application.
