import type { Metadata } from "next";
import "./globals.css";

// Note technique : on utilise la pile de polices système (pas next/font/google)
// pour ne pas dépendre d'un accès réseau à Google Fonts pendant le développement/build.
// Une police auto-hébergée pourra être ajoutée plus tard sans impact sur le reste du code.

export const metadata: Metadata = {
  title: "Analyse Immo",
  description: "Outil d'aide à la décision pour investisseurs immobiliers et marchands de biens",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
