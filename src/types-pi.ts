import type {
  BashToolInput,
  EditToolInput,
  FindToolInput,
  GrepToolInput,
  LsToolInput,
  ReadToolInput,
  ToolCallEvent,
  WriteToolInput,
} from "@earendil-works/pi-coding-agent";

export type PiToolCallEvent = ToolCallEvent;

export type PathToolInput =
  | ReadToolInput
  | WriteToolInput
  | EditToolInput
  | GrepToolInput
  | FindToolInput
  | LsToolInput;

export type PiToolInput =
  | PathToolInput
  | BashToolInput
  | Record<string, unknown>;
