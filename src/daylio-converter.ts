import { parseISO } from "date-fns";
import { DaylioExport, extractBackup } from "./daylio-export";
import { format, getDaysInMonth, parse } from "date-fns";
import { EOL } from "os";
import { TableUserConfig, table } from "table";

const originalNames = ["rad", "good", "meh", "bad", "awful"];

export class DaylioDatasource {
  tags: Record<number, Tag>;
  constructor(private daylioExport: DaylioExport) {
    this.tags = this.loadTags();
  }

  static async fromFile(file: string): Promise<DaylioDatasource> {
    return new DaylioDatasource(await extractBackup(file));
  }

  getWeekEntries(): GroupedEntries {
    return new GroupedEntries(
      "week",
      this.getEntriesGroupedBy(
        (v) => format(v.date, "yyyy-II"),
        () => 7
      )
    );
  }

  getMonthEntries(): GroupedEntries {
    return new GroupedEntries(
      "month",
      this.getEntriesGroupedBy(
        (v) => format(v.date, "yyyy-MM"),
        (v) => getDaysInMonth(parseISO(v))
      )
    );
  }

  getDayEntries(): GroupedEntries {
    return new GroupedEntries(
      "day",
      this.getEntriesGroupedBy(
        (v) => format(v.date, "yyyy-MM-dd"),
        () => 1
      )
    );
  }

  getEntriesGroupedBy(
    grouper: (e: Entry) => string,
    entryLengthCalculator: (e: string) => number
  ): GroupedEntry[] {
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
        new GroupedEntry({
          group: group,
          groupLengthDays: entryLengthCalculator(group),
          tagEntries: entries.flatMap((entry) => entry.tags),
          moodEntries: entries.map((entry) => entry.mood),
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

export class GroupedEntries {
  constructor(public type: string, public entries: GroupedEntry[]) {}

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

  hasState(entry: GroupedEntry) {
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
};

export class GroupedEntry {
  group: string;
  moodEntries: Mood[];
  tagEntries: Tag[];
  groupLengthDays: number;

  constructor({
    group,
    groupLengthDays,
    moodEntries,
    tagEntries,
  }: GroupedEntryConstructorArgs) {
    this.group = group;
    this.groupLengthDays = groupLengthDays;
    this.moodEntries = moodEntries;
    this.tagEntries = tagEntries;
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
