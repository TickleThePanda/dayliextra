export type DaylioExport = {
  version: number;
  isReminderOn: boolean;
  pin: string;
  customMoods: CustomMood[];
  tags: Tag[];
  dayEntries: DayEntry[];
  achievements: unknown;
  daysInRowLongestChain: number;
  goals: Goal[];
  prefs: unknown;
  tag_groups: TagGroup[];
  metadata: Metadata;
  moodIconsPackId: number;
  preferredMoodIconsIdsForMoodIdsForIconsPack: unknown;
  assets: unknown[];
  goalEntries: GoalEntry[];
  goalSuccessWeeks: GoalSuccessWeek[];
  reminders: unknown;
  writingTemplates: unknown;
  moodIconsDefaultFreePackId: number1;
};

export type CustomMood = {
  id: string;
  custom_name: string;
  mood_group_id: number;
  mood_group_order: number;
  icon_id: number;
  predefined_name_id: number;
  state: number;
  createdAt: number;
};

export type Tag = {
  id: number;
  name: string;
  createdAt: number;
  icon: number;
  order: number;
  state: number;
  id_tag_group: number;
};

export type DayEntry = {
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

export type Goal = {
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

export type TagGroup = {
  id: number;
  name: string;
  is_expanded: boolean;
  order: number;
};

export type Metadata = {
  number_of_entries: number;
  created_at: number;
  is_auto_backup: boolean;
  platform: string;
  android_version: number;
  number_of_photos: number;
  photos_size: number;
};

export type GoalEntry = {
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

export type GoalSuccessWeek = {
  goal_id: number;
  year: number;
  week: number;
  create_at_year: number;
  create_at_month: number;
  create_at_day: number;
};
