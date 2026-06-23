import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, VStack, Spinner, useDisclosure, useToast
} from "@chakra-ui/react";
import { ViewIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from '@/utils/fetcher';
import axios from '@/utils/axiosInstance';
import SidebarLayout from "@/components/SidebarLayout";
import withAuthProtection from "@/hoc/withAuthProtection";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { NextPageWithLayout } from "@/pages/_app";
import { Project } from "@/types/project";
import project from "@/pages/admin/project";

function AuteurProjectPage() {
    const { t } = useTranslation("common");
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [detail, setDetail] = useState<any>(null);

    const { data, mutate } = useSWR(`/api/projects?page=${page}&search=${search}&joinedOnly=true`, fetcher);
    const projects = data?.data || [];
    const totalPages = Math.ceil((data?.total || 1) / 10);

    const handleView = async (project: Project) => {
        try {
            const res = await axios.get(`/api/projects/${project.id}`);
            setDetail(res.data);
            onOpen();
        } catch {
            toast({ title: "Failed to fetch detail", status: "error" });
        }
    };

    return (
        <Box>
            <Text fontSize="2xl" fontWeight="bold" mt={6} mb={4}>
                {t("project.title")}
            </Text>

            <Input
                placeholder={t("project.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                width="100%"
                maxW="600px"
                size="lg"
                mb={4}
                borderRadius="md"
                boxShadow="sm"
            />

            <Table>
                <Thead>
                    <Tr>
                        <Th>{t("project.name")}</Th>
                        <Th>{t("project.description")}</Th>
                        <Th>{t("common.actions")}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {projects.map((project:Project) => (
                        <Tr key={project.id}>
                            <Td>{project.name}</Td>
                            <Td>{project.description || "-"}</Td>
                            <Td>
                                <IconButton
                                    icon={<ViewIcon />}
                                    aria-label="view"
                                    size="sm"
                                    onClick={() => handleView(project)}
                                />
                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>

            <HStack justifyContent="center" mt={4}>
                <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("pagination.prev")}</Button>
                <Text>{page} / {totalPages}</Text>
                <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("pagination.next")}</Button>
            </HStack>

            {/* Detail modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("project.detail")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {detail ? (
                            <Box>
                                <Text fontWeight="bold">{t("project.name")}:</Text>
                                <Text mb={2}>{detail.name}</Text>
                                <Text fontWeight="bold">{t("project.description")}:</Text>
                                <Text mb={2}>{detail.description || '-'}</Text>
                                <Text fontWeight="bold">{t("project.auteurs")}:</Text>
                                <VStack align="start" spacing={1} mb={2}>
                                    {detail.auteurs.map((a: any) => <Text key={a.id}>• {a.name || a.email}</Text>)}
                                </VStack>
                                <Text fontWeight="bold">{t("project.editeurs")}:</Text>
                                <VStack align="start" spacing={1}>
                                    {detail.editeurs.map((e: any) => <Text key={e.id}>• {e.name || e.email}</Text>)}
                                </VStack>
                            </Box>
                        ) : <Spinner />}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Box>
    );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common'])),
        },
    };
};

AuteurProjectPage.getLayout = (page: React.ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedAuteurProjectPage = withAuthProtection(AuteurProjectPage) as NextPageWithLayout;
ProtectedAuteurProjectPage.getLayout = AuteurProjectPage.getLayout;

export default ProtectedAuteurProjectPage;
