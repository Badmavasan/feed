import {
    Avatar,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Text,
    VStack,
    HStack,
    Box, Portal,
} from "@chakra-ui/react"
import {
    AtSignIcon,
    SettingsIcon,
    LockIcon,
    ExternalLinkIcon,
} from "@chakra-ui/icons"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import axiosInstance from "@/utils/axiosInstance"

export const UserMenu = () => {
    const router = useRouter()

    const [user, setUser] = useState({
        name: "Guest",
        email: "guest@example.com",
    })

    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const storedUser = localStorage.getItem("currentUser")
        if (storedUser) {
            setUser(JSON.parse(storedUser))
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add("user-menu-open")
            document.body.style.overflow = "hidden"
        } else {
            document.body.classList.remove("user-menu-open")
            document.body.style.overflow = ""
        }

        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    const handleNavigate = (path: string) => {
        router.push(path)
    }

    const handleLogout = () => {
        localStorage.removeItem("currentUser")
        localStorage.removeItem("token")
        localStorage.removeItem("currentProject")
        axiosInstance.defaults.headers.common["Authorization"] = ""
        alert("Déconnecté !")
        router.push("/login")
    }

    return (
        <>
            {/* 点击遮罩关闭菜单，但保留浮层在上方 */}
            {isOpen && (
                <Box
                    position="fixed"
                    top={0}
                    left={0}
                    width="100vw"
                    height="100vh"
                    zIndex={9998}
                    onClick={() => setIsOpen(false)}
                />
            )}

            <Menu
                isOpen={isOpen}
                onOpen={() => setIsOpen(true)}
                onClose={() => setIsOpen(false)}
                placement="bottom-end"
            >
                <MenuButton zIndex={9999}>
                    <Avatar name={user.name} size="sm" />
                </MenuButton>
                <Portal>
                <MenuList
                    p={2}
                    minW="200px"
                    maxW="calc(100vw - 16px)"
                    boxShadow="lg"
                    borderRadius="md"
                    zIndex={999999}
                >
                    <VStack align="start" spacing={0} px={3} pb={2}>
                        <HStack>
                            <Text fontWeight="bold" fontSize="md">👤 {user.name}</Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.500">{user.email}</Text>
                    </VStack>

                    <MenuDivider />

                    <MenuItem icon={<AtSignIcon />} onClick={() => handleNavigate("/profile")}>
                        My Profile
                    </MenuItem>
                    <MenuItem icon={<SettingsIcon />} onClick={() => handleNavigate("/settings")}>
                        Settings & Preferences
                    </MenuItem>
                    <MenuItem icon={<LockIcon />} onClick={() => handleNavigate("/security")}>
                        Security
                    </MenuItem>

                    <MenuDivider />
                    <MenuItem icon={<ExternalLinkIcon />} onClick={handleLogout}>
                        Logout
                    </MenuItem>
                </MenuList>
                </Portal>
            </Menu>
        </>
    )
}
