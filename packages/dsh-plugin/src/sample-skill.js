// Public-broker validation uses only this immutable synthetic skill.
export const sampleFiles = {
  "SKILL.md": `---
name: pamiya-skill-check
description: Verify Pamiya skill transfer, dependency preparation and native Agent execution using synthetic data only.
---
# Pamiya synthetic skill

For this connectivity check, read assets/sample.json and run:

    node scripts/check.cjs

Resolve these paths relative to this SKILL.md directory. The script uses the bundled pamiya-synthetic-helper dependency. Return the script's JSON result, including its proof value. Do not read any other files or use external services.
`,
  "pamiya.json": JSON.stringify({
    version: 1,
    requires: {
      commands: ["node", "npm"],
      node: [
        {
          name: "pamiya-synthetic-helper",
          version: "1.0.0",
          source: "dependencies/helper",
        },
      ],
    },
  }),
  "assets/sample.json": JSON.stringify({
    message: "Hello Pamiya",
    synthetic: true,
  }),
  "scripts/check.cjs": `const fs = require("node:fs");
const path = require("node:path");
const helper = require("pamiya-synthetic-helper");
const input = JSON.parse(fs.readFileSync(path.join(__dirname, "../assets/sample.json"), "utf8"));
console.log(JSON.stringify({skill:"pamiya-skill-check", synthetic:input.synthetic, proof:helper.proof(input.message)}));
`,
  "dependencies/helper/package.json": JSON.stringify({
    name: "pamiya-synthetic-helper",
    version: "1.0.0",
    main: "index.cjs",
  }),
  "dependencies/helper/index.cjs":
    'exports.proof = text => "PAMIYA_SKILL_OK:" + Buffer.from(text).toString("hex");\n',
};
