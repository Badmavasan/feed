import { withBasePath } from "@/utils/assetUrl";

export const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.href = withBasePath("/login");
};
