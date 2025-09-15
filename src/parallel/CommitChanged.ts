/**
 * Commit changes from SAB write masks to World change tracking
 * 从SAB写掩码提交变更到World变更跟踪
 */

import type { World } from '../core/World';
import type { ComponentCtor } from '../core/ComponentRegistry';
import { getComponentType } from '../core/ComponentRegistry';
import { isDrainableColumn, type ArchetypeObject, isArchetypeObject } from './TypeGuards';

/**
 * Commit component changes from SAB write masks to World
 * Worker has already set write masks, main thread only needs to traverse masks
 * → entity = arch.entities[row] → world.markChanged(entity, Component)
 * 从SAB写掩码提交组件变更到World
 * Worker已经设置了写掩码，主线程只需遍历掩码
 * → entity = arch.entities[row] → world.markChanged(entity, Component)
 */
export function commitChangedFromMasks(world: World, ctors: ComponentCtor<any>[]): void {
  const typeIds = ctors.map(c => getComponentType(c).id);
  
  for (const arch of world.getArchetypeIndex().getAll()) {
    for (let i = 0; i < typeIds.length; i++) {
      const tid = typeIds[i];
      const col = arch.cols.get(tid);
      
      // Only process SAB columns with write mask support
      // 只处理支持写掩码的SAB列
      if (!isDrainableColumn(col)) continue;
      
      // Drain written rows from SAB column write mask
      // 从SAB列写掩码中取出被写行
      const rows = col.drainWrittenRows();
      
      // Mark each entity's component as changed
      // 标记每个实体的组件为已更改
      for (const r of rows) {
        const e = arch.entities[r];
        const store = world.getStore(getComponentType(ctors[i]));
        if (store) {
          store.markChanged(e, world.frame);
        }
      }
    }
  }
}

/**
 * Commit changes for specific archetype and component types
 * 为特定原型和组件类型提交变更
 */
export function commitChangedFromMasksForArchetype(
  world: World, 
  archetype: ArchetypeObject, 
  ctors: ComponentCtor<any>[]
): void {
  const typeIds = ctors.map(c => getComponentType(c).id);
  
  for (let i = 0; i < typeIds.length; i++) {
    const tid = typeIds[i];
    const col = archetype.cols.get(tid);
    
    if (!isDrainableColumn(col)) continue;
    
    const rows = col.drainWrittenRows();
    
    for (const r of rows) {
      const e = archetype.entities[r];
      const store = world.getStore(getComponentType(ctors[i]));
      if (store) {
        store.markChanged(e, world.frame);
      }
    }
  }
}