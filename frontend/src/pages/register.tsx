import {
    Box, Button, FormControl, FormLabel, Heading, Input,
    Stack, Text, useToast, VStack, Link, Select
} from "@chakra-ui/react";
import { useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import withAuthProtection from "@/hoc/withAuthProtection";

function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("auteur");
    const toast = useToast();
    const router = useRouter();

    const handleRegister = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
            await axios.post(`${apiBase}/api/auth/register`, {
                email,
                password,
                name,
                role,
            });

            toast({
                title: "Compte créé avec succès",
                description: "Vous pouvez maintenant vous connecter",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            // 不自动登录，直接跳转到登录页
            router.push("/login");

        } catch (err) {
            let message = "Error inconnue";

            if (axios.isAxiosError(err) && err.response) {
                message = err.response.data.message || message;
            }

            toast({
                title: "Erreur",
                description: message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };


    return (
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
            <Box bg="white" p={8} rounded="md" shadow="md" w="full" maxW="md">
                <VStack spacing={4} align="start">
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

                    <FormControl isRequired>
                        <FormLabel>Rôle</FormLabel>
                        <Select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="auteur">Auteur</option>
                            <option value="admin">Admin</option>
                        </Select>
                    </FormControl>

                    <Button colorScheme="blue" w="full" onClick={handleRegister}>
                        S'inscrire
                    </Button>

                    <Text fontSize="sm" textAlign="center" w="full">
                        Vous avez déjà un compte ?{" "}
                        <Link href="/login" color="blue.500">Se connecter</Link>
                    </Text>
                </VStack>
            </Box>
        </Box>
    );
}

export default withAuthProtection(RegisterForm);
