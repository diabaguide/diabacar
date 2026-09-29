import Link from "next/link";
import type { CatalogueCard } from "@/services/catalogue.service";
import { VehiclePicture } from "@/components/public/VehiclePicture";
import { StatusBadges, cardBadges } from "@/components/public/StatusBadges";
import { formatAmount, formatMileage, fr } from "@/lib/i18n";

/**
 * Carte de catalogue (doc 05 §2). Toutes les données viennent de `CatalogueCard` : aucune règle
 * métier ni aucun champ sensible n'est manipulé côté interface.
 */
export function VehicleCard({ vehicle }: { vehicle: CatalogueCard }) {
  const href = `/voitures/${vehicle.slug}`;
  const imageAlt = vehicle.primaryImage?.alt ?? `${vehicle.title} ${vehicle.year}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Link href={href} className="relative block aspect-[4/3] bg-[#f4f7fb]">
        <VehiclePicture
          url={vehicle.primaryImage?.url ?? null}
          alt={imageAlt}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <StatusBadges badges={cardBadges(vehicle)} />

        <h3 className="text-base font-semibold text-[#011D4F]">
          <Link href={href}>{vehicle.title}</Link>
        </h3>

        <p className="text-sm text-slate-600">
          {vehicle.brandName} · {vehicle.modelName} · {vehicle.year}
        </p>

        <ul className="flex flex-col gap-1 text-sm text-slate-600">
          <li>{vehicle.bodyTypeName}</li>
          <li>
            {vehicle.fuelTypeName} · {vehicle.transmissionTypeName}
          </li>
          {vehicle.mileage !== null ? <li>{formatMileage(vehicle.mileage)}</li> : null}
        </ul>

        <p className="mt-auto text-lg font-semibold text-[#011D4F]">
          {vehicle.price
            ? formatAmount(vehicle.price.amount, vehicle.price.currency)
            : fr.common.priceOnRequest}
        </p>
      </div>
    </article>
  );
}