#!/usr/bin/env ts-node

import unzipper from "unzipper";
import fs from "fs";
import { PassThrough } from "stream";
import { group } from "console";

/**
 * @typedef {import("./daylio-export.js").DaylioExport} DaylioExport
 * @typedef {import("./daylio.js").Daylio} Daylio
 * @typedef {import("./daylio.js").Daylio} Entry
 * @typedef {import("./daylio.js").Tag} Tag
 */

const file = process.argv[2];

if (file === undefined) {
  throw new Error("You must specify a file as the first argument.");
}

/**
 * @type {DaylioExport}
 */
const backup = await extractBackup(file);

const entries = convertToEntries(backup);

console.log(entries);

/**
 * @param daylioExport {DaylioExport}
 * @returns {Entry}
 */
function convertToEntries(daylioExport) {
  /**
   * @type {Entry[]}
   */
  const entries = [];

  for (const { datetime, tags, mood } of daylioExport.dayEntries) {
    /**
     * @type {Tag}[]
     */
    const convertedTags = tags.map(toTag);

    function toTag(tagId) {
      const tag = daylioExport.tags.find((tag) => tag.id === tagId);
      const tagGroup = daylioExport.tag_groups.find(
        (tagGroup) => tag.id_tag_group === tagGroup.id
      );
      return {
        name: tag.name,
        group: tagGroup.name,
      };
    }

    const originalNames = ["rad", "good", "meh", "bad", "awful"];
    const convertedMood = toMood(mood);

    function toMood(moodId) {
      const mood = daylioExport.customMoods.find((m) => m.id === moodId);
      return {
        name:
          mood.custom_name === ""
            ? originalNames[mood.predefined_name_id - 1]
            : mood.custom_name,
        value: 4 - mood.mood_group_id,
      };
    }

    entries.push({
      date: new Date(datetime),
      tags: convertedTags,
      mood: convertedMood,
    });
  }
  return entries;
}

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
