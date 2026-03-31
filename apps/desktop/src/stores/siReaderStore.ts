import { create } from 'zustand';

type SiReaderStore = {
  connected: boolean;
  bufferedCard: number | null;
  error: string;
  setConnected: (connected: boolean) => void;
  setBufferedCard: (card: number | null) => void;
  setError: (error: string) => void;
};

export const useSiReaderStore = create<SiReaderStore>((set) => ({
  connected: false,
  bufferedCard: null,
  error: '',
  setConnected: (connected) => set({ connected }),
  setBufferedCard: (bufferedCard) => set({ bufferedCard }),
  setError: (error) => set({ error }),
}));
