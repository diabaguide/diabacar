import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="bg-gradient-to-br from-[#011D4F] via-[#0063DF] to-[#099FF8] px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#66E5FC]">DIABACAR V1</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Trouvez un véhicule en Chine ou au Sénégal, puis contactez DIABACAR.</h1>
          <p className="mt-6 max-w-2xl text-lg text-blue-50">Catalogue, fiches véhicules, demandes personnalisées et suivi client sans paiement en ligne dans cette première version.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/voitures" className="rounded-full bg-white px-6 py-3 text-center font-semibold text-[#0063DF]">Voir les véhicules</Link>
            <Link href="/commander" className="rounded-full border border-white px-6 py-3 text-center font-semibold text-white">Demande personnalisée</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
        {["Localisation claire Chine/Sénégal", "Prix calculé côté serveur", "Suivi dans My DIABACAR"].map((item) => (
          <article key={item} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#011D4F]">{item}</h2>
            <p className="mt-3 text-slate-600">Fondation préparée pour respecter les règles métier et la confidentialité des données.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
