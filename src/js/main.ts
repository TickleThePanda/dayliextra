import {
  TimePeriodGroupedEntry,
  TimePeriodGroupedEntries,
  DaylioDatasource as DaylioDatasource,
  ReferenceType,
  RelationshipStats,
} from "./lib/daylio-converter.js";

import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";

import { enGB } from "date-fns/locale";

window.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#upload")?.addEventListener("click", (e) => {
    e.preventDefault();
    const fileUpload = document.querySelector("#file") as HTMLInputElement;
    const files = fileUpload.files;
    const file = files?.item(0) as Blob;
    main(file);
  });
});

async function main(blob: Blob) {
  const datasource = await DaylioDatasource.fromUploadedFile(blob);

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

  // const entrySets = [datasource.getMonthEntries(), datasource.getWeekEntries()];

  // await generateRelationshipCharts(entrySets);

  await generateMoodOverTimeCharts(dayEntries);
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

async function generateRelationshipCharts(
  entrySets: TimePeriodGroupedEntries[]
) {
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
      counter: (t: TimePeriodGroupedEntry) => number
    ) {
      const data = entrySet.entries.map((v) => ({
        x: counter(v) / v.groupLengthDays,
        y: v.averageMood,
      }));

      const chart = new Chart(
        createChartElement(`chart-${entrySet.type}-${type}-${tag}`),
        {
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
        }
      );

      chart.render();
    }
  }
}

function createChartElement(idSlug: string) {
  const element = document.createElement("canvas");
  element.id = idSlug;
  document.body.appendChild(element);
  return element;
}

async function generateMoodOverTimeCharts(
  dayEntries: TimePeriodGroupedEntries
) {
  const firstDate = new Date("2021-10-01");
  const movingAverageOverTime = dayEntries.movingAverage(30, firstDate);

  movingAverageOverTime.filter((v) => v.date > firstDate);
  const data = movingAverageOverTime.map((v) => ({
    x: v.date,
    y: v.average,
  }));
  const chart = new Chart(createChartElement("mood-over-time"), {
    type: "line",
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
            text: "date",
          },
          type: "time",
          adapters: {
            date: {
              locale: enGB,
            },
          },
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

  chart.render();
}
