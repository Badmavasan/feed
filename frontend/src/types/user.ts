// types/user.ts

export interface ModulePermission {
    create: boolean;
    update: boolean;
    delete: boolean;
}

export interface User {
    id: number;
    name: string;
    email: string;
    role: 'auteur' | 'admin' | 'super_admin';
    isActive: boolean;
    avatar_url?: string;
    permissions?: Record<string, ModulePermission>;
}

export type ModuleName = 'taskType' | 'error' | 'exercise' | 'component' | 'feedback';

export type PermissionType = 'create' | 'update' | 'delete';

export type Permissions = {
    [module in ModuleName]?: {
        [action in PermissionType]?: boolean;
    };
};

export interface NewUser {
    name: string;
    email: string;
    role: 'auteur' | 'admin' | 'super_admin';
    permissions?: Permissions;
}
