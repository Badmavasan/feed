import { Box, Button } from "@chakra-ui/react";
import { Editor } from "@monaco-editor/react";

interface CodeInputProps {
    value: string;
    index: number;
    onChange: (index: number, value: string) => void;
    onRemove?: (index: number) => void;
    canRemove?: boolean;
}

const CodeInput = ({ value, index, onChange, onRemove, canRemove = false }: CodeInputProps) => {
    return (
        <Box mb={4}>
            <Editor
                height="300px"
                language="javascript"
                theme="vs-dark"
                value={value}
                onChange={(val) => onChange(index, val || "")}
            />
            {canRemove && (
                <Button colorScheme="red" mt={2} onClick={() => onRemove?.(index)}>
                    Supprimer ce bloc
                </Button>
            )}
        </Box>
    );
};

export default CodeInput;
