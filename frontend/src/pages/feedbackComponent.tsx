import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, useDisclosure, useToast, FormControl, FormLabel,
    VStack, Select, FormErrorMessage, Image, Tooltip, Icon, Textarea, Flex
} from "@chakra-ui/react";
import {AddIcon, DeleteIcon, EditIcon, InfoOutlineIcon, ViewIcon, WarningIcon} from "@chakra-ui/icons";
import React, { ReactElement,  useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import useSWR from "swr";
import axios from '@/utils/axiosInstance';
import { fetcher } from '@/utils/fetcher';
import CustomMultiSelect from '@/components/CustomMultiSelect';
import { Editor } from '@monaco-editor/react';

import { TaskType } from '@/types/taskType';
import type { Error } from "@/types/error";
import { Exercise } from "@/types/exercise";
import { FeedbackComponent, FeedbackComponentDetail } from '@/types/feedbackComponent';
import { useProjectContext } from '@/contexts/ProjectContext';

import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { isAxiosError } from "axios";
import withAuthProtection from "@/hoc/withAuthProtection";
import { NextPageWithLayout } from "@/pages/_app";
import SidebarLayout from "@/components/SidebarLayout";

function FeedbackComponentPage() {
    const { t } = useTranslation("common");
    const toast = useToast();
    const { currentProject } = useProjectContext();

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const [tagInput, setTagInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState<string | null>(null);

    const [selectedType, setSelectedType] = useState<'Text' | 'Image' | 'Code'>('Text');
    const [contentInput, setContentInput] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [natureInput, setNatureInput] = useState<'technique' | 'logos' | 'exemple' | 'erreur_pointée'>('technique');
    const [selectedExercises, setSelectedExercises] = useState<number[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
    const [selectedErrors, setSelectedErrors] = useState<number[]>([]);

    const [editingItem, setEditingItem] = useState<FeedbackComponent | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<FeedbackComponentDetail | null>(null);
    const [viewingItem, setViewingItem] = useState<FeedbackComponentDetail | null>(null);

    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    const pid = currentProject?.id;
    const shouldFetch = !!pid;

    const { data: componentData, mutate } = useSWR(
        shouldFetch ? `/api/components?page=${page}&limit=10&search=${search}&projectId=${pid}` : null,
        fetcher
    );
    const components: FeedbackComponent[] = componentData?.components || [];
    const totalPages = componentData?.totalPages || 1;

    const { data: typeOptions = [] } = useSWR(shouldFetch ? `/api/types/selectable?projectId=${pid}` : null, fetcher);
    const { data: exerciseOptions = [] } = useSWR(shouldFetch ? `/api/exercises/selectable?projectId=${pid}` : null, fetcher);
    const { data: errorOptions = [] } = useSWR(shouldFetch ? `/api/errors/selectable?projectId=${pid}` : null, fetcher);

    const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDeleteModal, onClose: closeDeleteModal } = useDisclosure();
    const { isOpen: isRelationOpen, onOpen: openRelationModal, onClose: closeRelationModal } = useDisclosure();

    const [codeLang, setCodeLang] = useState("python");

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

    const clearForm = () => {
        setEditingItem(null);
        setTagInput("");
        setDescriptionInput("");
        setSelectedType("Text");
        setNatureInput("technique");
        setContentInput("");
        setPreviewUrl(null);
        setSelectedExercises([]);
        setSelectedTypes([]);
        setSelectedErrors([]);
        setImageFile(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
    };

    const handleImageUpload = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast({ title: "Only image files are allowed.", status: "error" });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast({ title: "Image must be smaller than 2MB.", status: "error" });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setPreviewUrl(base64);
        };
        reader.readAsDataURL(file);
        setImageFile(file);
    };

    const handleSave = async () => {
        if (!currentProject) return;

        try {
            if (selectedType === 'Image') {
                if (!imageFile) {
                    toast({ title: "Veuillez choisir une image", status: "error" });
                    return;
                }

                const formData = new FormData();
                formData.append("tag", tagInput.trim());
                formData.append("description", (descriptionInput ?? "").trim());
                formData.append("type", selectedType);
                formData.append("nature", natureInput);
                if (imageFile) {
                    formData.append("image", imageFile);
                }
                formData.append("projectId", String(currentProject.id));
                formData.append("associatedTypeIds", JSON.stringify(selectedTypes));
                formData.append("associatedExerciseIds", JSON.stringify(selectedExercises));
                if (natureInput === "erreur_pointée") {
                    formData.append("pointedErrorIds", JSON.stringify(selectedErrors));
                }

                if (editingItem) {
                    await axios.put(`/api/components/${editingItem.id}`, formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                    toast({ title: "Modifié avec succès", status: "success" });
                } else {
                    await axios.post("/api/components", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                    toast({ title: "Créé avec succès", status: "success" });
                }
            } else {
                const payload = {
                    tag: tagInput.trim(),
                    description: (descriptionInput ?? "").trim(),
                    type: selectedType,
                    nature: natureInput,
                    content: contentInput,
                    associatedTypeIds: selectedTypes,
                    associatedExerciseIds: selectedExercises,
                    pointedErrorIds: natureInput === "erreur_pointée" ? selectedErrors : [],
                    projectId: currentProject.id
                };

                if (editingItem) {
                    await axios.put(`/api/components/${editingItem.id}`, payload);
                    toast({ title: "Modifié avec succès", status: "success" });
                } else {
                    await axios.post("/api/components", payload);
                    toast({ title: "Créé avec succès", status: "success" });
                }
            }

            mutate();
            closeModal();
            clearForm();
        } catch (err) {
            let message = "Erreur inconnue";
            if (isAxiosError(err) && err.response) {
                message = err.response.data?.message || message;
            }
            toast({ title: message, status: "error" });
        }
    };
    const isValid =
        tagInput.trim() &&
        (
            (selectedType === "Text" && contentInput.trim()) ||
            (selectedType === "Code" && contentInput.trim()) ||
            (selectedType === "Image" && (imageFile || previewUrl))
        );


    const handleCodeChange = (value: string | undefined) => {
        setContentInput(value || "");
    };


    const openCreateModal = () => {
        clearForm();
        openModal();
    };

    const handleEditInit = async (comp: FeedbackComponent) => {
        try {
            const res = await axios.get(`/api/components/${comp.id}?projectId=${pid}`);
            const detail: FeedbackComponentDetail = res.data;
            setEditingItem(detail);
            setTagInput(detail.tag);
            setDescriptionInput(detail.description ?? null);
            setSelectedType(detail.type);
            setContentInput(detail.content);
            setPreviewUrl(detail.type === 'Image' ? detail.content : null);
            setNatureInput(detail.nature);
            setSelectedExercises(detail.associatedExercises?.map(e => e.id) || []);
            setSelectedTypes(detail.associatedTypes?.map(t => t.id) || []);
            setSelectedErrors(detail.pointedError?.map(e => e.id) || []);
            openModal();
        } catch {
            toast({ title: "Erreur lors du chargement des détails", status: "error" });
        }
    };

    const handleDelete = async (component: FeedbackComponent) => {
        try {
            const res = await axios.get(`/api/components/${component.id}?projectId=${pid}`);
            setDeleteTarget(res.data);
            openDeleteModal();
        } catch (error: unknown) {
            let message = "Erreur inconnue";
            if (isAxiosError(error)) {
                message = error.response?.data?.message || message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            toast({ title: message, status: "error" });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            await axios.delete(`/api/components/${deleteTarget.id}?projectId=${pid}`);
            toast({ title: t("toast.component.deleteSuccess"), status: "success" });
            mutate();
            closeDeleteModal();
        } catch (e) {
            let message = "Erreur lors de la suppression";
            if (isAxiosError(e) && e.response) {
                message = e.response.data?.message || message;
            }
            toast({ title: message, status: "error" });
        }
    };

// handleViewDetails: 查看详情
    const handleViewDetails = async (comp: FeedbackComponent) => {
        if (!currentProject) {
            toast({ title: "Projet introuvable", status: "error" });
            return;
        }


        try {
            const res = await axios.get(`/api/components/${comp.id}?projectId=${currentProject.id}`);
            setViewingItem(res.data);
            openRelationModal();
        } catch {
            toast({ title: "Erreur lors du chargement du composant", status: "error" });
        }
    };



    return (
        <div>
            <Box>
                <HStack justifyContent="space-between" mt={6} mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">{t("component.title")}</Text>
                    <Button leftIcon={<AddIcon />} onClick={openCreateModal} colorScheme="blue" mr="120px">
                        {t("component.createButton")}
                    </Button>
                </HStack>

                <Input
                    placeholder={t("component.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    maxW="600px"
                    size="lg"
                    mb={4}
                    borderRadius="md"
                    boxShadow="sm"
                />
                <Box overflowX="auto">
                <Table variant="simple">
                    <Thead>
                        <Tr>
                            <Th>{t("component.tag")}</Th>
                            <Th>{t("component.description")}</Th>
                            <Th>{t("component.type")}</Th>
                            <Th>{t("component.nature")}</Th>
                            <Th>{t("common.actions")}</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {components.map((c) => (
                            <Tr key={c.id}>
                                <Td>{c.tag}</Td>
                                <Td>{c.description}</Td>
                                <Td>{c.type}</Td>
                                <Td>{c.nature}</Td>
                                <Td>
                                    <HStack>
                                        <IconButton
                                            icon={<ViewIcon />}
                                            aria-label="view"
                                            size="sm"
                                            onClick={() => handleViewDetails(c)}
                                        />
                                        <IconButton icon={<EditIcon />} aria-label="edit" size="sm" colorScheme="yellow" onClick={() => handleEditInit(c)} />
                                        <IconButton
                                            icon={<DeleteIcon />}
                                            aria-label="delete"
                                            size="sm"
                                            colorScheme="red"
                                            onClick={() => handleDelete(c)}
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

                {/* 创建/编辑 Modal */}
                <Modal isOpen={isModalOpen} onClose={closeModal} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>
                            {editingItem ? t("component.form.editTitle") : t("component.form.createTitle")}
                        </ModalHeader>

                        <ModalBody>
                            {/* tag */}
                            <FormControl isRequired isInvalid={!tagInput.trim()} mb={3}>
                                <FormLabel>
                                    {t("component.form.codeLabel")}
                                    <Tooltip label={t("component.form.codeHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
                                {!tagInput.trim() && <FormErrorMessage>{t("component.form.required")}</FormErrorMessage>}
                            </FormControl>

                            {/* description */}
                            <FormControl mb={3}>
                                <FormLabel>
                                    {t("component.form.description")}
                                    <Tooltip label={t("component.form.descriptionHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={descriptionInput ?? ""} onChange={(e) => setDescriptionInput(e.target.value)} />
                            </FormControl>

                            {/* type */}
                            <FormControl isRequired mb={3}>
                                <FormLabel>
                                    {t("component.form.type")}
                                    <Tooltip label={t("component.form.typeHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value as 'Text' | 'Image' | 'Code')}
                                >
                                    <option value="Text">{t("component.typeOptions.text")}</option>
                                    <option value="Image">{t("component.typeOptions.image")}</option>
                                    <option value="Code">{t("component.typeOptions.code")}</option>
                                </Select>
                            </FormControl>

                            {/* text */}
                            {selectedType === 'Text' && (
                                <FormControl isRequired isInvalid={!contentInput.trim()} mb={3}>
                                    <FormLabel>
                                        {t("component.form.text")}
                                        <Tooltip label={t("component.form.textHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </FormLabel>

                                    {/* 原来的 Input 替换为 Textarea */}
                                    <Textarea
                                        value={contentInput}
                                        onChange={(e) => setContentInput(e.target.value)}
                                        placeholder={t("component.form.textPlaceholder")}
                                        resize="vertical" // 可以让用户拖动调整高度
                                    />

                                    {!contentInput.trim() && (
                                        <FormErrorMessage>{t("component.form.required")}</FormErrorMessage>
                                    )}
                                </FormControl>

                            )}

                            {/* image */}
                            {selectedType === 'Image' && (
                                <FormControl
                                    isRequired
                                    isInvalid={selectedType === "Image" && !previewUrl && !imageFile}
                                    mb={3}
                                >
                                    <FormLabel>
                                        {t("component.form.image")}
                                        <Tooltip label={t("component.form.imageHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </FormLabel>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                    />
                                    <Text mt={1} fontSize="sm" color="gray.500">
                                        {t("component.form.imageNote")}
                                    </Text>
                                    {previewUrl && <Image src={previewUrl} maxH="200px" mt={2} borderRadius="md" />}
                                    {!previewUrl && !imageFile && (
                                        <FormErrorMessage>{t("component.form.required")}</FormErrorMessage>
                                    )}
                                </FormControl>
                            )}

                            {selectedType === 'Code' && (
                                <>
                                    {/* 语言选择器 */}
                                    <FormControl isRequired isInvalid={!contentInput.trim()} mb={3}>
                                        <FormLabel mb={1}>
                                            <Flex align="center" gap={2}>
                                                <Text>{t("component.form.code")}</Text>
                                                <Tooltip label={t("component.form.codeHelp")} fontSize="md">
                                                    <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                                </Tooltip>
                                                <Select
                                                    value={codeLang}
                                                    onChange={(e) => setCodeLang(e.target.value)}
                                                    variant="unstyled"
                                                    fontWeight="medium"
                                                    color="blue.500"
                                                    width="auto"
                                                    textAlign="left" // 让下拉内容左对齐
                                                    pl={1}            // 稍微留点内边距
                                                >
                                                    <option style={{ textAlign: "left" }} value="python">Python</option>
                                                    <option style={{ textAlign: "left" }} value="javascript">JavaScript</option>
                                                    <option style={{ textAlign: "left" }} value="typescript">TypeScript</option>
                                                    <option style={{ textAlign: "left" }} value="java">Java</option>
                                                    <option style={{ textAlign: "left" }} value="c">C</option>
                                                    <option style={{ textAlign: "left" }} value="cpp">C++</option>
                                                    <option style={{ textAlign: "left" }} value="html">HTML</option>
                                                    <option style={{ textAlign: "left" }} value="markdown">Markdown</option>
                                                </Select>

                                            </Flex>
                                        </FormLabel>

                                        <Editor
                                            height="300px"
                                            language={codeLang}
                                            theme="vs-dark"
                                            value={contentInput}
                                            onChange={handleCodeChange}
                                        />
                                    </FormControl>


                                </>
                            )}


                            {/* nature */}
                            <FormControl isRequired mb={3}>
                                <FormLabel>
                                    {t("component.form.nature")}
                                    <Tooltip label={t("component.form.natureHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Select
                                    value={natureInput}
                                    onChange={(e) =>
                                        setNatureInput(e.target.value as 'technique' | 'logos' | 'exemple' | 'erreur_pointée')
                                    }
                                >
                                    <option value="technique">{t("component.natureOptions.technique")}</option>
                                    <option value="logos">{t("component.natureOptions.logos")}</option>
                                    <option value="exemple">{t("component.natureOptions.exemple")}</option>
                                    <option value="erreur_pointée">{t("component.pointedError")}</option>
                                </Select>
                            </FormControl>

                            {/* pointed error */}
                            {natureInput === 'erreur_pointée' && (
                                <FormControl isRequired mb={3}>
                                    <FormLabel>
                                        {t("component.pointedError")}
                                        <Tooltip label={t("component.form.associatedErrorHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </FormLabel>
                                    <Select
                                        value={selectedErrors[0] || ""}
                                        onChange={(e) => {
                                            const id = parseInt(e.target.value);
                                            setSelectedErrors([id]);
                                        }}
                                    >
                                        {errorOptions.map((e: Error) => (
                                            <option key={e.id} value={e.id}>{e.tag}</option>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                            {/* exercises */}
                            <CustomMultiSelect
                                label={
                                    <>
                                        {t("component.associatedExercises")}
                                        <Tooltip label={t("component.form.associatedExercisesHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </>
                                }
                                options={exerciseOptions.map((e: Exercise) => ({ label: e.title, value: e.id }))}
                                value={selectedExercises}
                                onChange={setSelectedExercises}
                            />

                            {/* task types */}
                            <CustomMultiSelect
                                label={
                                    <>
                                        {t("component.associatedTypes")}
                                        <Tooltip label={t("component.form.associatedTypesHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </>
                                }
                                options={typeOptions.map((t: TaskType) => ({ label: `${t.taskId} - ${t.name}`, value: t.id }))}
                                value={selectedTypes}
                                onChange={setSelectedTypes}
                            />
                        </ModalBody>


                        <ModalFooter>
                            <Button colorScheme="blue" onClick={handleSave} isDisabled={!isValid}>{t("component.form.save")}</Button>
                            <Button onClick={closeModal} ml={3}>{t("component.form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* 删除确认 Modal */}
                <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t("component.deleteTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <Text mb={2}>{t("component.deleteConfirmText")}</Text>

                            {deleteTarget && (
                                <Box mt={4}>

                                    <Text fontWeight="bold">{t("component.pointedError")}:</Text>
                                    {deleteTarget.pointedError && deleteTarget.pointedError.length > 0 ? (
                                        <VStack align="start" spacing={1} mt={1} mb={2}>
                                            {deleteTarget.pointedError.map((err) => (
                                                <Text key={err.id}>• {err.tag} - {err.description}</Text>
                                            ))}
                                        </VStack>
                                    ) : (
                                        <Text>{t("component.form.none")}</Text>
                                    )}

                                    <Text fontWeight="bold">{t("component.form.associatedExercises")}:</Text>
                                    <VStack align="start" spacing={1} mt={1} mb={2}>
                                        {deleteTarget.associatedExercises && deleteTarget.associatedExercises.length > 0 ? (
                                            deleteTarget.associatedExercises.map((e: { id: number; title: string; description: string }) => (
                                                <Text key={e.id}>• {e.title}</Text>
                                            ))

                                        ) : (
                                            <Text>{t("component.form.none")}</Text>
                                        )}
                                    </VStack>

                                    <Text fontWeight="bold">{t("component.form.associatedTypes")}:</Text>
                                    <VStack align="start" spacing={1} mt={1} mb={2}>
                                        {deleteTarget.associatedTypes && deleteTarget.associatedTypes.length > 0 ? (
                                            deleteTarget.associatedTypes.map((t: TaskType) => (
                                                <Text key={t.id}>• {t.taskId} - {t.name}</Text>
                                            ))
                                        ) : (
                                            <Text>{t("component.form.none")}</Text>
                                        )}
                                    </VStack>
                                    {/* Referenced Feedbacks */}
                                    {(deleteTarget.referencedFeedbacks?.length ?? 0) > 0 && (
                                        <>
                                            <Text fontWeight="bold">{t("component.form.feedbackReferences")}:</Text>
                                            <VStack align="start" spacing={1} mt={1} mb={2}>
                                                {deleteTarget.referencedFeedbacks!.map((fb: { id: number; feedback_code: string; description?: string }) => (
                                                    <Text key={fb.id}>• {fb.feedback_code}{fb.description ? ` - ${fb.description}` : ""}</Text>
                                                ))}
                                            </VStack>
                                        </>
                                    )}



                                </Box>
                            )}

                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="red" mr={3} onClick={handleConfirmDelete}>
                                {t("component.form.delete")}
                            </Button>
                            <Button onClick={closeDeleteModal}>{t("component.form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* 查看详情 Modal */}
                <Modal isOpen={isRelationOpen} onClose={closeRelationModal} size="lg">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t('component.detailModalTitle')}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {viewingItem && (
                                <Box>
                                    {/* tag */}
                                    <Text fontWeight="bold">
                                        {t("component.form.codeLabel")}
                                        <Tooltip label={t("component.form.codeHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{viewingItem.tag}</Text>

                                    {/* description */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("component.form.description")}
                                        <Tooltip label={t("component.form.descriptionHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>
                                        {viewingItem.description || (
                                            <Text color="gray.500" fontStyle="italic">{t("component.form.none")}</Text>
                                        )}
                                    </Text>

                                    {/* type */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("component.form.type")}
                                        <Tooltip label={t("component.form.typeHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{viewingItem.type}</Text>

                                    {/* content */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("component.form.content")}
                                        <Tooltip label={t("component.form.contentHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    {viewingItem.type === 'Text' && (
                                        <Box whiteSpace="pre-line">
                                            {viewingItem.content}
                                        </Box>
                                    )}
                                    {viewingItem.type === 'Image' && (
                                        viewingItem.content ? (
                                            <Image src={viewingItem.content} alt="preview" maxH="300px" mt={2} borderRadius="md" />
                                        ) : (
                                            <Text color="gray.500" fontStyle="italic">{t("component.form.none")}</Text>
                                        )
                                    )}
                                    {viewingItem.type === 'Code' && (
                                        <Editor
                                            value={Array.isArray(viewingItem.content) ? viewingItem.content.join('\n') : viewingItem.content}
                                            language="javascript"
                                            theme="vs-dark"
                                            options={{ readOnly: true }}
                                            height="300px"
                                        />
                                    )}

                                    {/* nature */}
                                    <Text fontWeight="bold" mt={3}>
                                        {t("component.form.nature")}
                                        <Tooltip label={t("component.form.natureHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{viewingItem.nature}</Text>

                                    {/* pointed error */}
                                    <Box mt={3}>
                                        <Text fontWeight="bold">
                                            {t("component.pointedError")}
                                            <Tooltip label={t("component.form.associatedErrorHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        {viewingItem.pointedError?.length > 0 ? (
                                            viewingItem.pointedError.map((err) => (
                                                <Text key={err.id}>• {err.tag}</Text>
                                            ))
                                        ) : (
                                            <Text color="gray.500" fontStyle="italic">{t("component.form.none")}</Text>
                                        )}
                                    </Box>

                                    {/* associated types */}
                                    <Box mt={3}>
                                        <Text fontWeight="bold">
                                            {t("component.form.associatedTypes")}
                                            <Tooltip label={t("component.form.associatedTypesHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        {(viewingItem.associatedTypes?.length ?? 0) > 0 ? (
                                            viewingItem.associatedTypes!.map((t) => (
                                                <Text key={t.id}>• {t.taskId} - {t.name}</Text>
                                            ))
                                        ) : (
                                            <Text color="gray.500" fontStyle="italic">{t("component.form.none")}</Text>
                                        )}
                                    </Box>

                                    {/* associated exercises */}
                                    <Box mt={3}>
                                        <Text fontWeight="bold">
                                            {t("component.form.associatedExercises")}
                                            <Tooltip label={t("component.form.associatedExercisesHelp")} fontSize="md">
                                                <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                            </Tooltip>
                                        </Text>
                                        {(viewingItem.associatedExercises?.length ?? 0) > 0 ? (
                                            viewingItem.associatedExercises!.map((ex) => (
                                                <Text key={ex.id}>• {ex.title}</Text>
                                            ))
                                        ) : (
                                            <Text color="gray.500" fontStyle="italic">{t("component.form.none")}</Text>
                                        )}
                                    </Box>

                                    {(viewingItem.referencedFeedbacks?.length ?? 0) > 0 && (
                                        <Box mt={3}>
                                            <Text fontWeight="bold">
                                                {t("component.form.feedbackReferences")}
                                                <Tooltip label={t("component.form.feedbackReferencesHelp")} fontSize="md">
                                                    <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                </Tooltip>
                                            </Text>
                                            {viewingItem.referencedFeedbacks!.map((fb) => (
                                                <Text key={fb.id}>
                                                    • {fb.feedback_code}
                                                    {fb.description ? ` - ${fb.description}` : ""}
                                                </Text>
                                            ))}
                                        </Box>
                                    )}



                                </Box>
                            )}
                        </ModalBody>


                        <ModalFooter>
                            <Button onClick={closeRelationModal}>{t("component.form.close")}</Button>
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
            ...(await serverSideTranslations(locale ?? 'fr', ['common']))
        }
    };
};

FeedbackComponentPage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(FeedbackComponentPage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = FeedbackComponentPage.getLayout;

export default ProtectedDashboardPage;

