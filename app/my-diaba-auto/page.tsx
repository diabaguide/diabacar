import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileSummary } from "@/components/profile/ProfileSummary";
import {
  ProfileUnavailableNotice,
  StaffAreaNotice,
  SuspendedAccountNotice,
} from "@/components/profile/ProfileNotices";
import { ResellerStatusBadge } from "@/components/profile/ResellerStatusBadge";
import { getCurrentActor } from "@/lib/auth/session";
import { createCustomerRepository } from "@/repositories/customer.repository";
import { readOwnCustomerProfile, type CustomerProfileView } from "@/services/profile.service";
import { logoutAction, updateProfileAction } from "./actions";

/**
 * My Diaba Auto — tableau de bord du client.
 * `force-dynamic` garantit qu'aucune version privée n'est générée statiquement ni mise en cache :
 * le contenu dépend de la session, jamais d'un cache partagé (dev.md §9).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Diaba Auto — Espace personnel",
  description: "Espace personnel Diaba Auto : profil, statut Revendeur et déconnexion.",
  // Doc 18 — les espaces privés sont exclus de l'indexation. Le contrôle d'accès reste la garde réelle.
  robots: { index: false, follow: false, nocache: true },
};

export default async function MyDiabaAutoPage() {
  const actor = await getCurrentActor();

  if (actor.kind === "visitor") {
    // Aucune donnée privée n'est rendue pour un visiteur : redirection vers la connexion.
    redirect("/connexion?suivant=%2Fmy-diaba-auto");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#011D4F]">My Diaba Auto</h1>
          <p className="mt-2 text-slate-600">Profil personnel et statut du compte.</p>
        </div>
        <LogoutButton action={logoutAction} />
      </div>

      <div className="mt-8 grid gap-6">
        {actor.kind === "suspended" ? <SuspendedAccountNotice /> : null}
        {actor.kind === "staff" ? <StaffAreaNotice /> : null}
        {actor.kind === "customer" ? <CustomerDashboard /> : null}
      </div>
    </main>
  );
}

/** Le service projette explicitement les colonnes autorisées ; la page ne lit rien d'autre. */
async function CustomerDashboard() {
  const actor = await getCurrentActor();

  let profile: CustomerProfileView;
  try {
    profile = await readOwnCustomerProfile(createCustomerRepository(), actor);
  } catch {
    return <ProfileUnavailableNotice />;
  }

  return (
    <>
      <ProfileSummary profile={profile} />
      <section aria-labelledby="profil-statut" className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 id="profil-statut" className="text-lg font-semibold text-[#011D4F]">
          Statut Revendeur
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Ce statut est attribué et modifié par Diaba Auto. Il n&apos;est pas modifiable depuis cet espace.
        </p>
        <div className="mt-4">
          <ResellerStatusBadge status={profile.resellerStatus} />
        </div>
      </section>
      <ProfileForm profile={profile} action={updateProfileAction} />
    </>
  );
}
