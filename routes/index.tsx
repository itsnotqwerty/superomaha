import { define } from "../utils.ts";
import OmahaTable from "../islands/OmahaTable.tsx";

export default define.page(function Home() {
  return (
    <main class="page">
      <h1>Super Omaha</h1>
      <p class="tagline">
        Beat the blind: pick exactly <strong>2 hole cards</strong> +{" "}
        <strong>3 board cards</strong>. Tap cards to mark them for redraw.
      </p>
      <OmahaTable />
      <footer>
        <p>&copy; 2026 Samuel Roux</p>
        <p class="donate-line">Cool Freakin' Games is funded entirely by donations <a class="donate" href="bitcoin:bc1qsxmj8euqjqqze36kweglg4kut30f95gygmhyz3">&#8383; Donate Bitcoin</a></p>
      </footer>
    </main>
  );
});
