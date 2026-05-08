# LLM Neural Visualizer

A real-time 3D visualization of neural network activity as an LLM generates tokens. Watch lightning-like pulses chain through a sphere of interconnected neurons while chatting with an AI.

Built with Next.js, Three.js, and any OpenAI-compatible API.

![Neural Sphere Visualization](https://img.shields.io/badge/demo-live-brightgreen)

## Features

- **3D Neural Sphere** — 250 nodes arranged in a sphere with dense interconnections, labeled with real ML/transformer terminology (`attn_0`, `FFN`, `softmax`, `W_q`, `KV_cache`, etc.)
- **Lightning Chain Animation** — when the LLM streams tokens, lightning bolts chain through connected nodes end-to-end, starting white-hot and fading to red
- **Split Layout** — chat interface on the left, live neural visualization on the right
- **Any LLM Provider** — works with any OpenAI-compatible API (OpenRouter, Groq, OpenAI, Ollama, etc.)
- **Streaming** — real-time token-by-token streaming with Server-Sent Events

## Getting Started

### Prerequisites

- Node.js 18+
- An API key from any OpenAI-compatible provider

### Setup

1. Clone the repository:

```bash
git clone https://github.com/AbhishekSharma55/llm-illustration.git
cd llm-illustration
```

2. Install dependencies:

```bash
npm install
```

3. Create your environment file:

```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your API credentials:

```env
# Any OpenAI-compatible API provider works (OpenRouter, Groq, OpenAI, etc.)
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemini-2.0-flash-001
```

5. Start the dev server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) and send a message!

### Example Configurations

**OpenRouter:**
```env
LLM_API_KEY=sk-or-v1-...
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemini-2.0-flash-001
```

**Groq:**
```env
LLM_API_KEY=gsk_...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

**OpenAI:**
```env
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

**Ollama (local):**
```env
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router)
- **3D Rendering:** [Three.js](https://threejs.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) 4
- **Language:** TypeScript
- **API:** Any OpenAI-compatible chat completions endpoint with streaming

## How It Works

1. **Sphere Generation** — 250 nodes are distributed on a sphere using fibonacci spiral with subtle randomness (90% surface, 5% interior, 5% outlier) for an organic look
2. **Connection Graph** — nodes within a distance threshold are connected, forming a dense neural network mesh
3. **Token Streaming** — chat messages are sent to the LLM via a streaming API route, tokens are forwarded as Server-Sent Events
4. **Lightning Animation** — each token triggers 1-2 chain paths that hop through 4-7 connected nodes sequentially. Each connection starts white-hot and fades to red, creating a lightning bolt effect that snakes through the network

## Project Structure

```
app/
├── api/chat/route.ts        # Streaming LLM proxy endpoint
├── components/
│   ├── Chat.tsx              # Chat interface component
│   └── NeuralSphere.tsx      # Three.js 3D visualization
├── globals.css               # Global styles
├── layout.tsx                # Root layout
└── page.tsx                  # Main page (split layout)
```

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AbhishekSharma55/llm-illustration&env=LLM_API_KEY,LLM_BASE_URL,LLM_MODEL)

Set the three environment variables (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`) in your Vercel project settings.

## License

[MIT](LICENSE)
