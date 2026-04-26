
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { Profile, UserRole } from '../../types.ts';
import { BaseService } from './base.service.ts';

export class ProfileService extends BaseService {
  protected table = 'profiles';

  async getPendingHeadteachers(): Promise<ServiceResponse<Profile[]>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .eq('role', UserRole.Headteacher)
        .is('school_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async getPendingTeachers(schoolId?: string): Promise<ServiceResponse<Profile[]>> {
    try {
      let query = supabase
        .from(this.table)
        .select('*')
        .eq('role', UserRole.Teacher)
        .order('created_at', { ascending: false });

      if (schoolId) {
        // Headteacher view: Teachers assigned to their school but not yet onboarded
        query = query.eq('school_id', schoolId).eq('is_onboarded', false);
      } else {
        // Admin view: Teachers not yet assigned to any school
        query = query.is('school_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async assignUserToSchool(profileId: string, schoolId: string): Promise<ServiceResponse<Profile>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .update({ 
          school_id: schoolId,
          is_onboarded: false // Ensure they still need Headteacher authorization
        })
        .eq('id', profileId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async authorizeUser(profileId: string, schoolId: string): Promise<ServiceResponse<Profile>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .update({ 
          school_id: schoolId, 
          is_onboarded: true 
        })
        .eq('id', profileId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async authorizeHeadteacher(profileId: string, schoolId: string): Promise<ServiceResponse<Profile>> {
    return this.authorizeUser(profileId, schoolId);
  }

  async getAllProfiles(): Promise<ServiceResponse<Profile[]>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async updateUserRole(profileId: string, newRole: UserRole): Promise<ServiceResponse<Profile>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .update({ role: newRole })
        .eq('id', profileId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async updateUserSuspension(profileId: string, isSuspended: boolean): Promise<ServiceResponse<Profile>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .update({ is_suspended: isSuspended })
        .eq('id', profileId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }
}

export const profileService = new ProfileService();
