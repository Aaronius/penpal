import type { ReportResult, ResultKey } from './protocol.js';

type ExampleState = 'connected' | 'connecting' | 'error' | 'ready';

export type ExampleUi = {
  fail: (error: unknown) => void;
  reportResult: ReportResult;
  setState: (state: ExampleState, label: string) => void;
};

export const getRequiredElement = <TElement extends Element>(
  selector: string,
): TElement => {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Expected to find ${selector}.`);
  }

  return element;
};

export const createExampleUi = (): ExampleUi => {
  const status = getRequiredElement<HTMLElement>('[data-status]');

  const setState = (state: ExampleState, label: string) => {
    status.dataset.state = state;
    status.textContent = label;
  };

  const reportResult = (key: ResultKey, value: number) => {
    const output = getRequiredElement<HTMLOutputElement>(
      `[data-result="${key}"]`,
    );
    output.value = String(value);
  };

  return {
    fail(error) {
      const message = error instanceof Error ? error.message : String(error);
      setState('error', message);
    },
    reportResult,
    setState,
  };
};

export const runExample = (ui: ExampleUi, task: () => Promise<void>): void => {
  void task().catch((error: unknown) => {
    ui.fail(error);
  });
};

export const setEndpointState = (label: string): void => {
  const status = getRequiredElement<HTMLElement>('[data-endpoint-status]');
  status.textContent = label;
  status.dataset.state = 'connected';
};
