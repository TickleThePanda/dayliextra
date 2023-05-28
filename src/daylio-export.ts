import unzipper from "unzipper";
import fs from "fs";
import { PassThrough } from "node:stream";

export async function extractBackup(fileName: string): Promise<DaylioExport> {
  const stream = fs
    .createReadStream(fileName)
    .pipe(unzipper.ParseOne(/backup.daylio/))
    .pipe(new PassThrough());

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  const base64 = Buffer.concat(chunks).toString("utf-8");

  const text = Buffer.from(base64, "base64").toString("utf-8");

  return JSON.parse(text);
}

export type DaylioExport = {
  version: number;
  isReminderOn: boolean;
  pin: string;
  customMoods: DaylioExportCustomMood[];
  tags: DaylioExportTag[];
  dayEntries: DaylioExportDayEntry[];
  achievements: unknown;
  daysInRowLongestChain: number;
  goals: DaylioExportGoal[];
  prefs: unknown;
  tag_groups: DaylioExportTagGroup[];
  metadata: DaylioExportMetadata;
  moodIconsPackId: number;
  preferredMoodIconsIdsForMoodIdsForIconsPack: unknown;
  assets: unknown[];
  goalEntries: DaylioExportGoalEntry[];
  goalSuccessWeeks: DaylioExportGoalSuccessWeek[];
  reminders: unknown;
  writingTemplates: unknown;
  moodIconsDefaultFreePackId: number;
};

export type DaylioExportCustomMood = {
  id: number;
  custom_name: string;
  mood_group_id: number;
  mood_group_order: number;
  icon_id: number;
  predefined_name_id: number;
  state: number;
  createdAt: number;
};

export type DaylioExportTag = {
  id: number;
  name: string;
  createdAt: number;
  icon: number;
  order: number;
  state: number;
  id_tag_group: number;
};

export type DaylioExportDayEntry = {
  id: number;
  minute: number;
  hour: number;
  day: number;
  month: number;
  year: number;
  datetime: number;
  timeZoneOffset: number;
  mood: number;
  note: string;
  note_title: string;
  tags: number[];
  assets: unknown[];
};

export type DaylioExportGoal = {
  id: number;
  goal_id: number;
  created_at: number;
  reminder_enabled: boolean;
  reminder_minute: number;
  reminder_hour: number;
  state: number;
  repeat_value: number;
  repeat_type: number;
  id_tag: number;
  end_date: number;
  id_challenge: number;
  id_icon: number;
  id_avatar: number;
  order: number;
};

export type DaylioExportTagGroup = {
  id: number;
  name: string;
  is_expanded: boolean;
  order: number;
};

export type DaylioExportMetadata = {
  number_of_entries: number;
  created_at: number;
  is_auto_backup: boolean;
  platform: string;
  android_version: number;
  number_of_photos: number;
  photos_size: number;
};

export type DaylioExportGoalEntry = {
  id: number;
  goalId: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  createdAt: number;
};

export type DaylioExportGoalSuccessWeek = {
  goal_id: number;
  year: number;
  week: number;
  create_at_year: number;
  create_at_month: number;
  create_at_day: number;
};
