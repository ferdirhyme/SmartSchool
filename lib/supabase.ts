
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xfiywyvzqboupxzwoxbx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmaXl3eXZ6cWJvdXB4endveGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzg1NDUsImV4cCI6MjA3NzgxNDU0NX0.gOQV1c0sXhQ7rICp8aT9UOaymV6tqHcFS11dYDrbNy8';

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
