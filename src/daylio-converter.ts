import { parseISO } from "date-fns";
import { DaylioExport, extractBackup } from "./daylio-export";
import { format, getDaysInMonth, parse } from "date-fns";

const originalNames = ["rad", "good", "meh", "bad", "awful"];

export class BackupConverter {
  tags: Record<number, Tag>;
  constructor(private daylioExport: DaylioExport) {
    this.tags = this.loadTags();
  }

  static async fromFile(file: string): Promise<BackupConverter> {
    return new BackupConverter(await extractBackup(file));
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
        name: v.name,
        group: this.daylioExport.tag_groups.find(
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
      ...new Set(this.entries.flatMap((e) => e.tagEntries.map((t) => t.name))),
    ];
  }

  get uniqueGroups(): string[] {
    return [
      ...new Set(this.entries.flatMap((e) => e.tagEntries.map((t) => t.group))),
    ];
  }
}

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
      const currentCount = groupNameToCounts.get(tag.group);
      const notSeenYet = currentCount === undefined;
      groupNameToCounts.set(tag.group, notSeenYet ? 1 : currentCount + 1);
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

export type Tag = {
  name: string;
  group: string;
};

export type Mood = {
  name: string;
  value: number;
};
