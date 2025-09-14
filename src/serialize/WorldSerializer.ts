/**
 * World serialization for save/load functionality
 * 世界序列化用于存档/读档功能
 */

import type { World } from "../core/World";
import { getCtorByTypeId, getComponentType } from "../core/ComponentRegistry";
import { Guid } from "../components/Guid";
import { getSerde } from "./ComponentSerde";

/**
 * Save data format
 * 存档数据格式
 */
export interface SaveData {
  version: number;
  entities: Array<{ guid: string; comps: Array<{ typeId: number; data: any }> }>;
}

/**
 * World serializer for stable persistence using GUID mapping
 * 使用GUID映射的世界序列化器，用于稳定持久化
 */
export class WorldSerializer {
  constructor(private version = 1) {}

  /**
   * Save world state to serializable data
   * 将世界状态保存为可序列化数据
   */
  save(world: World): SaveData {
    const out: SaveData = { version: this.version, entities: [] };
    // 简易：扫描所有挂 Guid 的实体
    world.query(Guid).forEach((e, guid) => {
      const comps = world.getEntityComponents(e).map(c => {
        const t = getComponentType((c as any).constructor);
        const serde = getSerde((c as any).constructor);
        return { typeId: t.id, data: serde.toJSON(c) };
      });
      out.entities.push({ guid: (guid).value, comps });
    });
    return out;
  }

  /**
   * Load world state from save data
   * 从存档数据加载世界状态
   */
  load(world: World, data: SaveData) {
    const cmd = world.cmd();
    for (const ent of data.entities) {
      const e = cmd.create(true);
      cmd.add(e, Guid, { value: ent.guid });
      for (const c of ent.comps) {
        const Ctor = getCtorByTypeId<any>(c.typeId);
        if (!Ctor) continue; // 未注册类型可跳过/报错
        const serde = getSerde(Ctor);
        cmd.addInstance(e, serde.fromJSON(c.data));
      }
    }
    world.flush(cmd);
  }
}