import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CopyMe",
  description: "Connect. Share. Belong.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFFFFF",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      {children}
    </div>
  );
}
