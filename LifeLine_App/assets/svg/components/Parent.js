import * as React from "react";
import Svg, { Circle, Path, Ellipse } from "react-native-svg";

const SvgParent = (props) => (
  <Svg width={128} height={128} viewBox="0 0 128 128" {...props}>
    <Circle cx={64} cy={64} r={60} fill="#00adfe" />
    <Circle cx={64} cy={64} r={48} fill="#fff" opacity={0.3} />
    <Path d="M64 8.68a41 41 0 0 1 41 41v8a27.66 27.66 0 0 1-27.66 27.69H50.66A27.66 27.66 0 0 1 23 57.71v-8a41 41 0 0 1 41-41Z" fill="#393c54" />
    <Circle cx={89} cy={64} r={7} fill="#8f5653" />
    <Path d="M64 124a59.7 59.7 0 0 0 32.55-9.61l-3.18-10.75A10 10 0 0 0 84 97H44.05a10 10 0 0 0-9.42 6.64l-3.18 10.75A59.7 59.7 0 0 0 64 124" fill="#f85565" />
    <Path d="M64 115a18 18 0 0 0 18-18H46a18 18 0 0 0 18 18" fill="#ffd8c9" />
    <Path d="M64 91.75v7.75" stroke="#8f5653" strokeWidth={14} strokeLinecap="round" fill="none" />
    <Circle cx={39} cy={64} r={7} fill="#8f5653" />
    <Path d="M64 94a25 25 0 0 1-25-25V51.52a25 25 0 1 1 50 0V69a25 25 0 0 1-25 25" fill="#b56b63" />
    <Circle cx={77.25} cy={62.28} r={3} fill="#393c54" />
    <Path d="M71.75 63.37a6.61 6.61 0 0 1 11.5-1.31" stroke="#393c54" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx={50.75} cy={62.28} r={3} fill="#393c54" />
    <Path d="M56.25 63.37a6.61 6.61 0 0 0-11.5-1.31" stroke="#393c54" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Ellipse cx={51} cy={70} rx={5.08} ry={3} fill="#f85565" opacity={0.2} />
    <Ellipse cx={77} cy={70} rx={5.08} ry={3} fill="#f85565" opacity={0.2} />
    <Circle cx={90} cy={72} r={3} fill="#ffd8c9" />
    <Circle cx={38} cy={72} r={3} fill="#ffd8c9" />
    <Path d="m73 56 5.18-2.36a4.6 4.6 0 0 1 4.67.5L84 55M55 56l-5.18-2.36a4.6 4.6 0 0 0-4.67.5L44 55" stroke="#515570" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} fill="none" />
    <Path d="M91 31C81 14 64 16 64 16s-17-2-27 15a47.5 47.5 0 0 0-6 33s3-4.72 8-4.72c0-.2 3.65-8.08 5.68-12.44A3.48 3.48 0 0 1 48.8 45 55 55 0 0 0 64 47a55 55 0 0 0 15.2-2 3.48 3.48 0 0 1 4.12 1.89C85.35 51.2 89 59.08 89 59.28c5 0 8 4.72 8 4.72a47.5 47.5 0 0 0-6-33" fill="#393c54" />
    <Path d="M64 65v8M67 72h-6" stroke="#8f5653" strokeWidth={4} strokeLinecap="round" fill="none" />
    <Path d="M71.55 79a1 1 0 0 1 .94 1.07 8.56 8.56 0 0 1-17 0 1 1 0 0 1 .96-1.07Z" fill="#393c54" />
    <Path d="M59 85.91a8.52 8.52 0 0 0 10.08 0 5.79 5.79 0 0 0-10.08 0" fill="#f85565" />
    <Path d="M69 81H59a1.84 1.84 0 0 1-1.73-2h13.5A1.84 1.84 0 0 1 69 81" fill="#fff" />
  </Svg>
);

export default SvgParent;
