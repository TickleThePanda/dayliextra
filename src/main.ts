#!/usr/bin/env ts-node

import {
  GroupedEntry,
  GroupedEntries,
  DaylioDatasource as DaylioDatasource,
  ReferenceType,
  RelationshipStats,
} from "./daylio-converter";

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const chart = new ChartJSNodeCanvas({
  width: 500,
  height: 500,
  backgroundColour: "#ffffff",
});

main();

async function main() {
  const file = process.argv[2];

  if (file === undefined) {
    throw new Error("You must specify a file as the first argument.");
  }

  const datasource = await DaylioDatasource.fromFile(file);

  const dayEntries = datasource.getDayEntries();

  const tagRelationships = generateRelationships(dayEntries);

  const bestCombinations = getBestCombinations(tagRelationships);

  console.log("--- Best combinations ---");
  for (let r of bestCombinations) {
    console.log(r.toString());
  }

  const worstCombinations = getWorstCombinations(tagRelationships);
  console.log();
  console.log("--- Worst combinations ---");
  for (let r of worstCombinations) {
    console.log(r.toString());
  }

  console.log();
  console.log("--- Chosen stats ---");

  console.log(
    dayEntries
      .relationshipBetween(
        {
          name: "working",
          type: "Tag",
        },
        {
          name: "Alcohol",
          type: "Group",
        }
      )
      .toString()
  );

  console.log(
    dayEntries
      .relationshipBetween(
        {
          name: "Social",
          type: "Group",
        },
        {
          name: "Alcohol",
          type: "Group",
        }
      )
      .toString()
  );

  const entrySets = [datasource.getMonthEntries(), datasource.getWeekEntries()];

  await generateCharts(entrySets);
}

function getBestCombinations(tagRelationships: RelationshipStats[]) {
  return tagRelationships
    .filter((r) => r.relationshipStats[0].count > 10)
    .sort(
      (a, b) =>
        b.relationshipStats[0].averageMood - a.relationshipStats[0].averageMood
    )
    .slice(0, 10);
}

function getWorstCombinations(tagRelationships: RelationshipStats[]) {
  return tagRelationships
    .filter((r) => r.relationshipStats[0].count > 10)
    .sort(
      (a, b) =>
        a.relationshipStats[0].averageMood - b.relationshipStats[0].averageMood
    )
    .slice(0, 10);
}

function generateRelationships(dayEntries: GroupedEntries) {
  const tagRelationships = [];
  const tags = dayEntries.uniqueTags;
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const tag1 = tags[i];
      const tag2 = tags[j];

      tagRelationships.push(
        dayEntries.relationshipBetween(
          {
            name: tag1,
            type: "Tag",
          },
          {
            name: tag2,
            type: "Tag",
          }
        )
      );
    }
  }
  return tagRelationships;
}

async function generateCharts(entrySets: GroupedEntries[]) {
  for (const entrySet of entrySets) {
    for (const tag of entrySet.uniqueTags) {
      await createChartFor(
        "tags",
        tag,
        (e) => e.countOfTags.find((t) => t.tagName === tag)?.count ?? 0
      );
    }

    for (const groups of entrySet.uniqueGroups) {
      await createChartFor(
        "groups",
        groups,
        (e) => e.countOfGroups.find((t) => t.group === groups)?.count ?? 0
      );
    }

    async function createChartFor(
      type: "tags" | "groups",
      tag: string,
      counter: (t: GroupedEntry) => number
    ) {
      const data = entrySet.entries.map((v) => ({
        x: counter(v) / v.groupLengthDays,
        y: v.averageMood,
      }));

      const stream = chart.renderToStream({
        type: "scatter",
        options: {
          scales: {
            y: {
              title: {
                display: true,
                text: "mood",
              },
              min: 1,
              max: 5,
            },
            x: {
              title: {
                display: true,
                text: tag,
              },
              min: 0,
            },
          },
        },
        data: {
          datasets: [
            {
              data,
              pointBackgroundColor: "#000000",
            },
          ],
        },
      });
      await pipeline(
        stream,
        createWriteStream(`data/chart-${entrySet.type}-${type}-${tag}.png`)
      );
    }
  }
}
