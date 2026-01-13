import "./globals.css";

export const metadata = {
  title: "DogSG Directory",
  description: "Find dog-friendly places in Singapore"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-amber-50 to-white">{children}</body>
    </html>
  );
}
