# Tools

A personal developer workbench, deployed at **https://tools.abdspace.xyz**.

Three capabilities today:

| Route     | What it does                                                  |
| --------- | ------------------------------------------------------------- |
| `/jwt`    | Inspect a token: header, payload, signature, annotated claims |
| `/base64` | Encode and decode, both directions live, no mode to pick      |

`/` is an input surface, not a landing page: paste something and it resolves to
the capability that applies. `⌘K` / `Ctrl+K` opens the same resolution as a
command palette.

Everything runs in the browser. There is no server, no database, no account and
no telemetry — nothing pasted into Tools leaves the tab.

Read [VISION.md](./VISION.md) before making product or architectural decisions.

## Stack

React 19 · TypeScript (strict) · Vite · TanStack Router · Tailwind CSS v4 ·
Radix Dialog · Lucide · Vitest · Playwright · pnpm

No animation library: Radix drives its own enter and exit transitions through
`data-state`, so the palette animates from CSS keyframes in `styles/global.css`.

**CodeMirror 6** is used by `/json` and nothing else. A textarea cannot show a
gutter, fold a subtree, underline the exact character that broke the parse, or
stay responsive on a megabyte of JSON, and all four are the point of a JSON
workspace. It costs about 118 kB gzipped, entirely inside the `/json` chunk —
the entry bundle is unchanged, and `/jwt` and `/base64` never download it.

## Local development

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm dev          # dev server on :5173
pnpm build        # typecheck + production bundle into dist/
pnpm preview      # serve the production bundle on :4173
pnpm typecheck    # tsc, no emit
pnpm lint         # eslint
pnpm format       # prettier --write
pnpm test         # vitest, once
pnpm test:watch   # vitest, watching
pnpm test:e2e     # playwright (builds are served by `vite preview`)
```

`pnpm test:e2e` runs against the production bundle, so run `pnpm build` first
if `dist/` is stale.

## Architecture

```
src/
├── app/
│   ├── routing/     router, root input surface, not-found
│   ├── shell/       the app frame: top bar, layout
│   └── commands/    ⌘K palette
├── tools/
│   ├── registry.ts  every capability, declared once
│   ├── types.ts     the ToolDefinition contract
│   ├── json/        definition · lib (pure) · components · tests
│   ├── jwt/         definition · lib (pure) · components · tests
│   └── base64/      definition · lib (pure) · components · tests
├── components/
│   ├── ui/          Button, Panel, Editor, CopyButton, SegmentedControl…
│   └── shared/      composed pieces used across workspaces
├── hooks/           useCopy, useHotkey
├── lib/             cn, clipboard, bytes, json-tokens, handoff
└── styles/          theme tokens + global base layer
```

Two boundaries matter:

**Transformation is separate from presentation.** Everything in a tool's `lib/`
is pure, framework-free and tested without rendering React. Components read
those functions; they do not contain the logic.

**The registry is the single source of capability truth.** A `ToolDefinition`
carries the path, name, summary, icon, search keywords and an optional
`detect()`. Routing, the palette and intent resolution all read from it.

**A capability can have more than one view.** `/json` and `/json/compare` are
one tool, not two — same parser, same tree, same diagnostics. Views appear as
a small tab group in the top bar, but only for the tool you are in, and only
when it has more than one. This is how JSON stays one environment instead of
fragmenting into a page per operation.

**The document text is the single source of truth.** A tree edit parses,
changes the value and writes the text back, so there is one undo stack for the
whole workspace rather than one per surface — and CodeMirror's own history is
deliberately switched off for the same reason.

**Colour is split between status and syntax.** `--color-success` and friends
mean something happened; `--color-syntax-*` means "this is a number". Reusing
the status ramp for syntax made documents read like a status report.

**State lives at the lowest useful level.** No global store. The Base64
workspace keeps only the side you edited and derives the other on render, which
is why the two fields can never fight each other. Content handed from `/` to a
workspace goes through an in-memory slot (`lib/handoff.ts`), never the URL —
a token must not end up in history, a bookmark or a referrer.

## Adding a workspace

1. `src/tools/<name>/lib/` — the pure transformation, with tests beside it.
2. `src/tools/<name>/definition.ts` — a `ToolDefinition`, plus `detect()` if
   its input is recognisable on sight.
3. Add its route to `ToolPath` in `src/tools/types.ts`.
4. Register it in `src/tools/registry.ts`.
5. Add a lazy route in `src/app/routing/router.tsx`.
6. `src/tools/<name>/components/` — the workspace, built from `components/ui`.

The compiler enforces steps 3–5 together; the palette, the root surface and
search pick the tool up with no further wiring.

To add a _view_ to an existing tool, give it an entry in `views` (and a
`defaultViewName`, so the tab group does not repeat the tool's name), then
steps 3 and 5 for its route.

## Testing

- **Vitest** covers transformation logic: encoding, decoding, malformed input,
  Unicode, Base64URL, claim parsing, validity windows, intent detection, JSON
  syntax diagnostics, path queries, tree building and the structural diff.
- **Playwright** covers the flows that matter: deep links, reload, history,
  paste-to-result in every workspace, copy, the keyboard palette, tree
  navigation by keyboard, invalid input, and the guarantee that pasted content
  never reaches the URL.

## Production build

```bash
pnpm build      # -> dist/
```

Static output. Route-level code splitting means `/jwt` never downloads the code
for anything else.

## Docker

```bash
docker build -t tools .
docker run --rm -p 8080:8080 tools
```

Multi-stage: Node builds the bundle, nginx serves it. No Node and no dev server
in the runtime image. The nginx config provides the SPA fallback (so `/jwt`
resolves on a direct request), long-lived caching for hashed assets, a
`/healthz` endpoint, and a strict CSP appropriate for an app that talks to
nothing.

The container listens on **8080**.

## Deployment

```
GitHub → Actions → build + test → image → GHCR → Dokploy → Traefik → Hetzner
```

`.github/workflows/ci.yml` lints, typechecks, runs unit and E2E tests, builds
the bundle, then builds and pushes the image to `ghcr.io/<owner>/<repo>` tagged
`latest` and `sha-<commit>`. Actions performs the build; Dokploy only pulls.

Infrastructure values that still have to be supplied outside this repository:

- **`DOKPLOY_DEPLOY_WEBHOOK`** — repository secret. Without it the workflow
  publishes the image and skips the redeploy call.
- **Dokploy application** — configured to pull `ghcr.io/<owner>/tools:latest`,
  with registry credentials if the package is private.
- **Traefik** — route `tools.abdspace.xyz` to container port `8080`, terminate
  TLS there.

No application environment variables exist, so there is no `.env.example`.
