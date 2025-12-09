import * as React from "react";
import Svg, { Circle, Path } from "react-native-svg";

const SvgChild = (props) => (
  <Svg width={128} height={128} viewBox="0 0 128 128" {...props}>
    <Circle cx={64} cy={64} r={60} fill="#00adfe" />
    <Circle cx={64} cy={64} r={48} fill="#fff" opacity={0.2} />
    <Path d="M106 57a4 4 0 0 1-4-4V39a13 13 0 0 0-25.9 0l6 18a12 12 0 0 0 24 0Z" fill="#ff6d00" />
    <Circle cx={82} cy={41} r={10} fill="#4bc190" />
    <Path d="M20 57a4 4 0 0 0 4-4V39h.05A13 13 0 0 1 50 39l-6 18a12 12 0 0 1-24 0" fill="#ff6d00" />
    <Circle cx={44} cy={41} r={10} fill="#4bc190" />
    <Path d="M63 28a29.41 29.41 0 0 1 29.41 29.41v6.12a10.94 10.94 0 0 1-10.94 10.94H44.53a10.94 10.94 0 0 1-10.94-10.94v-6.12A29.41 29.41 0 0 1 63 28" fill="#ff6d00" />
    <Circle cx={85.98} cy={74.31} r={6.43} fill="#fbc0aa" />
    <Path d="M64 124a59.6 59.6 0 0 0 33-9.92l-2.66-7.44A10 10 0 0 0 85 100H41.05a10 10 0 0 0-9.42 6.64L29.36 113A59.74 59.74 0 0 0 64 124" fill="#393c54" />
    <Path d="M77.92 100H48.09l-2.63 6.3L54 110l-3 5 12 6 11-6-2-5 8-3.7z" fill="#515570" />
    <Path d="M72 101.25c0 5-4 16-9 16s-9-11-9-16 4-3 9-3 9-1.97 9 3" fill="#fff" />
    <Path d="M63 87.75v13.75" stroke="#fbc0aa" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx={40.02} cy={74.31} r={6.43} fill="#fbc0aa" />
    <Path d="M63 98.84a23 23 0 0 1-23-23V60.76a23 23 0 0 1 46 0v15.11a23 23 0 0 1-23 22.97" fill="#ffd8c9" />
    <Path d="M44.82 51A19.9 19.9 0 0 1 62.4 38.54" stroke="#fff" strokeWidth={3.68} strokeLinecap="round" fill="none" opacity={0.1} />
    <Path d="M88.82 58.82A25.82 25.82 0 0 0 62.27 33c-14.06.39-25.09 12.28-25.09 26.35v4a4.83 4.83 0 0 0 1.48 3.51 6 6 0 0 0 1.36 1V64a4 4 0 0 1 4-4h5.38a1 1 0 0 0 .9-.55L52 56l1.72 3.45a1 1 0 0 0 .9.55h1.24a1 1 0 0 0 .91-.58l1.65-3.5 1.8 3.53a1 1 0 0 0 .89.55h10.78a1 1 0 0 0 .89-.55l1.8-3.53 1.65 3.5a1 1 0 0 0 .91.58H82a4 4 0 0 1 4 4v3.89a6 6 0 0 0 1.36-1 4.83 4.83 0 0 0 1.48-3.51Z" fill="#ff8b2c" />
    <Path d="M62.5 77.5v4" stroke="#fbc0aa" strokeWidth={4.71} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M72 68h7M54 68h-7" stroke="#515570" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

export default SvgChild;
