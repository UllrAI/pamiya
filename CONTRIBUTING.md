# Contributing / 贡献说明

Pamiya currently publishes an architecture proposal. Explain the requirement and affected boundary before adding a mechanism. Keep the single-active baseline distinct from conditional enhancements, and distinguish design from implemented or third-party behavior.

Update corresponding files in `docs/en` and `docs/zh-CN` together. JSON contracts must remain identical; diagrams use localized labels but the same relationships. Cite primary sources for external capabilities. Public documents must stand on their own without private conversation references.

Check document links, language coverage, protocol correlations, and visual asset references:

```sh
python3 scripts/check_docs.py
```

To change a detailed diagram, edit its `.mmd` source under `assets/diagrams`. The readable overview uses the shared layout and labels in `scripts/render_readable_architecture.py`. Render both languages, then inspect PNG and SVG outputs:

```sh
npm ci
npx playwright install chromium
npm run diagrams:render
npm run docs:check
```

An existing compatible Chromium can be selected with `CHROMIUM_EXECUTABLE`. Node dependencies are documentation tools, not platform runtime dependencies. Inspect layout and readability at README width; parsing alone does not establish visual quality. Run runtime/hardware fault acceptance when implementing those features.

---

Pamiya 当前发布架构设计提案。新增机制前说明需求和受影响边界，保持单活首版与条件增强的区分，明确哪些是设计、已实现能力或第三方事实。

同步更新 `docs/en` 与 `docs/zh-CN` 的对应文件。JSON 契约必须相同；架构图的标签分别本地化，关系保持一致。第三方能力引用一手资料，公开文档不依赖私有对话。

运行上面的文档检查命令。详细图修改 `assets/diagrams` 中的 `.mmd` 源码，阅读总览修改 `scripts/render_readable_architecture.py` 的共享布局与文案；随后重新渲染双语图并检查 PNG、SVG。可通过 `CHROMIUM_EXECUTABLE` 选择兼容的本地 Chromium。Node 依赖只用于文档工具。检查 README 宽度下的可读性；语法解析不能代替视觉检查。运行时及硬件故障验收随对应功能实现执行。
