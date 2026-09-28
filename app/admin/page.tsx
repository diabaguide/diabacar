import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { getCurrentActor } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/errors";
import { requireStaff } from "@/services/access.service";
import { logoutAction } from "@/app/my-diabacar/actions";

/**
 * Back-office DIABACAR — état d'attente du lot 2.
 *
 * L'accès exige `requireStaff(actor, "vehicle.view")` : session vérifiée, statut de compte actif,
 * puis permission. La permission d'entrée est la plus faible du portail opérationnel : elle est
 * portée par ADMIN et par le COMMERCIAL de la matrice provisoire (D01), afin qu'un commercial
 * habilité puisse atteindre le back-office, sans lui ouvrir les écrans d'administration.
 * Un visiteur, un client ou un membre du personnel sans cette permission reçoit un refus neutre,
 * sans aucune donnée.
 *
 * Aucun écran de gestion n'est implémenté ici : les fonctionnalités arrivent aux lots suivants.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Back-office DIABACAR",
  description: "Accès réservé au personnel habilité.",
  // Doc 13 — le back-office est exclu de l'indexation.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const actor = await getCurrentActor();
  const authenticated = actor.kind !== "visitor";

  let roleCode: string | null = null;
  let denial: { code: string; message: string } | null = null;

  try {
    const staff = requireStaff(actor, "vehicle.view");
    roleCode = staff.roleCode;
  } catch (error) {
    denial = toErrorResponse(error).error;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#011D4F]">Back-office DIABACAR</h1>
          <p className="mt-2 text-slate-600">Accès réservé au personnel habilité.</p>
        </div>
        {authenticated ? <LogoutButton action={logoutAction} /> : null}
      </div>

      <div className="mt-8">
        {denial ? <AccessDenied code={denial.code} message={denial.message} /> : null}
        {roleCode ? <BackOfficePlaceholder roleCode={roleCode} /> : null}
      </div>
    </main>
  );
}

/**
 * Refus d'accès. Le message provient de l'enveloppe normalisée (`lib/errors.ts`) et ne révèle ni
 * ressource privée, ni identifiant, ni détail interne.
 */
function AccessDenied({ code, message }: { code: string; message: string }) {
  return (
    <section role="alert" className="rounded-xl border border-[#f3cfcb] bg-[#fdf1f1] p-5">
      <h2 className="text-lg font-semibold text-[#95312a]">
        {code === "UNAUTHENTICATED" ? "Connexion requise" : "Accès refusé"}
      </h2>
      <p className="mt-2 text-sm text-[#95312a]">{message}</p>
      <p className="mt-2 text-sm text-[#95312a]">
        Aucune donnée du back-office n&apos;est affichée pour ce compte.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        {code === "UNAUTHENTICATED" ? (
          <Link
            href="/connexion?suivant=%2Fadmin"
            className="rounded-lg bg-[#0063DF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0354A3]"
          >
            Se connecter
          </Link>
        ) : null}
        <Link href="/" className="text-sm font-semibold text-[#0063DF] hover:text-[#0354A3]">
          Retour au site public
        </Link>
      </div>
    </section>
  );
}

/** État d'attente explicite : les écrans de gestion ne sont pas encore livrés (lot 2). */
function BackOfficePlaceholder({ roleCode }: { roleCode: string }) {
  return (
    <section aria-labelledby="back-office-attente" className="rounded-xl border border-[#b8ddff] bg-[#e8f4ff] p-5">
      <h2 id="back-office-attente" className="text-lg font-semibold text-[#0354A3]">
        Accès au back-office confirmé
      </h2>
      <p className="mt-2 text-sm text-[#0354A3]">Rôle : {roleCode}</p>
      <p className="mt-2 text-sm text-[#0354A3]">
        Les écrans de gestion (véhicules, clients, prospects, commandes, personnel, contenus, audit)
        arrivent aux lots suivants. Aucune fonctionnalité de gestion n&apos;est disponible à ce stade.
      </p>
    </section>
  );
}
