import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import axios from '@/utils/axiosInstance';
import {
    Box, Button, Flex, Text, HStack, Avatar, Textarea,
    IconButton, useToast
} from '@chakra-ui/react';
import {ArrowBackIcon, ChevronDownIcon, ChevronUpIcon} from '@chakra-ui/icons';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAuthContext } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

const fetcher = (url: string) => axios.get(url).then(res => res.data);

function formatDate(date: string) {
    return dayjs(date).format('MMMM DD');
}

type Message = {
    id: number;
    content: string;
    createdAt: string;
    isSystemMessage?: boolean;
    sender?: {
        id: number;
        name: string;
        avatar_url?: string;
    };
};

export default function AdminChatPage() {
    const router = useRouter();
    const { id } = router.query;
    const toast = useToast();
    const { currentProject } = useProjectContext();
    const { currentUser } = useAuthContext();

    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const [showDetails, setShowDetails] = useState(true);


    const { data: messages = [], mutate } = useSWR(
        id && currentProject?.id ? `/api/moderationMessages/${id}/messages?projectId=${currentProject.id}` : null,
        fetcher
    );

    const { data: moderation } = useSWR(
        id && currentProject?.id ? `/api/moderations/${id}?projectId=${currentProject.id}` : null,
        fetcher
    );



    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (id && currentProject?.id) {
            axios.post(`/api/moderationMessages/${id}/mark-read?projectId=${currentProject.id}`);
        }
    }, [id, currentProject?.id]);



    const handleSend = async () => {
        if (!input.trim()) return;
        try {
            setSending(true);
            await axios.post(`/api/moderationMessages/${id}/messages`, { content: input });
            setInput('');
            await mutate();
        } catch (e) {
            toast({ title: "Erreur lors de l'envoi", status: 'error' });
        } finally {
            setSending(false);
        }
    };

    const groupedMessages = messages.reduce(
        (acc: Record<string, Message[]>, msg: Message) => {
            const date = formatDate(msg.createdAt);
            if (!acc[date]) acc[date] = [];
            acc[date].push(msg);
            return acc;
        },
        {} as Record<string, Message[]>
    );

    return (
        <Flex direction="column" h="100vh">
            <HStack p={4} borderBottom="1px solid #eee" justifyContent="space-between" bg="gray.50">
                <HStack>
                    <IconButton
                        aria-label="Retour"
                        icon={<ArrowBackIcon />}
                        onClick={() => router.push('/admin/demandes')}
                        variant="ghost"
                    />
                    <Text fontWeight="bold" fontSize="lg">Discussion</Text>
                </HStack>
            </HStack>

            {moderation && (
                <Box px={4} py={3} bg="white" borderBottom="1px solid #eee">
                    <Flex justify="space-between" align="center">
                        <Text fontWeight="semibold">
                            {moderation.action_type} {moderation.entity_type}
                        </Text>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDetails((prev) => !prev)}
                            leftIcon={showDetails ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        >
                            {showDetails ? 'Masquer les détails' : 'Afficher les détails'}
                        </Button>

                    </Flex>

                    {showDetails && (
                        <Box mt={2}>
                            <Text fontSize="sm" color="gray.600">
                                Soumis par : {moderation.requester?.email || 'Inconnu'}
                            </Text>

                            <Text fontSize="sm" color="gray.600">
                                {dayjs(moderation.created_at).format('DD MMM YYYY à HH:mm')}
                            </Text>
                            <Text fontSize="sm">
                                Statut : <b>
                                {{
                                    'pending_review': 'En attente',
                                    'approved': 'Validée',
                                    'rejected': 'Refusée',
                                    'withdrawn': 'Retirée par l’auteur'
                                }[moderation.status as string] || moderation.status}
                            </b>
                            </Text>
                        </Box>
                    )}
                </Box>
            )}

            <Box flex={1} overflowY="auto" px={4} py={2} bg="gray.100">
                {(Object.entries(groupedMessages) as [string, Message[]][]).map(([date, msgs], idx) => (
                    <Box key={idx}>
                        <Flex justify="center" my={4}>
                            <Text fontSize="sm" color="gray.500" bg="gray.100" px={3} py={1} borderRadius="full">
                                {date}
                            </Text>
                        </Flex>
                        {msgs.map((msg, i) => {
                            const isMe = msg.sender?.id === currentUser?.id;
                            const isSystem = msg.isSystemMessage;
                            return (
                                <Flex key={i} justify={isSystem ? 'center' : isMe ? 'flex-end' : 'flex-start'}>
                                    <Box
                                        maxW="70%"
                                        p={3}
                                        borderRadius="lg"
                                        bg={isSystem ? 'gray.300' : isMe ? 'blue.100' : 'white'}
                                        color="black"
                                        boxShadow="md"
                                        whiteSpace="pre-wrap"
                                        mb={2}
                                    >
                                        {!isSystem && (
                                            <HStack mb={1} spacing={2} align="center">
                                                <Avatar size="xs" src={msg.sender?.avatar_url || ''} />
                                                <Text fontSize="sm" fontWeight="bold">{msg.sender?.name || 'Inconnu'}</Text>
                                                <Text fontSize="xs" color="gray.700">{dayjs(msg.createdAt).format('HH:mm')}</Text>
                                            </HStack>
                                        )}
                                        <Text fontSize="sm">{msg.content}</Text>
                                    </Box>
                                </Flex>
                            );
                        })}
                    </Box>
                ))}

                <div ref={bottomRef} />
            </Box>

            <Box borderTop="1px solid #eee" px={4} py={3} bg="white">
                <HStack spacing={4} align="flex-start">
                    <Textarea
                        placeholder="Écrire un message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        resize="vertical"
                        rows={2}
                    />
                    <Button onClick={handleSend} colorScheme="blue" isLoading={sending}>Envoyer</Button>
                </HStack>
            </Box>
        </Flex>
    );
}
