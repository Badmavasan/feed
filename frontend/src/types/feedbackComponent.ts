
export type FeedbackComponent = {
    id: number;
    tag: string;
    description?: string;
    nature: "technique" | "logos" | "exemple" | "erreur_pointée";
    pointedError: boolean;
    pointedErrorIds?: number[];       // 后端和前端均使用 id（number）
    associatedExerciseIds?: number[]; // 练习关联 ID
    associatedTypeIds?: number[];             // 任务类型 ID
} & (
    | { type: "Text"; content: string }
    | { type: "Image"; content: string }  // base64 字符串
    | { type: "Code"; content: string }
    );

export type FeedbackComponentDetail = FeedbackComponent & {
    associatedTypes?: {
        id: number;
        taskId: string;
        name: string;
    }[];
    associatedExercises?: {
        id: number;
        title: string;
        description: string;
    }[];
    pointedError?: {
        id: number;
        tag: string;
        description: string;
    }[];
    referencedFeedbacks?: {
        id: number;
        feedback_code: string;
        description?: string;
    }[];
};

