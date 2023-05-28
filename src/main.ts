#!/usr/bin/env ts-node

import {
  GroupedEntry,
  BackupConverter as DaylioDatasource,
  Entry,
  Tag,
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

  const entrySets = [datasource.getMonthEntries(), datasource.getWeekEntries()];

  for (const entrySet of entrySets) {
    for (const tag of entrySet.uniqueTags) {
      await createChartFor(
        "tags",
        tag,
        (e) => e.countOfTags.find((t) => t.name === tag)?.count ?? 0
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
