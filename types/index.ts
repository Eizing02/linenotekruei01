// types/index.ts

// Raw data format: 2D arrays (same as original GAS getAllData() output)
export type Row = (string | number | null)[];

export interface AppData {
  schedule: Row[];
  events:   Row[];
  tasks:    Row[];
  settings: Row[];
}

export type TabId = 'dashboard' | 'schedule' | 'events' | 'tasks' | 'settings';

export interface SavePayload {
  sheetName: 'Master Schedule' | 'Event & Exception' | 'Task Tracker' | 'System Settings';
  data: Row[];
}

export interface SaveResult {
  ok: boolean;
  msg: string;
}
