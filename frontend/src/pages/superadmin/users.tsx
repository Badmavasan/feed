// ✅ UserManagementPage with edit, view, delete modals
import React, { useEffect, useState } from "react";
import {
    Box, Button, Input, Table, Thead, Tbody, Select, Tr, Th, Td,
    IconButton, useToast, Modal, ModalOverlay, ModalContent,
    ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
    FormControl, FormLabel, Checkbox, HStack, VStack, Text, Switch
} from "@chakra-ui/react";
import {DeleteIcon, ViewIcon, EditIcon, AddIcon} from "@chakra-ui/icons";
import dynamic from 'next/dynamic';
import axios from '@/utils/axiosInstance';
import { User, NewUser } from '@/types/user';
import {GetStaticProps} from "next";
import {serverSideTranslations} from "next-i18next/serverSideTranslations";
import {useTranslation} from "next-i18next";

const SidebarLayout = dynamic(() => import('@/components/SidebarLayout'), { ssr: false });

export default function UserManagementPage() {

    const { t } = useTranslation("common");

    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [viewUser, setViewUser] = useState<User | null>(null);
    const [deleteUser, setDeleteUser] = useState<User | null>(null);
    const [newUser, setNewUser] = useState<NewUser>({
        name: "",
        email: "",
        role: "auteur",
        permissions: {}
    });

    const openCreateModal = () => {
        setEditingUser(null);
        setNewUser({ name: "", email: "", role: "auteur", permissions: {} });
        setIsOpen(true);
    };

    const toast = useToast();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/users/list');
            setUsers(res.data?.users ?? []);
        } catch {
            toast({ title: "Error de chargement", status: "error" });
        }
    };

    const handleSaveUser = async () => {
        if (!newUser.name || !newUser.email) {
            toast({ title: "Champs requis manquants", status: "error" });
            return;
        }
        try {
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}`, newUser);
                toast({ title: "Utilisateur modifié", status: "success" });
            } else {
                await axios.post('/api/users', newUser);
                toast({ title: "Utilisateur créé", status: "success" });
            }
            setIsOpen(false);
            setEditingUser(null);
            setNewUser({ name: "", email: "", role: "auteur", permissions: {} });
            fetchUsers();
        } catch (e: any) {
            toast({ title: e.response?.data?.message || "Erreur", status: "error" });
        }
    };

    const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

    return (
        <SidebarLayout>
            <Box>
                <HStack justifyContent="space-between" mt={6} mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">{t("user.title")}</Text>
                    <Button
                        leftIcon={<AddIcon />}
                        onClick={openCreateModal}
                        colorScheme="blue"
                        mr="120px"
                    >
                        {t("user.create")}
                    </Button>

                </HStack>

                    <Input
                        placeholder={t("user.searchPlaceholder")}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        maxW="600px"
                        size="lg"
                        borderRadius="md"
                        boxShadow="sm"
                    />

                <Table variant="simple">
                    <Thead><Tr><Th>Nom</Th><Th>Email</Th><Th>Rôle</Th><Th>Actif</Th><Th>Actions</Th></Tr></Thead>
                    <Tbody>
                        {filtered.map(u => (
                            <Tr key={u.id}>
                                <Td>{u.name}</Td>
                                <Td>{u.email}</Td>
                                <Td>{u.role}</Td>
                                <Td>
                                    <Switch
                                        isChecked={u.isActive}
                                        onChange={async () => {
                                            if (u.isActive) {
                                                const confirmed = window.confirm("Êtes-vous sûr de vouloir désactiver cet utilisateur ? Il ne pourra plus se connecter.");
                                                if (!confirmed) return;
                                            }
                                            await axios.put(`/api/users/${u.id}/active`, { isActive: !u.isActive });
                                            fetchUsers();
                                        }}
                                    />
                                </Td>

                                <Td>
                                    <IconButton icon={<ViewIcon />} onClick={() => { setViewUser(u); setIsViewOpen(true); }} aria-label="view" mr={2} />
                                    <IconButton icon={<EditIcon />} onClick={() => { setNewUser(u); setEditingUser(u); setIsOpen(true); }} aria-label="edit" mr={2} />
                                    <IconButton icon={<DeleteIcon />} colorScheme="red" onClick={() => { setDeleteUser(u); setIsDeleteOpen(true); }} aria-label="delete" />
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>

                {/* Create / Edit Modal */}
                <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="xl">
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>{editingUser ? "Modifier" : "Créer"} un utilisateur</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <FormControl mb={3} isRequired><FormLabel>Nom</FormLabel><Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></FormControl>
                            <FormControl mb={3} isRequired><FormLabel>Email</FormLabel><Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></FormControl>
                            <FormControl mb={3}><FormLabel>Rôle</FormLabel><Select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}>
                                <option value="auteur">Auteur</option>
                                <option value="admin">Admin</option>
                            </Select></FormControl>

                        </ModalBody>
                        <ModalFooter>
                            <Button colorScheme="blue" onClick={handleSaveUser}>Valider</Button>
                            <Button onClick={() => setIsOpen(false)} ml={3}>Annuler</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>Détails utilisateur</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                            <Text><strong>Nom:</strong> {viewUser?.name}</Text>
                            <Text><strong>Email:</strong> {viewUser?.email}</Text>
                            <Text><strong>Rôle:</strong> {viewUser?.role}</Text>
                            <Text><strong>Actif:</strong> {viewUser?.isActive ? 'Oui' : 'Non'}</Text>

                        </ModalBody>
                        <ModalFooter>
                            <Button onClick={() => setIsViewOpen(false)}>Fermer</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>


                {/* Delete Modal */}
                <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
                    <ModalOverlay />
                    <ModalContent>
                        <ModalHeader>Supprimer l'utilisateur</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>Êtes-vous sûr de vouloir supprimer {deleteUser?.name} ?</ModalBody>
                        <ModalFooter>
                            <Button colorScheme="red" onClick={async () => {
                                await axios.delete(`/api/users/${deleteUser?.id}`);
                                setIsDeleteOpen(false);
                                fetchUsers();
                            }}>Supprimer</Button>
                            <Button onClick={() => setIsDeleteOpen(false)} ml={3}>Annuler</Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </Box>
        </SidebarLayout>
    );
}


export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'fr', ['common']))
        },
    };
};