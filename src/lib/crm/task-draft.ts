/** True when the message composer holds something the user hasn't sent yet. */
export function hasUnsentDraft(text: string, fileCount: number): boolean {
  return text.trim().length > 0 || fileCount > 0
}
