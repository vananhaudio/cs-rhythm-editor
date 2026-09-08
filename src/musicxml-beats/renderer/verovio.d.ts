/** Narrow facade for the pinned Verovio spike, whose npm package ships no TS types. */
declare module "verovio/wasm" {
  export default function createVerovioModule(): Promise<unknown>;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    getVersion(): string;
    resetOptions(): void;
    setOptions(options: Record<string, unknown>): boolean;
    resetXmlIdSeed(seed: number): void;
    loadData(data: string): boolean;
    getMEI(options?: Record<string, unknown>): string;
    getPageCount(): number;
    getLog(): string;
    renderToSVG(page?: number): string;
    renderToTimemap(
      options?: Record<string, unknown>
    ): {
      qstamp: number;
      on?: string[];
      off?: string[];
      restsOn?: string[];
      restsOff?: string[];
    }[];
    destroy(): void;
  }
}
