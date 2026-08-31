/**
 * Financement (section 9 du cahier des charges).
 * Simulation mois par mois du capital restant dû — plus robuste et plus facile à
 * vérifier qu'une formule fermée, notamment pour gérer le différé proprement.
 * Moteur 100% déterministe — aucune IA.
 */

export type TypeDiffere = "aucun" | "partiel" | "total";

export interface EntreesFinancement {
  montantEmprunte: number;
  /** Taux d'intérêt annuel, en fraction (ex: 0.035 pour 3,5%). */
  tauxAnnuel: number;
  dureeMois: number;
  /** Taux d'assurance emprunteur annuel, en fraction du capital emprunté initial. */
  tauxAssuranceAnnuel: number;
  fraisBancaires?: number;
  differeType?: TypeDiffere;
  /** Nombre de mois de différé (partiel ou total). Ignoré si differeType = "aucun". */
  differeMois?: number;
}

export interface DetailFinancement {
  /** Mensualité (hors assurance) pendant la phase d'amortissement normale. */
  mensualiteHorsAssurance: number;
  mensualiteAssurance: number;
  /** Mensualité totale (hors assurance + assurance) pendant la phase d'amortissement normale. */
  mensualiteTotale: number;
  /** Mensualité payée pendant la phase de différé (0 si différé total ou aucun différé). */
  mensualiteDiffere: number;
  interetsTotaux: number;
  assuranceTotale: number;
  fraisBancaires: number;
  coutTotalCredit: number;
  montantTotalDu: number;
  /** Capital restant dû en fin de simulation — doit être ~0, sert de garde-fou. */
  capitalResiduelFinal: number;
}

/** Mensualité d'un prêt amortissable classique (hors assurance), formule standard. */
export function calculerMensualite(
  capital: number,
  tauxAnnuel: number,
  dureeMois: number
): number {
  if (dureeMois <= 0) {
    throw new Error("La durée doit être positive.");
  }
  if (capital < 0) {
    throw new Error("Le capital ne peut pas être négatif.");
  }
  if (tauxAnnuel === 0) {
    return capital / dureeMois;
  }
  const tauxMensuel = tauxAnnuel / 12;
  const facteur = Math.pow(1 + tauxMensuel, dureeMois);
  return (capital * (tauxMensuel * facteur)) / (facteur - 1);
}

export function calculerFinancement(entrees: EntreesFinancement): DetailFinancement {
  if (entrees.montantEmprunte < 0) {
    throw new Error("Le montant emprunté ne peut pas être négatif.");
  }
  if (entrees.tauxAnnuel < 0 || entrees.tauxAssuranceAnnuel < 0) {
    throw new Error("Les taux ne peuvent pas être négatifs.");
  }
  if (entrees.dureeMois <= 0) {
    throw new Error("La durée du prêt doit être positive.");
  }

  const differeType = entrees.differeType ?? "aucun";
  const differeMois = differeType === "aucun" ? 0 : entrees.differeMois ?? 0;
  if (differeMois < 0 || differeMois >= entrees.dureeMois) {
    throw new Error("Le différé doit durer moins longtemps que le prêt lui-même.");
  }

  const tauxMensuel = entrees.tauxAnnuel / 12;
  const mensualiteAssurance = (entrees.montantEmprunte * entrees.tauxAssuranceAnnuel) / 12;

  let capital = entrees.montantEmprunte;
  let interetsTotaux = 0;
  let mensualiteDiffere = 0;

  // --- Phase de différé ---
  if (differeType === "partiel") {
    // Seuls les intérêts sont payés chaque mois ; le capital ne bouge pas.
    const interetMensuel = capital * tauxMensuel;
    mensualiteDiffere = interetMensuel + mensualiteAssurance;
    interetsTotaux += interetMensuel * differeMois;
  } else if (differeType === "total") {
    // Rien n'est payé : les intérêts courus sont capitalisés (ajoutés au capital).
    for (let mois = 0; mois < differeMois; mois++) {
      const interetMensuel = capital * tauxMensuel;
      interetsTotaux += interetMensuel;
      capital += interetMensuel;
    }
    mensualiteDiffere = 0;
  }

  // --- Phase d'amortissement normal ---
  const dureeAmortissement = entrees.dureeMois - differeMois;
  const mensualiteHorsAssurance = calculerMensualite(capital, entrees.tauxAnnuel, dureeAmortissement);

  for (let mois = 0; mois < dureeAmortissement; mois++) {
    const interetMensuel = capital * tauxMensuel;
    const principal = mensualiteHorsAssurance - interetMensuel;
    interetsTotaux += interetMensuel;
    capital -= principal;
  }

  const assuranceTotale = mensualiteAssurance * entrees.dureeMois;
  const fraisBancaires = entrees.fraisBancaires ?? 0;
  const coutTotalCredit = interetsTotaux + assuranceTotale + fraisBancaires;

  return {
    mensualiteHorsAssurance,
    mensualiteAssurance,
    mensualiteTotale: mensualiteHorsAssurance + mensualiteAssurance,
    mensualiteDiffere,
    interetsTotaux,
    assuranceTotale,
    fraisBancaires,
    coutTotalCredit,
    montantTotalDu: entrees.montantEmprunte + coutTotalCredit,
    capitalResiduelFinal: capital,
  };
}
