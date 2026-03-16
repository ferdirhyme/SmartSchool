
import { supabase, ServiceResponse } from '../../lib/supabase.ts';

export abstract class BaseService {
  protected abstract table: string;

  protected async getSchoolId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (error) return null;
    return profile?.school_id || null;
  }

  protected handleError(error: any): string {
    // Only log actual unexpected errors, not simple context issues
    if (error.message !== "No school context found.") {
      console.error(`[${this.table} Service Error]:`, error);
    }

    // Map Postgres/Supabase error codes to user-friendly messages
    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          if (error.message?.includes('email')) return "This email address is already registered.";
          if (error.message?.includes('admission_number')) return "This admission number is already in use.";
          if (error.message?.includes('staff_id')) return "This staff ID is already in use.";
          if (error.message?.includes('subdomain')) return "This school subdomain is already taken.";
          return "A record with this information already exists.";
        
        case '23503': // foreign_key_violation
          return "This action cannot be completed because it refers to a record that does not exist.";
        
        case '23502': // not_null_violation
          return "Please fill in all required fields.";
        
        case '42P01': // undefined_table
          return "System configuration error: Table not found.";
        
        case 'PGRST116': // No rows returned for .single()
          return "The requested information could not be found.";
          
        case '42703': // undefined_column
          return "System configuration error: Database schema mismatch.";
      }
    }

    // Handle common auth errors if they bubble up here
    if (error.message === 'Invalid login credentials') return "Incorrect email or password.";
    if (error.message === 'Email not confirmed') return "Please verify your email address before signing in.";
    
    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return "Network error: Unable to connect to the server. Please check your internet connection or if the database is paused.";
    }

    return error.message || "An unexpected error occurred. Please try again later.";
  }
}
