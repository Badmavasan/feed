import {
    Box, Button, HStack, IconButton, Input, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tr,
    Th, Tbody, Td, Text, useDisclosure, useToast, FormControl, FormLabel,
    FormErrorMessage, Select, UnorderedList, ListItem, Tooltip, Icon, VStack, Flex
} from "@chakra-ui/react";
import {AddIcon, DeleteIcon, EditIcon, ViewIcon, WarningIcon} from "@chakra-ui/icons";
import React, {useState, useRef, useEffect, ReactElement, useMemo} from "react";
import SidebarLayout from "@/components/SidebarLayout";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import { useTranslation } from "next-i18next";
import useSWR from "swr";
import axios from '@/utils/axiosInstance';
import { fetcher } from '@/utils/fetcher';
import { TaskType, TaskTypeDetail } from '@/types/taskType';
import { Error } from "@/types/error";
import { AxiosError } from "axios";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Tree, {RawNodeDatum, TreeNodeDatum} from 'react-d3-tree';
import { useProjectContext } from "@/contexts/ProjectContext";
import withAuthProtection from "@/hoc/withAuthProtection";
import {NextPageWithLayout} from "@/pages/_app";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import {Exercise, FeedbackComponent} from "@/types";

interface OriginalNode {
    taskId: string;
    name: string;
    children?: OriginalNode[];
}


function convertToTreeDatum(node: OriginalNode): RawNodeDatum {
    return {
        name: node.taskId,
        attributes: { name: node.name },
        children: node.children?.map(convertToTreeDatum) || [],
    };
}

function TypePage() {


    const { t } = useTranslation("common");
    const toast = useToast();
    const { currentProject } = useProjectContext();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [taskIdInput, setTaskIdInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const [parentTypeId, setParentTypeId] = useState<number | null>(null);
    const [selectedErrors, setSelectedErrors] = useState<Error[]>([]);
    const [editingItem, setEditingItem] = useState<TaskTypeDetail | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TaskTypeDetail | null>(null);
    const [viewingId, setViewingId] = useState<number | null>(null);

    const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();
    const { isOpen: isRelationOpen, onOpen: openRelationModal, onClose: closeRelationModal } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDeleteModal, onClose: closeDeleteModal } = useDisclosure();

    const [showTree, setShowTree] = useState(false);
    const [treeData, setTreeData] = useState<RawNodeDatum[] | null>(null);

    const treeContainerRef = useRef<HTMLDivElement>(null);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });

    const editingTaskTypeId = editingItem?.id ?? null;

    const projectId = currentProject?.id;
    const shouldFetch = !!projectId;


    // 不违反 hook 规则，统一顶层定义
    const { data: typeData, mutate } = useSWR(
        shouldFetch ? `/api/types?page=${page}&limit=10&search=${search}&projectId=${projectId}` : null,
        fetcher
    );


    const { data: allSelectableTypes = [] } = useSWR(
        shouldFetch ? `/api/types/selectable?projectId=${projectId}` : null,
        fetcher
    );

    const { data: otherSelectableTypes = [] } = useSWR(
        shouldFetch && editingTaskTypeId
            ? `/api/types/others/${editingTaskTypeId}?projectId=${projectId}`
            : null,
        fetcher
    );

    const selectableParentTypes = editingTaskTypeId ? otherSelectableTypes : allSelectableTypes;

    const { data: errors = [] } = useSWR(
        shouldFetch ? `/api/errors/selectable?projectId=${projectId}` : null,
        fetcher
    );

    const cachedErrors = useMemo(() => errors, [errors]);

    const { data: detail } = useSWR(
        viewingId !== null && currentProject
            ? `/api/types/${viewingId}?projectId=${projectId}`
            : null,
        fetcher
    );

    const types: TaskType[] = typeData?.types || [];
    const totalPages = typeData?.totalPages || 1;
    const isValid = taskIdInput.trim() !== "" && nameInput.trim() !== "";

    const clearForm = () => {
        setEditingItem(null);
        setTaskIdInput("");
        setNameInput("");
        setParentTypeId(null);
        setSelectedErrors([]);
    };

    useEffect(() => {
        if (treeContainerRef.current && showTree) {
            const dimensions = treeContainerRef.current.getBoundingClientRect();
            setTranslate({ x: dimensions.width / 2, y: 50 });
        }
    }, [treeContainerRef.current, showTree]);

    useEffect(() => {
        if (detail?.id && showTree) {
            axios.get(`/api/types/tree?rootId=${detail.id}&projectId=${currentProject?.id}`)
                .then(res => {
                    const converted = convertToTreeDatum(res.data);
                    setTreeData([converted]);
                })
                .catch(() => setTreeData(null));

        }
    }, [detail, showTree, currentProject]);


    const handleAdd = async () => {
        if (!isValid) return;
        try {
            const res = await axios.post(`/api/types?projectId=${projectId}`, {
                taskId: taskIdInput.trim(),
                name: nameInput.trim(),
                parentTypeId,
                errors: selectedErrors.map(e => e.id)
            });
            toast({ title: res.data?.message || t("type.createSuccess"), status: "success" });
            mutate();
            closeModal();
            clearForm();
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            toast({ title: err.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleEdit = async (taskType: TaskType) => {
        try {
            const res = await axios.get(`/api/types/${taskType.id}?projectId=${projectId}`);
            const detail = res.data as TaskTypeDetail;
            setEditingItem(detail);
            setTaskIdInput(detail.taskId);
            setNameInput(detail.name);
            setParentTypeId(detail.parent?.id || null);
            setSelectedErrors(detail.errors || []);
            openModal();
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            const statusType = err.response?.status === 400 ? "info" : "error";

            toast({
                title: err.response?.data?.message || "Unknown error",
                status: statusType,
            });

        }
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        try {
            const res = await axios.put(`/api/types/${editingItem.id}?projectId=${projectId}`, {
                taskId: taskIdInput.trim(),
                name: nameInput.trim(),
                parentTypeId,
                errors: selectedErrors.map(e => e.id)
            });
            toast({ title: res.data?.message || t("toast.editSuccess"), status: "success" });
            mutate();
            await mutate(`/api/types/${editingItem.id}?projectId=${projectId}`);
            closeModal();
            clearForm();
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            const statusType = err.response?.status === 400 ? "info" : "error";

            toast({
                title: err.response?.data?.message || "Unknown error",
                status: statusType,
            });

        }
    };

    const handleDelete = async (taskType: TaskType) => {
        const res = await axios.get(`/api/types/${taskType.id}?projectId=${projectId}`);
        setDeleteTarget(res.data);
        openDeleteModal();
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            const res = await axios.delete(`/api/types/${deleteTarget.id}?projectId=${projectId}`);
            toast({ title: res.data?.message || t("type.deleteSuccess"), status: "success" });
            mutate();
            closeDeleteModal();
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            toast({ title: err.response?.data?.message || "Error", status: "error" });
        }
    };

    const handleOpenCreateModal = () => {
        clearForm();
        setEditingItem(null);
        openModal();
    };


    return (
        <div>
            {!currentProject ? (
                <Box p={6}>
                    <Text fontSize="xl" color="gray.600" display="flex" alignItems="center" gap={2}>
                        <WarningIcon color="orange.400" boxSize={5} />
                        {t("project.noCurrentProject") || "You currently have no project selected. Please create or select a project first."}
                    </Text>
                </Box>
            ) : (


            <Box>
                <HStack justifyContent="space-between" mt={6} mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">{t("type.title")}</Text>
                    <Button leftIcon={<AddIcon />} onClick={handleOpenCreateModal} colorScheme="blue" mr="120px">
                        {t("type.create")}
                    </Button>

                </HStack>

                <Input
                    placeholder={t("type.searchPlaceholder")}
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
                            <Th>{t("type.taskTag")}</Th>
                            <Th>{t("type.name")}</Th>
                            <Th>{t("type.actions")}</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {types.length > 0 ? (
                            types.map((t) => (
                                <Tr key={t.id}>
                                    <Td>{t.taskId}</Td>
                                    <Td>{t.name}</Td>
                                    <Td>
                                        <HStack>
                                            <IconButton icon={<ViewIcon />} aria-label="view" size="sm" onClick={() => { setViewingId(t.id); openRelationModal(); }} />
                                            <IconButton icon={<EditIcon />} aria-label="edit" colorScheme="yellow" size="sm" onClick={() => handleEdit(t)} />
                                            <IconButton icon={<DeleteIcon />} aria-label="delete" colorScheme="red" size="sm" onClick={() => handleDelete(t)} />
                                        </HStack>
                                    </Td>
                                </Tr>
                            ))
                        ) : (
                            <Tr><Td colSpan={3}><Text textAlign="center">{t("type.none")}</Text></Td></Tr>
                        )}
                    </Tbody>
                </Table>
                </Box>

                <HStack mt={4} justifyContent="center">
                    <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("prev")}</Button>
                    <Text>{page} / {totalPages}</Text>
                    <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
                </HStack>

                {/* Create/Edit Modal */}
                <Modal isOpen={isModalOpen} onClose={closeModal} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{editingItem ? t("type.editModalTitle") : t("type.createModalTitle")}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>

                            <FormControl isRequired isInvalid={!taskIdInput.trim()} mb={4}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("type.taskId")}
                                    <Tooltip label={t("type.taskIdHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={taskIdInput} onChange={(e) => setTaskIdInput(e.target.value)} />
                                {!taskIdInput.trim() && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                            </FormControl>

                            <FormControl isRequired isInvalid={!nameInput.trim()} mb={4}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("type.name")}
                                    <Tooltip label={t("type.nameHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                                {!nameInput.trim() && <FormErrorMessage>{t("form.required")}</FormErrorMessage>}
                            </FormControl>

                            <FormControl mb={4}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("type.parentType")}
                                    <Tooltip label={t("type.parentTypeHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <Select
                                    placeholder="Select parent"
                                    value={parentTypeId ?? ""}
                                    onChange={(e) => setParentTypeId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    {selectableParentTypes.map((t: TaskType) => (
                                        <option key={t.id} value={t.id}>
                                            {t.taskId} - {t.name}
                                        </option>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl mb={4}>
                                <FormLabel display="flex" alignItems="center" gap={1}>
                                    {t("type.errors")}
                                    <Tooltip label={t("type.errorsHelp")} fontSize="md">
                                        <span><Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" /></span>
                                    </Tooltip>
                                </FormLabel>
                                <CustomMultiSelect
                                    options={cachedErrors.map((e: Error) => ({
                                        label: `${e.tag} - ${e.description}`,
                                        value: e.id,
                                    }))}
                                    value={selectedErrors.map(e => e.id)}
                                    onChange={(ids: number[]) => {
                                        setSelectedErrors(cachedErrors.filter((e: Error) => ids.includes(e.id)));
                                    }}
                                />
                            </FormControl>



                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="blue" onClick={editingItem ? handleSaveEdit : handleAdd} isDisabled={!isValid}>{t("form.save")}</Button>
                            <Button onClick={closeModal} ml={3}>{t("form.cancel")}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* Delete Confirmation Modal */}
                <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal} size="2xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{t('type.confirmDelete')}</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            {deleteTarget && (
                                <Box>
                                    <Text mb={2}><strong>{t('type.taskId')}:</strong> {deleteTarget.taskId}</Text>
                                    <Text mb={2}><strong>{t('type.name')}:</strong> {deleteTarget.name}</Text>
                                    <Text>{t('type.deleteNoticeFull')}</Text>

                                    {/* Parent display */}
                                    <Box mt={4}>
                                        <Text fontWeight="bold">{t('type.parentType')}:</Text>
                                        {deleteTarget.parent ? (
                                            <Text>• {deleteTarget.parent.taskId} - {deleteTarget.parent.name}</Text>
                                        ) : (
                                            <Text>{t('type.none')}</Text>
                                        )}
                                    </Box>

                                    {/* Other arrays display */}
                                    {[
                                        { key: 'subTypes', label: t('type.subTypes') },
                                        { key: 'errors', label: t('type.errors') },
                                        { key: 'associatedExercises', label: t('type.exercicesAssocies') },
                                        { key: 'associatedComponents', label: t('type.composantsAssocies') },
                                    ].map(({ key, label }) => (
                                        <Box key={key} mt={4}>
                                            <Text fontWeight="bold">{label}:</Text>

                                            {(() => {
                                                if (key === 'subTypes' && Array.isArray(deleteTarget.subTypes) && deleteTarget.subTypes.length > 0) {
                                                    return deleteTarget.subTypes.map(item => (
                                                        <Text key={item.id}>• {item.taskId} - {item.name}</Text>
                                                    ));
                                                }

                                                if (key === 'errors' && Array.isArray(deleteTarget.errors) && deleteTarget.errors.length > 0) {
                                                    return deleteTarget.errors.map(item => (
                                                        <Text key={item.id}>• {item.tag} - {item.description}</Text>
                                                    ));
                                                }

                                                if (key === 'associatedExercises' && Array.isArray(deleteTarget.associatedExercises) && deleteTarget.associatedExercises.length > 0) {
                                                    return deleteTarget.associatedExercises.map(item => (
                                                        <Text key={item.id}>• {item.title} - {item.description}</Text>
                                                    ));
                                                }

                                                if (key === 'associatedComponents' && Array.isArray(deleteTarget.associatedComponents) && deleteTarget.associatedComponents.length > 0) {
                                                    return deleteTarget.associatedComponents.map(item => (
                                                        <Text key={item.id}>• {item.description}</Text>
                                                    ));
                                                }

                                                return <Text>{t('type.none')}</Text>;
                                            })()}
                                        </Box>
                                    ))}

                                </Box>
                            )}
                        </ModalBody>

                        <ModalFooter>
                            <Button colorScheme="red" mr={3} onClick={handleDeleteConfirm}>{t('form.delete')}</Button>
                            <Button onClick={closeDeleteModal}>{t('form.cancel')}</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* View Details Modal */}
                <Modal isOpen={isRelationOpen} onClose={() => { closeRelationModal(); setViewingId(null); }} size="6xl">
                    <ModalOverlay />
                    <ModalContent maxH="80vh" overflowY="auto">
                        <ModalHeader px={6} py={4}>
                            <Flex align="center" gap={4}>
                                {t('type.viewModalTitle')}
                                <Button
                                    onClick={() => setShowTree(prev => !prev)}
                                    size="sm"
                                    bg="blue.100"
                                    color="blue.800"
                                    _hover={{ bg: "blue.200" }}
                                >
                                    {showTree ? t('type.backToDetails') : t('type.showTree')}
                                </Button>
                            </Flex>
                        </ModalHeader>

                        <ModalCloseButton />

                        <ModalBody>
                            {detail ? (
                                <>

                                    {showTree ? (
                                        <Box ref={treeContainerRef} w="100%" h="600px">
                                            {treeData ? (
                                                <Tree
                                                    data={treeData}
                                                    translate={translate}
                                                    orientation="vertical"
                                                    pathFunc="step"
                                                    collapsible
                                                    zoomable
                                                    separation={{ siblings: 1.5, nonSiblings: 2 }}
                                                    renderCustomNodeElement={({ nodeDatum, toggleNode, hierarchyPointNode }) => {
                                                        const isCollapsed = (hierarchyPointNode as any)._collapsed === true;

                                                        const fillColor = isCollapsed ? "#D1FAE5" : "#BFDBFE"; // 背景色：合上绿色，展开蓝色
                                                        const borderColor = isCollapsed ? "#059669" : "#2563EB"; // 边框色

                                                        return (
                                                            <g onClick={toggleNode} style={{ cursor: "pointer" }}>
                                                                <rect
                                                                    width={220}
                                                                    height={80}
                                                                    x={-110}
                                                                    y={-40}
                                                                    rx={16}
                                                                    ry={16}
                                                                    fill={fillColor}
                                                                    stroke={borderColor}
                                                                    strokeWidth={2}
                                                                    filter="url(#shadow)"
                                                                />
                                                                {/* taskId 显示 */}
                                                                <text
                                                                    x="0"
                                                                    y="-10"
                                                                    textAnchor="middle"
                                                                    fontSize="16"
                                                                    fontWeight="bold"
                                                                    fill="#000000"
                                                                    style={{
                                                                        pointerEvents: "none",
                                                                        paintOrder: "stroke", // 防止背景色干扰
                                                                        stroke: "white",
                                                                        strokeWidth: 0.5,
                                                                    }}
                                                                >
                                                                    {nodeDatum.name}
                                                                </text>

                                                                {/* name 显示 */}
                                                                <foreignObject x={-100} y={10} width={200} height={40}>
                                                                    <div style={{
                                                                        textAlign: "center",
                                                                        fontSize: "13px",
                                                                        fontWeight: "bold",
                                                                        color: "#1F2937",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "normal",
                                                                        lineHeight: "1.2em",
                                                                        height: "100%",
                                                                        wordWrap: "break-word",
                                                                        fontFamily: "'Segoe UI', Roboto, sans-serif"
                                                                    }}>
                                                                        {nodeDatum.attributes?.name}
                                                                    </div>
                                                                </foreignObject>
                                                            </g>
                                                        );
                                                    }}

                                                />

                                            ) : (
                                                <Text>{t('loading')}...</Text>
                                            )}
                                        </Box>
                                    ) : (
                                        <VStack align="start" spacing={5}>
                                            {/* TâcheTag */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.taskId')}
                                                    <Tooltip label={t("type.taskIdHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                <Text>{detail.taskId}</Text>
                                            </Box>

                                            {/* Nom */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.name')}
                                                    <Tooltip label={t("type.nameHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                <Text>{detail.name}</Text>
                                            </Box>

                                            {/* Tâche parente */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.parentType')}
                                                    <Tooltip label={t("type.parentTypeHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                {detail.parent ? (
                                                    <UnorderedList>
                                                        <ListItem>{detail.parent.taskId} - {detail.parent.name}</ListItem>
                                                    </UnorderedList>
                                                ) : (
                                                    <Text>{t('type.none')}</Text>
                                                )}
                                            </Box>

                                            {/* Sous-types */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.subTypes')}
                                                    <Tooltip label={t("type.subTypesHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                {detail.subTypes && detail.subTypes.length > 0 ? (
                                                    <UnorderedList>
                                                        {detail.subTypes.map((sub: { id: number; taskId: string; name: string }) => (
                                                            <ListItem key={sub.id}>
                                                                {sub.taskId} - {sub.name}
                                                            </ListItem>
                                                        ))}

                                                    </UnorderedList>
                                                ) : (
                                                    <Text>{t('type.none')}</Text>
                                                )}
                                            </Box>

                                            {/* Errors */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.errors')}
                                                    <Tooltip label={t("type.errorsHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                {detail.errors && detail.errors.length > 0 ? (
                                                    <UnorderedList>
                                                        {detail.errors.map((e:Error) => (
                                                            <ListItem key={e.id}>{e.tag} - {e.description}</ListItem>
                                                        ))}
                                                    </UnorderedList>
                                                ) : (
                                                    <Text>{t('type.none')}</Text>
                                                )}
                                            </Box>

                                            {/* Associated Exercises */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.exercicesAssocies')}
                                                    <Tooltip label={t("type.exercicesAssociesHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                {detail.associatedExercises && detail.associatedExercises.length > 0 ? (
                                                    <UnorderedList>
                                                        {detail.associatedExercises.map((e:Exercise) => (
                                                            <ListItem key={e.id}>{e.title} - {e.description}</ListItem>
                                                        ))}
                                                    </UnorderedList>
                                                ) : (
                                                    <Text>{t('type.none')}</Text>
                                                )}
                                            </Box>

                                            {/* Associated Components */}
                                            <Box>
                                                <Text fontWeight="bold">
                                                    {t('type.composantsAssocies')}
                                                    <Tooltip label={t("type.composantsAssociesHelp")} fontSize="md">
                                                        <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                                    </Tooltip>
                                                </Text>
                                                {detail.associatedComponents && detail.associatedComponents.length > 0 ? (
                                                    <UnorderedList>
                                                        {detail.associatedComponents.map((c:FeedbackComponent) => (
                                                            <ListItem key={c.id}>{c.tag} - {c.description}</ListItem>
                                                        ))}
                                                    </UnorderedList>
                                                ) : (
                                                    <Text>{t('type.none')}</Text>
                                                )}
                                            </Box>
                                        </VStack>
                                    )}
                                </>
                            ) : (
                                <Text>{t('loading')}...</Text>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button onClick={() => { closeRelationModal(); setViewingId(null); }}>
                                {t('form.close')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>


            </Box>

            )}
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

TypePage.getLayout = (page: ReactElement) => (
    <SidebarLayout>{page}</SidebarLayout>
);

const ProtectedDashboardPage = withAuthProtection(TypePage) as NextPageWithLayout;
ProtectedDashboardPage.getLayout = TypePage.getLayout;

export default ProtectedDashboardPage;
