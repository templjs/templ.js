declare module 'jsonparse' {
  export default class JSONParser {
    onValue: ((this: { stack: unknown[] }, value: unknown) => void) | undefined;
    write(chunk: string | Buffer): void;
  }
}
