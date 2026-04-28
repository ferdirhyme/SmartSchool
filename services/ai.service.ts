

export interface LessonPlanRequest {
    subject: string;
    className: string;
    term: string;
    strand: string;
    subStrand: string;
    topic: string;
    reference?: string;
    indicatorCount?: number;
}

export interface SchemeOfLearningRequest {
    subject: string;
    className: string;
    term: string;
}

export const aiService = {
    async generateLessonPlan(_request: LessonPlanRequest): Promise<any> {
        throw new Error("AI Lesson Plan generation is currently disabled.");
    },

    async generateSchemeOfLearning(_request: SchemeOfLearningRequest): Promise<any> {
        throw new Error("AI Scheme of Learning generation is currently disabled.");
    }
};
