import {
    Box,
    VStack,
    FormControl,
    FormLabel,
    Switch,
    Button,
    useColorMode,
    Heading,
    Text,
    Divider,
    Stack,
    useColorModeValue,
    useToast,
    Container,
    HStack,
    Spacer,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { storageService } from "@/utils/storageService";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import withAuthProtection from "@/hoc/withAuthProtection";

const SettingsPage = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const { colorMode, toggleColorMode } = useColorMode();
    const cardBg = useColorModeValue("white", "gray.700");
    const cardBorder = useColorModeValue("gray.200", "gray.600");
    const toast = useToast();
    const router = useRouter();
    const { t } = useTranslation("common");

    const handleSaveSettings = () => {
        storageService.set("settings", { darkMode, notifications });

        if (darkMode && colorMode !== "dark") {
            toggleColorMode();
        } else if (!darkMode && colorMode !== "light") {
            toggleColorMode();
        }

        toast({
            title: t("toast.title"),
            description: t("toast.description"),
            status: "success",
            duration: 3000,
            isClosable: true,
        });

        setTimeout(() => {
            router.push("/dashboard");
        }, 500);
    };

    useEffect(() => {
        const storedSettings = storageService.get<{
            darkMode: boolean;
            notifications: boolean;
        }>("settings");

        if (storedSettings) {
            setDarkMode(storedSettings.darkMode);
            setNotifications(storedSettings.notifications);

            if (storedSettings.darkMode && colorMode !== "dark") {
                toggleColorMode();
            } else if (!storedSettings.darkMode && colorMode !== "light") {
                toggleColorMode();
            }
        }
    }, []);

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
                bg={cardBg}
                borderRadius="xl"
                border="1px solid"
                borderColor={cardBorder}
                boxShadow="lg"
                p={{ base: 6, md: 10 }}
            >
                <Heading fontSize="2xl" mb={2}>
                   settings
                </Heading>
                <Text fontSize="sm" color="gray.500" mb={6}>

                </Text>

                <VStack spacing={6} align="stretch">
                    <FormControl display="flex" justifyContent="space-between" alignItems="center">
                        <FormLabel mb="0">{t("darkMode")}</FormLabel>
                        <Switch isChecked={darkMode} onChange={() => setDarkMode(!darkMode)} />
                    </FormControl>

                    <Divider />

                </VStack>

                <Stack mt={10} direction="row" justify="flex-end">
                    <Button colorScheme="blue" onClick={handleSaveSettings}>
                        {t("save")}
                    </Button>
                </Stack>
            </Box>
        </Container>
    );
};

export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? "fr", ["common"])),
        },
    };
};

export default withAuthProtection (SettingsPage);
