
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    async generateLessonPlan(request: LessonPlanRequest) {
        const prompt = `Act as an expert Ghanaian educator and curriculum specialist. Generate a detailed Weekly Lesson Plan strictly following the GES New Standard-Based Curriculum (SBC).
        
        CRITICAL CONTEXT: 
        - Ghanaian Academic Terms: Term 1 (Start of year, fundamental concepts), Term 2 (Building complexity), Term 3 (Consolidation and exam prep). Ensure the activities and depth are appropriate for ${request.term}.
        - Coding System: You MUST use official GES SBC codes for Content Standards (e.g., B7.1.1.1) and Learning Indicators (e.g., B7.1.1.1.1).
        
        Input Details:
        - Subject: ${request.subject}
        - Class: ${request.className}
        - Term: ${request.term}
        - Strand: ${request.strand}
        - Sub-strand: ${request.subStrand}
        - Number of Learning Indicators: ${request.indicatorCount || 1}
        
        The response should be in JSON format with the following structure:
        {
            "weekEnding": "Date (Friday of the week)",
            "subject": "${request.subject}",
            "className": "${request.className}",
            "term": "${request.term}",
            "strand": "Official Strand name",
            "subStrand": "Official Sub-strand name",
            "contentStandard": "Content Standard with official GES code (e.g., B7.2.1.1: ...)",
            "indicator": "Learning Indicator with official GES code (e.g., B7.2.1.1.1: ...). Provide exactly ${request.indicatorCount || 1} distinct indicators.",
            "rpk": "Relevant Previous Knowledge - specifically what students should have mastered in the previous grade or term to succeed in this lesson",
            "coreCompetencies": ["Competency 1", "Competency 2"],
            "keyWords": "Comma-separated key vocabulary",
            "learningResources": ["Specific TLM 1", "Specific TLM 2"],
            "introduction": "Detailed 5-10 minute introduction (Mental health starter, RPK check, link to lesson)",
            "presentationSteps": [
                { "step": "Step 1", "activity": "Introduction and RPK validation (Teacher & Learner activities)" },
                { "step": "Step 2", "activity": "Model the concept/demonstration (Teacher lead)" },
                { "step": "Step 3", "activity": "Guided practice / Collaborative tasks" },
                { "step": "Step 4", "activity": "Independent work / Assessment" }
            ],
            "conclusion": "Review, reflection, and wrap-up activities",
            "evaluation": "Evaluation and assessment tasks (Give 3-5 specific questions or tasks)"
        }`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });
            return JSON.parse(response.text || "{}");
        } catch (error) {
            console.error("AI Generation Error:", error);
            throw error;
        }
    },

    async generateSchemeOfLearning(request: SchemeOfLearningRequest) {
        const prompt = `Act as an expert Ghanaian curriculum developer. Generate a Termly Scheme of Learning based strictly on the GES Standard-Based Curriculum (SBC).
        
        Subject: ${request.subject}
        Class: ${request.className}
        Term: ${request.term}
        
        CRITICAL: All Content Standards and Indicators MUST use the official curriculum coding system (e.g., B8.2.1.1).
        
        Provide a logical 12-week progression of topics.
        
        The response should be in JSON format:
        {
            "scheme": [
                {
                    "week": 1,
                    "subStrand": "Detailed sub-strand name",
                    "contentStandard": "Specific content standard with code (e.g., B7.1.1.2)",
                    "indicators": "Learning indicators with codes (e.g., B7.1.1.2.1)",
                    "resources": "Specific resources/TLMs"
                },
                ...
            ]
        }`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });
            return JSON.parse(response.text || "{}");
        } catch (error) {
            console.error("AI Generation Error:", error);
            throw error;
        }
    }
};
