import { define } from "../utils.ts";
import Account from "../islands/Account.tsx";

export default define.page(function AccountPage() {
  return (
    <main class="page">
      <Account />
    </main>
  );
});
