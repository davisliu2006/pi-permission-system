import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPermissionSystem } from "./src/extension.ts";

export default function piPermissionSystem(pi: ExtensionAPI): void {
  registerPermissionSystem(pi);
}
