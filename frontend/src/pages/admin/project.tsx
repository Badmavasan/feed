import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, useDisclosure, useToast, FormControl, FormLabel,
    FormErrorMessage, VStack, Spinner, Tooltip, Icon, TabList, Tabs, Tab
} from "@chakra-ui/react";
import {AddIcon, DeleteIcon, EditIcon, InfoOutlineIcon, ViewIcon} from "@chakra-ui/icons";
import React, { ReactElement, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from '@/utils/fetcher';
import axios from '@/utils/axiosInstance';
import SidebarLayout from "@/components/SidebarLayout";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import withAuthProtection from "@/hoc/withAuthProtection";
import { useProjectContext } from "@/contexts/ProjectContext";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { NextPageWithLayout } from "@/pages/_app";
import { Project } from "@/types/project";
import { useTranslation } from "next-i18next";


interface ProjectListResponse {
    data: Project[];
    total: number;
}

interface User {
    id: number;
    name?: string;
    email: string;
}

function ProjectPage() {
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
    const { isOpen: isDetailOpen, onOpen: openDetail, onClose: closeDetail } = useDisclosure();
    const { t } = useTranslation("common");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleteRelated, setDeleteRelated] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [loadingRelated, setLoadingRelated] = useState(false);

    const [selectedAuteurs, setSelectedAuteurs] = useState<number[]>([]);
    const [selectedEditeurs, setSelectedEditeurs] = useState<number[]>([]);
    const [auteurs, setAuteurs] = useState<User[]>([]);
    const [editeurs, setEditeurs] = useState<User[]>([]);

    const [tab, setTab] = useState<"joined" | "created" | "all">("joined");


    useEffect(() => {
        setPage(1);
        setSearch("");
    }, [tab]);

    const queryParam =
        tab === "created"
            ? "createdOnly=true"
            : tab === "joined"
                ? "joinedOnly=true"
                : "";

    const { data, mutate } = useSWR<ProjectListResponse>(
        `/api/projects?page=${page}&search=${search}&${queryParam}`,
        fetcher
    );

    const { refreshProjects, setCurrentProject } = useProjectContext();

    useEffect(() => {
        if (!isOpen) return;

        axios.get('/api/users/active-auteurs')
            .then(res => setAuteurs(res.data)) // 这里赋给 options 源数据

        axios.get('/api/users/active-admins')
            .then(res => setEditeurs(res.data)) // 同理

        if (editingProject) {
            axios.get(`/api/projects/${editingProject.id}`).then(res => {
                setSelectedAuteurs(res.data.auteurs.map((u: any) => u.id));   //  id array
                setSelectedEditeurs(res.data.editeurs.map((u: any) => u.id));
            });
        } else {
            setSelectedAuteurs([]);
            setSelectedEditeurs([]);
        }
    }, [isOpen]);

    const auteurOptions = useMemo(() => (auteurs ?? []).map((u) => ({
        label: `${u.name || u.email} (${u.email})`,
        value: u.id
    })), [auteurs]);

    const editeurOptions = useMemo(() => (editeurs ?? []).map((u) => ({
        label: `${u.name || u.email} (${u.email})`,
        value: u.id
    })), [editeurs]);

    const projects = data?.data || [];
    const totalPages = Math.ceil((data?.total || 1) / 10);
    const isValid = name.trim() !== "";

    const clearForm = () => {
        setName("");
        setDescription("");
        setEditingProject(null);
        setSelectedAuteurs([]);
        setSelectedEditeurs([]);
    };

    const handleSave = async () => {
        if (!isValid) return;
        try {
            if (editingProject) {
                await axios.put(`/api/projects/${editingProject.id}`, {
                    name,
                    description,
                    members: selectedAuteurs,
                    editeurs: selectedEditeurs,
                });
                toast({ title: "Project updated successfully", status: "success" });
            } else {
                const res = await axios.post("/api/projects", {
                    name,
                    description,
                    members: selectedAuteurs,
                    editeurs: selectedEditeurs,
                });
                toast({ title: "Project created successfully", status: "success" });
                await refreshProjects();
                setCurrentProject(res.data);
            }
            mutate();
            onClose();
            clearForm();
        } catch (err: any) {
            toast({ title: err?.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setName(project.name);
        setDescription(project.description || "");
        onOpen();
    };

    const confirmDelete = async (project: Project) => {
        setLoadingRelated(true);
        openDelete();
        setDeleteTarget(project);
        try {
            const res = await axios.get(`/api/projects/${project.id}/related`);
            setDeleteRelated(res.data);
        } catch {
            toast({ title: "Failed to load related data", status: "error" });
        }
        setLoadingRelated(false);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(`/api/projects/${deleteTarget.id}`);
            toast({ title: "Deleted successfully", status: "success" });
            await refreshProjects();
            mutate();
            closeDelete();
        } catch {
            toast({ title: "Error deleting project", status: "error" });
        }
    };

    const handleView = async (project: Project) => {
        try {
            const res = await axios.get(`/api/projects/${project.id}`);
            setDetail(res.data);
            openDetail();
        } catch {
            toast({ title: "Failed to fetch detail", status: "error" });
        }
    };

    return (
    <Box>
        <HStack justifyContent="space-between" mt={6} mb={4}>
            <Text fontSize="2xl" fontWeight="bold">{t("project.title")}</Text>
            <Button leftIcon={<AddIcon />} onClick={onOpen} colorScheme="blue" mr="120px">{t("project.create")}</Button>
        </HStack>

        <Tabs
            index={tab === "all" ? 0 : tab === "created" ? 1 : 2}
            onChange={(i) => setTab(i === 0 ? "all" : i === 1 ? "created" : "joined")}
            mb={4}
        >
            <TabList>
                <Tab>{t("project.all")}</Tab>
                <Tab>{t("project.created")}</Tab>
                <Tab>{t("project.joined")}</Tab>
            </TabList>
        </Tabs>



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
                {projects.map((project) => (
                    <Tr key={project.id}>
                        <Td>{project.name}</Td>
                        <Td>{project.description || "-"}</Td>
                        <Td>
                            <HStack>
                                <IconButton
                                    icon={<ViewIcon />}
                                    aria-label="view"
                                    size="sm"
                                    onClick={() => handleView(project)}
                                />

                                {tab === "created" && (
                                    <>
                                        <IconButton
                                            icon={<EditIcon />}
                                            aria-label="edit"
                                            onClick={() => handleEdit(project)}
                                            size="sm"
                                            colorScheme="yellow"
                                        />
                                        <IconButton
                                            icon={<DeleteIcon />}
                                            aria-label="delete"
                                            onClick={() => confirmDelete(project)}
                                            size="sm"
                                            colorScheme="red"
                                        />
                                    </>
                                )}
                            </HStack>
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

        <Modal isOpen={isOpen} onClose={() => { onClose(); clearForm(); }} size="xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{editingProject ? t("project.edit") : t("project.create")}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <FormControl isRequired isInvalid={!isValid} mb={3}>
                        <FormLabel>{t("project.name")}</FormLabel>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                        {!isValid && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                    </FormControl>
                    <FormControl mb={3}>
                        <FormLabel>{t("project.description")}</FormLabel>
                        <Input value={description} onChange={e => setDescription(e.target.value)} />
                    </FormControl>

                    <FormControl mb={4}>
                        <FormLabel display="flex" alignItems="center" gap={1}>
                            {t("project.auteurs")}
                            <Tooltip label={t("project.auteursTooltip")} fontSize="md">
      <span>
        <Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" />
      </span>
                            </Tooltip>
                        </FormLabel>
                        <CustomMultiSelect
                            options={auteurOptions}
                            value={selectedAuteurs}
                            onChange={setSelectedAuteurs}
                        />
                    </FormControl>

                    <FormControl mb={4}>
                        <FormLabel display="flex" alignItems="center" gap={1}>
                            {t("project.editeurs")}
                            <Tooltip label={t("project.editeursTooltip")} fontSize="md">
      <span>
        <Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" />
      </span>
                            </Tooltip>
                        </FormLabel>
                        <CustomMultiSelect
                            options={editeurOptions}
                            value={selectedEditeurs}
                            onChange={setSelectedEditeurs}
                        />
                    </FormControl>

                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="blue" onClick={handleSave}>{t("common.save")}</Button>
                    <Button onClick={() => { onClose(); clearForm(); }} ml={3}>{t("common.cancel")}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>

        <Modal isOpen={isDeleteOpen} onClose={closeDelete} size="lg">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{t("project.confirmDelete")}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {loadingRelated ? <Spinner /> : (
                        <VStack align="start">
                            <Text>{t("project.deleteConfirm", { name: deleteTarget?.name })}</Text>
                            <Text fontWeight="bold">{t("project.relatedData")}</Text>
                            {deleteRelated && Object.entries(deleteRelated).map(([key, values]) => {
                                const arr = values as unknown[];
                                return (
                                    <Box key={key}>
                                        <Text>{key}: {arr.length}</Text>
                                    </Box>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="red" onClick={handleDelete}>{t("common.delete")}</Button>
                    <Button onClick={closeDelete} ml={3}>{t("common.cancel")}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>

        <Modal isOpen={isDetailOpen} onClose={closeDetail} size="lg">
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
                            <VStack align="start" spacing={1} mb={2}>{detail.auteurs.map((a: any) => <Text key={a.id}>• {a.name || a.email}</Text>)}</VStack>
                            <Text fontWeight="bold">{t("project.editeurs")}:</Text>
                            <VStack align="start" spacing={1}>{detail.editeurs.map((e: any) => <Text key={e.id}>• {e.name || e.email}</Text>)}</VStack>
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

ProjectPage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(ProjectPage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = ProjectPage.getLayout;
export default ProtectedDashboardPage;