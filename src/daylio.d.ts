export type Daylio = {
  entries: Entry[];
};

export type Entry = {
  date: Date;
  tags: Tag[];
  mood: Mood;
};

export type Tag = {
  name: string;
  group: string;
};

export type Mood = {
  name: string;
  value: number;
};
