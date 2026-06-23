
import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, useDisclosure, useToast, FormControl, FormLabel, VStack,
    FormErrorMessage, Tooltip, Icon
} from "@chakra-ui/react";
import {AddIcon, DeleteIcon, DownloadIcon, EditIcon, InfoOutlineIcon, ViewIcon, WarningIcon} from "@chakra-ui/icons";
import React, {ReactElement, useState} from "react";
import SidebarLayout from "@/components/SidebarLayout";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import { useTranslation } from "next-i18next";
import useSWR from "swr";
import axios from '@/utils/axiosInstance';
import { fetcher } from '@/utils/fetcher';

import { TaskType } from '@/types/taskType';
import { Error, ErrorDetail } from '@/types/error';
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useProjectContext } from '@/contexts/ProjectContext';
import withAuthProtection from "@/hoc/withAuthProtection";
import {NextPageWithLayout} from "@/pages/_app";

function ErrorPage() {
    const { t } = useTranslation("common");
    const toast = useToast();
    const { currentProject } = useProjectContext();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const [tagInput, setTagInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [selectedTypes, setSelectedTypes] = useState<number[]>([]);

    const [editingItem, setEditingItem] = useState<Error | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ErrorDetail | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);

    const { isOpen, onOpen, onClose } = useDisclosure();
    const [fileToImport, setFileToImport] = useState<File | null>(null);


    const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDeleteModal, onClose: closeDeleteModal } = useDisclosure();
    const { isOpen: isRelationOpen, onOpen: openRelationModal, onClose: closeRelationModal } = useDisclosure();

    const { data: errorData, mutate } = useSWR(
        currentProject ? `/api/errors?page=${page}&limit=10&search=${search}&projectId=${currentProject.id}` : null,
        fetcher
    );
    const { data: allTypes = [] } = useSWR(
        currentProject ? `/api/types/selectable?projectId=${currentProject.id}` : null,
        fetcher
    );
    const { data: detail } = useSWR(
        viewingId && currentProject ? `/api/errors/${viewingId}?projectId=${currentProject.id}` : null,
        fetcher
    );

    const errors: Error[] = errorData?.errors || [];
    const totalPages = errorData?.totalPages || 1;
    const isValid = tagInput.trim() !== "" && descriptionInput.trim() !== "";

    const clearForm = () => {
        setEditingItem(null);
        setTagInput("");
        setDescriptionInput("");
        setSelectedTypes([]);
    };

    const handleAdd = async () => {
        if (!isValid || !currentProject) return;
        try {
            const res = await axios.post(`/api/errors?projectId=${currentProject.id}`, {
                tag: tagInput.trim(),
                description: descriptionInput.trim(),
                associatedTypes: selectedTypes
            });
            const isApproval = res.data.message?.includes("submitted for approval");
            toast({
                title: isApproval ? t("toast.error.createSubmitted") : t("toast.error.createSuccess"),
                status: isApproval ? "info" : "success"
            });
            mutate();
            closeModal();
            clearForm();
        } catch (err: any) {
            toast({ title: err.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleEdit = async (error: Error) => {
        if (!currentProject) return;
        try {
            const res = await axios.get(`/api/errors/${error.id}?projectId=${currentProject.id}`);
            const detail: ErrorDetail = res.data;
            setEditingItem(error);
            setTagInput(detail.tag);
            setDescriptionInput(detail.description);
            setSelectedTypes(detail.associatedTypes?.map(t => t.id) || []);
            openModal();
        } catch (err: any) {
            toast({ title: err.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleSaveEdit = async () => {
        if (!editingItem || !currentProject) return;
        try {
            const res = await axios.put(`/api/errors/${editingItem.id}?projectId=${currentProject.id}`, {
                tag: tagInput.trim(),
                description: descriptionInput.trim(),
                associatedTypes: selectedTypes
            });

            const isApproval = res.data.message?.includes("submitted for approval");
            toast({
                title: isApproval ? t("toast.error.editSubmitted") : t("toast.error.editSuccess"),
                status: isApproval ? "info" : "success"
            });
            mutate();
            closeModal();
            clearForm();
        } catch (err: any) {
            toast({
                title: err.response?.data?.message || "Error",
                status: "error"
            });
        }
    };

    const handleDownloadTemplate = async () => {
        if (!currentProject) return;

        try {
            const response = await axios.get(`/api/errors/template?projectId=${currentProject.id}`, {
                responseType: "blob",
            });

            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "error_template.xlsx");
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast({
                title: "Échec du téléchargement",
                description: "Le modèle n'a pas pu être téléchargé.",
                status: "error",
            });
        }
    };

    const handleImportFile = async (file: File) => {
        if (!file || !currentProject) return;

        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv"
        ];
        const maxSize = 2 * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            toast({ title: t("error.toast.importFailed"), description: t("error.toast.invalidFileType"), status: "error" });
            return;
        }

        if (file.size > maxSize) {
            toast({ title: t("error.toast.importFailed"), description: t("error.toast.fileTooLarge"), status: "error" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(`/api/errors/import?projectId=${currentProject.id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            toast({
                title: t("error.toast.importSuccess"),
                description: t("error.toast.importResult", {
                    created: res.data.createdCount,
                    skipped: res.data.skippedCount,
                    reason: t("error.toast.reason.duplicateTag")
                }),
                status: "success"
            });

            mutate();
            setFileToImport(null);
            onClose();
        } catch (err: any) {
            toast({
                title: t("error.toast.importFailed"),
                description: err.response?.data?.message || "Unknown error",
                status: "error"
            });
        }
    };


    const handleDeleteConfirm = async () => {
        if (!deleteTarget || !currentProject) return;
        try {
            const res = await axios.delete(`/api/errors/${deleteTarget.id}?projectId=${currentProject.id}`);
            const isApproval = res.data.message?.includes("submitted for approval");
            toast({
                title: isApproval ? t("toast.error.deleteSubmitted") : t("toast.error.deleteSuccess"),
                status: isApproval ? "info" : "success"
            });

            mutate();
            closeDeleteModal();
        } catch (err: any) {
            toast({
                title: err.response?.data?.message || "Error",
                status: "error",
            });
        }
    };


    const handleDelete = async (error: Error) => {
        if (!currentProject) return;
        try {
            const res = await axios.get(`/api/errors/${error.id}?projectId=${currentProject.id}`);
            setDeleteTarget(res.data);
            openDeleteModal();
        } catch (err: any) {
            toast({ title: err.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleOpenCreateModal = () => {
        clearForm();
        setEditingItem(null);
        openModal();
    };

    if (!currentProject) {
        return (
            <Box p={6}>
                <Text fontSize="xl" color="gray.600" display="flex" alignItems="center" gap={2}>
                    <WarningIcon color="orange.400" boxSize={5} />
                    {t("project.noCurrentProject") || "You currently have no project selected. Please create or select a project first."}
                </Text>
            </Box>
        );
    }

    return (
        <div>
            <Box>
                <HStack justifyContent="space-between" mt={6} mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">{t("error.title")}</Text>
                    <Button leftIcon={<AddIcon />} onClick={handleOpenCreateModal} colorScheme="blue" mr="120px">{t("error.create")}</Button>
                </HStack>
                <HStack justifyContent="space-between" alignItems="center" mb={4}>
                    <Input
                        placeholder={t("error.searchPlaceholder")}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        maxW="600px"
                        size="lg"
                        borderRadius="md"
                        boxShadow="sm"
                    />

                    <HStack spacing={4} mr="120px">
                        <Button
                            variant="outline"
                            colorScheme="blue"
                            size="sm"
                            onClick={onOpen}
                        >
                            {t("error.importFile")}
                        </Button>

                    </HStack>
                </HStack>


                <Box overflowX="auto">
                <Table variant="simple">
                    <Thead>
                        <Tr>
                            <Th>{t("error.tag")}</Th>
                            <Th>{t("error.description")}</Th>
                            <Th>{t("error.actions")}</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {errors.length > 0 ? errors.map(e => (
                            <Tr key={e.id}>
                                <Td>{e.tag}</Td>
                                <Td>{e.description}</Td>
                                <Td>
                                    <HStack>
                                        <IconButton aria-label="view" size="sm" icon={<ViewIcon />} onClick={() => { setViewingId(e.id); openRelationModal(); }} />
                                        <IconButton aria-label="edit" size="sm" colorScheme="yellow" icon={<EditIcon />} onClick={() => handleEdit(e)} />
                                        <IconButton aria-label="delete" size="sm" colorScheme="red" icon={<DeleteIcon />} onClick={() => handleDelete(e)} />
                                    </HStack>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr><Td colSpan={3}><Text textAlign="center">{t("error.none")}</Text></Td></Tr>
                        )}
                    </Tbody>
                </Table>

                </Box>

                <HStack mt={4} justifyContent="center">
                    <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("prev")}</Button>
                    <Text>{page} / {totalPages}</Text>
                    <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
                </HStack>

                {/* 创建/编辑 Modal */}
                <Modal isOpen={isModalOpen} onClose={closeModal} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{editingItem ? t("error.editModalTitle") : t("error.createModalTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <FormControl isRequired isInvalid={!tagInput.trim()} mb={3}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("error.tag")}
                                    <Tooltip label={t("error.tagHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} />
                                {!tagInput.trim() && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                            </FormControl>

                            <FormControl isRequired isInvalid={!descriptionInput.trim()} mb={3}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("error.description")}
                                    <Tooltip label={t("error.descriptionHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={descriptionInput} onChange={e => setDescriptionInput(e.target.value)} />
                                {!descriptionInput.trim() && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                            </FormControl>

                            <FormControl mb={3}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("error.associatedTypes")}
                                    <Tooltip label={t("error.associatedTypesHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                    </Tooltip>
                                </FormLabel>

                                <CustomMultiSelect
                                    options={allTypes.map((t: TaskType) => ({
                                        label: `${t.taskId} - ${t.name}`,
                                        value: t.id,
                                    }))}
                                    value={selectedTypes}
                                    onChange={setSelectedTypes}
                                />
                            </FormControl>
                        </ModalBody>

                        <ModalFooter>
                            <Button colorScheme="blue" onClick={editingItem ? handleSaveEdit : handleAdd} isDisabled={!isValid}>{t("form.save")}</Button>
                            <Button onClick={closeModal} ml={3}>{t("form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* 删除确认 Modal */}
                <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t('error.confirmDelete')}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {deleteTarget && (
                                <>
                                    <Text fontWeight="bold" mb={2}>{t('error.tag')}:</Text>
                                    <Text mb={4}>{deleteTarget.tag}</Text>

                                    <Text fontWeight="bold" mb={2}>{t('error.description')}:</Text>
                                    <Text mb={4}>{deleteTarget.description}</Text>

                                    <Text fontWeight="bold" mb={2}>{t('error.associatedTypes')}:</Text>
                                    <VStack align="start" spacing={1}>
                                        {deleteTarget.associatedTypes && deleteTarget.associatedTypes.length > 0 ? (
                                            deleteTarget.associatedTypes.map((t: TaskType) => (
                                                <Box key={t.id}>• {t.taskId} - {t.name}</Box>
                                            ))
                                        ) : (
                                            <Text>{t('error.none')}</Text>
                                        )}
                                    </VStack>

                                </>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="red" mr={3} onClick={handleDeleteConfirm}>{t('form.delete')}</Button>
                            <Button onClick={closeDeleteModal}>{t('form.cancel')}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* 查看详情 Modal */}
                <Modal isOpen={isRelationOpen} onClose={() => { closeRelationModal(); setViewingId(null); }} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t('error.detailModalTitle')}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {detail ? (
                                <VStack align="start" spacing={5}>
                                    {/* Tag */}
                                    <Box>
                                        <Text fontWeight="bold">
                                            {t('error.tag')}
                                            <Tooltip label={t("error.tagHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        <Text>{detail.tag}</Text>
                                    </Box>

                                    {/* Description */}
                                    <Box>
                                        <Text fontWeight="bold">
                                            {t('error.description')}
                                            <Tooltip label={t("error.descriptionHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        <Text>{detail.description}</Text>
                                    </Box>

                                    {/* Associated TaskTypes */}
                                    <Box>
                                        <Text fontWeight="bold">
                                            {t('error.associatedTypes')}
                                            <Tooltip label={t("error.associatedTypesHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        <VStack align="start" mt={2}>
                                            {detail.associatedTypes && detail.associatedTypes.length > 0 ? (
                                                detail.associatedTypes.map((t: TaskType) => (
                                                    <Box key={t.id}>• {t.taskId} - {t.name}</Box>
                                                ))
                                            ) : (
                                                <Text>{t('error.none')}</Text>
                                            )}
                                        </VStack>
                                    </Box>
                                </VStack>
                            ) : (
                                <Text>{t('loading')}...</Text>
                            )}

                        </ModalBody>
                        <ModalFooter>
                            <Button onClick={() => { closeRelationModal(); setViewingId(null); }}>{t('form.close')}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                <Modal isOpen={isOpen} onClose={onClose}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t("error.importModalTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <VStack align="start" spacing={4}>
                                <Box>
                                    <Text fontSize="sm" mb={1}>
                                        {t("error.importInstructions")}
                                    </Text>
                                    <Button
                                        variant="link"
                                        colorScheme="blue"
                                        size="sm"
                                        onClick={handleDownloadTemplate}
                                        leftIcon={<DownloadIcon />}
                                    >
                                        {t("error.downloadTemplate")}
                                    </Button>
                                </Box>

                                <FormControl>
                                    <FormLabel>{t("error.selectFile")}</FormLabel>
                                    <Input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={(e) => setFileToImport(e.target.files?.[0] || null)}
                                    />
                                </FormControl>
                                {fileToImport && <Text fontSize="sm">📎 {fileToImport.name}</Text>}
                            </VStack>
                        </ModalBody>

                        <ModalFooter>
                            <Button
                                colorScheme="blue"
                                mr={3}
                                isDisabled={!fileToImport}
                                onClick={() => {
                                    if (fileToImport) {
                                        handleImportFile(fileToImport);
                                    }
                                }}
                            >
                                {t("error.form.import")}
                            </Button>
                            <Button onClick={onClose}>{t("error.form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>


            </Box>
        </div>
    );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'fr', ['common']))
    }
});


ErrorPage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(ErrorPage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = ErrorPage.getLayout;

export default ProtectedDashboardPage;
