const { createClient } = require('@supabase/supabase-js');

const url = 'https://yalhmltmslfaegaoppku.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhbGhtbHRtc2xmYWVnYW9wcGt1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExNjYyMywiZXhwIjoyMTA0NjkyNjIzfQ.scKerzhPw3eAaZG6KoINLaZVpsW3yskxCdpLsU9Q__U';

const supabase = createClient(url, serviceKey);

async function testConnection() {
  console.log('Testing Supabase Connection to:', url);
  try {
    const { data, error } = await supabase.from('leads').select('*').limit(5);
    if (error) {
      console.log('Query result:', error.message);
      if (error.message.includes('relation "public.leads" does not exist')) {
        console.log('\n--> NOTICE: The tables are not created in Supabase yet.');
        console.log('--> Please run the SQL schema script in your Supabase SQL Editor: supabase/schema.sql');
      }
    } else {
      console.log('Successfully connected to Supabase DB! Existing leads count:', data.length);
    }
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

testConnection();
