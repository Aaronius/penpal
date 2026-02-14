/// <reference types="vitest/globals" />

declare global {
  interface Window {
    PenpalGeneralFixtureMethods: {
      createGeneralMethods: (options: {
        getParentApi: () => Promise<Record<string, unknown>>;
        setParentReturnValue: (value: number) => void;
        getParentReturnValue: () => number | undefined;
        getUnclonableValue: () => unknown;
        createReply: (
          value: unknown,
          options?: { transferables?: Transferable[] }
        ) => unknown;
        reload?: () => void;
        navigate?: (to: string) => void;
      }) => Record<string, unknown>;
      createParentRoundTripMethods: (options: {
        getParentApi: () => Promise<Record<string, unknown>>;
        setParentReturnValue: (value: number) => void;
        getParentReturnValue: () => number | undefined;
      }) => Record<string, unknown>;
    };
  }
}

export {};
