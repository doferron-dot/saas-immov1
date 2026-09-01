import { verifierSession } from "@/lib/auth/dal";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Layout partagé par les pages authentifiées (dashboard + opérations, cf. le regroupement
 * de routes app/(app)/ — n'affecte pas les URLs, /dashboard et /operations/[id] restent
 * inchangées, voir node_modules/next/dist/docs/.../route-groups.md). Ajoute la barre de
 * navigation commune (components/layout/app-header.tsx) ; verifierSession() est mis en
 * cache par rendu (cache() dans lib/auth/dal.ts) donc ce second appel (après celui de
 * chaque page) ne déclenche pas de requête réseau supplémentaire.
 *
 * Type des props en dur (pas le helper généré `LayoutProps<...>`) : ce layout vit dans un
 * groupe de routes app/(app)/ et s'applique à plusieurs pages (/dashboard,
 * /operations/**) — le générateur de types de Next.js (node_modules/next/dist/docs/.../
 * layout.md, "Layout Props Helper") ne semble mapper `LayoutRoutes` que pour un layout
 * situé directement sur un segment de route littéral (ex: app/dashboard/layout.tsx),
 * pas pour un layout de groupe couvrant plusieurs pages : `LayoutProps<'/dashboard'>` ne
 * type-check pas ici (LayoutRoutes généré ne contient que "/").
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await verifierSession();

  return (
    <>
      <AppHeader email={user.email ?? ""} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
