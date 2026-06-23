// Used in list/table display
export interface TaskType {
    id: number;
    taskId: string;            // was taskId
    name: string;              // was name (nom)
    parentTypeId?: number | null;
    errors?: number[];         // error IDs associated
}

// Full task type details
export interface TaskTypeDetail {
    id: number;
    taskId: string;
    name: string;
    parent?: {
        id: number;
        taskId: string;
        name: string;
    };
    subTypes?: {
        id: number;
        taskId: string;
        name: string;
    }[];
    errors?: {
        id: number;
        tag: string;
        description: string;
    }[];
    associatedExercises?: {
        id: number;
        title: string;
        description: string;
    }[];
    associatedComponents?: {
        id: number;
        tag: string;
        description: string;
    }[];
}
