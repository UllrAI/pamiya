"""Check local documentation, bilingual examples, and rendered diagram references."""

import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


def anchors(path):
    counts = {}
    result = set()
    text = re.sub(r"^```.*?^```\s*$", "", path.read_text(), flags=re.M | re.S)
    for title in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", text, re.M):
        title = re.sub(r"<[^>]+>", "", title).lower().strip()
        slug = "".join(c for c in title if c in "_- " or unicodedata.category(c)[0] in "LN").replace(" ", "-")
        count = counts.get(slug, 0)
        result.add(f"{slug}-{count}" if count else slug)
        counts[slug] = count + 1
    return result


markdown = sorted(p for p in ROOT.rglob("*.md") if not {"node_modules", ".git", ".tmp"} & set(p.relative_to(ROOT).parts))
link_count = 0
for path in markdown:
    text = path.read_text()
    check("__BLOCK_" not in text, f"Unexpanded block in {path.relative_to(ROOT)}")
    check(not re.search(r"chatgpt-conversation://|/Users/|sandbox:", text), f"Private reference in {path.relative_to(ROOT)}")
    text = re.sub(r"^```.*?^```\s*$", "", text, flags=re.M | re.S)
    for target in re.findall(r"!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)", text):
        url = urlsplit(target.strip("<>"))
        if url.scheme or url.netloc:
            continue
        linked = (path.parent / unquote(url.path)).resolve() if url.path else path
        link_count += 1
        check(linked.exists(), f"Missing local target: {path.relative_to(ROOT)} -> {target}")
        if linked.is_file() and linked.suffix == ".md" and url.fragment:
            check(unquote(url.fragment) in anchors(linked), f"Missing anchor: {path.relative_to(ROOT)} -> {target}")

en = ROOT / "docs/en"
zh = ROOT / "docs/zh-CN"
check({p.name for p in en.glob("*.md")} == {p.name for p in zh.glob("*.md")}, "Language document inventory differs")
examples = {}
for path in sorted(en.glob("*.md")):
    other = zh / path.name
    if not other.exists():
        continue
    blocks = []
    for local in [path, other]:
        parsed = []
        for raw in re.findall(r"^```json\n(.*?)^```\s*$", local.read_text(), re.M | re.S):
            try:
                parsed.append(json.loads(raw))
            except json.JSONDecodeError as error:
                errors.append(f"Invalid JSON: {local.relative_to(ROOT)}: {error}")
        blocks.append(parsed)
    check(blocks[0] == blocks[1], f"Bilingual JSON differs: {path.name}")
    examples[path.name] = blocks[0]

protocol = examples.get("capabilities-and-protocol.md", [])
check(len(protocol) == 5, "Expected five baseline protocol examples")
if len(protocol) == 5:
    manifest, discovery, command, result, ack = protocol
    capability = next((c for c in manifest["capabilities"] if c["name"] == command["capability"]), None)
    check(capability is not None, "Command capability missing from Manifest")
    if capability:
        check(command["capability_version"] == capability["version"], "Capability version mismatch")
        schema = capability["input_schema"]
        check(set(schema["required"]) <= set(command["args"]) <= set(schema["properties"]), "Command args mismatch")
        output = capability["output_schema"]
        check(set(output["required"]) <= set(result["output"]) <= set(output["properties"]), "Result output mismatch")
    for key in ["task_id", "attempt_no"]:
        check(command[key] == result[key] == ack[key], f"Task correlation mismatch: {key}")
    check(command["action_id"] == result["action_id"], "Action identity mismatch")
    check(command["worker_id"] == result["worker_id"] == manifest["worker_id"], "Worker identity mismatch")
    check(command["target_boot_id"] == result["boot_id"] == manifest["boot_id"], "Boot identity mismatch")
    check(result["event_id"] == ack["event_id"], "Result ACK mismatch")
    check(set(discovery["required"]) <= {c["name"] for c in manifest["capabilities"]}, "Unknown discovery capability")

entries = json.loads((ROOT / "assets/diagrams/manifest.json").read_text())
groups = {}
for entry in entries:
    groups.setdefault(entry["name"], set()).add(entry["locale"])
    document = ROOT / entry["document"]
    for field in ["source", "svg", "png"]:
        asset = ROOT / "assets/diagrams" / entry[field]
        check(asset.is_file() and asset.stat().st_size > 0, f"Missing diagram {asset.relative_to(ROOT)}")
    check(entry["png"] in document.read_text(), f"Diagram not embedded: {entry['document']}")
    if entry["locale"] == "en":
        source_name = entry["svg"] if entry.get("renderer") == "svg" else entry["source"]
        source = (ROOT / "assets/diagrams" / source_name).read_text()
        check(not re.search(r"[\u4e00-\u9fff]", source), f"Untranslated diagram: {entry['source']}")
for name, locales in groups.items():
    check(locales == {"en", "zh-CN"}, f"Missing diagram language: {name}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)
print(f"Checked {len(markdown)} Markdown files, {link_count} local links, 5 bilingual JSON examples, and {len(entries)} diagrams.")
