import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
const plusJakarta = Plus_Jakarta_Sans({
    variable: "--font-plus-jakarta",
    subsets: ["latin"],
    display: "swap",
});
const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
    display: "swap",
});
export const metadata: Metadata = {
    title: "ProximaTrax",
    description: "A Next.js project workspace for Project Management and real-time collaboration.",
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en" suppressHydrationWarning className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster richColors position="top-right"/>
        </ThemeProvider>
      </body>
    </html>);
}
