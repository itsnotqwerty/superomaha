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
      </head>
      <body>
        <Component />
        <Footer />
      </body>
    </html>
  );
});
