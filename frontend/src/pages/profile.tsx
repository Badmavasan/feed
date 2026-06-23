import {
    Box,
    Text,
    Input,
    Button,
    VStack,
    FormControl,
    FormLabel,
    FormErrorMessage,
    Avatar,
    AvatarBadge,
    IconButton,
    useToast,
    Container,
    HStack,
    Spacer,
} from "@chakra-ui/react";
import { useState, useEffect, ChangeEvent } from "react";
import { storageService } from "@/utils/storageService";
import { SmallCloseIcon } from "@chakra-ui/icons";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import withAuthProtection from "@/hoc/withAuthProtection";

interface User {
    name: string;
    email: string;
    avatarUrl?: string;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const ProfilePage = () => {
    const router = useRouter();
    const [user, setUser] = useState<User>({ name: "", email: "", avatarUrl: undefined });
    const [emailError, setEmailError] = useState("");
    const [avatarError, setAvatarError] = useState("");
    const toast = useToast();

    useEffect(() => {
        const storedUser = storageService.get<User>("user");
        if (storedUser) {
            setUser(storedUser);
        }
    }, []);

    useEffect(() => {
        storageService.set<User>("user", user);
    }, [user]);

    const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
        setAvatarError("");
        const file = e.target.files?.[0];
        if (!file) return;

        if (!["image/jpeg", "image/png"].includes(file.type)) {
            setAvatarError("Only JPG and PNG are allowed.");
            return;
        }

        if (file.size > MAX_AVATAR_SIZE) {
            setAvatarError("File size exceeds 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setUser((prev) => ({ ...prev, avatarUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveAvatar = () => {
        setUser((prev) => ({ ...prev, avatarUrl: undefined }));
    };

    const handleSave = () => {
        if (!user.name.trim()) {
            toast({ title: "Name is required.", status: "error" });
            return;
        }
        if (!user.email.trim() || !isValidEmail(user.email)) {
            toast({ title: "Invalid email.", status: "error" });
            return;
        }

        toast({ title: "Profile saved successfully!", status: "success" });

        setTimeout(() => {
            router.push("/dashboard");
        }, 1000);
    };

    const handleEmailChange = (value: string) => {
        setUser((prev) => ({ ...prev, email: value }));
        if (value && !isValidEmail(value)) {
            setEmailError("Invalid email address.");
        } else {
            setEmailError("");
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

            <Box
                bg="white"
                borderRadius="xl"
                boxShadow="lg"
                p={{ base: 6, md: 10 }}
            >
                <VStack spacing={6} align="stretch">
                    <Text fontSize="2xl" fontWeight="bold" textAlign="center">
                        My Profile
                    </Text>

                    <FormControl>
                        <FormLabel>Profile Picture</FormLabel>
                        <Avatar size="xl" src={user.avatarUrl} name={user.name || "User"}>
                            {user.avatarUrl && (
                                <AvatarBadge
                                    as={IconButton}
                                    size="sm"
                                    rounded="full"
                                    top="-10px"
                                    right="-10px"
                                    aria-label="Remove avatar"
                                    icon={<SmallCloseIcon />}
                                    onClick={handleRemoveAvatar}
                                />
                            )}
                        </Avatar>
                        <Input
                            type="file"
                            accept="image/png, image/jpeg"
                            mt={2}
                            onChange={handleAvatarChange}
                        />
                        {avatarError && <Text color="red.500" fontSize="sm">{avatarError}</Text>}
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel>Name</FormLabel>
                        <Input
                            value={user.name}
                            onChange={(e) => setUser({ ...user, name: e.target.value })}
                            placeholder="Enter your name"
                        />
                    </FormControl>

                    <FormControl isRequired isInvalid={!!emailError}>
                        <FormLabel>Email</FormLabel>
                        <Input
                            value={user.email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            placeholder="Enter your email"
                        />
                        {emailError && <FormErrorMessage>{emailError}</FormErrorMessage>}
                    </FormControl>

                    <Button colorScheme="blue" onClick={handleSave}>
                        Save Profile
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


export default withAuthProtection(ProfilePage);