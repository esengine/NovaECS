/**
 * Resource system utilities
 * 资源系统工具函数
 */

import type { World } from '../core/World';

/**
 * Get or create a resource using the resource's constructor
 * 获取或创建资源，使用资源的构造函数
 */
export function getOrCreateResource<T>(
  world: World,
  ResourceClass: new () => T
): T {
  let resource = world.getResource(ResourceClass);
  if (!resource) {
    resource = new ResourceClass();
    world.setResource(ResourceClass, resource);
  }
  return resource;
}

/**
 * Get or create a resource with a custom factory function
 * 获取或创建资源，使用自定义工厂函数
 */
export function getOrCreateResourceWith<T>(
  world: World,
  ResourceClass: new () => T,
  factory: () => T
): T {
  let resource = world.getResource(ResourceClass);
  if (!resource) {
    resource = factory();
    world.setResource(ResourceClass, resource);
  }
  return resource;
}