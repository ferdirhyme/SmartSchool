import { createClient } from '@supabase/supabase-js';

// Environment-aware configuration
const getEnv = (key: string, fallback: string) => {
  const value = import.meta.env[key];
  return (value && value !== 'undefined' && value !== '') ? value : fallback;
};

// const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://xfiywyvzqboupxzwoxbx.supabase.co');
// const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmaXl3eXZ6cWJvdXB4endveGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzg1NDUsImV4cCI6MjA3NzgxNDU0NX0.gOQV1c0sXhQ7rICp8aT9UOaymV6tqHcFS11dYDrbNy8');

const supabaseUrl = 'https://ofdfytwrzougvxsmwkkb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZGZ5dHdyem91Z3Z4c213a2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODQ0NzgsImV4cCI6MjA5MTY2MDQ3OH0.paLyfVRmGBHZT8CQFnB-Y69dmYhDrcpHTCPwVkTu0Vw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
});

/**
 * Enterprise Service Response Pattern
 */
export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}
