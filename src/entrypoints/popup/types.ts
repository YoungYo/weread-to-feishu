export type BookBrief = {
  bookId: string;
  title: string;
  author?: string;
  cover?: string;
};

export type WereadNotebookResponse = {
  books?: Array<{
    book?: BookBrief;
  }>;
  data?: {
    errcode?: number;
  };
};

export type FeishuConfig = {
  docUrl: string;
  appId: string;
  appSecret: string;
  tenantAccessToken: string;
};

export type SyncState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | { status: "done"; message: string }
  | { status: "error"; message: string };
