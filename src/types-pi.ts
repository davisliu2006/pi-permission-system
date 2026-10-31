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

export function validatePathToolInput(input: PiToolInput): PathToolInput | undefined {
  if (!("path" in input) || typeof(input.path) !== "string") {return undefined;}
  return input as PathToolInput;
}
export function validateBashToolInput(input: PiToolInput): BashToolInput | undefined {
  if (!("command" in input) || typeof(input.command) !== "string") {return undefined;}
  return input as BashToolInput;
}
