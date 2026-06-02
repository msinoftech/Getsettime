export type dashboard_activity_feed_item = {
  id: string;
  type: string;
  action?: "created" | "updated" | "deleted";
  title: string;
  description: string;
  createdAt: string;
  entityId?: string | null;
  targetPath?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[];
};
