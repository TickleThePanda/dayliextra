import { unzip } from "unzipit";

export async function extractBackup(blob: Blob): Promise<DaylioExport> {
  const zip = await unzip(blob);
  const key = Object.keys(zip.entries).find((k) => k.includes("backup.daylio"));

  console.log(key);

  if (!key) {
    throw new Error("Backup file not found");
  }

  const file = zip.entries[key];
  console.log(file);
  console.log(await file.text());
  const base64 = await file.text();
  console.log(atob(base64));
  return JSON.parse(atob(base64));
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
