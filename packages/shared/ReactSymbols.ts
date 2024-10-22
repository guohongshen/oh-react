const supportSymbol = typeof Symbol === "function" && Symbol.for;

// 注意 REACT_ELEMENT_TYPE 是 element.$$typeof 的值，剩下三个是 element.type 的值。

export const REACT_ELEMENT_TYPE = supportSymbol
    ? Symbol.for('react.element')
    : 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
    ? Symbol.for('react.fragment')
    : 0xeacb;

export const REACT_CONTEXT_TYPE = supportSymbol
    ? Symbol.for('react.context')
    : 0xeac2;

export const REACT_PROVIDER_TYPE = supportSymbol
    ? Symbol.for('react.provider')
    : 0xeac3;

export const REACT_SUSPENSE_TYPE = supportSymbol
    ? Symbol.for('react.suspense')
    : 0xeac4;

    export const REACT_MEMO_TYPE = supportSymbol
    ? Symbol.for('react.memo')
    : 0xeac5;
