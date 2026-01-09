import React from "react";
import { Canvas, DiffRect, rect, rrect, RoundedRect, Paint } from "@shopify/react-native-skia";
import { Dimensions, StyleSheet, Platform } from "react-native";

const { width, height } = Dimensions.get("window");
const scanSize = 300;
const borderRadius = 20;
const cornerLength = 25;
const borderWidth = 4;

export const Overlay = () => {
    const outer = rrect(rect(0, 0, width, height), 0, 0);
    const inner = rrect(
        rect(width / 2 - scanSize / 2, height / 2 - scanSize / 2, scanSize, scanSize),
        borderRadius,
        borderRadius
    );

    const x = width / 2 - scanSize / 2;
    const y = height / 2 - scanSize / 2;

    return (
        <Canvas style={Platform.OS === "android" ? { flex: 1 } : StyleSheet.absoluteFillObject}>
            {/* Darken the background outside the scan area */}
            <DiffRect inner={inner} outer={outer} color="black" opacity={0.4} />

            {/* Corners */}
            {/* Top-left */}
            <RoundedRect x={x} y={y} width={cornerLength} height={borderWidth} r={0}>
                <Paint color="white" />
            </RoundedRect>
            <RoundedRect x={x} y={y} width={borderWidth} height={cornerLength} r={0}>
                <Paint color="white" />
            </RoundedRect>

            {/* Top-right */}
            <RoundedRect x={x + scanSize - cornerLength} y={y} width={cornerLength} height={borderWidth} r={0}>
                <Paint color="white" />
            </RoundedRect>
            <RoundedRect x={x + scanSize - borderWidth} y={y} width={borderWidth} height={cornerLength} r={0}>
                <Paint color="white" />
            </RoundedRect>

            {/* Bottom-left */}
            <RoundedRect x={x} y={y + scanSize - borderWidth} width={cornerLength} height={borderWidth} r={0}>
                <Paint color="white" />
            </RoundedRect>
            <RoundedRect x={x} y={y + scanSize - cornerLength} width={borderWidth} height={cornerLength} r={0}>
                <Paint color="white" />
            </RoundedRect>

            {/* Bottom-right */}
            <RoundedRect x={x + scanSize - cornerLength} y={y + scanSize - borderWidth} width={cornerLength} height={borderWidth} r={0}>
                <Paint color="white" />
            </RoundedRect>
            <RoundedRect x={x + scanSize - borderWidth} y={y + scanSize - cornerLength} width={borderWidth} height={cornerLength} r={0}>
                <Paint color="white" />
            </RoundedRect>
        </Canvas>
    );
};
