
import { supabase } from './lib/supabase.ts';

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Hope this function exists or try raw query
  if (error) {
    // Try information_schema
    const { data: data2, error: error2 } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    console.log('Tables:', data2 || error2);
  } else {
    console.log('Tables:', data);
  }
}
