import React, {ReactElement, useEffect, useState} from "react";
import {
    Box, Button, Input, Table, Thead, Tbody, Tr, Th, Td, IconButton,
    useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
    ModalBody, ModalFooter, FormControl, FormLabel, Checkbox, HStack, VStack,
    Text, Select, Switch, Tabs, TabList, Tab, TabPanels, TabPanel, Badge, Flex,
    useDisclosure, Icon, Tooltip, FormErrorMessage, InputLeftAddon, InputGroup, InputLeftElement
} from "@chakra-ui/react";
import {
    DeleteIcon,
    ViewIcon,
    AddIcon,
    EditIcon,
    InfoOutlineIcon,
    SearchIcon,
    CheckIcon,
    CloseIcon
} from "@chakra-ui/icons";
import { useTranslation } from "next-i18next";
import axios from '@/utils/axiosInstance';
import SidebarLayout from '@/components/SidebarLayout';
import withAuthProtection from "@/hoc/withAuthProtection";
import { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { NextPageWithLayout } from "@/pages/_app";
import { User, NewUser } from '@/types/user';
import { useProjectContext } from '@/contexts/ProjectContext';

const MODULES = ['taskType', 'error', 'exercise', 'component', 'feedback'];

type UserTableSectionProps = {
    users: User[];
    total: number;
    page: number;
    setPage: (page: number | ((prev: number) => number)) => void;
    fetchUsers: () => void;
    search: string;
    setSearch: (value: string) => void;
    onView: (id: number) => void;
    onPermission?: (id: number) => void; // 如果未使用可设为 optional
    onDelete: (id: number) => void;
    onEditPermission: (id: number) => void;
    tabIndex: number;
    setIsOpen: (open: boolean) => void;
};
type PermissionAction = 'create' | 'update' | 'delete';

type ModulePermission = Record<PermissionAction, boolean>;

type EditPermissions = Record<string, ModulePermission>;


function UserManagementPage() {
    const { t } = useTranslation("common");
    const { currentProject } = useProjectContext();
    const [tabIndex, setTabIndex] = useState(0);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<{ id: number, name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const toast = useToast();

    const { isOpen: isViewOpen, onOpen: openView, onClose: closeView } = useDisclosure();
    const { isOpen: isPermissionOpen, onOpen: openPermission, onClose: closePermission } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [userDetail, setUserDetail] = useState<any>(null);
    const [userPermissions, setUserPermissions] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [newUser, setNewUser] = useState<NewUser>({ name: "", email: "", role: "auteur" });

    const { isOpen: isEditPermissionOpen, onOpen: openEditPermission, onClose: closeEditPermission } = useDisclosure();
    const [editPermissionUserId, setEditPermissionUserId] = useState<number | null>(null);
    const [editPermissions, setEditPermissions] = useState<Record<string, { create: boolean; update: boolean; delete: boolean }>>({});

    useEffect(() => {
        if (tabIndex === 1) fetchProjects();
        fetchUsers();
    }, [tabIndex, selectedProjectId, page, search]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/projects/mine');
            setProjects(res.data);
            if (!selectedProjectId && res.data.length > 0) setSelectedProjectId(res.data[0].id);
        } catch {
            toast({ title: t("user.project.loadError"), status: "error" });
        }
    };

    const fetchUsers = async () => {
        try {
            const params = `?page=${page}&pageSize=${pageSize}&search=${search}`;
            const url = tabIndex === 0
                ? `/api/users/auteurs${params}`
                : selectedProjectId ? `/api/users/project-auteurs${params}&projectId=${selectedProjectId}` : null;
            if (!url) return;
            const res = await axios.get(url);
            setUsers(res.data?.users ?? res.data?.auteurs ?? []);
            setTotal(res.data?.total ?? 0);
        } catch {
            toast({ title: t("user.loadError"), status: "error" });
        }
    };

    const onEditPermission = async (userId: number) => {
        try {
            const res = await axios.get(`/api/users/${userId}/permissions?projectId=${selectedProjectId}`);
            const defaultPerms = MODULES.reduce((acc, mod) => {
                acc[mod] = { create: false, update: false, delete: false };
                return acc;
            }, {} as Record<string, { create: boolean; update: boolean; delete: boolean }>);

            setEditPermissions({
                ...defaultPerms,
                ...(res.data.permissions || {})
            });

            setUserPermissions({
                name: res.data.name,
                email: res.data.email,
                role: res.data.role
            });
            setEditPermissionUserId(userId);
            openEditPermission();
        } catch {
            toast({ title: t("user.permissionLoadError"), status: "error" });
        }
    };

    const handleSavePermissions = async () => {
        if (!selectedProjectId || !editPermissionUserId) return;

        try {
            await axios.put(`/api/users/project-auteur-permissions?projectId=${selectedProjectId}&userId=${editPermissionUserId}`, {
                permissions: editPermissions
            });
            toast({ title: t("user.permissionSaved"), status: "success" });
            closeEditPermission();
        } catch {
            toast({ title: t("user.permissionSaveError"), status: "error" });
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.email.trim()) {
            toast({
                title: t("user.form.missingFields"),
                description: t("user.form.nameEmailRequired"),
                status: "warning",
            });
            return;
        }

        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(newUser.email)) {
            toast({
                title: t("user.form.invalidEmail"),
                description: t("user.form.enterValidEmail"),
                status: "warning",
            });
            return;
        }

        try {
            const res = await axios.post('/api/users', newUser);
            toast({
                title: t("user.created"),
                description: `${t("user.defaultPassword")}: ${res.data.defaultPassword}`,
                status: "success",
            });

            setIsOpen(false);
            setNewUser({ name: "", email: "", role: "auteur" });
            fetchUsers();
        } catch (e: any) {
            toast({
                title: t("user.error.title"),
                description: e.response?.data?.message || t("user.error.serverError"),
                status: "error",
            });
        }
    };

    const viewUserDetail = async (id: number) => {
        try {
            if (tabIndex === 1 && selectedProjectId) {
                const res = await axios.get(`/api/users/${id}/permissions?projectId=${selectedProjectId}`);
                setUserPermissions(res.data);
                openPermission();
            } else {
                const res = await axios.get(`/api/users/${id}`);
                setUserDetail(res.data);
                openView();
            }
        } catch {
            toast({ title: t("user.detailLoadError"), status: "error" });
        }
    };

    const viewPermissions = async (id: number) => {
        try {
            const res = await axios.get(`/api/users/${id}/permissions?projectId=${selectedProjectId}`);
            setUserPermissions(res.data);
            openPermission();
        } catch {
            toast({ title: t("user.permissionLoadError"), status: "error" });
        }
    };

    const confirmDelete = async (id: number) => {
        try {
            const res = await axios.get(`/api/users/${id}`);
            setUserDetail(res.data);
            setSelectedUserId(id);
            openDelete();
        } catch {
            toast({ title: t("user.projectCheckError"), status: "error" });
        }
    };

    const handleDelete = async () => {
        if (!selectedUserId) return;
        try {
            await axios.delete(`/api/users/${selectedUserId}`);
            toast({ title: t("user.deleted"), status: "success" });
            closeDelete();
            fetchUsers();
        } catch {
            toast({ title: t("user.deleteError"), status: "error" });
        }
    };


    const totalPages = Math.ceil(total / pageSize);

    return (
        <Box>
            <Tabs index={tabIndex} onChange={setTabIndex} variant="line" colorScheme="blue">
                <TabList>
                    <Tab>{t("user.systemUsers")}</Tab>
                    <Tab>{t("user.projectMembers")}</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <UserTableSection
                            users={users}
                            total={total}
                            page={page}
                            setPage={setPage}
                            fetchUsers={fetchUsers}
                            search={search}
                            setSearch={setSearch}
                            onView={viewUserDetail}
                            onPermission={viewPermissions}
                            onDelete={confirmDelete}
                            onEditPermission={onEditPermission}
                            tabIndex={tabIndex}
                            setIsOpen={setIsOpen}
                        />
                    </TabPanel>

                    <TabPanel>
                        <FormControl mb={4} maxW="300px">
                            <InputGroup>
                                <InputLeftAddon bg="gray.100" fontWeight="bold" px={2}>
                                    <HStack spacing={1}>
                                        <Text>{t("user.project.label")}</Text>
                                        <Tooltip
                                            label={t("user.project.tooltip")}
                                            fontSize="sm"
                                            hasArrow
                                            placement="top"
                                        >
        <span>
          <Icon as={InfoOutlineIcon} color="gray.500" boxSize={4} cursor="pointer" />
        </span>
                                        </Tooltip>
                                    </HStack>
                                </InputLeftAddon>
                                <Select
                                    value={selectedProjectId ?? ''}
                                    onChange={e => setSelectedProjectId(parseInt(e.target.value))}
                                    placeholder={t("user.project.selectPlaceholder")}
                                    bg="white"
                                >
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </Select>
                            </InputGroup>

                        </FormControl>

                        {selectedProjectId && (
                            <UserTableSection
                                users={users} total={total} page={page} setPage={setPage}
                                fetchUsers={fetchUsers} search={search} setSearch={setSearch}
                                onView={viewUserDetail} onPermission={viewPermissions} onDelete={confirmDelete}
                                onEditPermission={onEditPermission}
                                tabIndex={tabIndex}
                                setIsOpen={setIsOpen}
                            />
                        )}
                    </TabPanel>
                </TabPanels>
            </Tabs>

            {/* 用户详情弹窗 */}
            <Modal isOpen={isViewOpen} onClose={closeView} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("user.detailsTitle")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {userDetail && (
                            <VStack align="start" spacing={5}>
                                <Box>
                                    <Text fontWeight="bold">{t("user.name")}</Text>
                                    <Text>{userDetail.name}</Text>
                                </Box>

                                <Box>
                                    <Text fontWeight="bold">
                                        {t("user.email")}
                                        <Tooltip label={t("user.emailTooltip")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{userDetail.email}</Text>
                                </Box>

                                <Box>
                                    <Text fontWeight="bold">
                                        {t("user.role")}
                                        <Tooltip label={t("user.roleTooltip")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <Text>{userDetail.role}</Text>
                                </Box>

                                <Box>
                                    <Text fontWeight="bold">
                                        {t("user.project.label")}
                                        <Tooltip label={t("user.projectTooltip")} fontSize="md">
                                            <span><Icon as={InfoOutlineIcon} ml={2} color="gray.500" /></span>
                                        </Tooltip>
                                    </Text>
                                    <VStack align="start" mt={2}>
                                        {userDetail.projects.length > 0 ? (
                                            userDetail.projects.map((p: any) => (
                                                <Box key={p.id}>• {p.name}</Box>
                                            ))
                                        ) : (
                                            <Text color="gray.500">{t("user.noProjects")}</Text>
                                        )}
                                    </VStack>
                                </Box>
                            </VStack>
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* 权限详情弹窗 */}
                    <Modal isOpen={isPermissionOpen} onClose={closePermission} size="2xl">
                        <ModalOverlay />
                        <ModalContent>
                            <ModalHeader>{t("user.permissionTitle")}</ModalHeader>
                            <ModalCloseButton />
                            <ModalBody>
                                {userPermissions && (
                                    <VStack align="start" spacing={4}>
                                        <Text><b>{t("user.name")}:</b> {userPermissions.name}</Text>
                                        <Text><b>{t("user.email")}:</b> {userPermissions.email}</Text>
                                        <Text><b>{t("user.role")}:</b> {userPermissions.role}</Text>
                                        <Text display="flex" alignItems="center" gap={1}>
                                            <b>{t("user.permissions")}:</b>
                                            <Tooltip label={t("user.permissionsHelp")} fontSize="md">
                                            <span>
                                              <Icon as={InfoOutlineIcon} boxSize={4} color="gray.500" />
                                            </span>
                                            </Tooltip>
                                        </Text>


                                        <Box w="100%" borderWidth={1} borderRadius="md" p={4} bg="gray.50">
                                            <VStack align="start" spacing={3}>
                                                {Object.entries(userPermissions?.permissions ?? {}).map(([mod, perms]) => {

                                                    const typedPerms = perms as {
                                                        create: boolean;
                                                        update: boolean;
                                                        delete: boolean;
                                                    };

                                                    return (
                                                        <Box
                                                            key={mod}
                                                            borderWidth={1}
                                                            borderRadius="md"
                                                            p={3}
                                                            w="100%"
                                                            bg="white"
                                                            shadow="sm"
                                                        >
                                                            <Text fontWeight="bold" mb={2}>
                                                                {t(`user.module.${mod}`)}
                                                            </Text>
                                                            <HStack spacing={6} pl={2} wrap="wrap">
                                                                <HStack>
                                                                    <Text fontSize="sm">{t("user.permission.create")}:</Text>
                                                                    {typedPerms.create ? (
                                                                        <CheckIcon color="green.500" boxSize={4} />
                                                                    ) : (
                                                                        <CloseIcon color="red.500" boxSize={3} />
                                                                    )}
                                                                </HStack>
                                                                <HStack>
                                                                    <Text fontSize="sm">{t("user.permission.update")}:</Text>
                                                                    {typedPerms.update ? (
                                                                        <CheckIcon color="green.500" boxSize={4} />
                                                                    ) : (
                                                                        <CloseIcon color="red.500" boxSize={3} />
                                                                    )}
                                                                </HStack>
                                                                <HStack>
                                                                    <Text fontSize="sm">{t("user.permission.delete")}:</Text>
                                                                    {typedPerms.delete ? (
                                                                        <CheckIcon color="green.500" boxSize={4} />
                                                                    ) : (
                                                                        <CloseIcon color="red.500" boxSize={3} />
                                                                    )}
                                                                </HStack>
                                                            </HStack>
                                                        </Box>
                                                    );
                                                })}

                                            </VStack>
                                        </Box>
                                    </VStack>
                                )}
                            </ModalBody>
                        </ModalContent>
                    </Modal>




            {/* 删除确认弹窗 */}
            <Modal isOpen={isDeleteOpen} onClose={closeDelete}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("user.confirmDeleteTitle")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {userDetail && (
                            <VStack align="start" spacing={5}>
                                <Box>
                                    <Text fontWeight="bold">
                                        ⚠️ {t("user.confirmDeleteText", { name: userDetail.name })}
                                    </Text>
                                </Box>

                                {userDetail.projects.length > 0 && (
                                    <Box>
                                        <Text fontWeight="bold">{t("user.associatedProjects")}</Text>
                                        <VStack align="start" mt={2}>
                                            {userDetail.projects.map((p: any) => (
                                                <Box key={p.id}>• {p.name}</Box>
                                            ))}
                                        </VStack>
                                    </Box>
                                )}
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="red" onClick={handleDelete}>{t("user.action.delete")}</Button>
                        <Button ml={3} onClick={closeDelete}>{t("user.action.cancel")}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* 创建用户弹窗 */}
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("user.createUser")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <FormControl mb={3}>
                            <FormLabel>{t("user.name")}</FormLabel>
                            <Input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                        </FormControl>
                        <FormControl isRequired isInvalid={!newUser.email.trim()} mb={3}>
                            <FormLabel>
                                {t("user.email")}
                                <Tooltip label={t("user.emailTooltip")} fontSize="md">
            <span>
              <Icon as={InfoOutlineIcon} ml={2} color="gray.500" />
            </span>
                                </Tooltip>
                            </FormLabel>
                            <Input
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                            />
                            {!newUser.email.trim() && <FormErrorMessage>{t("user.form.required")}</FormErrorMessage>}
                        </FormControl>

                        <FormControl mb={3}>
                            <FormLabel>{t("user.role")}</FormLabel>
                            <Select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as NewUser['role'] })}>
                                <option value="auteur">Auteur</option>
                            </Select>
                        </FormControl>
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" onClick={handleCreateUser}>{t("user.action.create")}</Button>
                        <Button ml={3} onClick={() => setIsOpen(false)}>{t("user.action.cancel")}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* 权限编辑弹窗 */}
            <Modal isOpen={isEditPermissionOpen} onClose={closeEditPermission}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t("user.editPermissionsTitle")}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {userPermissions && (
                            <VStack align="start" spacing={4}>
                                <Text><b>{t("user.name")}:</b> {userPermissions.name}</Text>
                                <Text><b>{t("user.email")}:</b> {userPermissions.email}</Text>
                                <Text display="flex" alignItems="center" gap={1}>
                                    <b>{t("user.permissions")}:</b>
                                    <Tooltip label={t("user.permissionsHelp")} fontSize="md">
                                    <span>
                                      <Icon as={InfoOutlineIcon} boxSize={4} color="gray.500" />
                                    </span>
                                    </Tooltip>
                                </Text>


                                {Object.entries(editPermissions).map(([mod, perms]) => (
                                    <Box key={mod} w="100%" borderWidth={1} borderRadius="md" p={3}>
                                        <Text fontWeight="bold" mb={2}>{t(`user.module.${mod}`)}</Text>
                                        <HStack spacing={6}>
                                            {(['create', 'update', 'delete'] as PermissionAction[]).map((action) => (
                                                <FormControl display="flex" alignItems="center" key={action}>
                                                    <FormLabel mb="0" minW="60px" fontSize="sm">
                                                        {t(`user.permission.${action}`)}
                                                    </FormLabel>
                                                    <Switch
                                                        size="sm"
                                                        isChecked={perms[action]}
                                                        onChange={(e) => {
                                                            const value = e.target.checked;
                                                            setEditPermissions((prev) => ({
                                                                ...prev,
                                                                [mod]: {
                                                                    ...prev[mod],
                                                                    [action]: value
                                                                }
                                                            }));
                                                        }}
                                                    />
                                                </FormControl>
                                            ))}
                                        </HStack>
                                    </Box>
                                ))}
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" onClick={handleSavePermissions}>
                            {t("user.action.save")}
                        </Button>
                        <Button ml={3} onClick={closeEditPermission}>
                            {t("user.action.close")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>




        </Box>
    );
}

const UserTableSection = ({
                              users, total, page, setPage, fetchUsers, search, setSearch,
                              onView, onDelete, onEditPermission, tabIndex, setIsOpen
                          }: UserTableSectionProps) => {
    const { t } = useTranslation("common");
    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);
    const [selectedUser, setSelectedUser] = useState<{ id: number; name: string; isActive: boolean } | null>(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [isToggling, setIsToggling] = useState(false);


    return (
        <Box>
            <HStack justify="space-between" mb={4}>
                <InputGroup maxW="600px">
                    <InputLeftElement pointerEvents="none" children={<SearchIcon color="gray.400" />} />
                    <Input
                        placeholder={t("user.searchPlaceholder")}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        size="lg"
                        borderRadius="md"
                        boxShadow="sm"
                        bg="white"
                        focusBorderColor="blue.400"
                    />
                </InputGroup>

                {tabIndex === 0 && (
                    <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={() => setIsOpen(true)} mr="120px">
                        {t("user.createUser")}
                    </Button>
                )}
            </HStack>

            <Table variant="simple">
                <Thead>
                    <Tr>
                        <Th>{t("user.name")}</Th>
                        <Th>{t("user.email")}</Th>
                        <Th>{t("user.role")}</Th>
                        <Th>{t("user.active")}</Th>
                        <Th>{t("user.table.actions")}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {users.map(u => (
                        <Tr key={u.id}>
                            <Td>{u.name}</Td>
                            <Td>{u.email}</Td>
                            <Td><Badge>{u.role}</Badge></Td>
                            <Td>
                                <Switch
                                    isChecked={u.isActive}
                                    onChange={() => {
                                        setSelectedUser({ id: u.id, name: u.name, isActive: u.isActive });
                                        onOpen();
                                    }}
                                />

                            </Td>
                            <Td>
                                <HStack>
                                    <IconButton
                                        icon={<ViewIcon />}
                                        aria-label="view"
                                        onClick={() => onView(u.id)}
                                    />

                                    {tabIndex === 1 && (
                                        <IconButton
                                            icon={<EditIcon />}
                                            colorScheme="yellow"
                                            aria-label="edit-permissions"
                                            onClick={() => onEditPermission(u.id)}
                                        />
                                    )}

                                    {tabIndex === 0 && (
                                        <IconButton
                                            icon={<DeleteIcon />}
                                            aria-label="delete"
                                            colorScheme="red"
                                            onClick={() => onDelete(u.id)}
                                        />
                                    )}
                                </HStack>

                            </Td>
                        </Tr>
                    ))}
                </Tbody>
            </Table>

            <Flex justify="center" align="center" mt={4} gap={4}>
                <Button onClick={() => setPage(prev => Math.max(prev - 1, 1))} isDisabled={page === 1}>
                    {t("user.pagination.prev")}
                </Button>
                <Text>{page} / {totalPages || 1}</Text>
                <Button onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} isDisabled={page >= totalPages}>
                    {t("user.pagination.next")}
                </Button>
            </Flex>

            <Modal isOpen={isOpen} onClose={onClose} isCentered>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>
                        {selectedUser?.isActive ? t("user.deactivate") : t("user.activate")}
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Text>
                            {selectedUser?.isActive
                                ? t("user.confirmDeactivate", { name: selectedUser.name })
                                : t("user.confirmActivate", { name: selectedUser?.name })}
                        </Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            colorScheme={selectedUser?.isActive ? "red" : "blue"}
                            isLoading={isToggling}
                            onClick={async () => {
                                if (!selectedUser) return;
                                setIsToggling(true);
                                try {
                                    await axios.put(`/api/users/${selectedUser.id}/active`, {
                                        isActive: !selectedUser.isActive,
                                    });
                                    fetchUsers();
                                } catch (e) {
                                    // 可选：toast 错误提示
                                } finally {
                                    setIsToggling(false);
                                    onClose();
                                }
                            }}
                        >
                            {t("common.confirm")}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

        </Box>
    );
};

export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common']))
        },
    };
};

UserManagementPage.getLayout = (page: ReactElement) => <SidebarLayout>{page}</SidebarLayout>;

const ProtectedPage = withAuthProtection(UserManagementPage) as NextPageWithLayout;
ProtectedPage.getLayout = UserManagementPage.getLayout;
export default ProtectedPage;

