import {
    Box,
    Button,
    Container,
    Heading,
    Text,
    VStack,
    HStack,
    Spacer,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import withAuthProtection from "@/hoc/withAuthProtection";
import { useTranslation } from "next-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {GetStaticProps} from "next";
import {serverSideTranslations} from "next-i18next/serverSideTranslations";

function GuidePage() {
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <Container maxW="4xl" py={6}>
            {/* Header */}
            <HStack mb={6}>
                <Button onClick={() => router.push("/dashboard")} variant="outline" colorScheme="blue">
                    ← {t("guide.backToDashboard")}
                </Button>
                <Spacer />
                <LanguageSwitcher />
            </HStack>

            <Heading as="h1" size="2xl" mb={4}>{t("guide.title")}</Heading>
            <Text fontSize="lg" mb={8} color="gray.600">{t("guide.intro")}</Text>

            {/* Modules */}
            <VStack align="start" spacing={6}>
                {/* Task Type */}
                <Box>
                    <Heading size="md">{t("guide.taskType.title")}</Heading>
                    <Text>{t("guide.taskType.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.taskType.example")}</Text>
                </Box>

                {/* Exercise */}
                <Box>
                    <Heading size="md">{t("guide.exercise.title")}</Heading>
                    <Text>{t("guide.exercise.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.exercise.example")}</Text>
                </Box>

                {/* Error */}
                <Box>
                    <Heading size="md">{t("guide.error.title")}</Heading>
                    <Text>{t("guide.error.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.error.example")}</Text>
                </Box>

                {/* Feedback */}
                <Box>
                    <Heading size="md">{t("guide.feedback.title")}</Heading>
                    <Text>{t("guide.feedback.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.feedback.example")}</Text>
                </Box>

                {/* Feedback Component */}
                <Box>
                    <Heading size="md">{t("guide.component.title")}</Heading>
                    <Text>{t("guide.component.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.component.example")}</Text>
                </Box>

                {/* User */}
                <Box>
                    <Heading size="md">{t("guide.user.title")}</Heading>
                    <Text>{t("guide.user.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.user.example")}</Text>
                </Box>

                {/* Project */}
                <Box>
                    <Heading size="md">{t("guide.project.title")}</Heading>
                    <Text>{t("guide.project.desc")}</Text>
                    <Text fontStyle="italic" color="gray.600">{t("guide.project.example")}</Text>
                </Box>
            </VStack>

            {/* Relationships */}
            <Box mt={10}>
                <Heading size="lg" mb={3}>{t("guide.relationshipsTitle")}</Heading>
                <Text>{t("guide.relationshipsExplanation")}</Text>
                <Text mt={2} fontStyle="italic" color="gray.500">{t("guide.relationshipExample")}</Text>
            </Box>
        </Container>
    );
}


export const getStaticProps: GetStaticProps = async (context) => {
    const locale = context.locale || 'fr'; // fallback 防止 undefined
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common', 'guide'])),
        },
    };
};

export default withAuthProtection(GuidePage);
