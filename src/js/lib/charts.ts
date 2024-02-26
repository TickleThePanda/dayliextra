import Chart from "chart.js/auto";
import { createChartElement } from "../main.js";
import { enGB } from "date-fns/locale";
import { createTitle, createSubtitle } from "./chart-defaults.js";
import {
  MovingAverageEntry,
  TimePeriodGroupedEntries,
  TimePeriodGroupedEntry,
} from "./daylio-converter.js";
import { format, parse } from "date-fns";

export async function generateMoodOverTimeCharts(
  entries: TimePeriodGroupedEntries,
  window: number,
  unit: string,
  description: string,
  entryFilter: (e: TimePeriodGroupedEntry) => boolean = () => true,
  axisRange: { min?: number; max?: number } = { min: 1, max: 5 }
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
          borderWidth: 2,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        title: createTitle("Mood over time"),
        subtitle: createSubtitle(
          `Daily rated mood | Moving average over ${window} ${unit} | ${description}`
        ),
      },
      scales: {
        y: {
          type: "linear",
          title: {
            display: false,
            text: "mood",
          },
          grid: {
            display: true,
            color: "#cccccc",
          },
          border: {
            display: false,
          },
          ...axisRange,
          ticks: {
            stepSize: 1,
          },
        },
        x: {
          title: {
            display: false,
            text: "date",
          },
          grid: {
            drawOnChartArea: false,
            drawTicks: true,
          },
          border: {
            display: false,
            color: "#000000",
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
          data,
          pointBackgroundColor: "#000000",
          borderColor: "#d668cc",
          backgroundColor: "#d668cc",
        },
      ],
    },
  });

  chart.render();
}
export async function generateYearComparison(
  entries: TimePeriodGroupedEntries,
  window: number,
  entryFilter: (e: TimePeriodGroupedEntry) => boolean = () => true
) {
  const movingAverageOverTime = entries.movingAverage(window, entryFilter);

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
    2021: "#f9bded",
    2022: "#d668cc",
    2023: "#884d94",
    2024: "#4a4066",
  };

  const datasets = Array.from(years).map(([year, entries]) => ({
    label: year.toString(),
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
      plugins: {
        title: createTitle("Mood over time by year"),
        subtitle: createSubtitle(
          `Daily rated mood by year | Moving average over ${window} days`
        ),
      },
      scales: {
        y: {
          title: {
            display: false,
            text: "mood",
          },
          min: 1,
          max: 5,
          grid: {
            display: true,
            color: "#cccccc",
          },
          border: {
            display: false,
          },
          ticks: {
            stepSize: 1,
          },
        },
        x: {
          title: {
            display: false,
            text: "date",
          },
          grid: {
            drawOnChartArea: false,
            drawTicks: true,
          },
          border: {
            display: false,
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
      aspectRatio: 1.5,
    },
    data: {
      datasets,
    },
  });

  chart.render();
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
