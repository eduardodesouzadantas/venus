"use client";

import React, { createContext, useContext, useState } from "react";

interface UserImageContextType {
  userPhoto: string | null;
  setUserPhoto: (photo: string | null) => void;
  isAvatarMode: boolean;
}

const UserImageContext = createContext<UserImageContextType | undefined>(undefined);

export function UserImageProvider({ children }: { children: React.ReactNode }) {
  const [userPhoto, setUserPhotoState] = useState<string | null>(null);

  const setUserPhoto = (photo: string | null) => {
    setUserPhotoState(photo);
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
