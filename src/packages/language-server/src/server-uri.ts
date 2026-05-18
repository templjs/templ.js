import { fileURLToPath } from 'url';

export function isLikelySchemaUri(uri: string): boolean {
  const normalized = uri.replace(/[?#].*$/, '').toLowerCase();
  if (!/\.(json|ya?ml)$/.test(normalized)) {
    return false;
  }

  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  return !/\.(templ|template|tpl|tmpl)\.(json|ya?ml)$/.test(fileName);
}

export function isMdTemplateUri(uri: string): boolean {
  return /\.(md|markdown)\.(templ|tmpl|tpl)$/i.test(uri.replace(/[?#].*$/, ''));
}

export function isYamlTemplateUri(uri: string): boolean {
  return /\.ya?ml\.(templ|tmpl|tpl)$/i.test(uri.replace(/[?#].*$/, ''));
}

export function deriveWorkspaceRootFromDocumentUri(uri: string | undefined): {
  rootUri?: string;
  workspaceRoot?: string;
} {
  if (!uri || !uri.startsWith('file://')) {
    return {};
  }

  try {
    const url = new URL(uri);
    const segments = url.pathname.split('/');
    segments.pop();
    const parentPath = segments.join('/');
    if (!parentPath) {
      return {};
    }
    url.pathname = parentPath;
    const rootUri = url.href;

    if (url.host && url.host !== 'localhost') {
      return { rootUri };
    }

    return { rootUri, workspaceRoot: fileURLToPath(rootUri) };
  } catch {
    return {};
  }
}
