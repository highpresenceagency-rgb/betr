import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && !supabaseUrl.includes('your-project-ref');

if (__DEV__ && !isSupabaseConfigured) {
  console.warn(
    '[Bettr] Supabase credentials not set. Create a .env in the project root with ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. The app will still boot ' +
      '(e.g. to browse the UI in guest mode), but no data will load until you add them.',
  );
}

// Fall back to a syntactically-valid placeholder when credentials are missing so
// createClient() doesn't throw "supabaseUrl is required" and white-screen the app
// on launch. With the placeholder, network calls simply return empty results.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
