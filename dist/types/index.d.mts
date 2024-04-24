export = startMocking;
declare function startMocking(path: any, mockExport: any, lazy: any): void;
declare namespace startMocking {
    export { stopMocking as stop, stopMockingAll as stopAll, reRequire };
}
declare function stopMocking(path: any): void;
declare function stopMockingAll(): void;
declare function reRequire(path: any): any;
