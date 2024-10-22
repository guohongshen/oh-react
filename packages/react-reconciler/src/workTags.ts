export enum WorkTag {
    FunctionComponent = 0,
    HostRoot = 3,
    HostComponent = 5, // div
    HostText = 6, // 23sdf23
    Fragment = 7,
    ContextProvider = 8,
    Suspense = 9,
    Offscreen = 10,
    Memo = 11
}

export const WorkTagToName = {
    [WorkTag.HostRoot]: 'HostRoot',
    [WorkTag.HostComponent]: 'HostComponent',
    [WorkTag.FunctionComponent]: 'FunctionComponent',
    [WorkTag.Fragment]: 'Fragment',
    [WorkTag.HostText]: 'HostText',
    [WorkTag.ContextProvider]: 'ContextProvider',
    [WorkTag.Suspense]: 'Suspense',
    [WorkTag.Offscreen]: 'Offscreen',
    [WorkTag.Memo]: 'Memo'
}
