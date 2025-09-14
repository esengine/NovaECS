import type { Component } from '../core/Component';
import type { ComponentType } from '../utils/Types';
import type { ComponentSerde } from './Types';

class ComponentSerdeRegistry {
  private serdeMap = new Map<number, ComponentSerde>();

  register<T extends Component>(serde: ComponentSerde<T>): void {
    this.serdeMap.set(serde.type.id, serde as ComponentSerde);
  }

  get<T extends Component>(type: ComponentType<T>): ComponentSerde<T> | undefined {
    return this.serdeMap.get(type.id) as ComponentSerde<T> | undefined;
  }

  has(type: ComponentType): boolean {
    return this.serdeMap.has(type.id);
  }

  getRegisteredTypes(): ComponentType[] {
    return Array.from(this.serdeMap.values()).map(serde => serde.type);
  }

  clear(): void {
    this.serdeMap.clear();
  }
}

export const componentSerdeRegistry = new ComponentSerdeRegistry();

export function registerComponentSerde<T extends Component>(serde: ComponentSerde<T>): void {
  componentSerdeRegistry.register(serde);
}

export function createBasicSerde<T extends Component>(
  type: ComponentType<T>,
  serialize?: (component: T) => any,
  deserialize?: (data: any) => T
): ComponentSerde<T> {
  return {
    type,
    serialize: serialize || ((component: T) => ({ ...component })),
    deserialize: deserialize || ((data: any) => {
      const instance = new type();
      Object.assign(instance, data);
      return instance;
    })
  };
}