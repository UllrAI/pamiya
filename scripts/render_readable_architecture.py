"""Render the bilingual architecture overview with a fixed, readable SVG layout."""

from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/diagrams"

LABELS = {
    "en": {
        "diagram_title": "Pamiya architecture at a glance",
        "diagram_desc": "Control reads durable state, routes Worker messages through MQTT, delegates via adapters, and uses HTTPS for artifacts.",
        "title": "Agent Gateway / API",
        "inputs": "Chat · Web · App · Schedules · External events",
        "control": "Control Plane",
        "harness": "Personal Agent · Harness · Task Runtime · Event Engine",
        "routing": "Capability discovery · Routing · Authorization · Scheduling",
        "state_link": "Durable reads / writes",
        "worker_link": "Commands / Results / Events",
        "agent_link": "Tools / Delegation",
        "state": "State Plane",
        "database": "PostgreSQL",
        "records": "Session · Run · Task · Event",
        "memory": "Checkpoints · Memory · Skills",
        "references": "Artifact references",
        "broker": "MQTT Broker",
        "messages": "Commands · Results · Events · Presence",
        "connectivity": "Long-lived connections · Pub/Sub · Topic ACLs",
        "apis": "Tool & Agent APIs",
        "protocols": "HTTP · MCP · A2A",
        "adapters": "Tools · Agent Adapter",
        "workers": "Workers connect outbound · Bidirectional messaging",
        "remote": "Remote task state",
        "cloud": "Cloud Worker",
        "cloud_desc": "Sandbox · Tools",
        "desktop": "Desktop Worker",
        "desktop_desc": "macOS · Windows",
        "edge": "Enterprise Edge",
        "edge_desc": "Internal systems",
        "device": "Device Worker",
        "device_desc": "ESP32 · HID · GPIO",
        "agent": "Agent Runtime",
        "agent_desc": "Own harness · Task",
        "data": "Authorized HTTPS · Files · Images · Large artifacts",
        "storage": "Object Storage",
        "storage_desc": "Inputs and outputs · Verified content · Durable references",
        "baseline": "Baseline: one active coordinator · Serial Sessions · Fixed device ownership",
        "status": "Architecture proposal · 0.1",
    },
    "zh-CN": {
        "diagram_title": "Pamiya 架构阅读总览",
        "diagram_desc": "Control 直接读写持久化状态，通过 MQTT 调用 Worker，通过适配器委托 Agent，并以 HTTPS 传输文件与产物。",
        "title": "Agent Gateway / API",
        "inputs": "聊天 · Web · App · 定时任务 · 外部事件",
        "control": "Control Plane",
        "harness": "Personal Agent · Harness · 任务运行时 · 事件引擎",
        "routing": "能力发现 · 工具路由 · 权限检查 · 任务调度",
        "state_link": "持久化读写",
        "worker_link": "命令 / 结果 / 事件",
        "agent_link": "工具 / Agent 委托",
        "state": "State Plane",
        "database": "PostgreSQL",
        "records": "Session · Run · Task · Event",
        "memory": "检查点 · Memory · Skills",
        "references": "产物引用与执行记录",
        "broker": "MQTT Broker",
        "messages": "命令 · 结果 · 事件 · 在线状态",
        "connectivity": "长连接 · Pub/Sub · 身份与 Topic ACL",
        "apis": "工具与 Agent 接口",
        "protocols": "HTTP · MCP · A2A",
        "adapters": "工具 · Agent Adapter",
        "workers": "Worker 主动连接 Broker · 双向消息",
        "remote": "远程任务状态",
        "cloud": "云端 Worker",
        "cloud_desc": "Sandbox · 工具",
        "desktop": "桌面 Worker",
        "desktop_desc": "macOS · Windows",
        "edge": "企业 Edge",
        "edge_desc": "企业内网与业务系统",
        "device": "设备 Worker",
        "device_desc": "ESP32 · HID · GPIO",
        "agent": "专业 Agent",
        "agent_desc": "独立 Harness · 子任务",
        "data": "授权 HTTPS · 文件 · 图像 · 大型产物",
        "storage": "Object Storage",
        "storage_desc": "输入与成果 · 内容校验 · 持久化引用",
        "baseline": "首版：单活协调 · 每个 Session 串行 · 设备固定执行归属",
        "status": "架构设计提案 · 0.1",
    },
}

ICONS = {
    "gateway": '<rect x="-15" y="-12" width="30" height="24" rx="5"/><path d="M-7 -4 0 2-7 8M5 8h5"/>',
    "control": '<circle cx="0" cy="0" r="9"/><path d="M-16 -8h6M-16 8h6M10-8h6M10 8h6M-8-16v6M8-16v6M-8 10v6M8 10v6"/>',
    "database": '<ellipse cx="0" cy="-10" rx="12" ry="5"/><path d="M-12-10v20c0 7 24 7 24 0v-20M-12 0c0 7 24 7 24 0"/>',
    "broker": '<rect x="-5" y="-15" width="10" height="10" rx="2"/><rect x="-17" y="5" width="10" height="10" rx="2"/><rect x="7" y="5" width="10" height="10" rx="2"/><path d="M0-5v6M-12 5v-4h24v4"/>',
    "cloud": '<path d="M-11 12h23a8 8 0 0 0 1-16 13 13 0 0 0-25-3 10 10 0 0 0 1 19Z"/>',
    "desktop": '<rect x="-17" y="-13" width="34" height="23" rx="3"/><path d="M0 10v7M-8 17h16"/>',
    "edge": '<rect x="-14" y="-16" width="28" height="32" rx="3"/><path d="M-14-5h28M-14 5h28M-7-10h3M-7 0h3M-7 10h3"/>',
    "device": '<rect x="-11" y="-11" width="22" height="22" rx="3"/><rect x="-5" y="-5" width="10" height="10" rx="1"/><path d="M-17-6h6M-17 6h6M11-6h6M11 6h6M-6-17v6M6-17v6M-6 11v6M6 11v6"/>',
    "agent": '<circle cx="0" cy="-10" r="6"/><circle cx="-13" cy="12" r="5"/><circle cx="13" cy="12" r="5"/><path d="M0-4v8M-13 7V3h26v4"/>',
}


def diagram(locale):
    labels = LABELS[locale]
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1240" viewBox="0 0 1500 1240" role="img" aria-labelledby="diagram-title diagram-desc">',
        f'<title id="diagram-title">{escape(labels["diagram_title"])}</title>',
        f'<desc id="diagram-desc">{escape(labels["diagram_desc"])}</desc>',
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="#66837F" stroke-width="1.7" stroke-linejoin="round"/></marker></defs>',
        '<style>text{font-family:Inter,"Noto Sans CJK SC","PingFang SC",Arial,sans-serif;fill:#101A20}.muted{fill:#5B6872}.link{fill:#66837F}</style>',
        '<rect width="1500" height="1240" fill="#FBFCFD"/>',
        '<rect x="16" y="16" width="1468" height="1208" rx="26" fill="none" stroke="#DDE3E7" stroke-width="2"/>',
    ]

    def text(key, x, y, size=24, weight=400, css="", anchor="middle"):
        value = labels.get(key, key)
        parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" class="{css}" data-label="{key}">{escape(value)}</text>')

    def card(card_id, x, y, width, height, fill="#FBFCFD", stroke="#DDE3E7"):
        parts.append(f'<rect data-card="{card_id}" x="{x}" y="{y}" width="{width}" height="{height}" rx="16" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')

    def icon(name, x, y, color="#2D827B"):
        parts.append(f'<g transform="translate({x} {y})" fill="none" stroke="{color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')

    def path(d, both=False, dashed=False):
        parts.append(f'<path d="{d}" fill="none" stroke="#66837F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"'
                     + (' marker-start="url(#arrow)"' if both else '')
                     + (' stroke-dasharray="6 7"' if dashed else '') + '/>')

    text("status", 1428, 52, 19, css="muted", anchor="end")
    icon("gateway", 464, 86)
    text("title", 782, 100, 40, 650)
    text("inputs", 750, 146, 26, css="muted")
    path("M750 160V178")

    card("control", 56, 192, 1388, 156, "#EAF4F2", "#A0C8C1")
    icon("control", 584, 229)
    text("control", 775, 242, 40, 650)
    text("harness", 750, 288, 28)
    text("routing", 750, 324, 24, css="muted")

    for x in [269, 839, 1307]:
        path(f"M{x} 362V424", both=True)
    for key, x in [("state_link", 269), ("worker_link", 839), ("agent_link", 1307)]:
        parts.append(f'<rect x="{x-168}" y="381" width="336" height="30" fill="#FBFCFD"/>')
        text(key, x, 404, 22, css="link")

    card("state", 56, 438, 426, 230)
    icon("database", 147, 481)
    text("state", 291, 494, 36, 650)
    text("database", 269, 539, 28)
    text("records", 269, 578, 24, css="muted")
    text("memory", 269, 611, 23, css="muted")
    text("references", 269, 644, 23, css="muted")

    card("mqtt", 528, 438, 622, 180, "#EDF2FC", "#AABFEF")
    icon("broker", 670, 483, "#3869C7")
    text("broker", 868, 496, 38, 650)
    text("messages", 839, 542, 26, css="muted")
    text("connectivity", 839, 582, 23, css="muted")

    card("apis", 1170, 438, 274, 180, "#FFF7E9", "#E8D3B1")
    text("apis", 1307, 483, 28, 650)
    text("protocols", 1307, 530, 26)
    text("adapters", 1307, 573, 22, css="muted")

    parts.append('<path d="M839 632V720M186 720H1032" fill="none" stroke="#66837F" stroke-width="2.4" stroke-linecap="round"/>')
    parts.append('<rect x="291" y="674" width="700" height="34" fill="#FBFCFD"/>')
    text("workers", 641, 700, 23, css="link")
    for x in [186, 468, 750, 1032]:
        path(f"M{x} 720V756", both=True)
    path("M1307 632V756", both=True)
    parts.append('<rect x="1187" y="674" width="240" height="34" fill="#FBFCFD"/>')
    text("remote", 1307, 700, 22, css="link")

    for key, x in [("cloud", 56), ("desktop", 338), ("edge", 620), ("device", 902), ("agent", 1184)]:
        card(key, x, 770, 260, 158)
        icon(key, x+130, 806, "#5B6872")
        text(key, x+130, 857, 26, 600)
        text(f"{key}_desc", x+130, 895, 21, css="muted")

    text("data", 750, 989, 25, css="link")
    for x in [186, 468, 750, 1032, 1314]:
        parts.append(f'<path d="M{x} 942V958" fill="none" stroke="#66837F" stroke-width="2.4" stroke-dasharray="6 7" marker-start="url(#arrow)"/>')
        path(f"M{x} 1002V1022", dashed=True)

    card("artifacts", 56, 1036, 1388, 120, "#F1F5F7", "#D4DEE3")
    icon("database", 557, 1073)
    text("storage", 777, 1086, 36, 650)
    text("storage_desc", 750, 1129, 25, css="muted")
    text("baseline", 750, 1200, 23, css="muted")
    parts.append("</svg>\n")
    return "\n".join(parts)


if __name__ == "__main__":
    for locale in LABELS:
        target = OUT / f"readable-overview.{locale}.svg"
        target.write_text(diagram(locale))
        print(target.relative_to(ROOT))
