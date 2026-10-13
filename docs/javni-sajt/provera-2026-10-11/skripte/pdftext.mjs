import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "/Users/miledulic/Carsystem/carsystem/node_modules/unpdf/dist/index.mjs";
const pdf = await getDocumentProxy(new Uint8Array(readFileSync(process.argv[2])));
const { text } = await extractText(pdf, { mergePages: false });
text.forEach((t, i) => console.log(`=== strana ${i + 1}\n${t}`));
