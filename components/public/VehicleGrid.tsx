import type { CatalogueCard } from "@/services/catalogue.service";
import { VehicleCard } from "@/components/public/VehicleCard";

/** Grille de cartes du catalogue (mobile first : 1 colonne, puis 2, puis 3). */
export function VehicleGrid({ vehicles }: { vehicles: CatalogueCard[] }) {
  if (vehicles.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <li key={vehicle.id} className="h-full">
          <VehicleCard vehicle={vehicle} />
        </li>
      ))}
    </ul>
  );
}