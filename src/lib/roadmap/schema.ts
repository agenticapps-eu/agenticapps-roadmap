import { z } from "zod";

const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetDate: z.string().nullable(),
});

const IssueCountsSchema = z.object({
  backlog: z.number().int().nonnegative(),
  started: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
});

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  url: z.string().nullish(),
  planAhead: z.boolean().nullish(), // OV-04 (D-05-02) — populated by Phase 6 walker; badge renders only when truthy
  initiativeId: z.string().nullable(),
  status: z.string(),
  priority: z.number().int(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  milestones: z.array(MilestoneSchema),
  issueCounts: IssueCountsSchema,
});

const InitiativeSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  status: z.string(),
});

export const RoadmapJsonSchema = z.object({
  generatedAt: z.string(),
  initiatives: z.array(InitiativeSchema),
  projects: z.array(ProjectSchema),
});

export type RoadmapJson = z.infer<typeof RoadmapJsonSchema>;
export type Initiative = z.infer<typeof InitiativeSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type IssueCounts = z.infer<typeof IssueCountsSchema>;
