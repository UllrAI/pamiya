# Visual identity / 视觉说明

Pamiya's README uses a light panoramic masthead: one conversation connects to laptop, server and desktop Workers. “One conversation. Many workers.” expresses distributed task execution through DSH, with progress and results returning to the original conversation. The illustration is conceptual; literal system relationships live in the editable architecture diagrams.

| Asset | Size | Use / 用途 |
|---|---|---|
| [banner.png](banner.png) | 1600 × 400, 4:1 | English and Chinese README header / 双语首页 |
| [social-preview.jpg](social-preview.jpg) | 1280 × 640, 2:1 | Existing dark GitHub social preview / 现有深色仓库分享图 |
| [design.json](design.json) | — | Palette and composition / 配色与构图 |
| [banner-prompt.txt](banner-prompt.txt) | — | Final generation prompt / 最终生成提示词 |

The banner was created with the built-in image generation tool, then center-cropped and resized to 1600 × 400. The final prompt and export steps are saved in banner-prompt.txt. The social preview retains the earlier dark artwork. Architecture diagrams use Mermaid sources with checked-in SVG/PNG exports.

The header uses porcelain-white `#F8F9FB`, dark ink `#20272E`, muted blue `#7C99C4` and sage `#89A99D`. Diagrams retain a neutral light surface `#F4F7F8`, teal lines `#2D827B`, and dark text. Use sans-serif typography and generous spacing. Keep headers low; do not reuse the taller sharing format as a README banner.

---

README 新版视觉使用浅色宽幅底图、克制的细线与留白，一个对话连接笔记本、服务器和桌面电脑三个 Worker。“One conversation. Many workers.” 表达通过 DSH 分布式执行任务、进度与结果回到原对话的核心定位。具体系统关系由可编辑架构图承担。

Banner 通过内置 imagegen 工具重绘，居中裁切后导出为 1600 × 400；最终提示词与导出步骤保存在 banner-prompt.txt。分享图仍保留此前的深色配图。架构图使用 Mermaid 源码，提供 SVG 和 PNG。页面采用无衬线字体与克制配色，保持 banner 低矮，分享图单独适配。
