import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, useDisclosure, useToast, FormControl, FormLabel, VStack,
    FormErrorMessage, Select, Tooltip, Icon
} from "@chakra-ui/react";
import {AddIcon, CheckIcon, DeleteIcon, EditIcon, InfoOutlineIcon, ViewIcon, WarningIcon} from "@chakra-ui/icons";
import React, {ReactElement, useState} from "react";
import SidebarLayout from "@/components/SidebarLayout";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import { useTranslation } from "next-i18next";
import useSWR from "swr";
import axios from '@/utils/axiosInstance';
import { fetcher } from '@/utils/fetcher';
import { Exercise, ExerciseDetail } from '@/types/exercise';
import { TaskType } from '@/types/taskType';
import CodeInput from '@/components/CodeInput';
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { isAxiosError } from 'axios';
import { useProjectContext } from "@/contexts/ProjectContext";
import withAuthProtection from "@/hoc/withAuthProtection";
import {NextPageWithLayout} from "@/pages/_app";

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message || "Axios error";
    if (error instanceof Error) return error.message;
    return "Unknown error";
}

function ExercisePage() {
    const { t } = useTranslation("common");
    const toast = useToast();
    const { currentProject } = useProjectContext();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [titleInput, setTitleInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [correctCodes, setCorrectCodes] = useState<string[]>([]);
    const [choices, setChoices] = useState<{ text: string; isCorrect: boolean }[]>([]);
    const [type, setType] = useState<"CODE" | "QCM" | "MULTI_QCM" | "FILL_IN_BLANK">("CODE");
    const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
    const [editingItem, setEditingItem] = useState<ExerciseDetail | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ExerciseDetail | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);

    const { isOpen: isRelationOpen, onOpen: openRelationModal, onClose: closeRelationModal } = useDisclosure();
    const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDeleteModal, onClose: closeDeleteModal } = useDisclosure();

    const [correctTexts, setCorrectTexts] = useState<string[]>([]);

    const { data: exerciseData, mutate } = useSWR(
        currentProject ? `/api/exercises?page=${page}&limit=10&search=${search}&projectId=${currentProject.id}` : null,
        fetcher
    );

    const { data: typeOptions = [] } = useSWR(
        currentProject ? `/api/types/selectable?projectId=${currentProject.id}` : null,
        fetcher
    );

    const { data: detail } = useSWR(
        viewingId !== null && currentProject
            ? `/api/exercises/${viewingId}?projectId=${currentProject.id}`
            : null,
        (url) => axios.get(url).then(res => res.data as ExerciseDetail)
    );

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

    const exercises: Exercise[] = exerciseData?.exercises || [];
    const totalPages = exerciseData?.totalPages || 1;

    const correctChoiceCount = choices.filter(c => c.isCorrect).length;

    const isValid = titleInput.trim() && (
        (type === "CODE" && correctCodes.length > 0) ||
        (type === "QCM" && choices.length >= 2 && correctChoiceCount === 1) ||
        (type === "MULTI_QCM" && choices.length >= 2 && correctChoiceCount >= 2) ||
        (type === "FILL_IN_BLANK" && correctTexts.length > 0)
    );



    const clearForm = () => {
        setEditingItem(null);
        setTitleInput("");
        setDescriptionInput("");
        setCorrectCodes([]);
        setCorrectTexts([]);
        setChoices([]);
        setSelectedTypes([]);
        setType("CODE");
    };

    const handleAdd = async () => {
        if (!isValid) return;
        const payload = {
            title: titleInput.trim(),
            description: descriptionInput.trim(),
            correctCodes: type === "CODE" ? correctCodes : [],
            correctTexts: type === "FILL_IN_BLANK" ? correctTexts : [],
            choices,
            type,
            taskTypes: selectedTypes,
            projectId: currentProject.id
        };
        try {
            const res = await axios.post('/api/exercises', payload);
            toast({
                title: t(`messages.${res.data.message}`) || res.data.message,
                status: "success"
            });
            mutate(); closeModal(); clearForm();
        } catch (e) {
            toast({ title: getErrorMessage(e), status: "error" });
        }

    };

    const handleEditInit = async (exercise: Exercise) => {
        try {
            const res = await axios.get(`/api/exercises/${exercise.id}?projectId=${currentProject.id}`);
            const detail: ExerciseDetail = res.data;
            setEditingItem(detail);
            setTitleInput(detail.title);
            setDescriptionInput(detail.description);
            setCorrectCodes(detail.correctCodes || []);
            setCorrectTexts(detail.correctTexts || []);
            setChoices(detail.choices || []);
            setType(detail.type || "CODE");
            setSelectedTypes(detail.associatedTypes?.map(t => t.id) || []);
            openModal();
        } catch (e) { toast({ title: getErrorMessage(e), status: "error" }); }
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        const payload = {
            title: titleInput.trim(),
            description: descriptionInput.trim(),
            correctCodes: type === "CODE" ? correctCodes : [],
            correctTexts: type === "FILL_IN_BLANK" ? correctTexts : [],
            choices,
            type,
            taskTypes: selectedTypes,
            projectId: currentProject.id
        };

        try {
            const res = await axios.put(`/api/exercises/${editingItem.id}`, payload);
            toast({
                title: t(`messages.${res.data.message}`) || res.data.message,
                status: "success"
            });
            mutate(); closeModal(); clearForm();
        } catch (e) {
            toast({ title: getErrorMessage(e), status: "error" });
        }

    };

    const handleDelete = async (exercise: Exercise) => {
        try {
            const res = await axios.get(`/api/exercises/${exercise.id}?projectId=${currentProject.id}`);
            const detail: ExerciseDetail = res.data;
            setDeleteTarget(detail); openDeleteModal();
        } catch (e) { toast({ title: getErrorMessage(e), status: "error" }); }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            const res = await axios.delete(`/api/exercises/${deleteTarget.id}?projectId=${currentProject.id}`);
            toast({
                title: t(`messages.${res.data.message}`) || res.data.message,
                status: "success"
            });
            mutate();
            closeDeleteModal();
        } catch (e) {
            toast({ title: getErrorMessage(e), status: "error" });
        }
    };

    // Modal 表单：输入题干、题型、代码或选项
    const renderAnswerInput = () => {
        if (type === "CODE") {
            return (
                <FormControl isRequired isInvalid={correctCodes.length === 0} mb={3}>
                    <FormLabel>{t("exercise.correctCodes")}</FormLabel>
                    {correctCodes.map((code, index) => (
                        <CodeInput
                            key={index}
                            value={code}
                            index={index}
                            onChange={(i, val) => {
                                const newCodes = [...correctCodes];
                                newCodes[i] = val;
                                setCorrectCodes(newCodes);
                            }}
                            onRemove={(i) => {
                                const newCodes = correctCodes.filter((_, idx) => idx !== i);
                                setCorrectCodes(newCodes);
                            }}
                            canRemove={correctCodes.length > 1}
                        />
                    ))}
                    <Button mt={2} colorScheme="blue" onClick={() => setCorrectCodes([...correctCodes, ""])}>
                        {t("exercise.addCode")}
                    </Button>
                    {correctCodes.length === 0 && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                </FormControl>
            );
        } else if (type === "FILL_IN_BLANK") {
            return (
                <FormControl isRequired isInvalid={correctTexts.length === 0} mb={3}>
                    <FormLabel>{t("exercise.correctTexts")}</FormLabel>
                    {correctTexts.map((text, index) => (
                        <HStack key={index} mb={2}>
                            <Input
                                value={text}
                                onChange={(e) => {
                                    const newTexts = [...correctTexts];
                                    newTexts[index] = e.target.value;
                                    setCorrectTexts(newTexts);
                                }}
                            />
                            <IconButton
                                icon={<DeleteIcon />}
                                size="sm"
                                aria-label="delete"
                                onClick={() => setCorrectTexts(correctTexts.filter((_, i) => i !== index))}
                            />
                        </HStack>
                    ))}
                    <Button mt={2} colorScheme="blue" onClick={() => setCorrectTexts([...correctTexts, ""])}>
                        {t("exercise.addAnswer")}
                    </Button>
                    {correctTexts.length === 0 && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                </FormControl>
            );
        } else {
            return (
                <FormControl isRequired isInvalid={choices.length === 0} mb={3}>
                    <FormLabel>{t("exercise.choices")}</FormLabel>
                    {choices.map((choice, index) => (
                        <HStack key={index} mb={2}>
                            <Input
                                value={choice.text}
                                onChange={(e) => {
                                    const updated = [...choices];
                                    updated[index].text = e.target.value;
                                    setChoices(updated);
                                }}
                                placeholder={`Option ${index + 1}`}
                            />

                            <Button
                                size="sm"
                                onClick={() => {
                                    const updated = [...choices];
                                    if (type === "QCM") {
                                        // 只允许一个正确答案
                                        updated.forEach((c, i) => updated[i].isCorrect = false);
                                        updated[index].isCorrect = true;
                                    } else {
                                        // 多选题：切换当前选项
                                        updated[index].isCorrect = !updated[index].isCorrect;
                                    }
                                    setChoices(updated);
                                }}
                                colorScheme={choice.isCorrect ? "green" : "gray"}
                            >
                                {choice.isCorrect ? t("form.correct") : t("form.incorrect")}
                            </Button>

                            <IconButton
                                icon={<DeleteIcon />}
                                size="sm"
                                aria-label="delete"
                                onClick={() => setChoices(choices.filter((_, i) => i !== index))}
                            />
                        </HStack>
                    ))}

                    {type === "QCM" && (
                        <Text fontSize="sm" color="gray.600" mb={1}>
                            💡 Multiple-choice questions can only choose one correct answer
                        </Text>
                    )}
                    {type === "MULTI_QCM" && (
                        <Text fontSize="sm" color="gray.600" mb={1}>
                            💡 Multiple-choice questions require you to select two or more correct answers
                        </Text>
                    )}

                    <Button mt={2} colorScheme="blue" onClick={() => setChoices([...choices, { text: "", isCorrect: false }])}>
                        {t("exercise.addChoice")}
                    </Button>
                    {choices.length === 0 && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                </FormControl>
            );
        }
    };


    const handleOpenCreateModal = () => {
        clearForm();
        setEditingItem(null);
        openModal();
    };
    // Modal 内部使用 renderAnswerInput()

    return (
        <div>

            <Box>
            <HStack justifyContent="space-between" mt={6} mb={4}>
                <Text fontSize="2xl" fontWeight="bold">{t("exercise.titleLabel")}</Text>
                <Button leftIcon={<AddIcon />} onClick={handleOpenCreateModal} colorScheme="blue" mr="120px">{t("exercise.create")}</Button>
            </HStack>

            <Input
                placeholder={t("exercise.searchPlaceholder")}
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
            <Table variant="simple">
                <Thead>
                    <Tr>
                        <Th>{t("exercise.title")}</Th>
                        <Th>{t("exercise.descriptionLabel")}</Th>
                        <Th>{t("exercise.actions")}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {exercises.length > 0 ? (
                        exercises.map((e) => (
                            <Tr key={e.id}>
                                <Td>{e.title}</Td>
                                <Td>{e.description}</Td>
                                <Td>
                                    <HStack>
                                        <IconButton
                                            aria-label={t('exercise.view')}
                                            icon={<ViewIcon />}
                                            size="sm"
                                            onClick={() => {
                                                setViewingId(e.id);
                                                openRelationModal();
                                            }}
                                        />
                                        <IconButton icon={<EditIcon />} aria-label="edit" colorScheme="yellow" size="sm" onClick={() => handleEditInit(e)} />
                                        <IconButton
                                            icon={<DeleteIcon />}
                                            aria-label="delete"
                                            colorScheme="red"
                                            size="sm"
                                            onClick={() => handleDelete(e)}
                                        />
                                    </HStack>
                                </Td>
                            </Tr>
                        ))
                    ) : (
                        <Tr><Td colSpan={3}><Text textAlign="center">{t("exercise.none")}</Text></Td></Tr>
                    )}
                </Tbody>
            </Table>
                </Box>

            <HStack mt={4} justifyContent="center">
                <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("prev")}</Button>
                <Text>{page} / {totalPages}</Text>
                <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
            </HStack>

            <Modal isOpen={isModalOpen} onClose={closeModal} size="xl">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{editingItem ? t("exercise.editModalTitle") : t("exercise.createModalTitle")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <FormControl isRequired isInvalid={!titleInput.trim()} mb={3}>
                            <FormLabel display="flex" alignItems="center" gap={1}>
                                {t("exercise.title")}
                                <Tooltip label={t("exercise.titleHelp")} fontSize="md">
                                    <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                </Tooltip>
                            </FormLabel>
                            <Input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} />
                            {!titleInput.trim() && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                        </FormControl>

                        <FormControl mb={3}>
                            <FormLabel display="flex" alignItems="center" gap={1}>
                                {t("exercise.descriptionLabel")}
                                <Tooltip label={t("exercise.descriptionHelp")} fontSize="md">
                                    <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                </Tooltip>
                            </FormLabel>
                            <Input value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} />
                        </FormControl>

                        <FormControl isRequired mb={3}>
                            <FormLabel display="flex" alignItems="center" gap={1}>
                                {t("exercise.type")}
                                <Tooltip label={t("exercise.typeHelp")} fontSize="md">
                                    <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                </Tooltip>
                            </FormLabel>
                            <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                                <option value="CODE">{t("exercise.exType.CODE")}</option>
                                <option value="QCM">{t("exercise.exType.QCM")}</option>
                                <option value="MULTI_QCM">{t("exercise.exType.MULTI_QCM")}</option>
                                <option value="FILL_IN_BLANK">{t("exercise.exType.FILL_IN_BLANK")}</option>
                            </Select>
                        </FormControl>

                        {renderAnswerInput()}

                        <FormControl mb={3}>
                            <FormLabel display="flex" alignItems="center" gap={1}>
                                {t("exercise.taskTypes")}
                                <Tooltip label={t("exercise.taskTypeHelp")} fontSize="md">
                                    <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} /></span>
                                </Tooltip>
                            </FormLabel>

                            <CustomMultiSelect
                                options={typeOptions.map((t: TaskType) => ({
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

                <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t('exercise.confirmDelete')}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {deleteTarget ? (
                                <VStack align="start" spacing={5}>
                                    {/* Title */}
                                    <Box>
                                        <Text fontWeight="bold">{t('exercise.title')}:</Text>
                                        <Text>{deleteTarget.title}</Text>
                                    </Box>

                                    {/* Description */}
                                    <Box>
                                        <Text fontWeight="bold">{t('exercise.description')}:</Text>
                                        <Text>{deleteTarget.description}</Text>
                                    </Box>

                                    {/* Correct Answers Display */}
                                    <Box>
                                        <Text fontWeight="bold">{t('exercise.answers')}:</Text>

                                        {deleteTarget.type === "CODE" && (
                                            <VStack align="start" mt={2} spacing={2}>
                                                {deleteTarget.correctCodes?.map((code, i) => (
                                                    <Box key={i} whiteSpace="pre-wrap" bg="gray.100" p={2} borderRadius="md">{code}</Box>
                                                ))}
                                            </VStack>
                                        )}

                                        {(deleteTarget.type === "QCM" || deleteTarget.type === "MULTI_QCM") && (
                                            <VStack align="start" mt={2} spacing={2}>
                                                {deleteTarget.choices?.map((c, i) => (
                                                    <Box key={i} display="flex" alignItems="center" gap={2}>
                                                        <Text>{c.text}</Text>
                                                        {c.isCorrect && <CheckIcon color="green.500" />}
                                                    </Box>
                                                ))}
                                            </VStack>
                                        )}

                                        {deleteTarget.type === "FILL_IN_BLANK" && (
                                            <VStack align="start" mt={2} spacing={2}>
                                                {deleteTarget.correctTexts?.map((txt, i) => (
                                                    <Box key={i} bg="gray.100" p={2} borderRadius="md">{txt}</Box>
                                                ))}
                                            </VStack>
                                        )}
                                    </Box>

                                    {/* Associated Task Types */}
                                    <Box>
                                        <Text fontWeight="bold">{t('exercise.taskTypes')}:</Text>
                                        <VStack align="start" mt={2}>
                                            {(deleteTarget.associatedTypes ?? []).length > 0 ? (
                                                deleteTarget.associatedTypes!.map((t) => (
                                                    <Text key={t.id}>• {t.taskId} - {t.name}</Text>
                                                ))
                                            ) : (
                                                <Text>{t('exercise.none')}</Text>
                                            )}
                                        </VStack>
                                    </Box>
                                </VStack>
                            ) : (
                                <Text>{t('loading')}...</Text>
                            )}
                        </ModalBody>

                        <ModalFooter>
                            <Button colorScheme="red" mr={3} onClick={handleDeleteConfirm}>{t('form.delete')}</Button>
                            <Button onClick={closeDeleteModal}>{t('form.cancel')}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>


            <Modal isOpen={isRelationOpen} onClose={() => { closeRelationModal(); setViewingId(null); }} size="xl">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t('exercise.detailsTitle')}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {detail ? (
                            <VStack align="start" spacing={5}>
                                {/* Title */}
                                <Box>
                                    <Text fontWeight="bold">
                                        {t('exercise.title')}
                                        <Tooltip label={t("exercise.titleHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{detail.title}</Text>
                                </Box>

                                {/* Description */}
                                <Box>
                                    <Text fontWeight="bold">
                                        {t('exercise.description')}
                                        <Tooltip label={t("exercise.descriptionHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{detail.description}</Text>
                                </Box>

                                {/* Correct Answers Display */}
                                <Box>
                                    <Text fontWeight="bold">
                                        {t('exercise.answers')}
                                        <Tooltip label={t('exercise.answersTooltip', { type: detail.type })} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>

                                    {detail.type === "CODE" && (
                                        <VStack align="start" mt={2} spacing={2}>
                                            {detail.correctCodes?.map((code, i) => (
                                                <Box key={i} whiteSpace="pre-wrap" bg="gray.100" p={2} borderRadius="md">{code}</Box>
                                            ))}
                                        </VStack>
                                    )}

                                    {(detail.type === "QCM" || detail.type === "MULTI_QCM") && (
                                        <VStack align="start" mt={2} spacing={2}>
                                            {detail.choices?.map((c, i) => (

                                                <Box key={i} display="flex" alignItems="center" gap={2}>
                                                    <Text>{c.text}</Text>
                                                    {c.isCorrect && <CheckIcon color="green.500" />}
                                                </Box>
                                            ))}
                                        </VStack>
                                    )}

                                    {detail.type === "FILL_IN_BLANK" && (
                                        <VStack align="start" mt={2} spacing={2}>
                                            {detail.correctTexts?.map((txt, i) => (
                                                <Box key={i} bg="gray.100" p={2} borderRadius="md">{txt}</Box>
                                            ))}
                                        </VStack>
                                    )}

                                </Box>

                                {/* Associated Task Types */}
                                <Box>
                                    <Text fontWeight="bold">
                                        {t('exercise.taskTypes')}
                                        <Tooltip label={t("exercise.typeHelp")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <VStack align="start" mt={2}>
                                        {(detail.associatedTypes || []).length > 0 ? (
                                            detail.associatedTypes!.map((t) => (
                                                <Text key={t.id}>• {t.taskId} - {t.name}</Text>
                                            ))
                                        ) : (
                                            <Text>{t('exercise.none')}</Text>
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

        </Box>

        </div>
    );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'fr', ['common'])),
    },
});

ExercisePage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(ExercisePage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = ExercisePage.getLayout;

export default ProtectedDashboardPage;
