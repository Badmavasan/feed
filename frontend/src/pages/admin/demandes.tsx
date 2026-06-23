import axios from '@/utils/axiosInstance';
import React, { ReactElement, useEffect, useState } from 'react';
import {
    Box, Tabs, TabList, TabPanels, Tab, TabPanel, Text,
    VStack, Tag, Button, HStack, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, useDisclosure,
    useToast, Textarea, Flex, Stack, UnorderedList, ListItem
} from '@chakra-ui/react';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useProjectContext } from '@/contexts/ProjectContext';
import withAuthProtection from "@/hoc/withAuthProtection";
import { NextPageWithLayout } from "@/pages/_app";
import SidebarLayout from '@/components/SidebarLayout';
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";

type ModerationRequest = {
    id: number;
    payload: any;
    entity_type: string;
    action_type: string;
    created_at: string;
    status: 'pending_review' | 'approved' | 'rejected'| 'withdrawn';
    requester?: { email?: string };
    hasUnread?: boolean;
};

type Demande = {
    id: number;
    type: string;
    date: string;
    status: string;
    user: string;
    hasUnreadMessage?: boolean;
    content: {
        name?: string;
        taskId?: string;
        parentType?: {
            id: number;
            task_code: string;
            task_name: string;
        };
        errors?: {
            id: number;
            error_tag: string;
            description: string;
        }[];
    };
};


function AdminDemandes() {
    const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
    const [demandes, setDemandes] = useState<Demande[]>([]);
    const [tabIndex, setTabIndex] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [total, setTotal] = useState(0);
    const [reason, setReason] = useState('');
    const [showRejectReason, setShowRejectReason] = useState(false);

    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();
    const router = useRouter();
    const { currentProject } = useProjectContext();
    const { t } = useTranslation("common");

    type ModerationTabKey = 'en attente' | 'validée' | 'refusée'| 'retirée';
    const tabKeys = ['all', 'en attente', 'validée', 'refusée', 'retirée'] as const;
    const statusMap: Record<ModerationTabKey, string> = {
        'en attente': 'pending_review',
        'validée': 'approved',
        'refusée': 'rejected',
        'retirée': 'withdrawn'
    };
    const currentStatus = tabKeys[tabIndex];


    const fetchDemandes = async () => {
        if (!currentProject?.id) return;

        try {
            const baseUrl = `/api/moderations?page=${page}&pageSize=${pageSize}&projectId=${currentProject.id}`;
            const query = currentStatus === 'all'
                ? baseUrl
                : `${baseUrl}&status=${statusMap[currentStatus as ModerationTabKey]}`;

            const res = await axios.get(query);

            const statusLabelMap: Record<string, string> = {
                'pending_review': 'en attente',
                'approved': 'validée',
                'rejected': 'refusée',
                'withdrawn': 'retirée'
            };
            const mapped = (res.data.data as ModerationRequest[]).map((d) => {
                let parsed = d.payload;

                if (typeof parsed === 'string') {
                    try {
                        parsed = JSON.parse(parsed);
                    } catch {}
                }

                if (d.entity_type === 'error' && parsed.tag) {
                    parsed = {
                        error_tag: parsed.tag,
                        description: parsed.description
                    };
                }

                if (d.entity_type === 'type' && parsed.taskId) {
                    parsed = {
                        task_code: parsed.taskId,
                        task_name: parsed.nom,
                        subRelations: parsed.sousTypes || [],
                        errorAssociations: parsed.erreurs || []
                    };
                }

                return {
                    id: d.id,
                    type: `${d.action_type} ${d.entity_type}`,
                    content: parsed,
                    date: new Date(d.created_at).toLocaleDateString(),
                    status: statusLabelMap[d.status] ?? 'inconnue',
                    user: d.requester?.email || 'Inconnu',
                    hasUnreadMessage: d.hasUnread ?? false
                };
            });


            setDemandes(mapped);
            setTotal(res.data.total);
        } catch {
            toast({ title: "Erreur de chargement", status: "error" });
        }
    };

    useEffect(() => {
        if (currentProject?.id) {
            fetchDemandes();
        }
    }, [tabIndex, page, currentProject]);

    const handleViewDetails = (demande: Demande) => {
        setSelectedDemande(demande);
        setShowRejectReason(false);
        setReason('');
        onOpen();
    };

    const handleAction = async (action: 'approve' | 'reject') => {
        try {
            if (!selectedDemande) {
                toast({ title: 'Aucune demande sélectionnée', status: 'error' });
                return;
            }

            await axios.put(`/api/moderations/${selectedDemande.id}`, {
                action,
                reason: action === 'reject' ? reason : null
            });

            toast({
                title: `Demande ${action === 'approve' ? 'approuvée' : 'refusée'}`,
                status: 'success'
            });

            onClose();
            fetchDemandes();
        } catch (e) {
            const message = (e as any)?.response?.data?.message || (e as Error).message || 'Erreur';
            toast({ title: message, status: 'error' });
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (

            <Box>
                <Text fontSize="2xl" fontWeight="bold" mb={4}>
                    {t("request.title")}
                </Text>

                <Box overflowX="auto">
                    <Tabs index={tabIndex} onChange={(i) => { setTabIndex(i); setPage(1); }}>
                        <TabList>
                            <Tab>{t("request.all")}</Tab>
                            <Tab>{t("request.pending")}</Tab>
                            <Tab>{t("request.approved")}</Tab>
                            <Tab>{t("request.rejected")}</Tab>
                        </TabList>

                        <TabPanels>
                            {[0, 1, 2, 3].map(i => (
                                <TabPanel key={i}>
                                    <VStack align="start" spacing={4}>
                                        {demandes.map((d) => {
                                            const errors = d.content?.errors; // ✅ 关键修复点：提前定义 errors

                                            return (
                                                <Box
                                                    key={d.id}
                                                    w="full"
                                                    p={4}
                                                    pr={5}
                                                    borderWidth={1}
                                                    borderRadius="xl"
                                                    boxShadow="sm"
                                                    transition="all 0.2s ease-in-out"
                                                    _hover={{ bg: 'gray.50', boxShadow: 'md' }}
                                                    position="relative"
                                                >
                                                    {d.hasUnreadMessage && (
                                                        <HStack
                                                            position="absolute"
                                                            top={2}
                                                            left={2}
                                                            spacing={1}
                                                            align="center"
                                                            bg="red.50"
                                                            px={2}
                                                            py={0.5}
                                                            borderRadius="md"
                                                            boxShadow="sm"
                                                        >
                                                            <Box boxSize={2} bg="red.400" borderRadius="full" />
                                                        </HStack>
                                                    )}

                                                    <HStack justifyContent="space-between" alignItems="flex-start">
                                                        <Box
                                                            onClick={() => router.push(`/admin/demandes/${d.id}/chat`)}
                                                            cursor="pointer"
                                                            w="full"
                                                        >
                                                            <HStack spacing={2} align="center">
                                                                <Text fontWeight="bold">{d.type}</Text>
                                                            </HStack>
                                                            <Text fontSize="sm">
                                                                {t("request.submittedBy")}: {d.user}
                                                            </Text>

                                                            <Box fontSize="sm" whiteSpace="pre-wrap" maxHeight="7.5em" overflow="hidden">
                                                                {d.content?.name && <Text><b>Nom :</b> {d.content.name}</Text>}
                                                                {d.content?.taskId && <Text><b>Code :</b> {d.content.taskId}</Text>}
                                                                {d.content?.parentType && (
                                                                    <Text>
                                                                        <b>Parent :</b> {d.content.parentType.task_code} - {d.content.parentType.task_name}
                                                                    </Text>
                                                                )}

                                                                <Text><b>Erreurs :</b></Text>
                                                                {Array.isArray(errors) && errors.length > 0 ? (
                                                                    <UnorderedList pl={4}>
                                                                        {errors.map((e) => (
                                                                            <ListItem key={e.id}>{e.error_tag} - {e.description}</ListItem>
                                                                        ))}
                                                                    </UnorderedList>
                                                                ) : (
                                                                    <Text color="gray.500" pl={2}>Aucune</Text>
                                                                )}
                                                            </Box>

                                                            <Text fontSize="sm">{d.date}</Text>
                                                        </Box>

                                                        <VStack align="end">
                                                            <Tag
                                                                colorScheme={
                                                                    d.status === "validée"
                                                                        ? "green"
                                                                        : d.status === "refusée"
                                                                            ? "orange"
                                                                            : d.status === "retirée"
                                                                                ? "cyan"
                                                                                : "purple"
                                                                }
                                                            >
                                                                {t(`request.status.${d.status}`)}
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
                                                                {t("request.verify")}
                                                            </Button>
                                                        </VStack>
                                                    </HStack>
                                                </Box>
                                            );
                                        })}
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

                <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t("request.detailTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {selectedDemande && (
                                <Stack spacing={3}>
                                    <Text>
                                        <b>{t("request.type")}:</b> {selectedDemande.type}
                                    </Text>
                                    <Text>
                                        <b>{t("request.user")}:</b> {selectedDemande.user}
                                    </Text>
                                    <Text>
                                        <b>{t("request.date")}:</b> {selectedDemande.date}
                                    </Text>
                                    <Text>
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
                                    </Text>

                                    <Box>
                                        <Text>
                                            <b>{t("request.content")}:</b>
                                        </Text>

                                        <Box bg="gray.50" p={3} rounded="md" fontSize="sm">
                                            {selectedDemande?.content && (
                                                <Stack spacing={2}>
                                                    <Text>
                                                        <b>TâcheTag :</b> {selectedDemande.content.taskId || '—'}
                                                    </Text>
                                                    <Text>
                                                        <b>Nom :</b> {selectedDemande.content.name || '—'}
                                                    </Text>

                                                    <Text>
                                                        <b>Tâche parente :</b>{' '}
                                                        {selectedDemande.content.parentType
                                                            ? `${selectedDemande.content.parentType.task_code} - ${selectedDemande.content.parentType.task_name}`
                                                            : 'Aucun'}
                                                    </Text>
                                                    <Text>
                                                        <b>Erreurs associées :</b>{' '}
                                                        {Array.isArray(selectedDemande.content.errors) && selectedDemande.content.errors.length > 0
                                                            ? selectedDemande.content.errors.map((e) => `${e.error_tag} - ${e.description}`).join(', ')
                                                            : 'Aucune'}
                                                    </Text>
                                                </Stack>
                                            )}

                                        </Box>
                                    </Box>

                                    {showRejectReason && (
                                        <Textarea
                                            mt={2}
                                            placeholder={t("request.rejectReasonPlaceholder")}
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    )}
                                </Stack>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            {selectedDemande?.status === 'en attente' && !showRejectReason && (
                                <>
                                    <Button colorScheme="green" mr={3} onClick={() => handleAction('approve')}>
                                        {t("request.approve")}
                                    </Button>
                                    <Button colorScheme="red" onClick={() => setShowRejectReason(true)}>
                                        {t("request.reject")}
                                    </Button>
                                </>
                            )}
                            {selectedDemande?.status === 'en attente' && showRejectReason && (
                                <Button
                                    colorScheme="red"
                                    mr={3}
                                    onClick={() => handleAction('reject')}
                                    isDisabled={!reason.trim()}
                                >
                                    {t("request.confirmReject")}
                                </Button>
                            )}
                            <Button onClick={onClose}>{t("common.close")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

            </Box>
    );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common']))
        }
    };
};

AdminDemandes.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(AdminDemandes) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = AdminDemandes.getLayout;

export default ProtectedDashboardPage;
