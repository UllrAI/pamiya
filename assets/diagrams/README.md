# Architecture diagrams / 架构图

Each conceptual diagram has English and Simplified Chinese versions with the same relationships. `manifest.json` maps each source to its document, renderer, and exported files.

| Format | Purpose / 用途 |
|---|---|
| `.mmd` | Editable Mermaid source for detailed diagrams / 详细关系图源码 |
| [Python layout](../../scripts/render_readable_architecture.py) | Shared layout and bilingual labels for the readable overview / 阅读总览的布局与双语文案 |
| `.svg` | Scalable figure / 矢量图 |
| `.png` | Reliable Markdown display / Markdown 展示 |

The readable overview uses a fixed SVG layout with larger type, cards, icons, and fewer connecting lines. Detailed diagrams remain available as Mermaid. Edit the appropriate source and run `npm run diagrams:render` from the repository root; inspect outputs before committing. Use `npm run diagrams:render -- readable-overview` to update only the overview. See [contributing](../../CONTRIBUTING.md) for setup.

阅读总览通过共享布局生成双语 SVG，采用大字号、卡片、图标和少量连线；详细关系图使用 Mermaid。修改相应源码后重新渲染并检查输出。`manifest.json` 记录源码、正文、渲染器和导出文件之间的对应关系，PNG 与 SVG 用于阅读和分享。
