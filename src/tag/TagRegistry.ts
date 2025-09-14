/**
 * Tag registration system for string-based entity categorization
 * 基于字符串的实体分类标签注册系统
 */

let _nextTag = 1;
const _nameToId = new Map<string, number>();

/**
 * Get or register tag ID for given name
 * 获取或注册指定名称的标签ID
 */
export function tagId(name: string): number {
  let id = _nameToId.get(name);
  if (!id) {
    id = _nextTag++;
    _nameToId.set(name, id);
  }
  return id;
}

/**
 * Get all registered tag names and their IDs
 * 获取所有已注册的标签名称及其ID
 */
export function getAllTags(): Array<{ name: string; id: number }> {
  return Array.from(_nameToId.entries()).map(([name, id]) => ({ name, id }));
}

/**
 * Reset tag registry (for testing)
 * 重置标签注册表（测试用）
 */
export function __resetTagRegistry(): void {
  _nextTag = 1;
  _nameToId.clear();
}