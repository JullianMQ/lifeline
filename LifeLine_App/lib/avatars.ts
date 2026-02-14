// app/lib/avatars.ts
import type React from "react";
import type { SvgProps } from "react-native-svg";

import Alien from "../assets/images/avatars/alien.svg";
import Avocado from "../assets/images/avatars/avocado.svg";
import Bear from "../assets/images/avatars/bear.svg";
import Cactus from "../assets/images/avatars/cactus.svg";
import Cloud from "../assets/images/avatars/cloud.svg";
import Coffee from "../assets/images/avatars/coffee.svg";
import Face from "../assets/images/avatars/face.svg";
import Pencil from "../assets/images/avatars/pencil.svg";
import Sheep from "../assets/images/avatars/sheep.svg";
import Sloth from "../assets/images/avatars/sloth.svg";

export const AVATAR_KEYS = [
    "alien",
    "avocado",
    "bear",
    "cactus",
    "cloud",
    "coffee",
    "face",
    "pencil",
    "sheep",
    "sloth",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

// Stored value contract (same as web)
export const avatarValueFromKey = (k: AvatarKey) => `/avatars/${k}.svg`;

export const avatarKeyFromStoredValue = (
    value: string | null | undefined
): AvatarKey | null => {
    if (!value) return null;
    const m = value.match(/^\/avatars\/([a-z0-9_-]+)\.svg$/i);
    if (!m) return null;

    const key = m[1].toLowerCase();
    return (AVATAR_KEYS as readonly string[]).includes(key) ? (key as AvatarKey) : null;
};

export const AVATAR_SVGS: Record<AvatarKey, React.ComponentType<SvgProps>> = {
    alien: Alien,
    avocado: Avocado,
    bear: Bear,
    cactus: Cactus,
    cloud: Cloud,
    coffee: Coffee,
    face: Face,
    pencil: Pencil,
    sheep: Sheep,
    sloth: Sloth,
};

export const getAvatarSvgFromStoredValue = (
    value: string | null | undefined
): React.ComponentType<SvgProps> | null => {
    const key = avatarKeyFromStoredValue(value);
    return key ? AVATAR_SVGS[key] : null;
};
