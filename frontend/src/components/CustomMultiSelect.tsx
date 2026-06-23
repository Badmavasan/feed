import {
    Box, Checkbox, Input, Menu, MenuButton, MenuList, Button,
    Text, VStack, Tag, TagLabel, TagCloseButton, Wrap, WrapItem,
    useColorMode
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";

interface Option {
    label: string;
    value: number;
    description?: string;
}

interface Props {
    label?: React.ReactNode;
    options: Option[];
    value: number[];
    onChange: (values: number[]) => void;
    renderOption?: (option: Option) => React.ReactNode;
    renderValue?: (selectedOptions: Option[]) => React.ReactNode;
}

export default function CustomMultiSelect({
                                                    label,
                                                    options,
                                                    value,
                                                    onChange,
                                                    renderOption,
                                                    renderValue
                                                }: Props) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [filtered, setFiltered] = useState<Option[]>(options);
    const { colorMode } = useColorMode();

    const buttonProps = colorMode === "dark" ? {
        bg: "gray.700",
        color: "gray.100",
        _hover: { bg: "gray.600" }
    } : {};

    const menuListProps = colorMode === "dark" ? {
        bg: "gray.800",
        color: "gray.100"
    } : {};

    const inputProps = colorMode === "dark" ? {
        bg: "gray.700",
        color: "gray.100",
        borderColor: "gray.600",
        _placeholder: { color: "gray.400" }
    } : {};

    const textColor = colorMode === "dark" ? "gray.100" : "inherit";
    const subTextColor = colorMode === "dark" ? "gray.400" : "gray.500";

    useEffect(() => {
        setFiltered(
            options.filter(opt =>
                opt.label.toLowerCase().includes(search.toLowerCase()) ||
                String(opt.value).toLowerCase().includes(search.toLowerCase()) ||
                opt.description?.toLowerCase().includes(search.toLowerCase())
            )
        );
    }, [search, options]);

    const handleToggle = (val: number) => {
        onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val]);
    };

    const selectedOptions = options.filter(o => value.includes(o.value));

    const displayTags = renderValue ? renderValue(selectedOptions) : (
        <Wrap spacing={2} mt={2}>
            {selectedOptions.map(opt => (
                <WrapItem key={opt.value}>
                    <Tag size="md" borderRadius="full" variant="solid" colorScheme="blue">
                        <TagLabel>{opt.label}</TagLabel>
                        <TagCloseButton onClick={() => handleToggle(opt.value)} />
                    </Tag>
                </WrapItem>
            ))}
        </Wrap>
    );

    return (
        <Box mt={4}>
            {label && <Text fontWeight="semibold" mb={1}>{label}</Text>}
            <Menu closeOnSelect={false} isLazy matchWidth>
                <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    width="100%"
                    py={6}
                    textAlign="left"
                    {...buttonProps}
                >
                    {(value?.length ?? 0) === 0
                        ? t("form.selectPlaceholder", "Select...")
                        : `${value.length} ${t("form.selected", "selected")}`}
                </MenuButton>

                <MenuList maxH="300px" overflowY="auto" px={2} {...menuListProps}>
                    <Box p={2}>
                        <Input
                            placeholder={t("form.searchPlaceholder")}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            size="sm"
                            {...inputProps}
                        />
                    </Box>

                    <VStack align="start" spacing={2} p={2}>
                        {filtered.length === 0 ? (
                            <Text fontSize="sm" color={subTextColor}>{t("form.noResult")}</Text>
                        ) : (
                            filtered.map(opt => (
                                <Box key={opt.value} w="100%">
                                    <Checkbox
                                        isChecked={value.includes(opt.value)}
                                        onChange={() => handleToggle(opt.value)}
                                        color={textColor}
                                    >
                                        {renderOption ? renderOption(opt) : (
                                            <Box>
                                                <Text fontWeight="medium">{opt.label}</Text>
                                                {opt.description && (
                                                    <Text fontSize="xs" color={subTextColor}>{opt.description}</Text>
                                                )}
                                            </Box>
                                        )}
                                    </Checkbox>
                                </Box>
                            ))
                        )}
                    </VStack>
                </MenuList>
            </Menu>
            {displayTags}
        </Box>
    );
}