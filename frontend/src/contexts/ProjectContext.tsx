import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import axiosInstance from "@/utils/axiosInstance";
import {useAuthContext} from "@/contexts/AuthContext";

export interface Project {
    id: number;
    name: string;
}

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    refreshProjects: () => Promise<void>;
    loading: boolean;
}

export const ProjectContext = createContext<ProjectContextType>({
    projects: [],
    currentProject: null,
    setCurrentProject: () => {},
    refreshProjects: async () => {},
    loading: true,
});

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const { currentUser, loading: authLoading } = useAuthContext();

    const updateCurrentProject = (project: Project | null) => {
        setCurrentProject(project);
        if (project) {
            localStorage.setItem("currentProject", JSON.stringify(project));
        } else {
            localStorage.removeItem("currentProject");
        }
    };

    const refreshProjects = async () => {
        try {
            const res = await axiosInstance.get("/api/projects/mine");
            const data: Project[] = res.data;
            setProjects(data);

            const saved = localStorage.getItem("currentProject");
            if (saved) {
                const parsed = JSON.parse(saved);
                const found = data.find(p => p.id === parsed.id);
                if (found) {
                    updateCurrentProject(found);
                    return;
                }
            }

            if (data.length > 0) {
                updateCurrentProject(data[0]); // 默认选中第一个
            } else {
                updateCurrentProject(null);
            }
        } catch (err) {
            console.error("项目获取失败", err);
            setProjects([]);
            updateCurrentProject(null);
        }
    };



    useEffect(() => {
        if (!authLoading && currentUser) {
            refreshProjects().finally(() => setLoading(false));
        } else if (!authLoading && !currentUser) {
            // 未登录状态，清空项目
            setProjects([]);
            updateCurrentProject(null);
            setLoading(false);
        }
    }, [authLoading, currentUser]);


    return (
        <ProjectContext.Provider
            value={{
                projects,
                currentProject,
                setCurrentProject: updateCurrentProject,
                refreshProjects,
                loading,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
};
