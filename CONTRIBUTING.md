# Contributing / 贡献说明

Pamiya includes a DSH plugin, a separate interaction prototype and architecture proposals. Explain the requirement and affected boundary before adding a mechanism. Keep the single-active baseline distinct from conditional enhancements, and distinguish design from implemented or third-party behavior.

Update corresponding files in `docs/en` and `docs/zh-CN` together. JSON contracts must remain identical; diagrams use localized labels but the same relationships. Cite primary sources for external capabilities. Public documents must stand on their own without private conversation references.

Product specifications follow the same pairing under `docs/product/en` and `docs/product/zh-CN`, including stable requirement/acceptance IDs. For the local prototype, use the scripts in [prototype/README.md](prototype/README.md) and keep its [approved visual and QA](prototype/design-qa.md) aligned. Model/tool/schedule simulations must remain explicit. Do not publish personal browser data or include ignored QA scratch files.

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

An existing compatible Chromium can be selected with `CHROMIUM_EXECUTABLE`. Runtime dependencies are scoped to `packages/dsh-plugin`; root development dependencies render documentation. Inspect layout and readability at README width; parsing alone does not establish visual quality. Run runtime/hardware fault acceptance when implementing those features.

---

Pamiya 包含 DSH 插件、独立交互原型和架构设计提案。新增机制前说明需求和受影响边界，保持单活首版与条件增强的区分，明确哪些是设计、已实现能力或第三方事实。

同步更新 `docs/en` 与 `docs/zh-CN` 的对应文件。JSON 契约必须相同；架构图的标签分别本地化，关系保持一致。第三方能力引用一手资料，公开文档不依赖私有对话。

产品规格同步维护 `docs/product/en` 与 `docs/product/zh-CN`，保持需求与验收 ID 一致。原型遵循[运行说明](prototype/README.md)和[视觉 QA](prototype/design-qa.md)，明确模型、工具与安排的模拟边界；不要发布个人浏览器数据或忽略的 QA 临时文件。

运行上面的文档检查命令。详细图修改 `assets/diagrams` 中的 `.mmd` 源码，阅读总览修改 `scripts/render_readable_architecture.py` 的共享布局与文案；随后重新渲染双语图并检查 PNG、SVG。可通过 `CHROMIUM_EXECUTABLE` 选择兼容的本地 Chromium。运行依赖归属 `packages/dsh-plugin`，根目录开发依赖用于文档工具。检查 README 宽度下的可读性；语法解析不能代替视觉检查。运行时及硬件故障验收随对应功能实现执行。


## DSH plugin / DSH 插件

```sh
npm ci
npm run plugin:check
npm run plugin:test
npm run docs:check
```

Tests use a real local MQTT broker and Worker processes without an external account. Public-broker testing uses synthetic inputs only. Install locally with `node scripts/install-dsh-plugin.mjs`; `--demo` explicitly enables public test bootstrap. Keep credentials, pairing codes, private DSH homes and installation backups out of Git. Bundles include dependency license notices.

测试使用真实本地 MQTT 服务与 Worker 进程，不要求外部账号。公共连接只测试合成输入。本机安装运行 `node scripts/install-dsh-plugin.mjs`，`--demo` 显式启用公共测试引导。凭据、配对码、私有 DSH home 与安装备份不进入 Git。构建产物包含依赖许可声明。
