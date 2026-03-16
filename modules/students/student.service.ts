
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { Student } from '../../types.ts';
import { BaseService } from '../core/base.service.ts';

export class StudentService extends BaseService {
  protected table = 'students';

  async getAll(page: number = 1, pageSize: number = 20): Promise<ServiceResponse<{ students: Student[], total: number }>> {
    try {
      const schoolId = await this.getSchoolId();
      if (!schoolId) return { data: { students: [], total: 0 }, error: "No school context found." };
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await supabase
        .from(this.table)
        .select('*', { count: 'exact' })
        .eq('school_id', schoolId)
        .range(from, to)
        .order('full_name');

      if (error) throw error;
      return { data: { students: data, total: count || 0 }, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }

  async create(student: Partial<Student>): Promise<ServiceResponse<Student>> {
    try {
      const schoolId = await this.getSchoolId();
      if (!schoolId) return { data: null, error: "No school context found." };
      const { data, error } = await supabase
        .from(this.table)
        .insert({ ...student, school_id: schoolId })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: this.handleError(err) };
    }
  }
}

export const studentService = new StudentService();
