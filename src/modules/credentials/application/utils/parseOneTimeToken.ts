const UUID_V4_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ParsedOneTimeToken {
  tokenId: string
  secret: string
}

export const parseOneTimeToken = (
  token: string,
): ParsedOneTimeToken | null => {
  const separatorIndex = token.indexOf('.')
  const hasSingleSeparator =
    separatorIndex > 0 &&
    separatorIndex < token.length - 1 &&
    token.indexOf('.', separatorIndex + 1) === -1

  if (!hasSingleSeparator) {
    return null
  }

  const tokenId = token.slice(0, separatorIndex)
  const secret = token.slice(separatorIndex + 1)

  if (!UUID_V4_LIKE_REGEX.test(tokenId) || secret.length === 0) {
    return null
  }

  return {
    tokenId,
    secret,
  }
}
