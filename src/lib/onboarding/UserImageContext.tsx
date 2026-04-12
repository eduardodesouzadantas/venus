"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface UserImageContextType {
  userPhoto: string | null;
  setUserPhoto: (photo: string | null) => void;
  isAvatarMode: boolean;
}

const UserImageContext = createContext<UserImageContextType | undefined>(undefined);

function safeLocalStorageGet(key: string) {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures on browsers that block localStorage.
  }
}

export function UserImageProvider({ children }: { children: React.ReactNode }) {
  const [userPhoto, setUserPhotoState] = useState<string | null>(null);

  useEffect(() => {
    const saved = safeLocalStorageGet("venus_user_photo");
    if (saved) setUserPhotoState(saved);
  }, []);

  const setUserPhoto = (photo: string | null) => {
    setUserPhotoState(photo);
    safeLocalStorageSet("venus_user_photo", photo);
  };

  return (
    <UserImageContext.Provider value={{ userPhoto, setUserPhoto, isAvatarMode: !!userPhoto }}>
      {children}
    </UserImageContext.Provider>
  );
}

export function useUserImage() {
  const context = useContext(UserImageContext);
  if (context === undefined) {
    throw new Error("useUserImage must be used within a UserImageProvider");
  }
  return context;
}
