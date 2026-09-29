/**
 * Point d'entrée i18n de l'interface publique (BR-143, contrat lot 3 §3.9).
 *
 * Le français est la seule langue livrée dans ce lot : les composants importent `fr` (et les
 * fonctions de formatage) depuis `@/lib/i18n`. EN/AR et le routage de langue restent hors lot.
 */
export {
  fr,
  formatAmount,
  formatMileage,
  formatPublishedDate,
  formatResultCount,
  type Messages,
} from "./fr";