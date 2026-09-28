-- ============================================================================
-- DIABACAR - M05 : liaison auth.users, RLS, policies et buckets Storage
-- SQL entièrement manuel : ces objets ne sont pas exprimables par Prisma (T01).
--
-- Principes retenus (décisions T03/T05, docs 11 et 12) :
--   * RLS activée sur TOUTES les tables exposées du schéma « public ».
--     Aucune policy n'est créée par défaut : « aucune policy » = aucun accès
--     pour anon et authenticated (refus par défaut).
--   * Les tables de back-office (staff_profiles, roles, permissions,
--     role_permissions, audit_logs, order_events, vehicle_documents,
--     brands, vehicle_models) n'ont AUCUNE policy client : leur lecture et leur
--     écriture passent exclusivement par le serveur (rôle service_role).
--   * Les requêtes « lignes propres » s'appuient sur deux fonctions helper
--     SECURITY DEFINER STABLE, ce qui évite la récursion des policies sur
--     « profiles » et contourne RLS pour la seule jointure auth.uid().
--   * Aucune attribution de rôle (user_type/status/reseller_status) n'est
--     déductible des métadonnées éditables par l'utilisateur (T03).
-- ============================================================================

-- Extensions (idempotent) ----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Fonctions utilitaires
-- ----------------------------------------------------------------------------

-- Profil métier (profiles.id) de l'utilisateur authentifié.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
$$;

-- Profil client (customer_profiles.id) de l'utilisateur authentifié.
CREATE OR REPLACE FUNCTION public.current_customer_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM public.customer_profiles c
  JOIN public.profiles p ON p.id = c."profileId"
  WHERE p.auth_user_id = auth.uid()
$$;

-- Vrai si l'utilisateur authentifié est un membre du personnel actif portant le rôle ADMIN.
CREATE OR REPLACE FUNCTION public.current_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_profiles s
    JOIN public.profiles p ON p.id = s."profileId"
    JOIN public.roles r ON r.id = s."roleId"
    WHERE p.auth_user_id = auth.uid()
      AND s.active = true
      AND r.code = 'ADMIN'
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_customer_profile_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_is_admin() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Liaison auth.users <-> profiles (T03) : trigger idempotent + réparation
-- ----------------------------------------------------------------------------

-- Création idempotente du profil métier à l'inscription.
-- IMPORTANT : user_type et status sont FIXÉS par cette fonction ('CUSTOMER',
-- 'ACTIVE') et ne sont JAMAIS lus depuis raw_user_meta_data, qui est éditable
-- par l'utilisateur (doc 11, dev.md §6). L'attribution STAFF/ADMIN est un acte
-- serveur séparé (commande d'amorçage, décision D04).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_first text;
  v_last  text;
BEGIN
  INSERT INTO public.profiles (id, auth_user_id, "userType", status, "createdAt", "updatedAt")
  VALUES (gen_random_uuid(), NEW.id, 'CUSTOMER', 'ACTIVE', now(), now())
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_profile_id FROM public.profiles WHERE auth_user_id = NEW.id;
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_first := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''), '');
  v_last  := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'last_name'), ''), '');

  INSERT INTO public.customer_profiles (id, "profileId", "firstName", "lastName", "resellerStatus")
  VALUES (gen_random_uuid(), v_profile_id, v_first, v_last, 'NONE')
  ON CONFLICT ("profileId") DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Réparation des comptes orphelins : profils absents pour un auth.users
-- existant, ou client sans customer_profiles. Idempotente ; renvoie le nombre
-- de profils créés. À exécuter hors ligne (opérateur/service_role).
CREATE OR REPLACE FUNCTION public.repair_orphan_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created integer := 0;
BEGIN
  INSERT INTO public.profiles (id, auth_user_id, "userType", status, "createdAt", "updatedAt")
  SELECT gen_random_uuid(), u.id, 'CUSTOMER', 'ACTIVE', now(), now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.auth_user_id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (auth_user_id) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  INSERT INTO public.customer_profiles (id, "profileId", "firstName", "lastName", "resellerStatus")
  SELECT gen_random_uuid(), p.id, '', '', 'NONE'
  FROM public.profiles p
  LEFT JOIN public.customer_profiles c ON c."profileId" = p.id
  WHERE p."userType" = 'CUSTOMER' AND c.id IS NULL
  ON CONFLICT ("profileId") DO NOTHING;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_orphan_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_orphan_profiles() TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Reprise explicite des privilèges (Supabase accorde de larges GRANT par défaut)
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Activation de RLS sur toutes les tables (refus par défaut)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Catalogue public : véhicules publiés et images publiques (lecture seule)
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.vehicles       TO anon, authenticated;
GRANT SELECT ON public.vehicle_images TO anon, authenticated;

CREATE POLICY vehicles_select_published ON public.vehicles
  FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');

-- L'image n'est lisible que si elle est PUBLIQUE et rattachée à une fiche PUBLISHED.
CREATE POLICY vehicle_images_select_published ON public.vehicle_images
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'PUBLIC'
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_images."vehicleId" AND v.status = 'PUBLISHED'
    )
  );

-- NOTE : « brands » et « vehicle_models » ne reçoivent volontairement AUCUNE
-- policy de lecture (non listés dans le périmètre autorisé). Le catalogue les
-- référence via le serveur (rôle service_role). Une policy SELECT sur les lignes
-- « active = true » devra être ajoutée par décision explicite si un accès direct
-- depuis le client est requis.

-- ----------------------------------------------------------------------------
-- 6. Profil et profil client : lecture de sa ligne, mise à jour de sa ligne
--    limitée par des GRANT de colonnes (user_type, status, reseller_status protégés)
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.profiles TO authenticated;
-- profiles ne porte aucune colonne modifiable par le client : aucun GRANT UPDATE
-- n'est accordé (userType et status sont des champs serveur).
GRANT SELECT ON public.customer_profiles TO authenticated;
-- Mise à jour colonne par colonne : « profileId » et « resellerStatus » sont exclus.
GRANT UPDATE ("firstName", "lastName", phone, whatsapp, city, country)
  ON public.customer_profiles TO authenticated;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = public.current_profile_id());

CREATE POLICY customer_profiles_select_own ON public.customer_profiles
  FOR SELECT TO authenticated
  USING ("profileId" = public.current_profile_id());

CREATE POLICY customer_profiles_update_own ON public.customer_profiles
  FOR UPDATE TO authenticated
  USING ("profileId" = public.current_profile_id())
  WITH CHECK ("profileId" = public.current_profile_id());

-- ----------------------------------------------------------------------------
-- 7. Favoris et recherches enregistrées : CRUD de ses propres lignes
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;

CREATE POLICY favorites_select_own ON public.favorites
  FOR SELECT TO authenticated
  USING ("customerId" = public.current_customer_profile_id());
CREATE POLICY favorites_insert_own ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK ("customerId" = public.current_customer_profile_id());
CREATE POLICY favorites_update_own ON public.favorites
  FOR UPDATE TO authenticated
  USING ("customerId" = public.current_customer_profile_id())
  WITH CHECK ("customerId" = public.current_customer_profile_id());
CREATE POLICY favorites_delete_own ON public.favorites
  FOR DELETE TO authenticated
  USING ("customerId" = public.current_customer_profile_id());

CREATE POLICY saved_searches_select_own ON public.saved_searches
  FOR SELECT TO authenticated
  USING ("customerId" = public.current_customer_profile_id());
CREATE POLICY saved_searches_insert_own ON public.saved_searches
  FOR INSERT TO authenticated
  WITH CHECK ("customerId" = public.current_customer_profile_id());
CREATE POLICY saved_searches_update_own ON public.saved_searches
  FOR UPDATE TO authenticated
  USING ("customerId" = public.current_customer_profile_id())
  WITH CHECK ("customerId" = public.current_customer_profile_id());
CREATE POLICY saved_searches_delete_own ON public.saved_searches
  FOR DELETE TO authenticated
  USING ("customerId" = public.current_customer_profile_id());

-- ----------------------------------------------------------------------------
-- 8. Prospects, commandes et demandes : LECTURE de ses propres lignes uniquement.
--    Aucune policy INSERT/UPDATE/DELETE client : l'écriture passe par le serveur
--    (enveloppe de service, doc 10 / dev.md §6).
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.leads           TO authenticated;
GRANT SELECT ON public.orders          TO authenticated;
GRANT SELECT ON public.custom_requests TO authenticated;

CREATE POLICY leads_select_own ON public.leads
  FOR SELECT TO authenticated
  USING ("customerId" IS NOT NULL AND "customerId" = public.current_customer_profile_id());

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING ("customerId" = public.current_customer_profile_id());

CREATE POLICY custom_requests_select_own ON public.custom_requests
  FOR SELECT TO authenticated
  USING ("customerId" IS NOT NULL AND "customerId" = public.current_customer_profile_id());

-- NOTE : « order_events » et « vehicle_documents » sont en refus par défaut
-- (RLS activée, aucune policy) : journaux et pièces privées servis uniquement
-- par le serveur, qui émet des URL signées de courte durée (décision T09).

-- ----------------------------------------------------------------------------
-- 9. Buckets Storage (doc 11, doc 13 M05)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('vehicle-images',    'vehicle-images',    true,  NULL, NULL),
  ('vehicle-documents', 'vehicle-documents', false, NULL, NULL),
  ('avatars',           'avatars',           false, NULL, NULL),
  ('app-assets',        'app-assets',        false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- LIMITE CONNUE DU BUCKET vehicle-images (« public = true ») :
-- un bucket marqué public expose TOUS ses objets en lecture anonyme via l'URL
-- /storage/v1/object/public/vehicle-images/... , SANS passer par RLS. Les
-- policies ci-dessous ne gouvernent donc que l'accès via l'API Storage
-- authentifiée. L'exigence « variantes publiées uniquement » n'est garantie
-- que si les images sont servies par URL signée / proxy serveur. Si la
-- garantie au niveau du stockage est exigée, basculer ce bucket en
-- « public = false » par migration (l'application ne doit alors consommer que
-- des URL signées).
CREATE POLICY storage_vehicle_images_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND EXISTS (
      SELECT 1
      FROM public.vehicle_images vi
      JOIN public.vehicles v ON v.id = vi."vehicleId"
      WHERE vi.path = storage.objects.name
        AND vi.visibility = 'PUBLIC'
        AND v.status = 'PUBLISHED'
    )
  );

-- vehicle-documents : privé, aucune policy client (URL signées côté serveur,
-- durée paramétrée par STORAGE_SIGNED_URL_TTL_SECONDS, décision T09).

-- avatars : privé, propriétaire uniquement, convention de chemin <auth_uid>/...
CREATE POLICY storage_avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY storage_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY storage_avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY storage_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- app-assets : privé, écriture réservée aux administrateurs (rôle ADMIN actif).
-- Les privilèges de table sur storage.objects sont fournis par Supabase ; ce sont
-- les policies ci-dessous (RLS active par défaut sur storage.objects) qui bornent
-- l'accès. Aucun GRANT large n'est ajouté ici : seules les policies autorisent.
CREATE POLICY storage_app_assets_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-assets' AND public.current_is_admin());
CREATE POLICY storage_app_assets_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.current_is_admin());
CREATE POLICY storage_app_assets_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND public.current_is_admin())
  WITH CHECK (bucket_id = 'app-assets' AND public.current_is_admin());
CREATE POLICY storage_app_assets_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND public.current_is_admin());
