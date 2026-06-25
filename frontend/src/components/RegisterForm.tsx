import {
    Box, Button, FormControl, FormLabel, Heading, Input,
     Text, useToast, VStack, Select, Link
} from "@chakra-ui/react";
import { useState } from "react";
import { useRouter } from "next/router";
import { withBasePath } from "@/utils/assetUrl";

export default function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("auteur");
    const toast = useToast();
    const router = useRouter();

    const handleRegister = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
            const res = await fetch(`${apiBase}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name, role }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            // 保存登录信息
            localStorage.setItem("token", data.token);
            localStorage.setItem("currentUser", JSON.stringify(data.user));

            toast({
                title: "Compte créé avec succès",
                status: "success",
                duration: 2000,
                isClosable: true,
            });

            if (data.user.role === "admin" || data.user.role === "super_admin") {
                router.push("/admin/dashboard");
            } else {
                router.push("/dashboard");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error inconnue";
            toast({
                title: "Error d'inscription",
                description: msg,
                status: "error",
                duration: 2000,
                isClosable: true,
            });
        }
    };

    return (
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
            <Box p={8} bg="white" rounded="md" shadow="md" w="full" maxW="md">
                <VStack spacing={4} align="stretch">
                    <Heading size="lg">Créer un compte</Heading>

                    <FormControl isRequired>
                        <FormLabel>Nom</FormLabel>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel>Email</FormLabel>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel>Mot de passe</FormLabel>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </FormControl>

                    <FormControl>
                        <FormLabel>Rôle (optionnel)</FormLabel>
                        <Select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="auteur">Auteur</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </Select>
                    </FormControl>

                    <Button colorScheme="blue" onClick={handleRegister}>S’inscrire</Button>

                    <Text fontSize="sm" textAlign="center">
                        Déjà un compte ? <Link color="blue.500" href={withBasePath("/login")}>Se connecter</Link>
                    </Text>
                </VStack>
            </Box>
        </Box>
    );
}
