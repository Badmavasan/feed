// 类型用于：列表展示、分页加载
export interface Exercise {
    id: number;
    title: string;
    description: string;
    correctCodes: string[];
    type: "CODE" | "QCM" | "MULTI_QCM" | "FILL_IN_BLANK";
}

// 类型用于：编辑和详情查看（带选项与 taskType 信息）
export interface ExerciseDetail {
    id: number;
    title: string;
    description: string;
    correctCodes?: string[];
    correctTexts?: string[];
    type: "CODE" | "QCM" | "MULTI_QCM" | "FILL_IN_BLANK";
    choices?: { text: string; isCorrect: boolean }[];
    associatedTypes?: {
        id: number;
        taskId: string;
        name: string;
    }[];
}
