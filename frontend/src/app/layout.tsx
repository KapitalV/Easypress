import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "EasyPress — Smart Image & Enrollment Compressor",
  description:
    "Minimalist high-performance image optimizer and enrollment photo & signature compressor. Developed by Vishal Sahu, CSE Student at Govt. Polytechnic Madhogarh.",
  icons: {
    icon: "/easypress_logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="bg-[#05070f] text-zinc-100 min-h-screen flex flex-col items-center relative selection:bg-blue-600 selection:text-white"
      >
        {/* Animated Mesh Background (From DiplomaSathi) */}
        <div className="mesh-bg" aria-hidden="true">
          <div className="mesh-orb" />
          <div className="mesh-orb" />
          <div className="mesh-orb" />
          <div className="mesh-orb" />
        </div>

        {/* Main Content Layer */}
        <div className="relative z-10 w-full flex flex-col items-center flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
