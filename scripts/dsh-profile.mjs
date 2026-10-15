export function patchProfile(original, { revision, demo }) {
  const start = "# Pamiya managed install revision";
  const end = "# End Pamiya managed install";
  const block = `${start}\n- id: pamiya\n  config:\n    revision: "${revision}"\n    bootstrapDemo: ${Boolean(demo)}\n${end}`;
  if (original.includes(start)) {
    const offset = original.indexOf(start),
      endOffset = original.indexOf(end, offset);
    if (endOffset < 0)
      throw new Error(
        "Pamiya install block is incomplete; reload DSH to activate the installed package.",
      );
    return (
      original.slice(0, offset) + block + original.slice(endOffset + end.length)
    );
  }
  if (/^\s*- id: pamiya\s*$/m.test(original))
    throw new Error(
      "An existing Pamiya override is user-owned. Reload DSH to activate the installed package.",
    );
  if (original.replace(/^\s*#.*$/gm, "").trim() === "[]")
    return original.replace(/^\[\]\s*$/m, block) + "\n";
  return original + "\n" + block + "\n";
}
