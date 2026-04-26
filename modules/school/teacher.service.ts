
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { BaseService } from '../core/base.service.ts';

export interface AssignedClass {
    id: string;
    name: string;
}

export interface AssignedSubject {
    id: string;
    name: string;
}

export class TeacherService extends BaseService {
    protected table = 'teachers';

    async getMyAssignments(): Promise<ServiceResponse<{ classes: AssignedClass[], subjects: AssignedSubject[] }>> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // Find teacher record by email
            const { data: teacher, error: teacherError } = await supabase
                .from('teachers')
                .select('id')
                .eq('email', session.user.email)
                .maybeSingle();

            if (teacherError) throw teacherError;
            if (!teacher) return { data: { classes: [], subjects: [] }, error: null };

            // Fetch assigned classes
            const { data: classData, error: classError } = await supabase
                .from('teacher_classes')
                .select('classes(id, name)')
                .eq('teacher_id', teacher.id);

            if (classError) throw classError;

            // Fetch assigned subjects
            const { data: subjectData, error: subjectError } = await supabase
                .from('teacher_subjects')
                .select('subjects(id, name)')
                .eq('teacher_id', teacher.id);

            if (subjectError) throw subjectError;

            return {
                data: {
                    classes: (classData || []).map((item: any) => item.classes).filter(Boolean),
                    subjects: (subjectData || []).map((item: any) => item.subjects).filter(Boolean)
                },
                error: null
            };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }
}

export const teacherService = new TeacherService();
