"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface UserImageContextType {
  userPhoto: string | null;
  setUserPhoto: (photo: string | null) => void;
  isAvatarMode: boolean;
}

const UserImageContext = createContext<UserImageContextType | undefined>(undefined);

export function UserImageProvider({ children }: { children: React.ReactNode }) {
  const [userPhoto, setUserPhotoState] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("venus_user_photo");
    if (saved) setUserPhotoState(saved);
  }, []);

  const setUserPhoto = (photo: string | null) => {
    setUserPhotoState(photo);
    if (photo) {
      localStorage.setItem("venus_user_photo", photo);
    } else {
      localStorage.removeItem("venus_user_photo");
    }
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
