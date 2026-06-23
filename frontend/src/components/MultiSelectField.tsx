import {
    Box,
    Checkbox,
    CheckboxGroup,
    FormControl,
    FormLabel,
    Input,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";

interface Option {
    id: string;
    [key: string]: string | number | undefined;
}


interface MultiSelectFieldProps {
    label: string;
    localStorageKey: string;
    selectedValues: string[];
    setSelectedValues: (values: string[]) => void;
    enabled: boolean;
    setEnabled?: (enabled: boolean) => void;
    placeholder?: string;
    displayField: string;
    secondaryField?: string;
}

export default function MultiSelectField({
                                             label,
                                             localStorageKey,
                                             selectedValues,
                                             setSelectedValues,
                                             enabled,
                                             setEnabled,
                                             placeholder = "Rechercher par ID ou Nom",
                                             displayField,
                                             secondaryField,
                                         }: MultiSelectFieldProps) {
    const [options, setOptions] = useState<Option[]>([]);
    const [search, setSearch] = useState("");

    const loadOptions = () => {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
            setOptions(JSON.parse(stored));
        }
    };

    useEffect(() => {
        loadOptions(); // 初次加载
        const interval = setInterval(() => {
            loadOptions(); // 每隔1秒钟同步一下localStorage
        }, 1000);

        return () => clearInterval(interval); // 组件卸载时清除
    }, [localStorageKey]);

    const filtered = options.filter((opt) => {
        const primary = opt[displayField]?.toString().toLowerCase() || "";
        const secondary = secondaryField ? (opt[secondaryField]?.toString().toLowerCase() || "") : "";
        const id = opt.id?.toString().toLowerCase() || "";
        const s = search.toLowerCase();
        return primary.includes(s) || secondary.includes(s) || id.includes(s);
    });

    return (
        <VStack align="start" spacing={3} mt={3}>
            {setEnabled && (
                <Checkbox isChecked={enabled} onChange={(e) => setEnabled(e.target.checked)}>
                    {label}
                </Checkbox>
            )}
            <FormControl isDisabled={!enabled}>
                {!setEnabled && <FormLabel>{label}</FormLabel>}
                <Input
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <CheckboxGroup
                    value={selectedValues}
                    onChange={(vals) => setSelectedValues(vals as string[])}
                >
                    <Box
                        border="1px solid #E2E8F0"
                        borderRadius="md"
                        p={2}
                        maxHeight="150px"
                        overflowY="auto"
                        w="100%"
                    >
                        <Stack spacing={1}>
                            {filtered.map((opt) => (
                                <Checkbox key={`${localStorageKey}-${opt.id}`} value={opt.id} alignItems="start">
                                    <Box textAlign="left">
                                        {/* 显示 Sous-type */}
                                        {localStorageKey === "task-types" && (
                                            <>
                                                <Text fontWeight="bold" isTruncated>
                                                    Task ID: {opt.taskId} {/* 显示 taskId */}
                                                </Text>
                                                <Text fontSize="xs" color="gray.500" isTruncated>
                                                    Nom: {opt.name} {/* 显示 name */}
                                                </Text>
                                            </>
                                        )}

                                        {/* 显示 Erreurs */}
                                        {localStorageKey === "erreurs" && (
                                            <>
                                                <Text fontWeight="bold" isTruncated>
                                                    ErreurTag: {opt.tag} {/* 显示 tag */}
                                                </Text>
                                                <Text fontSize="xs" color="gray.500" isTruncated>
                                                    Description: {opt.description} {/* 显示 description */}
                                                </Text>
                                            </>
                                        )}

                                        {/* 显示 Exercices */}
                                        {localStorageKey === "exercices" && (
                                            <>
                                                <Text fontWeight="bold" isTruncated>
                                                    Exercise ID: {opt.exerciseId} {/* 显示 exerciseId */}
                                                </Text>
                                                <Text fontSize="xs" color="gray.500" isTruncated>
                                                    Correct Code: {opt.correctcode} {/* 显示 correctcode */}
                                                </Text>
                                            </>
                                        )}

                                        {/* 显示 Feedbacks */}
                                        {localStorageKey === "feedbacks" && (
                                            <>
                                                <Text fontWeight="bold" isTruncated>
                                                    Feedback ID: {opt.feedbackId} {/* 显示 feedbackId */}
                                                </Text>
                                                <Text fontSize="xs" color="gray.500" isTruncated>
                                                    Theme: {opt.theme} {/* 显示 theme */}
                                                </Text>
                                            </>
                                        )}

                                        {/* 公共显示 ID */}
                                        <Text fontSize="xs" color="gray.400" isTruncated>
                                            ID: {opt.id}  {/* 公共显示 ID */}
                                        </Text>
                                    </Box>
                                </Checkbox>
                            ))}
                        </Stack>
                    </Box>
                </CheckboxGroup>
            </FormControl>
        </VStack>
    );
}
