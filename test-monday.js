const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('cases').select('id, patient_name, monday_item_id, created_at').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
check();
