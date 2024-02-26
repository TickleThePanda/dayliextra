import {
  TimePeriodGroupedEntries,
  DaylioDatasource as DaylioDatasource,
  ReferenceType,
  RelationshipStats,
} from "./lib/daylio-converter.js";

import "chartjs-adapter-date-fns";

import { generateMoodOverTimeCharts } from "./lib/charts.js";
import { generateYearComparison } from "./lib/charts.js";
import { addDays, subDays, subMonths } from "date-fns";

window.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#upload")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const fileUpload = document.querySelector("#file") as HTMLInputElement;
    const files = fileUpload.files;
    const file = files?.item(0) as Blob;

    const uploadForm = document.querySelector(
      "#upload-form"
    ) as HTMLFormElement;
    uploadForm.setAttribute("hidden", "");

    const processing = document.querySelector("#status") as HTMLDivElement;
    processing.removeAttribute("hidden");

    await main(file);

    const chartsElement = document.querySelector("#charts") as HTMLDivElement;
    chartsElement.removeAttribute("hidden");
    processing.setAttribute("hidden", "");
  });
});

async function main(blob: Blob) {
  const datasource = await DaylioDatasource.fromUploadedFile(blob);

  const dayEntries = datasource.getDayEntries();

  const weekEntries = datasource.getWeekEntries();

  const startOf2023 = subDays(new Date("2023-01-01"), 28);
  const startOf2022 = subDays(new Date("2022-01-01"), 30);

  const sixMonthsAgo = subMonths(new Date(), 6);

  await generateMoodOverTimeCharts(
    weekEntries,
    4,
    "weeks",
    "Since 2023",
    (e) => e.date > startOf2023
  );
  await generateMoodOverTimeCharts(
    dayEntries,
    30,
    "days",
    "Over the last 6 months",
    (e) => e.date > sixMonthsAgo
  );
  await generateYearComparison(dayEntries, 30, (e) => e.date > startOf2022);
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

function generateRelationships(dayEntries: TimePeriodGroupedEntries) {
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

export function createChartElement(idSlug: string) {
  const element = document.createElement("canvas");
  element.id = idSlug;
  document.querySelector("#charts")?.appendChild(element);
  return element;
}
