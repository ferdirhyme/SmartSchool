
import { supabase, ServiceResponse } from '../../lib/supabase.ts';
import { BaseService } from '../core/base.service.ts';

export interface LessonNote {
    id: string;
    school_id: string;
    teacher_id: string;
    week_ending: string;
    subject: string;
    class_name: string;
    term: string;
    strand: string;
    sub_strand?: string;
    days?: string;
    duration?: string;
    reference?: string;
    rpk?: string;
    core_competencies: string[];
    learning_indicators: string;
    tlms: string[];
    introduction?: string;
    presentation_steps: { step: string; activity: string }[];
    conclusion?: string;
    evaluation?: string;
    status: 'pending' | 'approved' | 'rejected';
    headteacher_remarks?: string;
    approved_at?: string;
    created_at: string;
    teacher?: { full_name: string };
}

export class LessonNoteService extends BaseService {
    protected table = 'lesson_notes';

    async createNote(note: Omit<LessonNote, 'id' | 'created_at' | 'status' | 'school_id' | 'teacher_id'>): Promise<ServiceResponse<LessonNote>> {
        try {
            const schoolId = await this.getSchoolId();
            if (!schoolId) throw new Error("No school context found.");

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from(this.table)
                .insert([{
                    ...note,
                    school_id: schoolId,
                    teacher_id: session.user.id,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }

    async getTeacherNotes(): Promise<ServiceResponse<LessonNote[]>> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from(this.table)
                .select('*')
                .eq('teacher_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }

    async getSchoolNotesForReview(): Promise<ServiceResponse<LessonNote[]>> {
        try {
            const schoolId = await this.getSchoolId();
            if (!schoolId) throw new Error("No school context found.");

            const { data, error } = await supabase
                .from(this.table)
                .select('*, teacher:profiles(full_name)')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }

    async updateStatus(id: string, status: 'approved' | 'rejected', remarks?: string): Promise<ServiceResponse<LessonNote>> {
        try {
            const updateData: any = { status, headteacher_remarks: remarks };
            if (status === 'approved') {
                updateData.approved_at = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from(this.table)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }

    async deleteNote(id: string): Promise<ServiceResponse<void>> {
        try {
            const { error } = await supabase
                .from(this.table)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { data: undefined, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }

    async updateNote(id: string, note: Partial<LessonNote>): Promise<ServiceResponse<LessonNote>> {
        try {
            const { data, error } = await supabase
                .from(this.table)
                .update(note)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: this.handleError(err) };
        }
    }
}

export const lessonNoteService = new LessonNoteService();
