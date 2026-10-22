// Crée le premier compte (administrateur du catalogue), sans invitation (spec technique §7.1).
// Usage :
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/create-admin.ts <email> <mot_de_passe> <nom_affiché>
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SETTINGS = {
  units: { weight: 'kg', length: 'cm', distance: 'km' },
  defaultRestS: 90,
  timerSound: true,
  keepAwake: true,
  theme: 'dark',
  restNotification: true,
  profileChart: 'count',
  progressionEnabled: true,
};

// Cette méthode permet de créer l'utilisateur confirmé et son profil administrateur lorsqu'on initialise un environnement.
async function main(): Promise<void> {
  const [email, password, displayName] = process.argv.slice(2);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !password || !displayName || !url || !key) {
    console.error('Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/create-admin.ts <email> <mdp> <nom>');
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    console.error('Création de l’utilisateur impossible :', error?.message);
    process.exit(1);
  }
  const { data: code, error: profileError } = await admin.rpc('admin_create_profile', {
    p_user_id: data.user.id,
    p_display_name: displayName,
    p_settings: DEFAULT_SETTINGS,
    p_is_admin: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error('Création du profil impossible :', profileError.message);
    process.exit(1);
  }
  const pretty = String(code).match(/.{1,4}/g)?.join('-');
  console.log(`Admin créé : ${email} (id ${data.user.id})`);
  console.log(`Code d'invitation : ${pretty}`);
}

void main();
