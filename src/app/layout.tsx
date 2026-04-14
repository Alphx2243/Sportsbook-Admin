import "./globals.css";
import Navbar from "@/components/Header";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: "SportsBook - College Sports Reimagined",
  description: "Book courts, track live scores, and join teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} antialiased`}>
        <ToastProvider>
          <AuthProvider>
            <ThemeProvider>
              <Navbar />
              <main>{children}</main>
            </ThemeProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
