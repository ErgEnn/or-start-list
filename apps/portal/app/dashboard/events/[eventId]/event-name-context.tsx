"use client";

import { createContext, useContext } from "react";

export const EventNameContext = createContext<(name: string) => void>(() => {});
export const useSetEventName = () => useContext(EventNameContext);
