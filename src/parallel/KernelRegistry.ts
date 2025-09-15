/**
 * Unified kernel registry with metadata for main thread and worker coordination
 * 主线程和Worker协调的统一内核注册表（含元数据）
 */

/**
 * Host kernel function type that runs on main thread
 * 在主线程运行的宿主核函数类型
 */
export type HostKernel = (
  cols: any[][], 
  length: number, 
  params?: any
) => { written: number[] };

/**
 * Kernel metadata describing static properties
 * 描述静态属性的核函数元数据
 */
export type KernelMeta = {
  /** Column indices that this kernel may write to (based on ctors order) */
  /** 此核函数可能写入的列索引（基于ctors顺序） */
  writes: number[];
};

/**
 * Registry for host kernels (main thread versions of worker kernels)
 * 宿主核函数注册表（worker核函数的主线程版本）
 */
const hostKernels = new Map<string, HostKernel>();

/**
 * Registry for kernel metadata
 * 核函数元数据注册表
 */
const kernelMetadata = new Map<string, KernelMeta>();

/**
 * Register a host kernel function with metadata for main thread execution
 * 注册带元数据的宿主核函数用于主线程执行
 */
export function registerHostKernel(id: string, fn: HostKernel, meta: KernelMeta): void {
  hostKernels.set(id, fn);
  kernelMetadata.set(id, meta);
}

/**
 * Get a registered host kernel function
 * 获取已注册的宿主核函数
 */
export function getHostKernel(id: string): HostKernel | undefined {
  return hostKernels.get(id);
}

/**
 * Get registered metadata for a kernel function
 * 获取核函数的已注册元数据
 */
export function getKernelMeta(id: string): KernelMeta | undefined {
  const meta = kernelMetadata.get(id);
  return meta ? { writes: [...meta.writes] } : undefined;
}

/**
 * Check if a host kernel is registered
 * 检查宿主核函数是否已注册
 */
export function hasHostKernel(id: string): boolean {
  return hostKernels.has(id);
}

/**
 * Check if kernel metadata is registered
 * 检查核函数元数据是否已注册
 */
export function hasKernelMeta(id: string): boolean {
  return kernelMetadata.has(id);
}

/**
 * Get all registered host kernel IDs
 * 获取所有已注册的宿主核函数ID
 */
export function getRegisteredHostKernels(): string[] {
  return Array.from(hostKernels.keys());
}

/**
 * Get all registered kernel IDs with metadata
 * 获取所有有元数据注册的核函数ID
 */
export function getRegisteredKernelIds(): string[] {
  return Array.from(kernelMetadata.keys());
}

/**
 * Validate that a kernel's runtime written indices match its static metadata
 * 验证核函数运行时写入的索引与其静态元数据匹配
 */
export function validateWrittenAgainstMeta(
  kernelId: string, 
  runtimeWritten: number[]
): { isValid: boolean; message?: string } {
  const meta = getKernelMeta(kernelId);
  if (!meta) {
    return {
      isValid: false,
      message: `No metadata registered for kernel '${kernelId}'. Use registerHostKernel() first.`
    };
  }

  // Check if runtime written is a subset of declared writes
  // 检查运行时写入是否是声明写入的子集
  const undeclaredWrites = runtimeWritten.filter(idx => !meta.writes.includes(idx));
  if (undeclaredWrites.length > 0) {
    return {
      isValid: false,
      message: `Kernel '${kernelId}' wrote to undeclared columns [${undeclaredWrites.join(', ')}]. ` +
               `Declared writes: [${meta.writes.join(', ')}]`
    };
  }

  return { isValid: true };
}

/**
 * Clear all registered host kernels and metadata (for testing)
 * 清除所有已注册的宿主核函数和元数据（用于测试）
 */
export function clearHostKernels(): void {
  hostKernels.clear();
  kernelMetadata.clear();
}