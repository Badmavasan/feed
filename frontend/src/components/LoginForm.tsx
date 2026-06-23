import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Heading,
    Input,
    Link,
    Stack,
    Text,
    useToast,
    VStack,
    InputGroup,
    InputRightElement,
    IconButton,
} from "@chakra-ui/react";
import { useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";

import axiosInstance from "@/utils/axiosInstance";
import axios from "axios";
import LanguageSwitcher from "./LanguageSwitcher";
import { useAuthContext } from "@/contexts/AuthContext";
import {useProjectContext} from "@/contexts/ProjectContext";

export default function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const toast = useToast();
    const router = useRouter();
    const { t } = useTranslation("common");
    const { login } = useAuthContext();

    const { setCurrentProject } = useProjectContext();

    const handleLogin = async () => {
        try {
            const res = await axiosInstance.post("/api/auth/login", { email, password });
            console.log(res)
            const { token, user } = res.data;

            // 使用 AuthContext login 方法
            login(user, token);

            // 登录成功后获取当前项目并跳转
            try {
                const resProjects = await axiosInstance.get("/api/projects/mine");
                const projects = resProjects.data;

                if (projects.length > 0) {
                    const firstProject = projects[0];
                    setCurrentProject(firstProject);
                }

                router.push("/dashboard");
            } catch (err) {
                console.error("Failed to get the current user's project list:", err);
                router.push("/dashboard");
            }

            toast({
                title: t("login.success"),
                status: "success",
                duration: 2000,
                isClosable: true,
            });
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.log(" Axios error:", err.response?.data);
                const { code, message } = err.response?.data || {};
                let errorMsg = t("login.unknownError");

                if (code === "MISSING_FIELDS") {
                    errorMsg = t("login.missingFields");
                } else if (code === "INVALID_CREDENTIALS") {
                    errorMsg = t("login.invalidCredentials");
                } else if (code === "USER_INACTIVE") {
                    errorMsg = t("login.userInactive");
                } else if (message) {
                    errorMsg = message;
                }

                toast({
                    title: t("login.error"),
                    description: errorMsg,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            } else {
                console.log(" Non-Axios error:", err);
                toast({
                    title: t("login.error"),
                    description: t("login.unknownError"),
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        }
    };

    return (
        <Box minH="100vh" display="flex" bg="gray.50">
            {/* 左侧插图和标题 */}
            <Box
                flex="1"
                bg="blue.700"
                color="white"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                px={10}
            >
                <Heading as="h1" size="2xl" mb={4}>
                    {t("login.heading")}
                </Heading>
                <img
                    src="/login-illustration.png"
                    alt="Illustration"
                    style={{ maxWidth: "300px", objectFit: "contain", marginTop: "1rem" }}
                />
            </Box>

            {/* 右侧登录表单 */}
            <Box flex="1" p={10} display="flex" flexDirection="column" bg="white">
                <Box w="full" display="flex" justifyContent="flex-end" position="sticky" top={4} mb={6}>
                    <LanguageSwitcher />
                </Box>
                <Box display="flex" alignItems="center" justifyContent="center" flex="1">
                    <Stack spacing={6} w="full" maxW="md">
                        <VStack spacing={1} align="start">
                            <Heading fontSize="2xl">{t("login.title")}</Heading>
                            <Text fontSize="sm" color="gray.500">
                                {t("login.subtitle")}
                            </Text>
                        </VStack>

                        <FormControl isRequired>
                            <FormLabel>{t("login.emailLabel")}</FormLabel>
                            <Input
                                type="email"
                                placeholder={t("login.emailPlaceholder")}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </FormControl>

                        <FormControl isRequired>
                            <FormLabel>{t("login.passwordLabel")}</FormLabel>
                            <InputGroup>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t("login.passwordPlaceholder")}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <InputRightElement>
                                    <IconButton
                                        variant="ghost"
                                        size="sm"
                                        aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                                        onClick={() => setShowPassword(!showPassword)}
                                    />
                                </InputRightElement>
                            </InputGroup>
                        </FormControl>

                        <Checkbox colorScheme="blue" defaultChecked>
                            {t("login.remember")}
                        </Checkbox>

                        <Button colorScheme="blue" size="lg" onClick={handleLogin}>
                            {t("login.button")}
                        </Button>

                        <Text textAlign="center" fontSize="sm">
                            {t("login.noAccount")}{" "}
                            <Link href="/register" color="blue.500">
                                {t("login.register")}
                            </Link>
                        </Text>
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
}





