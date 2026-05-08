# Repo Overview — LLM Neural Visualizer

A walk-through aimed at a reviewer or interviewer skimming the repo for the first time.

## What it is

A small, single-page Next.js app that visualizes an LLM "thinking." The left half is a chat box; the right half is a 3D sphere of ~250 connected nodes. Every time the streaming API yields a token, lightning-bolt chains fire through 4–7 connected nodes, starting white-hot and fading to red. It's a visual analogy for token-by-token generation — not a real neural net inspector.

## Tech stack

| Layer       | Choice                                             |
| ----------- | -------------------------------------------------- |
| Framework   | Next.js 16 (App Router)                            |
| Language    | TypeScript                                         |
| 3D          | Three.js (`WebGLRenderer`, no external r3f)        |
| Styling     | Tailwind CSS 4                                     |
| LLM backend | Any OpenAI-compatible endpoint (OpenRouter/Groq/…) |
| Streaming   | Server-Sent Events over `fetch` ReadableStream     |

No state library, no ORM, no auth. Everything is in-memory in the client.

## File map

```
app/
├── api/chat/route.ts        # Server-side streaming proxy → upstream LLM
├── components/
│   ├── Chat.tsx              # Chat UI + SSE consumer; emits onToken callbacks
│   └── NeuralSphere.tsx      # All Three.js: scene, nodes, connections, animation
├── layout.tsx                # Root layout (fonts, metadata)
├── page.tsx                  # Two-pane layout, wires Chat ↔ NeuralSphere via props
└── globals.css               # Tailwind + scrollbar tweaks

public/                       # Static SVGs (default Next.js scaffolding)
.env.example                  # Three vars: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
```

## How it runs end-to-end

1. User types a message in `Chat.tsx`. It POSTs the conversation to `/api/chat`.
2. `app/api/chat/route.ts` forwards the request to the configured upstream
   (`LLM_BASE_URL/chat/completions`) with `stream: true` and re-emits each
   `delta.content` as a clean SSE frame: `data: {"token": "..."}`.
3. `Chat.tsx` reads the stream, appends each token to the active assistant
   message, and calls `onToken()` from props.
4. `page.tsx` increments a `tokenCount` state on every `onToken`. That count
   is passed as a prop to `NeuralSphere.tsx`.
5. `NeuralSphere.tsx` watches `tokenCount` in a `useEffect`; on each increment,
   it spawns 1–2 chain animations (4–7 hops each) through the connection graph.

## Run it

```bash
cp .env.example .env.local   # fill in LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
npm install
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build && npm run start
```

## Design notes worth talking about

- **Server-side streaming proxy.** The API key never reaches the client.
  The route reads the upstream SSE stream chunk-by-chunk, buffers partial
  lines (`buffer = lines.pop() || ""`), and re-emits a stripped-down event
  shape so the client doesn't have to know the OpenAI envelope.
- **Provider-agnostic.** Three env vars (`LLM_API_KEY`, `LLM_BASE_URL`,
  `LLM_MODEL`) are enough to switch between OpenRouter, Groq, OpenAI, and
  Ollama. Done by leaning on the OpenAI chat-completions wire format as a
  de facto standard.
- **Sphere generation.** Fibonacci-spiral distribution with a seeded RNG
  for reproducibility. 90% surface / 5% interior / 5% outliers — the
  interior + outlier nodes break the perfect-shell look so it reads as
  "organic" rather than "wireframe."
- **Connection graph.** O(n²) distance check at startup (n=250, runs once),
  then a precomputed `neighborMap` for O(1) hop lookups during animation.
- **Lightning chains, not per-edge flashes.** Each token picks a starting
  edge, then walks 4–7 neighbors, with each hop birthing only when the
  previous hop's "travel" portion completes. That's what gives it the
  bolt-snaking-through-the-graph feel instead of random sparkle.
- **Color ramp.** Each segment lerps white → hot pink → deep red over
  the first ~33% of its lifetime, then fades opacity quadratically. Two
  separate things (color and opacity) doing the work of "it's cooling."
- **No re-init on streaming.** The Three.js scene is built once in a
  `useEffect([])`. Streaming state is communicated via a separate
  `useEffect([isStreaming, tokenCount])` that mutates the existing scene.
  Avoids the React-strict-mode-double-mount canvas duplication trap
  (handled defensively at the top of init: `while (container.firstChild)…`).
- **Dynamic import with `ssr: false`** for `NeuralSphere` — Three.js
  touches `window` during construction, so it must be client-only.
- **Cleanup.** The init effect returns a teardown that disposes the
  renderer, cancels `requestAnimationFrame`, and disconnects the
  `ResizeObserver`. `disposed` flag guards in-flight frames.

## Trade-offs / what was deliberately left out

- **No `OrbitControls`.** Auto-rotate only. Keeps the focus on the
  streaming animation rather than user-driven camera fiddling.
- **No conversation persistence.** Refresh = blank slate. Out of scope
  for a visualization demo.
- **No rate limiting / auth on `/api/chat`.** Fine for local + private
  Vercel deploys; would need adding before any public exposure.
- **Hardcoded constants** (250 nodes, radius 2.5, connection threshold 1.8,
  500–800ms link lifetime) live as locals in `NeuralSphere.tsx`. Pulling
  them into a config object would be the natural first refactor if this
  grew.
- **No tests.** It's a visual demo; the meaningful surface (does the
  animation look right) isn't unit-testable. Manual run is the test.

## Known issues / TODOs

- The "Deploy with Vercel" link in `README.md` works, but `LLM_*` env
  vars must be set in the Vercel dashboard before the deploy will run.
- `package.json` lists `"lint": "eslint"` with no path — works in
  Next.js 16, but `eslint .` would be more portable.
- Mobile layout: the 50/50 split squashes both panes on narrow screens.
  No responsive breakpoints yet.
