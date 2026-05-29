import { publishR2Data } from "./r2.js";

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const outDir = optionValue("--out", "public");
const uploaded = await publishR2Data(outDir);

for (const item of uploaded) {
  console.log(`uploaded ${item.key}`);
}
