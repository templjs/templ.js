declare module 'yaml-language-service' {
  export function getLanguageService(options: {
    schemaRequestService: (uri: string) => Promise<string>;
    workspaceContext: { resolveRelativePath: (relativePath: string, resource?: string) => string };
  }): {
    configure?: (settings: unknown) => void;
    doValidation: (
      document: {
        uri: string;
        languageId: string;
        version?: number;
        getText: () => string;
      },
      isKubernetes: boolean
    ) => Promise<
      Array<{
        message: string;
        severity?: number;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        source?: string;
        code?: string | number;
      }>
    >;
  };
}
