"use client";

import { useState, useEffect } from "react";
import { MOCK_PROJECTS } from "./mockData";
import { Project } from "./api";

const STORAGE_KEY = "clinicflow_projects";

function loadProjects(): Project[] {
    if (typeof window === "undefined") return MOCK_PROJECTS;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return MOCK_PROJECTS;
}

function saveProjects(projects: Project[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch { }
}

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Load from localStorage on client mount
        const stored = loadProjects();
        setProjects(stored);
        setLoaded(true);
    }, []);

    function addProject(project: Project) {
        setProjects((prev) => {
            const updated = [project, ...prev];
            saveProjects(updated);
            return updated;
        });
    }

    function updateProject(id: number, changes: Partial<Project>) {
        setProjects((prev) => {
            const updated = prev.map((p) => (p.id === id ? { ...p, ...changes } : p));
            saveProjects(updated);
            return updated;
        });
    }

    function deleteProject(id: number) {
        setProjects((prev) => {
            const updated = prev.filter((p) => p.id !== id);
            saveProjects(updated);
            return updated;
        });
    }

    function getProject(id: number): Project | undefined {
        return projects.find((p) => p.id === id);
    }

    return { projects, loaded, addProject, updateProject, deleteProject, getProject };
}
