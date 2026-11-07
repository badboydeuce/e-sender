import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "eSender | Device Command Center", description: "Manage enrolled iPhones and campaign operations." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
