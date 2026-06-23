import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { User } from "@/types/user";

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    login: () => {},
    logout: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const user = localStorage.getItem("currentUser");
        const token = localStorage.getItem("token");

        if (user && token) {
            setCurrentUser(JSON.parse(user));
        } else {
            setCurrentUser(null);
        }

        setLoading(false);
    }, []);

    const login = (user: User, token: string) => {
        localStorage.setItem("currentUser", JSON.stringify(user));
        localStorage.setItem("token", token);
        setCurrentUser(user);
    };

    const logout = () => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("token");
        localStorage.removeItem("currentProject");
        setCurrentUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
