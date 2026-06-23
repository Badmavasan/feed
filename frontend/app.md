1. 首先引入库和组件
    
   import { useEffect, useState } from "react";
   Chakra UI：一个简单易用的组件库，用来快速构建用户界面。按钮（Button）、输入框（Input）、模态框（Modal）等
   import { Box, Button, Input, Textarea, Radio, RadioGroup, Stack, FormControl, FormLabel, Text, HStack, IconButton, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Table, Thead, Tbody, Tr, Th, Td, useToast, Divider, Select, FormErrorMessage } from "@chakra-ui/react";
   import { AddIcon, DeleteIcon, EditIcon, ViewIcon } from "@chakra-ui/icons";
   import SidebarLayout from "@/components/SidebarLayout";
2. 组件定义 定义了一个FeedbackComponent 类型来描述一个反馈组件
   interface FeedbackComponent {
   id: string;
   type: "Text" | "Image" | "Code";
   content: string;
   nature: "logos" | "technique" |  exemple |  erreur |  étayage (liste à affiner).;
   exemple: boolean;
   exerciceAssocie: boolean;
   exerciceAssocieId?: string | null;
   erreurAssocie: boolean;
   erreurDescription?: string;
   createTime: string;
   }
3. 页面的数据存储方式是通过 localStorage（本地存储）来进行的
   localStorage 是浏览器提供的一种持久化存储方式，用来在不同页面之间共享数据，即使页面刷新也能保留数据
   a. 获取数据
   当页面加载时 会从localstorage中获取存储的 反馈组件 和 练习列表 数据
   从localstroge中读取数据 如果存在 就解析成数组 保存在 组件的状态中setComponents
   useEffect(() => {
   const stored = localStorage.getItem("feedback-components");
   if (stored) setComponents(JSON.parse(stored));
   
   const storedExos = localStorage.getItem("exercices");
   if (storedExos) setExercices(JSON.parse(storedExos));
   }, []);

   b. 保存数据
    每当 components 的数据发生变化时 都将其保存回localstorage
   useEffect(() => {
   if (components.length > 0) {
   localStorage.setItem("feedback-components", JSON.stringify(components));
   }
   }, [components]);
4. 获取练习列表 并将其与components关联起来
   
