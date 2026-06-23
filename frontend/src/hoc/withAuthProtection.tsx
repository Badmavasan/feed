
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/contexts/AuthContext";

function withAuthProtection<P extends object>(WrappedComponent: React.ComponentType<P>): React.FC<P> {
    const ProtectedComponent: React.FC<P> = (props) => {
        const { currentUser, loading } = useAuthContext();
        const router = useRouter();

        useEffect(() => {
            if (!loading && !currentUser) {
                router.push("/login");
            }
        }, [loading, currentUser]);

        if (loading || !currentUser) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };

    ProtectedComponent.displayName = `withAuthProtection(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

    return ProtectedComponent;
}

export default withAuthProtection;
