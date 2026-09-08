import { define } from "../utils.ts";
import Collection from "../islands/Collection.tsx";

export default define.page(function CollectionPage() {
  return (
    <main class="page">
      <Collection />
    </main>
  );
});
