
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { StudentProfile } from '../../types.ts';
import { BaseService } from '../core/base.service.ts';

export class StudentService extends BaseService {
  protected table = 'students';

  async expelStudent(studentId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { error } = await supabase
        .from(this.table)
        .delete()
        .eq('id', studentId);

      if (error) throw error;
      return { data: true, error: null };
    } catch (err: any) {
      return { data: false, error: this.handleError(err) };
    }
  }

  async getStudentsBySchool(schoolId: string): Promise<ServiceResponse<StudentProfile[]>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*, class:classes(id, name)')
        .eq('school_id', schoolId)
        .order('full_name');

      if (error) throw error;
      return { data: data as StudentProfile[], error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }
}

export const studentService = new StudentService();
