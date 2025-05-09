import { DaylioExport, extractBackup } from "./daylio-export.js";
import {
  format,
  getDaysInMonth,
  parse,
  parseISO,
  setYear,
  startOfWeek,
} from "date-fns";
import { TableUserConfig, table } from "table";

const originalNames = ["rad", "good", "meh", "bad", "awful"];

export class DaylioDatasource {
  tags: Record<number, Tag>;
  constructor(private daylioExport: DaylioExport) {
    this.tags = this.loadTags();
  }

  static async fromUploadedFile(blob: Blob): Promise<DaylioDatasource> {
    return new DaylioDatasource(await extractBackup(blob));
  }

  getWeekEntries(): TimePeriodGroupedEntries {
    return new TimePeriodGroupedEntries(
      "week",
      this.getEntriesGroupedBy(
        (v) => format(startOfWeek(v.date), "yyyy-MM-dd"),
        () => 7,
        "yyyy-MM-dd"
      ),
      "yyyy-MM-dd"
    );
  }

  getMonthEntries(): TimePeriodGroupedEntries {
    return new TimePeriodGroupedEntries(
      "month",
      this.getEntriesGroupedBy(
        (v) => format(v.date, "yyyy-MM"),
        (v) => getDaysInMonth(parseISO(v)),
        "yyyy-MM"
      ),
      "yyyy-MM"
    );
  }

  getDayEntries(): TimePeriodGroupedEntries {
    return new TimePeriodGroupedEntries(
      "day",
      this.getEntriesGroupedBy(
        (v) => format(v.date, "yyyy-MM-dd"),
        () => 1,
        "yyyy-MM-dd"
      ),
      "yyyy-MM-dd"
    );
  }

  getEntriesGroupedBy(
    grouper: (e: Entry) => string,
    entryLengthCalculator: (e: string) => number,
    format: string
  ): TimePeriodGroupedEntry[] {
    const entries = this.getEntries();

    const grouped = entries.reduce((p, v) => {
      const group = grouper(v);
      if (p[group] === undefined) {
        p[group] = [];
      }
      p[group].push(v);
      return p;
    }, {} as Record<string, Entry[]>);

    return Object.entries(grouped).map(
      ([group, entries]) =>
        new TimePeriodGroupedEntry({
          group: group,
          groupLengthDays: entryLengthCalculator(group),
          tagEntries: entries.flatMap((entry) => entry.tags),
          moodEntries: entries.map((entry) => entry.mood),
          dateFormat: format,
        })
    );
  }

  getEntries(): Entry[] {
    return this.daylioExport.dayEntries.map(({ datetime, tags, mood }) => ({
      date: new Date(datetime),
      tags: tags.map((t) => this.getTag(t)),
      mood: this.getMood(mood),
    }));
  }

  private loadTags(): Record<number, Tag> {
    return this.daylioExport.tags.reduce((p, v) => {
      p[v.id] = {
        tagName: v.name,
        groupName: this.daylioExport.tag_groups.find(
          (tagGroup) => v.id_tag_group === tagGroup.id
        )!.name,
      };
      return p;
    }, {} as Record<number, Tag>);
  }

  getTag(tagId: number): Tag {
    return this.tags[tagId];
  }

  getMood(moodId: number): Mood {
    const mood = this.daylioExport.customMoods.find((m) => m.id === moodId)!;
    const name =
      mood.custom_name === ""
        ? originalNames[mood.predefined_name_id - 1]
        : mood.custom_name;
    const value =
      mood.mood_group_id === undefined ? 2.5 : 6 - mood.mood_group_id;
    return {
      name,
      value,
    };
  }
}

export class TimePeriodGroupedEntries {
  constructor(
    public type: string,
    public entries: TimePeriodGroupedEntry[],
    public dateFormat: string
  ) {}

  get uniqueTags(): string[] {
    return [
      ...new Set(
        this.entries.flatMap((e) => e.tagEntries.map((t) => t.tagName))
      ),
    ];
  }

  get uniqueGroups(): string[] {
    return [
      ...new Set(
        this.entries.flatMap((e) => e.tagEntries.map((t) => t.groupName))
      ),
    ];
  }

  relationshipBetween(refA: Reference, refB: Reference): RelationshipStats {
    return new RelationshipStats({
      refA,
      refB,
      relationshipStats: [
        this.moodWhen([
          new ReferenceState({
            reference: refA,
            present: true,
          }),
          new ReferenceState({
            reference: refB,
            present: true,
          }),
        ]),
        this.moodWhen([
          new ReferenceState({
            reference: refA,
            present: true,
          }),
          new ReferenceState({
            reference: refB,
            present: false,
          }),
        ]),
        this.moodWhen([
          new ReferenceState({
            reference: refA,
            present: false,
          }),
          new ReferenceState({
            reference: refB,
            present: true,
          }),
        ]),
        this.moodWhen([
          new ReferenceState({
            reference: refA,
            present: false,
          }),
          new ReferenceState({
            reference: refB,
            present: false,
          }),
        ]),
      ],
    });
  }

  moodWhen(states: ReferenceState[]): RelationshipStat {
    const matchingEntries = this.entries.filter((entry) =>
      states.every((s) => s.hasState(entry))
    );

    return {
      states,
      count: matchingEntries.length,
      averageMood:
        matchingEntries.reduce((p, v) => (p += v.averageMood), 0) /
        matchingEntries.length,
    };
  }

  movingAverage(
    windowSizeInEntryUnits: number,
    entryFilter: (e: TimePeriodGroupedEntry) => boolean = () => true
  ): MovingAverageEntry[] {
    const filteredEntries = this.entries.filter(entryFilter);

    const nEntries = filteredEntries.length;
    const beforeWindow = Math.floor(windowSizeInEntryUnits / 2);
    const afterWindow = Math.ceil(windowSizeInEntryUnits / 2);

    const windows: MovingAverageEntry[] = [];

    for (let i = beforeWindow; i < nEntries - afterWindow; i++) {
      const currentEntry = filteredEntries[i];
      const entriesInWindow = [];
      for (let j = i - beforeWindow; j < i + afterWindow; j++) {
        entriesInWindow.push(this.entries[j]);
      }

      const sum = entriesInWindow.reduce((p, v) => p + v.averageMood, 0);
      const count = entriesInWindow.length;

      windows.push(
        new MovingAverageEntry({
          date: currentEntry.group,
          count,
          sum,
          format: this.dateFormat,
        })
      );
    }

    return windows;
  }

  moodsByDayOfYear(): GroupedMoods {
    const moods = this.entries.reduce((acc, entry) => {
      const dateAlignedTo1970 = format(setYear(entry.date, 1970), "yyyy-MM-dd");
      acc[dateAlignedTo1970] = (acc[dateAlignedTo1970] || []).concat([
        entry.averageMood,
      ]);
      return acc;
    }, {} as Record<string, number[]>);

    const groupedMoods = Object.entries(moods).map(([date, moods]) => {
      return new MoodGroupEntry(moods, parse(date, "yyyy-MM-dd", new Date()));
    });
    return new GroupedMoods(
      groupedMoods.sort((a, b) => a.date.getTime() - b.date.getTime())
    );
  }
}

type DatasetEntry = {
  x: Date;
  y: number;
};

export class GroupedMoods {
  public entries: MoodGroupEntry[];

  constructor(entries: MoodGroupEntry[]) {
    this.entries = entries;
  }

  get averageSeries(): DatasetEntry[] {
    return this.entries
      .map((entry) => ({
        x: entry.date,
        y: entry.average,
      }))
      .sort((a, b) => a.x.getTime() - b.x.getTime());
  }

  get minSeries(): DatasetEntry[] {
    return this.entries
      .map((entry) => ({
        x: entry.date,
        y: entry.min,
      }))
      .sort((a, b) => a.x.getTime() - b.x.getTime());
  }

  get maxSeries(): DatasetEntry[] {
    return this.entries
      .map((entry) => ({
        x: entry.date,
        y: entry.max,
      }))
      .sort((a, b) => a.x.getTime() - b.x.getTime());
  }
}

export class MoodGroupEntry {
  public date: Date;
  public moods: number[];

  constructor(moods: number[], date: Date) {
    this.moods = moods;
    this.date = date;
  }
  get average(): number {
    const allMoods = Object.values(this.moods).flat();
    return allMoods.reduce((p, v) => (p += v), 0) / allMoods.length;
  }
  get min(): number {
    return Math.min(...this.moods);
  }
  get max(): number {
    return Math.max(...this.moods);
  }
}

export class MovingAverageEntry {
  private _date: string;
  public sum: number;
  public count: number;
  public format: string;
  constructor({
    date,
    count,
    sum,
    format,
  }: {
    date: string;
    format: string;
    count: number;
    sum: number;
  }) {
    this._date = date;
    this.sum = sum;
    this.count = count;
    this.format = format;
  }

  get date(): Date {
    return parse(this._date, this.format, new Date());
  }

  get average(): number {
    return this.sum / this.count;
  }
}

export class RelationshipStats {
  refA: Reference;
  refB: Reference;
  relationshipStats: [
    RelationshipStat,
    RelationshipStat,
    RelationshipStat,
    RelationshipStat
  ];

  constructor({
    refA,
    refB,
    relationshipStats,
  }: {
    refA: Reference;
    refB: Reference;
    relationshipStats: [
      RelationshipStat,
      RelationshipStat,
      RelationshipStat,
      RelationshipStat
    ];
  }) {
    this.refA = refA;
    this.refB = refB;
    this.relationshipStats = relationshipStats;
  }

  get aY$bY() {
    return this.relationshipStats[0];
  }
  get aY$bN() {
    return this.relationshipStats[1];
  }
  get aN$bY() {
    return this.relationshipStats[2];
  }
  get aN$bN() {
    return this.relationshipStats[3];
  }

  get diffsWhen() {
    return {
      aY: this.aY$bY.averageMood - this.aY$bN.averageMood,
      aN: this.aN$bY.averageMood - this.aN$bN.averageMood,
      bY: this.aY$bY.averageMood - this.aN$bY.averageMood,
      bN: this.aY$bN.averageMood - this.aN$bN.averageMood,
    };
  }
  get diffsInDiffs() {
    const diffs = this.diffsWhen;
    return {
      a: Math.abs(diffs.aN - diffs.aY),
      b: Math.abs(diffs.bN - diffs.bY),
    };
  }

  toString() {
    const diffs = this.diffsWhen;
    const data = [
      ["", "", this.refA.name, "", this.diffsInDiffs.b.toFixed(1)],
      ["", "", "n", "y", "Δ"],
      [
        this.refB.name,
        "n",
        this.aN$bN.averageMood.toFixed(1),
        this.aY$bN.averageMood.toFixed(1),
        diffs.bN.toFixed(1),
      ],
      [
        "",
        "y",
        this.aN$bY.averageMood.toFixed(1),
        this.aY$bY.averageMood.toFixed(1),
        diffs.bY.toFixed(1),
      ],
      [
        this.diffsInDiffs.a.toFixed(1),
        "Δ",
        diffs.aN.toFixed(1),
        diffs.aY.toFixed(1),
        "",
      ],
    ];
    const config: TableUserConfig = {
      columns: [
        { width: this.refB.name.length },
        { width: 1 },
        { width: Math.max(4, Math.ceil(this.refA.name.length / 2)) },
        { width: Math.max(4, Math.ceil(this.refA.name.length / 2)) },
      ],
      spanningCells: [
        {
          col: 0,
          row: 0,
          rowSpan: 2,
          colSpan: 2,
        },
        {
          col: 2,
          row: 0,
          colSpan: 2,
          alignment: "center",
        },
        {
          col: 0,
          row: 2,
          rowSpan: 2,
          verticalAlignment: "middle",
        },
      ],
    };
    const result = table(data, config);
    return result;
  }
}

export type ReferenceType = "Tag" | "Group";

export class ReferenceState {
  reference: Reference;
  present: boolean;

  constructor({
    reference,
    present,
  }: {
    reference: Reference;
    present: boolean;
  }) {
    this.reference = reference;
    this.present = present;
  }

  hasState(entry: TimePeriodGroupedEntry) {
    if (this.reference.type === "Tag") {
      if (this.present) {
        return entry.tagEntries.some((e) => e.tagName === this.reference.name);
      } else {
        return !entry.tagEntries.some((e) => e.tagName === this.reference.name);
      }
    } else {
      if (this.present) {
        return entry.tagEntries.some(
          (e) => e.groupName === this.reference.name
        );
      } else {
        return !entry.tagEntries.some(
          (e) => e.groupName === this.reference.name
        );
      }
    }
  }
}

export type RelationshipStat = {
  states: ReferenceState[];
  count: number;
  averageMood: number;
};

export type GroupedEntryConstructorArgs = {
  group: string;
  groupLengthDays: number;
  moodEntries: Mood[];
  tagEntries: Tag[];
  dateFormat: string;
};

export class TimePeriodGroupedEntry {
  group: string;
  moodEntries: Mood[];
  tagEntries: Tag[];
  groupLengthDays: number;
  dateFormat: string;

  constructor({
    group,
    groupLengthDays,
    moodEntries,
    tagEntries,
    dateFormat,
  }: GroupedEntryConstructorArgs) {
    this.group = group;
    this.groupLengthDays = groupLengthDays;
    this.moodEntries = moodEntries;
    this.tagEntries = tagEntries;
    this.dateFormat = dateFormat;
  }

  get countOfTags(): TagCount[] {
    const tagCounts = this.tagEntries.reduce((tagsToCounts, tag) => {
      const currentCount = tagsToCounts.get(tag);
      const notSeenYet = currentCount === undefined;
      tagsToCounts.set(tag, notSeenYet ? 1 : currentCount + 1);
      return tagsToCounts;
    }, new Map<Tag, number>());

    return Array.from(tagCounts, ([tag, count]) => ({
      count,
      ...tag,
    }));
  }

  get countOfGroups(): GroupCount[] {
    const groupCounts = this.tagEntries.reduce((groupNameToCounts, tag) => {
      const currentCount = groupNameToCounts.get(tag.groupName);
      const notSeenYet = currentCount === undefined;
      groupNameToCounts.set(tag.groupName, notSeenYet ? 1 : currentCount + 1);
      return groupNameToCounts;
    }, new Map<string, number>());

    return Array.from(groupCounts, ([group, count]) => ({
      group,
      count,
    }));
  }

  get averageMood(): number {
    return (
      this.moodEntries.reduce((sum, mood) => sum + (mood.value ?? 2.5), 0) /
      this.moodEntries.length
    );
  }

  get date(): Date {
    return parse(this.group, this.dateFormat, new Date());
  }
}

export type Entry = {
  date: Date;
  tags: Tag[];
  mood: Mood;
};

export type TagCount = Tag & {
  count: number;
};

export type GroupCount = {
  group: string;
  count: number;
};

export type Reference = {
  name: string;
  type: ReferenceType;
};

export type Tag = {
  tagName: string;
  groupName: string;
};

export type Mood = {
  name: string;
  value: number;
};
