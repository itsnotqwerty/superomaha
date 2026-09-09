import Footer from "../islands/Footer.tsx";
import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0b3d2e" />
        <link rel="stylesheet" href="/styles.css" />

        <title>Super Omaha</title>
        <meta name="title" content="Super Omaha" />
        <meta name="description" content="A roguelike Omaha video poker game with procedurally generated challenges. Play through a series of increasingly difficult hands and try to reach the top of the leaderboard." />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://omaha.coolfreakingames.dev/" />
        <meta property="og:title" content="Super Omaha" />
        <meta property="og:description" content="A roguelike Omaha video poker game with procedurally generated challenges. Play through a series of increasingly difficult hands and try to reach the top of the leaderboard." />
        <meta property="og:image" content="https://omaha.coolfreakingames.dev/embed.png" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://omaha.coolfreakingames.dev/" />
        <meta property="twitter:title" content="Super Omaha" />
        <meta property="twitter:description" content="A roguelike Omaha video poker game with procedurally generated challenges. Play through a series of increasingly difficult hands and try to reach the top of the leaderboard." />
        <meta property="twitter:image" content="https://omaha.coolfreakingames.dev/embed.png" />
      </head>
      <body>
        <Component />
        <Footer />
      </body>
    </html>
  );
});
