import React from "react";
import { TextInput, TextInputProps, StyleSheet } from "react-native";
import { spacing } from "../lib/spacing";

interface InputFieldProps extends TextInputProps { }

const InputField: React.FC<InputFieldProps> = (props) => {
    return (
        <TextInput
            {...props}
            style={StyleSheet.flatten([
                {
                    paddingHorizontal: spacing.sm,
                    borderWidth: 2,
                    borderColor: "black",
                    borderRadius: spacing.md,
                    backgroundColor: "white",
                },
                props.style,
            ])}
        />
    );
};

export default InputField;
