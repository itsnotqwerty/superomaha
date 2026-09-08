// Collection screen (spec §11 / REQ-META-2): everything seen across runs.
// Discovery in-run, complete-by-playing — nothing is gated behind grind.
import { useEffect, useState } from "preact/hooks";
import { BOSSES } from "../core/bosses.ts";
import {
  Collection as CollectionData,
  collectionKey,
  EMPTY_COLLECTION,
  loadCollection,
} from "../core/collection.ts";
import { RELICS } from "../core/relics.ts";
import { TABLES } from "../core/tables.ts";

export default function Collection() {
  const [c, setC] = useState<CollectionData>(EMPTY_COLLECTION);
  useEffect(() => {
    setC(loadCollection(localStorage.getItem(collectionKey())));
  }, []);

  const section = (
    title: string,
    items: { id: string; name: string; text: string }[],
    seen: string[],
  ) => (
    <section class="collection-section">
      <h3>
        {title} <span class="dim">{seen.length}/{items.length}</span>
      </h3>
      <ul class="collection-list">
        {items.map((item) => {
          const found = seen.includes(item.id);
          return (
            <li key={item.id} class={found ? "" : "unseen"}>
              <strong>{found ? item.name : "???"}</strong>
              <span class="shop-text">
                {found ? item.text : "Not seen yet."}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div class="table collection">
      <h2>Collection</h2>
      <p class="table-desc">
        {c.runs} runs · {c.wins} wins · best ante {c.bestAnte || "—"}
      </p>
      {section("Relics", RELICS, c.relics)}
      {section("Bosses", BOSSES, c.bosses)}
      {section(
        "Tables",
        TABLES.map((t) => ({ id: t.id, name: t.name, text: t.text })),
        c.tables,
      )}
      <a class="commit tutorial-back" href="/">Back</a>
    </div>
  );
}
