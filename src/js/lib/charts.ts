import Chart from "chart.js/auto";
import { createChartElement } from "../main.js";
import { enGB } from "date-fns/locale";
import { createTitle, createSubtitle } from "./chart-defaults.js";
import {
  MovingAverageEntry,
  TimePeriodGroupedEntries,
  TimePeriodGroupedEntry,
} from "./daylio-converter.js";
import { format, parse, setYear } from "date-fns";

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

  function normaliseDate(date: Date) {
    const normalised = new Date(date);
    normalised.setFullYear(1970);
    return normalised;
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
            date: format(normaliseDate(e.date), "yyyy-MM-dd"),
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
    2025: "#2b2a44",
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

type DatedValue = {
  x: Date;
  y: number;
};

function rollingAverageTorroidial(arr: DatedValue[], window: number) {
  const result = arr.map((v) => ({ x: v.x, y: 0 }));
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < window; j++) {
      const index = i + j - window / 2;
      sum += arr[(index + n) % n].y;
    }
    result[i].y = sum / window;
  }
  return result;
}

export async function generateAverageMoodOnDayOfYear(
  entries: TimePeriodGroupedEntries,
  window: number,
  unit: string
) {
  const moodOnDayOfYear = entries.moodsByDayOfYear();

  const averages = rollingAverageTorroidial(
    moodOnDayOfYear.averageSeries,
    window
  );

  const mins = rollingAverageTorroidial(moodOnDayOfYear.minSeries, window);

  const maxs = rollingAverageTorroidial(moodOnDayOfYear.maxSeries, window);

  const chart = new Chart(createChartElement("average-mood-on-day-of-year"), {
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
        title: createTitle("Mood on day of year"),
        subtitle: createSubtitle(
          `Daily rated mood | Moving average over ${window} ${unit}`
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
          min: 1,
          max: 5,
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
      datasets: [
        {
          label: "Average",
          data: averages,
          pointBackgroundColor: "#000000",
          borderColor: "#d668cc",
          backgroundColor: "#d668cc",
        },
        {
          label: "Min",
          data: mins,
          pointBackgroundColor: "#000000",
          borderColor: "#f59fed",
          backgroundColor: "#f59fed",
        },
        {
          label: "Max",
          data: maxs,
          pointBackgroundColor: "#000000",
          borderColor: "#f59fed",
          backgroundColor: "#f59fed",
        },
      ],
    },
  });

  chart.render();
}

export async function generateYearComparisonRemovingAnnualSeasonaility(
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

  function normaliseDate(date: Date) {
    const normalised = new Date(date);
    normalised.setFullYear(1970);
    return normalised;
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
            date: format(normaliseDate(e.date), "yyyy-MM-dd"),
          })
      );
      normalised.set(year, normalisedEntries);
    }
    return normalised;
  }

  const moodsOnDayOfYear = entries.moodsByDayOfYear();

  const averageMoodOnDayOfYear = rollingAverageTorroidial(
    moodsOnDayOfYear.averageSeries,
    window
  );

  const years = normaliseDatesIntoSingleYear(
    groupByYear(movingAverageOverTime)
  );

  const colors: Record<number, string> = {
    2021: "#f9bded",
    2022: "#d668cc",
    2023: "#884d94",
    2024: "#4a4066",
    2025: "#2b2a44",
  };

  const datasets = Array.from(years).map(([year, entries]) => ({
    label: year.toString(),
    data: entries.map((v) => ({
      x: v.date,
      y:
        v.average -
        (averageMoodOnDayOfYear.find((a) => a.x.getTime() === v.date.getTime())
          ?.y || 0),
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
        title: createTitle("Deseasonalised by year"),
        subtitle: createSubtitle(
          `Daily rated mood by year, deseasonalised | Moving average over ${window} days`
        ),
      },
      scales: {
        y: {
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
