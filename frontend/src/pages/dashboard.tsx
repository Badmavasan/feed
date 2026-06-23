import {
    Box, Heading, Text, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
    useColorModeValue, Icon, HStack, Button, Link, Center
} from "@chakra-ui/react";
import { FaTasks, FaBug, FaBook, FaComments, FaClipboardList } from "react-icons/fa";
import {ReactElement, useEffect, useState} from "react";
import { useTranslation } from 'next-i18next';
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { getCurrentUser, getStatsCounts } from '@/utils/api';
import { useRouter } from "next/router";
import NextLink from "next/link";
import withAuthProtection from "@/hoc/withAuthProtection";
import { useProjectContext } from '@/contexts/ProjectContext';
import SidebarLayout from '@/components/SidebarLayout';
import {NextPageWithLayout} from "@/pages/_app";



function DashboardPage (){
    const { t } = useTranslation('common');
    const router = useRouter();

    const [stats, setStats] = useState({
        totalTypes: 0,
        totalErreurs: 0,
        totalExercises: 0,
        totalFeedbacks: 0,
        totalComponents: 0,
    });

    const [isLoading, setIsLoading] = useState(true);

    const { currentProject, loading: projectLoading } = useProjectContext();

    useEffect(() => {
        const fetchData = async () => {
            try {
                await getCurrentUser(); // 🔐 验证登录
                if (!currentProject) return;

                const statsData = await getStatsCounts(currentProject.id); // 传入 projectId
                setStats(statsData);
            } catch (err) {
                console.error("Error fetching stats:", err);
                router.replace('/login');
            } finally {
                setIsLoading(false);
            }
        };

        if (!projectLoading) {
            fetchData();
        }
    }, [router, currentProject, projectLoading]);

    const cardBg = useColorModeValue("gray.50", "gray.700");

    const statCards = [
        {
            icon: FaTasks,
            label: t('dashboard.taskTypes'),
            value: stats.totalTypes,
            helpText: t('dashboard.taskTypesHelp'),
        },
        {
            icon: FaBug,
            label: t('dashboard.errors'),
            value: stats.totalErreurs,
            helpText: t('dashboard.errorsHelp'),
        },
        {
            icon: FaBook,
            label: t('dashboard.exercises'),
            value: stats.totalExercises,
            helpText: t('dashboard.exercisesHelp'),
        },
        {
            icon: FaComments,
            label: t('dashboard.feedbackComponents'),
            value: stats.totalComponents,
            helpText: t('dashboard.feedbackComponentsHelp'),
        },
        {
            icon: FaClipboardList,
            label: t('dashboard.feedbacks'),
            value: stats.totalFeedbacks,
            helpText: t('dashboard.feedbacksHelp'),
        },
    ];




    if (isLoading) return null; // 或者添加 loading spinner

    return (
<div>
            <Box p={6}>
                <Heading as="h2" size="xl" mb={6} mt={6}>
                    {t('dashboard.heading')}
                </Heading>

                <Text fontSize="lg" mb={6}>
                    {t('dashboard.description')}
                </Text>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                    {statCards.map((stat, index) => (
                        <Box
                            key={index}
                            bg={cardBg}
                            p={6}
                            borderRadius="xl"
                            boxShadow="md"
                            transition="transform 0.2s"
                            _hover={{ transform: "scale(1.03)", boxShadow: "xl" }}
                        >
                            <HStack spacing={4}>
                                <Icon as={stat.icon} boxSize={8} color="blue.500" />
                                <Box>
                                    <Stat>
                                        <StatLabel>{stat.label}</StatLabel>
                                        <StatNumber>{stat.value}</StatNumber>
                                        <StatHelpText>{stat.helpText}</StatHelpText>
                                    </Stat>
                                </Box>
                            </HStack>
                        </Box>
                    ))}
                </SimpleGrid>

            </Box>

            <Center mt={12} mb={6}>
                <NextLink href="/guide" passHref>
                    <Link
                        fontSize="sm"
                        color="blue.500"
                        textDecoration="underline"
                        _hover={{ color: "blue.600", textDecoration: "underline" }}
                    >
                        Need help? Read the user guide →
                    </Link>
                </NextLink>
            </Center>

</div>


    );
}


export const getStaticProps = async ({ locale }: { locale: string }) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'fr', [
            "common"
        ])),
    },
});
DashboardPage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(DashboardPage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = DashboardPage.getLayout;

export default ProtectedDashboardPage;