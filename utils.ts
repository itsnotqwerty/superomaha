import { createDefine } from "fresh";

// Shared server state type for Fresh context.
// deno-lint-ignore no-empty-interface
export interface State {}

export const define = createDefine<State>();
