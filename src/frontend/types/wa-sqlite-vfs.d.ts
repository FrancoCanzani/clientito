declare module "wa-sqlite/src/examples/AccessHandlePoolVFS.js" {
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string);
    name: string;
    isReady: Promise<void>;
    close(): Promise<void>;
    getSize(): number;
    getCapacity(): number;
    addCapacity(n: number): Promise<void>;
    removeCapacity(n: number): Promise<void>;
  }
}
