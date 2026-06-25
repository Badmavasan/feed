import React, {useEffect, useState, useContext, ReactElement} from "react";
import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr, Th,
    Tbody, Td, Text, VStack, useDisclosure, useToast, FormControl, FormLabel, Tooltip, Icon, FormErrorMessage
} from "@chakra-ui/react";
import {AddIcon, DeleteIcon, EditIcon, InfoOutlineIcon, ViewIcon, WarningIcon} from "@chakra-ui/icons";

import { useTranslation } from "next-i18next";
import { FeedbackComponent, Feedback } from "@/types";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import useSWR, { mutate } from 'swr';
import axios from '@/utils/axiosInstance';
import { fetcher } from '@/utils/fetcher';
import { assetUrl } from '@/utils/assetUrl';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent
} from "@dnd-kit/core";
import {
    SortableContext, useSortable, arrayMove, verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useProjectContext } from "@/contexts/ProjectContext";
import withAuthProtection from "@/hoc/withAuthProtection";
import {NextPageWithLayout} from "@/pages/_app";

import SidebarLayout from "@/components/SidebarLayout";

interface SortableComponentProps {
    comp: FeedbackComponent;
}

function renderComponentPreview(component: FeedbackComponent) {
    const { type, content } = component;
    switch (type) {
        case "Text":
            return (
                <Box whiteSpace="pre-wrap" fontSize="sm" p={2}>
                    {content}
                </Box>
            );
        case "Image":
            return (
                <Box>
                    <img src={assetUrl(content)} alt="Image" style={{ maxHeight: "80px" }} />
                </Box>
            );
        case "Code":
            return (
                <Box as="pre" fontFamily="mono" fontSize="sm" bg="gray.100" p={2} borderRadius="md">
                    {content}
                </Box>
            );
        default:
            return <Box>{content}</Box>;
    }
}

export function SortableComponent({ comp }: SortableComponentProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: comp.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        border: "1px dashed #ccc",
        padding: "8px",
        marginBottom: "8px",
        cursor: "grab",
        background: "#f9f9f9",
    };

    return (
        <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {renderComponentPreview(comp)}
        </Box>
    );
}

function FeedbackPage  () {

        const toast = useToast();
        const { t } = useTranslation("common");
        const { currentProject } = useProjectContext();

        const [page, setPage] = useState(1);
        const [search, setSearch] = useState("");
        const [selectedComponents, setSelectedComponents] = useState<FeedbackComponent[]>([]);
        const [components, setComponents] = useState<FeedbackComponent[]>([]);
        const [feedbackCodeInput, setFeedbackCodeInput] = useState("");
        const [descriptionInput, setDescriptionInput] = useState("");
        const [editingItem, setEditingItem] = useState<Feedback | null>(null);
        const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
        const [deleteTarget, setDeleteTarget] = useState<any>(null);

        const { isOpen: isDeleteOpen, onOpen: openDeleteModal, onClose: closeDeleteModal } = useDisclosure();
        const { isOpen, onOpen, onClose } = useDisclosure();
        const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
        const sensors = useSensors(useSensor(PointerSensor));

        const { data, error } = useSWR(
            currentProject?.id ? `/api/feedbacks?page=${page}&limit=10&search=${search}&projectId=${currentProject.id}` : null,
            fetcher
        );
        useEffect(() => {
            if (!currentProject?.id) return;
            axios.get(`/api/components/selectable?projectId=${currentProject.id}`).then(res => {
                setComponents(res.data);
            });
        }, [currentProject?.id]);

        // hook 全部声明完之后再进行条件返回
    if (!currentProject) {
        return (
            <Box p={6}>
                <Text fontSize="xl" color="gray.600" display="flex" alignItems="center" gap={2}>
                    <WarningIcon color="orange.400" boxSize={5} />
                    {t('project.noCurrentProject') || "Please select a project first."}
                </Text>
            </Box>
        );
    }

        const feedbacks = data?.feedbacks ?? [];
        const totalPages = data?.totalPages ?? 1;



    const clearForm = () => {
        setFeedbackCodeInput("");
        setDescriptionInput("");
        setSelectedComponents([]);
        setEditingItem(null);
    };

    const openCreateModal = () => {
        clearForm();
        onOpen();
    };

    const handleCreateOrUpdate = async () => {
        if (!feedbackCodeInput.trim() ||  selectedComponents.length === 0) {
            toast({ title: t("form.requiredFields"), status: "error" });
            return;
        }

        const payload = {
            feedback_code: feedbackCodeInput,
            description: descriptionInput,
            components: selectedComponents.map((c, i) => ({ id: c.id, position: i }))
        };

        try {
            if (editingItem) {
                // projectId 放入 query 参数
                const res = await axios.put(`/api/feedbacks/${editingItem.id}?projectId=${currentProject.id}`, payload);

                const isApproval = res.data.message?.includes("submitted for approval");
                toast({
                    title: isApproval ? t("toast.error.deleteSubmitted") : t("toast.error.deleteSuccess"),
                    status: isApproval ? "info" : "success"
                });
            } else {
                // 新建时仍然将 projectId 放在 body 中
                await axios.post('/api/feedbacks', { ...payload, projectId: currentProject.id });
                toast({ title: t("toast.createSuccess"), status: "success" });
            }

            onClose();
            clearForm();
            mutate(`/api/feedbacks?page=${page}&limit=10&search=${search}&projectId=${currentProject.id}`);
        } catch (err: any) {
            toast({ title: err.response?.data?.message || 'Erreur', status: 'error' });
        }
    };


    const handleDeleteClick = async (feedback: Feedback) => {
        try {
            // GET 请求 projectId 放在 query 参数中
            const res = await axios.get(`/api/feedbacks/${feedback.id}?projectId=${currentProject.id}`);
            setDeleteTarget(res.data);
            openDeleteModal();
        } catch (err) {
            toast({ title: "Erreur lors du chargement", status: "error" });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget?.id) return;

        try {
            // DELETE 请求 projectId 放在 query 参数中
            await axios.delete(`/api/feedbacks/${deleteTarget.id}?projectId=${currentProject.id}`);
            toast({ title: t("toast.feedback.deleteSuccess"), status: "success" });
            closeDeleteModal();
            mutate(`/api/feedbacks?page=${page}&limit=10&search=${search}&projectId=${currentProject.id}`);
        } catch (e: any) {
            toast({ title: e.response?.data?.message || "Erreur", status: "error" });
        }
    };

    const handleView = async (fb: Feedback) => {
        try {
            // GET 请求 projectId 放在 query 参数中
            const res = await axios.get(`/api/feedbacks/${fb.id}?projectId=${currentProject.id}`);
            setSelectedFeedback(res.data);
            onViewOpen();
        } catch (err) {
            toast({ title: "Erreur lors du chargement", status: "error" });
        }
    };


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = selectedComponents.findIndex(c => c.id === active.id);
            const newIndex = selectedComponents.findIndex(c => c.id === over?.id);
            setSelectedComponents((items) => arrayMove(items, oldIndex, newIndex));
        }
    };
    
    return (
        <div>
            <Box>
                <HStack justifyContent="space-between" mt={6} mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">{t("feedback.title")}</Text>
                    <Button leftIcon={<AddIcon />} onClick={openCreateModal} colorScheme="blue" mr="120px">
                        {t("feedback.createButton")}
                    </Button>
                </HStack>

                <Input
                    placeholder={t("feedback.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    width="100%"
                    maxW="600px"
                    size="lg"
                    mb={4}
                    borderRadius="md"
                    boxShadow="sm"
                />

                <Box overflowX="auto">
                <Table>
                    <Thead>
                        <Tr><Th>{t("feedback.tag")}</Th><Th>{t("feedback.description")}</Th><Th>{t("common.actions")}</Th></Tr>
                    </Thead>
                    <Tbody>
                        {feedbacks.map((fb: Feedback) => (
                            <Tr key={fb.id}>
                                <Td>{fb.feedback_code}</Td>
                                <Td>{fb.description}</Td>
                                <Td>
                                    <HStack>
                                        <IconButton icon={<ViewIcon />} onClick={() => handleView(fb)} aria-label='view' />
                                        <IconButton
                                            icon={<EditIcon />}
                                            colorScheme="yellow"
                                            aria-label="edit"
                                            onClick={() => {
                                                setEditingItem(fb);
                                                setFeedbackCodeInput(fb.feedback_code);
                                                setDescriptionInput(fb.description);

                                                axios
                                                    .get(`/api/feedbacks/${fb.id}?projectId=${currentProject.id}`)
                                                    .then((res) => {
                                                        const compIds = res.data.components.map((c: any) => c.id);
                                                        const selected = components.filter((c) => compIds.includes(c.id));
                                                        setSelectedComponents(selected);
                                                        onOpen();
                                                    });
                                            }}
                                        />

                                        <IconButton
                                            icon={<DeleteIcon />}
                                            colorScheme="red"
                                            aria-label="delete"
                                            onClick={() => handleDeleteClick(fb)}
                                        />
                                    </HStack>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
                    </Box>

                <HStack mt={4} justifyContent="center">
                    <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("prev")}</Button>
                    <Text>{page} / {totalPages}</Text>
                    <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
                </HStack>

                {/* Create/Edit Modal */}
                <Modal isOpen={isOpen} onClose={onClose} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>
                            {editingItem ? t('feedback.editTitle') : t('feedback.createTitle')}
                        </ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {/* FeedbackTag */}
                            <FormControl isRequired isInvalid={!feedbackCodeInput.trim()} mb={3}>
                                <FormLabel>
                                    {t("feedback.codeLabel")}
                                    <Tooltip label={t("feedback.codeHelp")} fontSize="md">
        <span>
          <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
        </span>
                                    </Tooltip>
                                </FormLabel>
                                <Input
                                    value={feedbackCodeInput}
                                    onChange={(e) => setFeedbackCodeInput(e.target.value)}
                                />
                                {!feedbackCodeInput.trim() && (
                                    <FormErrorMessage>{t("form.required")}</FormErrorMessage>
                                )}
                            </FormControl>

                            {/* Description */}
                            <FormControl mb={3}>
                                <FormLabel>
                                    {t("feedback.descriptionLabel")}
                                    <Tooltip label={t("feedback.descriptionHelp")} fontSize="md">
        <span>
          <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
        </span>
                                    </Tooltip>
                                </FormLabel>
                                <Input
                                    value={descriptionInput}
                                    onChange={(e) => setDescriptionInput(e.target.value)}
                                />
                            </FormControl>

                            {/* Composants */}
                            <FormControl
                                isRequired
                                isInvalid={selectedComponents.length === 0}
                                mb={3}
                            >
                                <FormLabel>
                                    {t("feedback.componentsLabel")}
                                    <Tooltip label={t("feedback.componentsHelp")} fontSize="md">
                                    <span>
                                      <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
                                    </span>
                                    </Tooltip>
                                </FormLabel>
                                <CustomMultiSelect
                                    options={components.map((c) => ({
                                        label: `${c.tag} - ${c.description || ""}`,
                                        value: c.id,
                                    }))}
                                    value={selectedComponents.map((c) => c.id)}
                                    onChange={(ids: number[]) => {
                                        const selected = ids
                                            .map((id) => components.find((c) => c.id === id))
                                            .filter((c): c is FeedbackComponent => !!c && !!c.content);
                                        setSelectedComponents(selected);
                                    }}
                                />
                                {selectedComponents.length === 0 && (
                                    <FormErrorMessage>{t("form.required")}</FormErrorMessage>
                                )}
                            </FormControl>

                            {/* Ordre */}
                            {selectedComponents.length > 0 && (
                                <Box mt={4}>
                                    <Text fontWeight="bold">
                                        {t("feedback.orderLabel")}
                                        <Tooltip label={t("feedback.orderHelp")} fontSize="md">
          <span>
            <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
          </span>
                                        </Tooltip>
                                    </Text>
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={selectedComponents.map((c) => c.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {selectedComponents.map((c) => (
                                                <SortableComponent key={c.id} comp={c} />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </Box>
                            )}
                        </ModalBody>


                        <ModalFooter>
                            <Button colorScheme="blue" onClick={handleCreateOrUpdate} isDisabled={
                                !feedbackCodeInput.trim() ||
                                selectedComponents.length === 0
                            }>
                                {editingItem ? t("common.edit") : t("common.submit")}

                            </Button>
                            <Button ml={3} onClick={onClose}>{t("common.cancel")}</Button>

                        </ModalFooter>
                    </ModalContent>
                </Modal>


                {/* View Modal */}
                <Modal isOpen={isViewOpen} onClose={onViewClose} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t("feedback.detailTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {selectedFeedback && (
                                <Box>
                                    {/* Tag */}
                                    <Text fontWeight="bold" mt={0}>
                                        {t("feedback.codeLabel")}
                                        <Tooltip label={t("feedback.codeHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{selectedFeedback.feedback_code}</Text>

                                    {/* Description */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("feedback.descriptionLabel")}
                                        <Tooltip label={t("feedback.descriptionHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    <Text>
                                        {selectedFeedback.description || (
                                            <Text color="gray.500" fontStyle="italic">{t("form.none")}</Text>
                                        )}
                                    </Text>

                                    {/* Components */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("feedback.componentsLabel")}
                                        <Tooltip label={t("feedback.componentsHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    <Box
                                        borderWidth="1px"
                                        borderRadius="md"
                                        borderColor="gray.200"
                                        bg="gray.50"
                                        p={3}
                                        mt={2}
                                        w="100%"
                                    >
                                        <VStack spacing={4} align="stretch">
                                            {selectedFeedback.components.length > 0 ? (
                                                selectedFeedback.components.map((c: any, i: number) => (
                                                    <Box
                                                        key={i}
                                                        borderWidth="1px"
                                                        borderRadius="md"
                                                        borderColor="gray.300"
                                                        bg="white"
                                                        p={3}
                                                        shadow="sm"
                                                    >
                                                        {renderComponentPreview(c)}
                                                    </Box>
                                                ))
                                            ) : (
                                                <Text color="gray.500" fontStyle="italic">{t("form.none")}</Text>
                                            )}
                                        </VStack>
                                    </Box>

                                    {/* Errors */}
                                    <Text fontWeight="bold" mt={4}>
                                        {t("form.associatedError")}
                                        <Tooltip label={t("feedback.errorsHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    {selectedFeedback.erreurs?.length > 0 ? (
                                        <VStack align="start" spacing={1}>
                                            {selectedFeedback.erreurs.map((e: any, i: number) => (
                                                <Box key={i}>
                                                    <b>{e.error_tag}</b> — {e.description}
                                                </Box>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text color="gray.500" fontStyle="italic">{t("form.none")}</Text>
                                    )}

                                    {/* Exercises */}
                                    <Text fontWeight="bold" mt={4}>
                                        {t("form.associatedExercises")}
                                        <Tooltip label={t("feedback.exercisesHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    {selectedFeedback.exercices?.length > 0 ? (
                                        <VStack align="start" spacing={1}>
                                            {selectedFeedback.exercices.map((e: any, i: number) => (
                                                <Box key={i}>• {e.title}</Box>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text color="gray.500" fontStyle="italic">{t("form.none")}</Text>
                                    )}

                                    {/* Task Types */}
                                    <Text fontWeight="bold" mt={4}>
                                        {t("form.associatedTypes")}
                                        <Tooltip label={t("feedback.typesHelp")} fontSize="md">
              <span>
                <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
              </span>
                                        </Tooltip>
                                    </Text>
                                    {selectedFeedback.typesDeTaches?.length > 0 ? (
                                        <VStack align="start" spacing={1}>
                                            {selectedFeedback.typesDeTaches.map((t: any, i: number) => (
                                                <Box key={i}>• {t.taskId} — {t.nom}</Box>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text color="gray.500" fontStyle="italic">{t("form.none")}</Text>
                                    )}
                                </Box>
                            )}
                        </ModalBody>

                        <ModalFooter>
                            <Button onClick={onViewClose}>{t("common.close")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>


                {/* Delete Confirmation Modal */}
                <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t("feedback.deleteConfirmTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <Text mb={3}>
                                {t("feedback.deleteConfirmText", { id: deleteTarget?.feedback_code })}
                            </Text>

                            {/* 显示每个组件及其关联内容 */}
                            {deleteTarget?.feedbackComponentsMapping?.map((mapping: any, index: number) => {
                                const c = mapping.component;
                                return (
                                    <Box key={index} mt={4} p={3} borderWidth="1px" borderRadius="md">
                                        <Text fontWeight="bold">{t("form.type")}: {c.type}</Text>
                                        <Text>{c.content?.slice(0, 80)}...</Text>

                                        <Text fontWeight="semibold" mt={2}>{t("form.associatedExercises")}:</Text>
                                        {c.exercises?.length > 0
                                            ? c.exercises.map((e: any, idx: number) => (
                                                <Text key={idx}>• {e.exercise?.title}</Text>
                                            ))
                                            : <Text>{t("form.none")}</Text>}

                                        <Text fontWeight="semibold" mt={2}>{t("form.associatedTypes")}:</Text>
                                        {c.taskTypes?.length > 0
                                            ? c.taskTypes.map((t: any, idx: number) => (
                                                <Text key={idx}>• {t.taskType?.task_code} - {t.taskType?.task_name}</Text>
                                            ))
                                            : <Text>{t("form.none")}</Text>}

                                        <Text fontWeight="semibold" mt={2}>{t("form.associatedError")}:</Text>
                                        {c.error
                                            ? <Text>• {c.error.error_tag} - {c.error.description}</Text>
                                            : <Text>{t("form.none")}</Text>}
                                    </Box>
                                );
                            })}
                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="red" mr={3} onClick={handleConfirmDelete}>
                                {t("form.delete")}
                            </Button>
                            <Button onClick={closeDeleteModal}>{t("form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </Box>
        </div>
    );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common'])),
        },
    };
};

FeedbackPage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedPage = withAuthProtection(FeedbackPage) as NextPageWithLayout;
ProtectedPage.getLayout = FeedbackPage.getLayout;

export default ProtectedPage;


