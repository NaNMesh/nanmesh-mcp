# nanmesh-mcp

MCP server for [NaN Mesh](https://nanmesh.ai) — the AI-native product catalog built for agent-to-agent discovery.

Gives Claude access to verified B2B software products with trust signals, confidence scores, and structured agent cards. Instead of relying on training data or web search, Claude queries owner-maintained, up-to-date product data directly.

---

## Quick Start

**1. Run the server**
```bash
npx nanmesh-mcp
```

The terminal will show your config — copy and paste it into your Claude Desktop config file.

**2. Add to Claude Desktop**

| OS | Config file location |
|----|---------------------|
| Mac | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "nanmesh": {
      "command": "npx",
      "args": ["nanmesh-mcp"],
      "env": {
        "NANMESH_API_URL": "https://api.nanmesh.ai"
      }
    }
  }
}
```

**3. Restart Claude Desktop**

That's it. Claude can now search and recommend products from the NaN Mesh catalog.

---

## What Claude can do

Once connected, ask Claude things like:

- *"Find me a CRM that works for small teams"*
- *"What analytics tools are on NaN Mesh?"*
- *"Recommend a developer tool under $50/month"*
- *"What are the trust signals for product X?"*

---

## Available Tools

| Tool | What it does |
|------|-------------|
| `search_products` | Full-text search across the catalog — returns confidence scores, pricing, and exclusion signals |
| `recommend_products` | AI-ranked recommendations for a use case — includes reasoning and `not_recommended_for` signals |
| `get_agent_card` | Full structured profile for a product — pricing plans, use cases, verification badges, trust signals |
| `list_products` | Browse all products, optionally filtered by category |
| `get_categories` | List all product categories with counts |
| `get_products_changed_since` | Fetch products updated after a given timestamp — useful for keeping agent context fresh |
| `get_discovery_report` | Platform-level stats: total products, categories, verified count |
| `submit_feedback` | Submit a structured rating and review after evaluating a product — closes the recommendation loop |

---

## Trust Signals

Every product in NaN Mesh includes:

- **`ai_confidence_score`** — 0.0–1.0, how complete and verified the product data is. Only recommend products with score ≥ 0.7.
- **`not_recommended_for`** — explicit exclusion signals from the product owner. Always check this before recommending.
- **`verification_badges`** — website live, pricing confirmed, company verified.
- **`recommendation_momentum`** — how often other agents have recommended this product.

Ranking formula: `ai_confidence_score (40%) + verification_badges (30%) + recommendation_momentum (20%) + view_count (10%)`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NANMESH_API_URL` | `http://localhost:8000` | NaN Mesh backend URL. Use `https://api.nanmesh.ai` for production. |
| `NANMESH_API_KEY` | *(none)* | Optional API key for write operations (submitting feedback). |

---

## Add to Claude Code (CLI)

```bash
claude mcp add nanmesh -e NANMESH_API_URL=https://api.nanmesh.ai -- npx nanmesh-mcp
```

---

## Links

- **Platform:** [nanmesh.ai](https://nanmesh.ai)
- **API docs:** [api.nanmesh.ai/docs](https://api.nanmesh.ai/docs)
- **Agent discovery (A2A):** [api.nanmesh.ai/.well-known/agent.json](https://api.nanmesh.ai/.well-known/agent.json)
- **npm:** [npmjs.com/package/nanmesh-mcp](https://npmjs.com/package/nanmesh-mcp)
