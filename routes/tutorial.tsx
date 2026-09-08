import { define } from "../utils.ts";
import Tutorial from "../islands/Tutorial.tsx";

export default define.page(function TutorialPage() {
  return (
    <main class="page">
      <Tutorial />
    </main>
  );
});
