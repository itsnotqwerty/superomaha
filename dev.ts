import { Builder } from "fresh/dev";

const builder = new Builder();

if (Deno.args.includes("build")) {
  await builder.build();
} else {
  await builder.listen(async () => (await import("./main.ts")).app);
}
