import unzipper from "unzipper";
import fs from "fs";
import { PassThrough } from "stream";

const file = process.argv[2];

if (file === undefined) {
  throw new Error("You must specify a file as the first argument.");
}

console.log(file);

const backup = await extractBackup(file);

console.log(Object.keys(backup));

async function extractBackup(fileName) {
  const stream = fs
    .createReadStream(fileName)
    .pipe(unzipper.ParseOne(/backup.daylio/))
    .pipe(new PassThrough());

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  const base64 = Buffer.concat(chunks).toString("utf-8");

  const text = Buffer.from(base64, "base64");

  return JSON.parse(text);
}
