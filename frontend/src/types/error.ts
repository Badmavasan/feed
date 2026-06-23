
export interface Error {
    id: number;
    tag: string;
    description: string;
}

export interface ErrorDetail {
    id: number;
    tag: string;
    description: string;
    associatedTypes?: {
        id: number;
        taskId: string;
        name: string;
    }[];
}
