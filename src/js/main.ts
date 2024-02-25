import {
  TimePeriodGroupedEntry,
  TimePeriodGroupedEntries,
  DaylioDatasource as DaylioDatasource,
  ReferenceType,
  RelationshipStats,
  MovingAverageEntry,
} from "./lib/daylio-converter.js";

import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { format, parse } from "date-fns";

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

  const firstDate = new Date("2023-01-01");

  await generateMoodOverTimeCharts(dayEntries, 30, (e) => e.date > firstDate);
  await generateYearComparison(dayEntries, 30);
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
  entries: TimePeriodGroupedEntries,
  window: number,
  entryFilter: (e: TimePeriodGroupedEntry) => boolean = () => true
) {
  const movingAverageOverTime = entries.movingAverage(window, entryFilter);

  const data = movingAverageOverTime.map((v) => ({
    x: v.date,
    y: v.average,
  }));
  const chart = new Chart(createChartElement("mood-over-time"), {
    type: "line",
    options: {
      elements: {
        point: {
          radius: 0,
        },
        line: {
          borderColor: "#000000",
          borderWidth: 1,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          title: {
            display: true,
            text: "mood",
          },
          min: 1,
          max: 5,
          grid: {
            display: false,
          },
        },
        x: {
          title: {
            display: true,
            text: "date",
          },
          grid: {
            drawOnChartArea: false,
            drawTicks: true,
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
          },
          type: "time",
          time: {
            unit: "month",
          },
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
          title: "mood",
          data,
          pointBackgroundColor: "#000000",
        },
      ],
    },
  });

  chart.render();
}

async function generateYearComparison(
  entries: TimePeriodGroupedEntries,
  window: number
) {
  const movingAverageOverTime = entries.movingAverage(window);

  function groupByYear(entries: MovingAverageEntry[]) {
    const years = new Map<number, MovingAverageEntry[]>();
    for (const entry of entries) {
      const year = entry.date.getFullYear();
      if (!years.has(year)) {
        years.set(year, []);
      }
      years.get(year)?.push(entry);
    }
    return years;
  }

  function normaliseDatesIntoSingleYear(
    years: Map<number, MovingAverageEntry[]>
  ) {
    const normalised = new Map<number, MovingAverageEntry[]>();
    for (const [year, entries] of years) {
      const normalisedEntries = entries.map(
        (e) =>
          new MovingAverageEntry({
            count: e.count,
            sum: e.sum,
            format: "yyyy-MM-dd",
            date: format(
              parse(
                `1970-${e.date.getMonth() + 1}-${e.date.getDate()}`,
                "yyyy-MM-dd",
                new Date()
              ),
              "yyyy-MM-dd"
            ),
          })
      );
      normalised.set(year, normalisedEntries);
    }
    return normalised;
  }

  const years = normaliseDatesIntoSingleYear(
    groupByYear(movingAverageOverTime)
  );

  const colors: Record<number, string> = {
    2021: "#9175a7",
    2022: "#664bac",
    2023: "#1b39ba",
  };

  const datasets = Array.from(years).map(([year, entries]) => ({
    label: year,
    data: entries.map((v) => ({
      x: v.date,
      y: v.average,
    })),
    borderColor: colors[year],
    backgroundColor: colors[year],
  }));

  const chart = new Chart(createChartElement("mood-over-time"), {
    type: "line",
    options: {
      elements: {
        point: {
          radius: 0,
        },
        line: {
          borderColor: "#000000",
          borderWidth: 2,
        },
      },
      scales: {
        y: {
          title: {
            display: true,
            text: "mood",
          },
          min: 1,
          max: 5,
          grid: {
            display: false,
          },
        },
        x: {
          title: {
            display: true,
            text: "date",
          },
          grid: {
            drawOnChartArea: false,
            drawTicks: true,
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
          },
          type: "time",
          time: {
            unit: "month",
            displayFormats: {
              month: "MMM",
            },
          },
          adapters: {
            date: {
              locale: enGB,
            },
          },
        },
      },
    },
    data: {
      datasets,
    },
  });

  chart.render();
}
