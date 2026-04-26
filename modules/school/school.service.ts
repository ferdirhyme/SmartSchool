
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { School, SubscriptionStatus, SchoolSettings } from '../../types.ts';
import { BaseService } from '../core/base.service.ts';

export class SchoolService extends BaseService {
  protected table = 'schools';

  async getAllSchools(): Promise<ServiceResponse<School[]>> {
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

  async createSchool(name: string): Promise<ServiceResponse<School>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .insert({ name, status: SubscriptionStatus.Active })
        .select()
        .single();

      if (error) throw error;

      // Initialize default settings
      await supabase.from('school_settings').insert({
        id: data.id,
        school_name: name,
        currency: 'GHS',
        theme: 'light'
      });

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async registerSchool(name: string, adminId: string): Promise<ServiceResponse<School>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .insert({ name, status: SubscriptionStatus.Active }) // Default to Active instead of Trial
        .select()
        .single();

      if (error) throw error;

      // Link admin to school
      await supabase
        .from('profiles')
        .update({ school_id: data.id, is_onboarded: true })
        .eq('id', adminId);

      // Initialize default settings for the new school
      await supabase.from('school_settings').insert({
        id: data.id, // Use school ID as settings ID for 1:1 mapping
        school_name: name,
        currency: 'GHS',
        theme: 'light'
      });

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async getMySchool(): Promise<ServiceResponse<School>> {
    try {
      const schoolId = await this.getSchoolId();
      if (!schoolId) return { data: null, error: "No school context found." };

      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .eq('id', schoolId)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async getMySchoolSettings(): Promise<ServiceResponse<SchoolSettings>> {
    try {
      const schoolId = await this.getSchoolId();
      if (!schoolId) return { data: null, error: "No school context found." };

      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .eq('id', schoolId)
        .single();
      
      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async deleteSchool(schoolId: string, reason: string, adminId: string): Promise<ServiceResponse<boolean>> {
    try {
      // 1. Log the deletion in audit_logs first (since it will cascade delete the logs later, 
      // this is mainly for the moment of action, or we could have a separate platform_logs table)
      await supabase.from('audit_logs').insert({
        school_id: schoolId,
        user_id: adminId,
        action: 'DELETE_SCHOOL',
        entity_type: 'school',
        entity_id: schoolId,
        new_data: { reason }
      });

      // 2. Perform the deletion
      const { error } = await supabase
        .from(this.table)
        .delete()
        .eq('id', schoolId);

      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: this.handleError(err) };
    }
  }

  /**
   * Simplified check that always returns true now that subscriptions are disabled.
   */
  async checkSubscription(): Promise<boolean> {
    return true;
  }
}

export const schoolService = new SchoolService();
