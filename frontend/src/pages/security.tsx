import {
    Box,
    VStack,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
    Container,
    HStack,
    Spacer,
    InputGroup,
    InputRightElement,
    IconButton,
    Text,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon, CheckIcon, CloseIcon } from "@chakra-ui/icons";
import { useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import withAuthProtection from "@/hoc/withAuthProtection";
import axiosInstance from "@/utils/axiosInstance";

const SecurityPage = () => {
    const router = useRouter();
    const toast = useToast();

    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const passwordRules = [
        {
            label: "At least 8 characters",
            test: (pw: string) => pw.length >= 8,
        },
        {
            label: "At least one uppercase letter",
            test: (pw: string) => /[A-Z]/.test(pw),
        },
        {
            label: "At least one lowercase letter",
            test: (pw: string) => /[a-z]/.test(pw),
        },
        {
            label: "At least one number",
            test: (pw: string) => /\d/.test(pw),
        },
        {
            label: "At least one special character",
            test: (pw: string) => /[!@#$%^&*()_\-+=<>?{}[\]~]/.test(pw),
        },
    ];

    const isPasswordStrong = (pw: string) => passwordRules.every((rule) => rule.test(pw));

    const handleChangePassword = async () => {
        if (!password.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            toast({
                title: "Please fill all fields",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        if (!isPasswordStrong(newPassword)) {
            toast({
                title: "Password does not meet all security requirements",
                status: "error",
                duration: 4000,
                isClosable: true,
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({
                title: "Passwords do not match",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        try {
            const res = await axiosInstance.post("/api/users/change-password", {
                oldPassword: password,
                newPassword,
            });

            toast({
                title: "Password changed successfully!",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            setPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || "Password change failed",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    return (
        <Container maxW="lg" py={10}>
            <HStack mb={6}>
                <Button
                    size="sm"
                    variant="ghost"
                    colorScheme="blue"
                    onClick={() => router.push("/dashboard")}
                >
                    ← Back to Dashboard
                </Button>
                <Spacer />
            </HStack>

            <Box bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 6, md: 10 }}>
                <VStack spacing={6} align="stretch">
                    {/* Current Password */}
                    <FormControl isRequired>
                        <FormLabel>Current Password</FormLabel>
                        <InputGroup>
                            <Input
                                type={showCurrent ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your current password"
                            />
                            <InputRightElement>
                                <IconButton
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Toggle password visibility"
                                    icon={showCurrent ? <ViewOffIcon /> : <ViewIcon />}
                                    onClick={() => setShowCurrent(!showCurrent)}
                                />
                            </InputRightElement>
                        </InputGroup>
                    </FormControl>

                    {/* New Password */}
                    <FormControl isRequired>
                        <FormLabel>New Password</FormLabel>
                        <InputGroup>
                            <Input
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                            />
                            <InputRightElement>
                                <IconButton
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Toggle password visibility"
                                    icon={showNew ? <ViewOffIcon /> : <ViewIcon />}
                                    onClick={() => setShowNew(!showNew)}
                                />
                            </InputRightElement>
                        </InputGroup>

                        {/* Password rules */}
                        <VStack mt={2} align="start" spacing={1}>
                            {passwordRules.map((rule, index) => {
                                const passed = rule.test(newPassword);
                                return (
                                    <HStack key={index}>
                                        {passed ? (
                                            <CheckIcon color="green.500" boxSize={3} />
                                        ) : (
                                            <CloseIcon color="red.500" boxSize={3} />
                                        )}
                                        <Text fontSize="sm" color={passed ? "green.600" : "red.500"}>
                                            {rule.label}
                                        </Text>
                                    </HStack>
                                );
                            })}
                        </VStack>
                    </FormControl>

                    {/* Confirm New Password */}
                    <FormControl isRequired>
                        <FormLabel>Confirm New Password</FormLabel>
                        <InputGroup>
                            <Input
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                            />
                            <InputRightElement>
                                <IconButton
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Toggle password visibility"
                                    icon={showConfirm ? <ViewOffIcon /> : <ViewIcon />}
                                    onClick={() => setShowConfirm(!showConfirm)}
                                />
                            </InputRightElement>
                        </InputGroup>
                    </FormControl>

                    <Button colorScheme="red" onClick={handleChangePassword}>
                        Change Password
                    </Button>
                </VStack>
            </Box>
        </Container>
    );
};

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? "fr", ["common"])),
        },
    };
};

export default withAuthProtection(SecurityPage);
