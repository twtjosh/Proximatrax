import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
const geist = Geist({
    variable: "--font-geist",
    subsets: ["latin"],
    display: "swap",
});
const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: "swap",
});
export const metadata: Metadata = {
    title: "ProximaTrax",
    description: "Project management and real-time task monitoring for AEG Home Fashion.",
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider delay={300}>
            {children}
          </TooltipProvider>
          <Toaster position="bottom-right" offset={{ bottom: 144, right: 24 }} mobileOffset={{ bottom: 144 }}/>
        </ThemeProvider>
      </body>
    </html>);
}
