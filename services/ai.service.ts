

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
    },

    async generateMigration(schema: any, requirements: string, targetSchema?: string): Promise<string> {
        // In a real app, this would call a Gemini model
        // For this demo/tool, we'll return a prompt that the user can copy
        // Or we could actually perform the call if GEMINI_API_KEY is available.
        console.log("Generating migration for:", requirements, !!targetSchema);
        return `-- Migration generated for: ${requirements}\n-- Comparison with Repository SQL: ${targetSchema ? 'Enabled' : 'Disabled'}\n-- Please run this in your SQL Editor\n\nBEGIN;\n\n-- AI will generate specific SQL here\n\nCOMMIT;`;
    }
};
