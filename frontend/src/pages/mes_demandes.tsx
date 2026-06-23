import dynamic from 'next/dynamic';
import axios from '@/utils/axiosInstance';
import React, { ReactElement, useEffect, useState } from 'react';
import {
    Box, Tabs, TabList, TabPanels, Tab, TabPanel, Text,
    VStack, Tag, Button, HStack, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
    useDisclosure, useToast, Flex, UnorderedList, ListItem
} from '@chakra-ui/react';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import withAuthProtection from '@/hoc/withAuthProtection';
import { NextPageWithLayout } from '@/pages/_app';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

const SidebarLayout = dynamic(() => import('@/components/SidebarLayout'), { ssr: false });

const statusMap: Record<string, string> = {
    'en attente': 'pending_review',
    'validée': 'approved',
    'refusée': 'rejected',
    'retirée': 'withdrawn',
};

type DemandeItem = {
    id: number;
    type: string;
    status: 'en attente' | 'validée' | 'refusée' | 'retirée';
    date: string;
    user?: string; // 可选用户字段
    content: {
        name: string;
        taskId: string;
        parentType?: {
            id: number;
            task_code: string;
            task_name: string;
        };
        errors: {
            id: number;
            error_tag: string;
            description: string;
        }[];
    };
    hasUnreadMessage?: boolean;
};


function MesDemandes() {
    const [demandes, setDemandes] = useState<DemandeItem[]>([]);
    const [selectedDemande, setSelectedDemande] = useState<DemandeItem | null>(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();
    const [tabIndex, setTabIndex] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);
    const { t } = useTranslation("common");

    const router = useRouter();
    const { currentProject } = useProjectContext();
    const currentStatus = ['all', 'en attente', 'validée', 'refusée', 'retirée'][tabIndex];

    const fetchDemandes = async () => {
        if (!currentProject?.id) return;
        try {
            const baseUrl = `/api/moderations/mine`;
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                projectId: currentProject.id.toString(),
            });
            if (currentStatus !== 'all') {
                params.append('status', statusMap[currentStatus]);
            }

            const query = `${baseUrl}?${params.toString()}`;
            const res = await axios.get(query);

            const mapped: DemandeItem[] = res.data.data.map((d: any) => {
                let parsed = d.payload;
                if (typeof parsed === 'string') {
                    try {
                        parsed = JSON.parse(parsed);
                    } catch {}
                }

                return {
                    id: d.id,
                    type: `${d.action_type} ${d.entity_type}`,
                    user: d.requester?.email || "", // 如果后端传了 requester 字段（建议你传一下）
                    content: parsed, // ✅ 保持为对象，供组件访问
                    date: new Date(d.created_at).toLocaleDateString(),
                    status:
                        d.status === 'pending_review'
                            ? 'en attente'
                            : d.status === 'approved'
                                ? 'validée'
                                : d.status === 'rejected'
                                    ? 'refusée'
                                    : 'retirée',
                    hasUnreadMessage: d.hasUnread ?? false
                };
            });


            setDemandes(mapped);
            setTotal(res.data.total);
        } catch (e: any) {
            toast({ title: 'Erreur de chargement', status: 'error' });
        }
    };

    useEffect(() => {
        if (currentProject?.id) fetchDemandes();
    }, [tabIndex, page, currentProject?.id, router.asPath]);

    const handleViewDetails = (demande: DemandeItem) => {
        setSelectedDemande(demande);
        onOpen();
    };

    const handleRetirer = async (id: number) => {
        if (!currentProject?.id) return;
        try {
            await axios.delete(`/api/moderations/${id}?projectId=${currentProject.id}`);
            toast({ title: 'Demande retirée', status: 'info' });
            fetchDemandes();
        } catch (e: any) {
            toast({ title: e.response?.data?.message || 'Erreur lors du retrait', status: 'error' });
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <Box>
            <Text fontSize="2xl" fontWeight="bold" mb={4}>
                {t("request.myRequests")}
            </Text>

            <Box overflowX="auto">
                <Tabs index={tabIndex} onChange={(index) => { setTabIndex(index); setPage(1); }}>
                    <TabList>
                        <Tab>{t("request.allRequests")}</Tab>
                        <Tab>{t("request.pending")}</Tab>
                        <Tab>{t("request.approved")}</Tab>
                        <Tab>{t("request.rejected")}</Tab>
                        <Tab>{t("request.withdrawn")}</Tab>
                    </TabList>

                    <TabPanels>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <TabPanel key={i}>
                                <VStack align="start" spacing={4}>
                                    {demandes.map((d) => (
                                        <Box
                                            key={d.id}
                                            position="relative"
                                            w="full"
                                            p={4}
                                            borderWidth={1}
                                            borderRadius="xl"
                                            boxShadow="sm"
                                            transition="all 0.2s ease-in-out"
                                            _hover={{ bg: 'gray.50', boxShadow: 'md' }}
                                        >
                                            {d.hasUnreadMessage && (
                                                <Box
                                                    position="absolute"
                                                    top={2}
                                                    left={2}
                                                    boxSize={3}
                                                    bg="red.400"
                                                    borderRadius="full"
                                                    boxShadow="md"
                                                />
                                            )}

                                            <HStack justifyContent="space-between" alignItems="flex-start">
                                                <Box
                                                    onClick={() => router.push(`/mes_demandes/${d.id}/chat`)}
                                                    cursor="pointer"
                                                    w="full"
                                                >
                                                    <Text fontSize="lg" fontWeight="bold" mb={1}>
                                                        {d.type}
                                                    </Text>

                                                    <Box fontSize="sm" whiteSpace="pre-wrap" maxHeight="7.5em" overflow="hidden">
                                                        {d.content?.name && (
                                                            <Text>
                                                                <Text as="span" fontWeight="semibold" color="gray.700">
                                                                    Nom :
                                                                </Text>{' '}
                                                                <Text as="span" color="gray.800">{d.content.name}</Text>
                                                            </Text>
                                                        )}

                                                        {d.content?.taskId && (
                                                            <Text>
                                                                <Text as="span" fontWeight="semibold" color="gray.700">
                                                                    Task ID :
                                                                </Text>{' '}
                                                                <Text as="span" color="gray.800">{d.content.taskId}</Text>
                                                            </Text>
                                                        )}

                                                        {d.content?.parentType && (
                                                            <Text>
                                                                <Text as="span" fontWeight="semibold" color="gray.700">
                                                                    Parent :
                                                                </Text>{' '}
                                                                <Text as="span" color="gray.800">
                                                                    {d.content.parentType.task_code} - {d.content.parentType.task_name}
                                                                </Text>
                                                            </Text>
                                                        )}

                                                        {Array.isArray(d.content?.errors) && d.content.errors.length > 0 && (
                                                            <>
                                                                <Text fontWeight="semibold" color="gray.700">Erreurs :</Text>
                                                                <UnorderedList ml={4}>
                                                                    {d.content.errors.map((e) => (
                                                                        <ListItem key={e.id} fontSize="sm" color="gray.800">
                                                                            {e.error_tag} - {e.description}
                                                                        </ListItem>
                                                                    ))}
                                                                </UnorderedList>
                                                            </>
                                                        )}
                                                    </Box>


                                                    <Text fontSize="sm">{d.date}</Text>
                                                </Box>

                                                <VStack align="end">
                                                    <Tag colorScheme={
                                                        d.status === 'validée' ? 'green' :
                                                            d.status === 'refusée' ? 'orange' :
                                                                d.status === 'retirée' ? 'cyan' : 'purple'
                                                    }>
                                                        {t(`request.${d.status}`)}
                                                    </Tag>

                                                    <Button
                                                        size="sm"
                                                        position="relative"
                                                        zIndex={1}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewDetails(d);
                                                        }}
                                                    >
                                                        {t("request.viewDetails")}
                                                    </Button>

                                                    {d.status === 'en attente' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            position="relative"
                                                            zIndex={1}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRetirer(d.id);
                                                            }}
                                                        >
                                                            {t("request.withdraw")}
                                                        </Button>
                                                    )}
                                                </VStack>
                                            </HStack>
                                        </Box>
                                    ))}
                                </VStack>

                                <Flex mt={4} align="center">
                                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={page === 1}>
                                        {t("request.previous")}
                                    </Button>
                                    <Text mx={4}>{t("request.pageInfo", { current: page, total: totalPages })}</Text>
                                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} isDisabled={page === totalPages}>
                                        {t("request.next")}
                                    </Button>
                                </Flex>
                            </TabPanel>
                        ))}
                    </TabPanels>
                </Tabs>
            </Box>

            <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("request.detailsTitle")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {selectedDemande ? (
                            <>
                                <Text mb={1}><b>{t("request.type")}:</b> {selectedDemande.type}</Text>
                                <Text mb={1}><b>{t("request.content")}:</b></Text>

                                <Box mt={1} bg="gray.50" p={3} borderRadius="md">
                                    <VStack align="start" spacing={2} fontSize="sm">
                                        {/* 标签 + 内容同一行，更清晰 */}
                                        <Text>
                                            <Text as="span" fontWeight="semibold" color="gray.700">
                                                {t("type.taskId")}:
                                            </Text>{' '}
                                            <Text as="span" color="gray.800">
                                                {selectedDemande.content?.taskId || '—'}
                                            </Text>
                                        </Text>

                                        <Text>
                                            <Text as="span" fontWeight="semibold" color="gray.700">
                                                {t("type.name")}:
                                            </Text>{' '}
                                            <Text as="span" color="gray.800">
                                                {selectedDemande.content?.name || '—'}
                                            </Text>
                                        </Text>

                                        {selectedDemande.content?.parentType && (
                                            <Text>
                                                <Text as="span" fontWeight="semibold" color="gray.700">
                                                    {t("type.parentType")}:
                                                </Text>{' '}
                                                <Text as="span" color="gray.800">
                                                    • {selectedDemande.content.parentType.task_code} - {selectedDemande.content.parentType.task_name}
                                                </Text>
                                            </Text>
                                        )}

                                        <Box>
                                            <Text fontWeight="semibold" color="gray.700">
                                                {t("type.errors")}:
                                            </Text>
                                            {selectedDemande.content?.errors?.length > 0 ? (
                                                <UnorderedList pl={4} mt={1} spacing={1}>
                                                    {selectedDemande.content.errors.map((e: any) => (
                                                        <ListItem key={e.id} fontSize="sm" color="gray.800">
                                                            • {e.error_tag} - {e.description}
                                                        </ListItem>
                                                    ))}
                                                </UnorderedList>
                                            ) : (
                                                <Text fontSize="sm" color="gray.500" pl={2}>
                                                    ({t("form.noResult")})
                                                </Text>
                                            )}
                                        </Box>
                                    </VStack>
                                </Box>

                                {/* 日期和状态 */}
                                <Box><Text mt={4} >
                                    <b>{t("request.status.label")}:</b>{' '}
                                    <Tag
                                        colorScheme={
                                            selectedDemande.status === 'validée'
                                                ? 'green'
                                                : selectedDemande.status === 'refusée'
                                                    ? 'orange'
                                                    : selectedDemande.status === 'retirée'
                                                        ? 'cyan'
                                                        : 'purple'
                                        }
                                        variant="subtle"
                                    >
                                        {t(`request.status.${selectedDemande.status}`)}
                                    </Tag>
                                </Text></Box>
                            <Box><Text mt={4}><b>{t("request.date")}:</b> {selectedDemande.date}</Text></Box>

                            </>
                        ) : (
                            <Text>{t("request.noSelection")}</Text>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>{t("request.close")}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>


        </Box>
    );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common'])),
        },
    };
};

MesDemandes.getLayout = (page: ReactElement) => <SidebarLayout>{page}</SidebarLayout>;
const ProtectedDashboardPage = withAuthProtection(MesDemandes) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = MesDemandes.getLayout;

export default ProtectedDashboardPage;
