// types/project.ts
export interface Project {
    id: number;
    name: string;
    description?: string;
    auteurs: User[];
    editeurs: User[];
}

export interface ProjectListItem {
    id: number;
    name: string;
    description?: string;
    created_at: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
}
