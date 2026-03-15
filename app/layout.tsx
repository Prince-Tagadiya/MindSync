import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindSync - The Ultimate Word Matching Game",
  description: "Say the same word without planning. Connect your thoughts to win.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;700;900&family=Lexend:wght@400;600;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className="font-display bg-background-light dark:bg-mindsync-deep text-slate-900 dark:text-slate-100 min-h-screen overflow-x-hidden">
        {/* Background Elements */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-[#ec5b13]/20"></div>
          <div className="floating-shape top-10 left-[10%] w-24 h-24 rounded-full bg-yellow-400 blur-3xl animate-float"></div>
          <div className="floating-shape top-1/4 right-[15%] w-32 h-32 rounded-full bg-purple-500 blur-3xl animate-float-delayed"></div>
          <div className="floating-shape bottom-1/4 left-[5%] w-40 h-40 rounded-full bg-emerald-500/40 blur-3xl animate-float-slow"></div>
          <div className="absolute top-20 right-20 text-yellow-300 opacity-20 transform rotate-12 animate-pulse-slow">
            <span className="material-symbols-outlined text-[120px]">brush</span>
          </div>
          <div className="absolute bottom-20 left-20 text-[#22c55e] opacity-20 transform -rotate-12 animate-float">
            <span className="material-symbols-outlined text-[100px]">gesture</span>
          </div>
        </div>
        
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root">

          {children}

        </div>
      </body>
    </html>
  );
}
