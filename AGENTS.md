# Repository guidance

This repository contains Pamiya architecture documents, diagrams and visual assets.

It also contains bilingual product specifications under `docs/product` and a local interaction prototype under `prototype`. Pamiya's product starts with a modern personal Agent, conversation, and useful artifacts; infrastructure remains a supporting layer. Prototype simulations do not establish production runtime capabilities.

- Keep `docs/en` and `docs/zh-CN` aligned; machine-readable examples use identical contracts.
- Preserve the lightweight baseline: one active control coordinator, fixed device ownership, durable Task/Attempt state and business result acknowledgements.
- Stronger leases, resource fencing, signed grants, budget reservations and automated recovery need explicit triggering requirements.
- Keep proposals distinct from implemented capabilities. Do not add runtime scaffolding or CI workflows unless requested.
- Maintain relative links and editable diagram sources. Verify generated diagrams visually.
- Use concise English code comments. Do not overwrite unrelated local changes.
