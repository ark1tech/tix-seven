import localFont from "next/font/local";

/** Body copy and UI: Inter (variable) */
export const inter = localFont({
  src: [
    {
      path: "./inter/Inter-VariableFont_opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "./inter/Inter-Italic-VariableFont_opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

/** Headings, card titles, dialog titles */
export const ttNorms = localFont({
  src: [
    { path: "./tt-norms/TTNorms-Thin.woff2", weight: "100", style: "normal" },
    { path: "./tt-norms/TTNorms-ExtraLight.woff2", weight: "200", style: "normal" },
    { path: "./tt-norms/TTNorms-Light.woff2", weight: "300", style: "normal" },
    { path: "./tt-norms/TTNorms-Regular.woff2", weight: "400", style: "normal" },
    { path: "./tt-norms/TTNorms-Medium.woff2", weight: "500", style: "normal" },
    { path: "./tt-norms/TTNorms-Medium.woff2", weight: "600", style: "normal" },
    { path: "./tt-norms/TTNorms-Bold.woff2", weight: "700", style: "normal" },
    { path: "./tt-norms/TTNorms-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "./tt-norms/TTNorms-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-tt-norms",
  display: "swap",
});
