/// <reference types="vite/client" />

declare module '*.yaml?raw' {
  const text: string;
  export default text;
}

declare module '*.yml?raw' {
  const text: string;
  export default text;
}
