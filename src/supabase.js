import { createClient } from '@supabase/supabase-js'

// Correctly formatted Supabase URL (extracted from your Anon Key)
const supabaseUrl = 'https://yrwfdnpwwefdyujkccyn.supabase.co';

// Your Anon Key wrapped in quotes so it doesn't cause a syntax error
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd2ZkbnB3d2VmZHl1amtjY3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODQ0NzksImV4cCI6MjA5MzA2MDQ3OX0._Dhz7coYqO4kj88tyN48aTXFOLlliwwrg_3yD2tG_kA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
