import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve('./');
const envPath = path.join(projectRoot, '.env');
const outputPath = path.join(projectRoot, 'js', 'env-config.js');

if (!fs.existsSync(envPath)) {
  console.error('File .env tidak ditemukan di root proyek. Buat terlebih dahulu dengan SUPABASE_URL dan SUPABASE_ANON_KEY.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split(/\r?\n/);
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key] = rest.join('=');
}

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.error('File .env harus berisi SUPABASE_URL dan SUPABASE_ANON_KEY.');
  process.exit(1);
}

const jsContent = `export const SUPABASE_ENV = {
  SUPABASE_URL: ${JSON.stringify(env.SUPABASE_URL)},
  SUPABASE_ANON_KEY: ${JSON.stringify(env.SUPABASE_ANON_KEY)},
};\n`;

fs.writeFileSync(outputPath, jsContent, 'utf8');
console.log(`Berhasil membuat ${outputPath}`);
