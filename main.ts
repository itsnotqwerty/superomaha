// Server entrypoint for Fresh (dev via dev.ts, production via `deno task start`
// after `deno task build`). DONUT Deploy runs this behind nginx.
import { App, staticFiles } from "fresh";
import type { State } from "./utils.ts";

export const app = new App<State>();

app.use(staticFiles());

// Include file-based routes.
app.fsRoutes();
