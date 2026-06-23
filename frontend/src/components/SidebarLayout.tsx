import {
    Box,
    Flex,
    VStack,
    Button,
    IconButton,
    Tooltip,
    useColorModeValue,

    Text,
    Menu,
    MenuButton,
    MenuList,
    MenuItem, ComponentWithAs, IconProps, Collapse, Icon
} from "@chakra-ui/react";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    CalendarIcon,
    WarningIcon,
    EditIcon,
    ChatIcon,
    InfoOutlineIcon,
    ViewIcon,
    ChevronDownIcon as DropdownIcon
} from "@chakra-ui/icons";

import { useRouter } from "next/router";
import {JSX, ReactNode, useEffect, useState} from "react";
import { UserMenu } from "./UserMenu";
import { useTranslation } from "next-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useProjectContext } from "@/contexts/ProjectContext";
import {FolderIcon} from "lucide-react";
import { FaUserCog } from "react-icons/fa";
import {MdFolderSpecial, MdOutlineAssignment} from "react-icons/md";
import {IconType} from "react-icons";


// 自定义项目图标，这里用 StarIcon 代替
const ProjectIcon = FolderIcon ;

type Role = "super_admin" | "admin" | "auteur";

type ChakraIconType = ComponentWithAs<"svg", IconProps>;

interface SidebarItem {
    label: string;
    path?: string;
    icon: IconType | ChakraIconType;
    isParent?: boolean;
    children?: SidebarItem[];
}

// Project 类型定义保持不变
interface Project {
    id: number;
    name: string;
}

export default function SidebarLayout({ children }: { children: ReactNode }) {
    const { t } = useTranslation("common");
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(true);
    const [user, setUser] = useState<{ name: string; email: string; role: Role } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);


// 用 ProjectContext 提供的 projects
    const { currentProject, setCurrentProject, projects } = useProjectContext();

    useEffect(() => {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
            } catch (e) {
                console.error("Failed to parse user:", e);
            }
        }
    }, []);


    // 构建菜单项（所有 path 为固定扁平路径）
    useEffect(() => {
        if (!user) return;

        const roleSidebarItems: Record<Role, SidebarItem[]> = {
            super_admin: [
                { label: t("sidebar.userManagement"), path: "/superadmin/users", icon: FaUserCog  }
            ],
            admin: [
                { label: t("sidebar.userManagement"), path: "/admin/users", icon: FaUserCog   },
                { label: t("sidebar.requestManagement"), path: "/admin/demandes", icon: MdOutlineAssignment    },
                { label: t("sidebar.projectManagement"), path: "/admin/project", icon:  MdFolderSpecial }

            ],
            auteur: [
                { label: t("sidebar.myRequests"), path: "/mes_demandes", icon: MdOutlineAssignment },
                { label: t("sidebar.projectManagement"), path: "/project", icon:  MdFolderSpecial }
            ],
        };

        let commonSidebarItems: SidebarItem[] = [];

        if (user?.role === "super_admin") {
            commonSidebarItems = [

            ];
        } else {
            commonSidebarItems = [
                { label: t("sidebar.home"), path: "/dashboard", icon: InfoOutlineIcon },
                { label: t("sidebar.taskType"), path: "/taskType", icon: CalendarIcon },
                { label: t("sidebar.error"), path: "/error", icon: WarningIcon },
                { label: t("sidebar.exercise"), path: "/exercise", icon: EditIcon },
                {
                    label: t("sidebar.feedback"),
                    icon: ChatIcon,
                    path: "/feedback",
                    isParent: true,
                    children: [{ label: t("sidebar.component"), path: "/feedbackComponent", icon: ViewIcon }],
                },
            ];
        }


        const roleMenus = roleSidebarItems[user.role] || [];
        setSidebarItems([...commonSidebarItems, ...roleMenus]);
    }, [user, t]);

    useEffect(() => {
        const stored = localStorage.getItem("sidebarOpen");
        if (stored !== null) setIsOpen(JSON.parse(stored));
    }, []);

    useEffect(() => {
        localStorage.setItem("sidebarOpen", JSON.stringify(isOpen));
    }, [isOpen]);

    useEffect(() => {
        if (router.pathname.startsWith("/feedbackComponent")) {
            setExpanded(true);
        }
    }, [router.pathname]);

    // 切换项目只更新 currentProject，不跳转路由
    const handleProjectChange = (project: Project) => {
        setCurrentProject(project);
    };


    const sidebarBg = useColorModeValue("gray.100", "gray.900");
    const mainBg = useColorModeValue("white", "gray.800");
    const activeBg = useColorModeValue("blue.500", "blue.400");
    const activeColor = useColorModeValue("white", "gray.100");
    const textColor = useColorModeValue("gray.800", "gray.200");
    const hoverBg = useColorModeValue("gray.200", "gray.700");

    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const toggleExpanded = (label: string) => {
        setExpandedItems((prev) => ({
            ...prev,
            [label]: !prev[label],
        }));
    };

    return (
        <Flex height="100vh" bg={sidebarBg}>
            <Box
                w={isOpen ? "240px" : "70px"}
                bg={sidebarBg}
                p={4}
                boxShadow="md"
                transition="width 0.3s ease"
                display="flex"
                flexDirection="column"
                justifyContent="space-between"
                position="relative"
            >
                {/* 左上角：项目切换按钮 + 语言切换 + 收缩按钮 */}
                <Flex alignItems="center" mb={6} gap={2} minH="40px">
                        {isOpen && user?.role !== "super_admin" && (
                            <>
                                <Menu>
                                    <MenuButton
                                        as={Button}
                                        leftIcon={<ProjectIcon />}
                                        rightIcon={<DropdownIcon />}
                                        colorScheme="blue"
                                        variant="solid"
                                    >
                                        {currentProject?.name || "Sélectionner un projet"}
                                    </MenuButton>
                                    <MenuList>
                                        {projects.map((project) => (
                                            <MenuItem
                                                key={project.id}
                                                onClick={() => handleProjectChange(project)}
                                                fontWeight={project.id === currentProject?.id ? "bold" : "normal"}
                                            >
                                                {project.name}
                                            </MenuItem>
                                        ))}
                                    </MenuList>
                                </Menu>
                            </>
                        )}

                    <Box flex="1" textAlign="right">
                        <IconButton
                            aria-label="Toggle sidebar"
                            icon={isOpen ? <ChevronLeftIcon boxSize={6} /> : <ChevronRightIcon boxSize={6} />}
                            onClick={() => setIsOpen(!isOpen)}
                            size="md"
                            rounded="full"
                            colorScheme="blue"
                        />
                    </Box>
                </Flex>

                {/* 菜单项 */}
                <VStack spacing={3} align="start" w="full" flex="1" overflowY="auto" mb={4}>
                    {sidebarItems.map((item) => {
                        const isActive = router.pathname === item.path;
                        const isExpanded = expandedItems[item.label];

                        if (item.isParent && item.children) {
                            const collapseChildren: JSX.Element[] = item.children
                                .filter((child) => !!child.path)
                                .map((child) => (
                                    <Tooltip key={child.label} label={child.label} placement="right" isDisabled={!isOpen}>
                                        <Button
                                            onClick={() => router.push(child.path!)}
                                            variant="ghost"
                                            justifyContent={isOpen ? "start" : "center"}
                                            w="full"
                                            bg={router.pathname === child.path ? activeBg : "transparent"}
                                            color={router.pathname === child.path ? activeColor : textColor}
                                            _hover={{ bg: hoverBg }}
                                            fontWeight={router.pathname === child.path ? "bold" : "normal"}
                                            leftIcon={isOpen ? <Icon as={child.icon} boxSize={4} /> : undefined}
                                            rounded="lg"
                                            pl={isOpen ? 8 : 0}
                                            pr={isOpen ? 4 : 0}
                                            whiteSpace="nowrap"
                                            textAlign="left"
                                        >
                                            {isOpen ? child.label : <Icon as={child.icon} boxSize={5} />}
                                        </Button>
                                    </Tooltip>
                                ));

                            return (
                                <Box key={item.label} w="full">
                                    <Flex align="center" justify="space-between" w="full">
                                        <Tooltip label={item.label} placement="right" isDisabled={!isOpen}>
                                            <Button
                                                onClick={() => router.push(item.path || "/")}
                                                variant="ghost"
                                                justifyContent={isOpen ? "start" : "center"}
                                                w="full"
                                                bg={isActive ? activeBg : "transparent"}
                                                color={isActive ? activeColor : textColor}
                                                _hover={{ bg: hoverBg }}
                                                fontWeight={isActive ? "bold" : "normal"}
                                                leftIcon={isOpen ? <Icon as={item.icon} boxSize={4} /> : undefined}
                                                px={isOpen ? 4 : 0}
                                                textAlign="left"
                                            >
                                                {isOpen ? item.label : <Icon as={item.icon} boxSize={5} />}
                                            </Button>
                                        </Tooltip>

                                        <IconButton
                                            aria-label="Toggle submenu"
                                            icon={
                                                <ChevronDownIcon
                                                    transform={isExpanded ? "rotate(180deg)" : "rotate(0deg)"}
                                                    transition="transform 0.2s"
                                                />
                                            }
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpanded(item.label);
                                            }}
                                            minW={isOpen ? undefined : "40px"}
                                            h={isOpen ? undefined : "40px"}
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                        />
                                    </Flex>

                                    <Collapse in={isExpanded} animateOpacity={true} as="div" {...({} as any)}>
                                        <div>{collapseChildren}</div>
                                    </Collapse>



                                </Box>
                            );
                        }

                        return (
                            <Tooltip key={item.label} label={item.label} placement="right" isDisabled={!isOpen}>
                                <Button
                                    onClick={() => router.push(item.path!)}
                                    variant="ghost"
                                    justifyContent={isOpen ? "start" : "center"}
                                    w="full"
                                    bg={isActive ? activeBg : "transparent"}
                                    color={isActive ? activeColor : textColor}
                                    _hover={{ bg: hoverBg }}
                                    fontWeight={isActive ? "bold" : "normal"}
                                    leftIcon={isOpen ? <Icon as={item.icon} boxSize={4} /> : undefined}
                                    rounded="lg"
                                    px={isOpen ? 4 : 0}
                                    whiteSpace="nowrap"
                                    textAlign="left"
                                >
                                    {isOpen ? item.label : <Icon as={item.icon} boxSize={5} />}
                                </Button>
                            </Tooltip>
                        );
                    })}
                </VStack>

                {/* 左下角：标题 */}
                <Box pt={2} borderTop="1px solid" borderColor={useColorModeValue("gray.300", "gray.700")}>
                    {isOpen ? (
                        <Text
                            fontWeight="bold"
                            fontSize="lg"
                            color={textColor}
                            userSelect="none"
                            textAlign="center"
                            mb={2}
                        >
                            FEED
                        </Text>
                    ) : (
                        <Box h="40px" />
                    )}
                </Box>
            </Box>

            {/* 主体内容区域 */}
            <Box flex={1} overflowY="auto" bg={mainBg}>
                <Box p={6} position="relative">
                    {/* 顶部右上角：语言切换按钮 + 用户头像 */}
                    <Box position="absolute" top={4} right={4} zIndex={1500}>
                        <Flex align="center" gap={3}>
                            <Box transform="scale(0.85)">
                                <LanguageSwitcher />
                            </Box>
                            <Box transform="scale(1.15)">
                                <UserMenu />
                            </Box>
                        </Flex>
                    </Box>

                    {children}
                </Box>
            </Box>

        </Flex>
    );
}
