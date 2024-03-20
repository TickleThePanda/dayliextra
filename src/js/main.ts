import {
  TimePeriodGroupedEntries,
  DaylioDatasource as DaylioDatasource,
  ReferenceType,
  RelationshipStats,
} from "./lib/daylio-converter.js";

import "chartjs-adapter-date-fns";

import {
  generateMoodOverTimeCharts,
  generateYearComparison,
} from "./lib/charts.js";
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
  const startOf2022 = new Date("2022-01-01");
  const sixMonthsAgo = subMonths(new Date(), 6);
  const eightWeeksAgo = subDays(new Date(), 8 * 7);

  await generateMoodOverTimeCharts(
    dayEntries,
    7,
    "days",
    "Over the last 8 weeks",
    (e) => e.date > eightWeeksAgo
  );

  await generateMoodOverTimeCharts(
    dayEntries,
    30,
    "days",
    "Over the last 6 months",
    (e) => e.date > sixMonthsAgo
  );

  await generateYearComparison(
    dayEntries,
    30,
    (e) => e.date > subDays(startOf2022, 15)
  );

  await generateMoodOverTimeCharts(
    weekEntries,
    13,
    "weeks",
    "Since start 2023",
    (e) => e.date > startOf2022
  );
}

export function createChartElement(idSlug: string) {
  const element = document.createElement("canvas");
  element.id = idSlug;
  document.querySelector("#charts")?.appendChild(element);
  return element;
}
