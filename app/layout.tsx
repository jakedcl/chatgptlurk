import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Calendar",
  description:
    "A private calendar of your ChatGPT prompts. Upload an export in the browser. Files never leave your device.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full">
        {children}
        <noscript>
          <p className="mx-auto max-w-lg px-6 py-10 text-sm leading-6 text-zinc-300">
            Prompt Calendar needs JavaScript. Your ChatGPT export is parsed in the browser. Files never leave this
            device.
          </p>
        </noscript>
      </body>
    </html>
  );
}
