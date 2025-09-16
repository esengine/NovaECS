import { describe, test, expect } from 'vitest';
import { World } from '../src/core/World';
import { registerComponent } from '../src/core/ComponentRegistry';
import { Guid } from '../src/components/Guid';

describe('Debug Guid Value', () => {
  test('should debug guid value issue', () => {
    registerComponent(Guid);
    const world = new World();

    // Test 1: Create Guid directly with string constructor
    console.log('=== Test 1: Direct string constructor ===');
    const guid1 = new Guid('test-guid-123');
    console.log('guid1:', { hi: guid1.hi, lo: guid1.lo, _originalValue: guid1._originalValue });
    console.log('guid1.value:', guid1.value);

    // Test 2: Create Guid and set value via property
    console.log('\n=== Test 2: Property assignment ===');
    const guid2 = new Guid();
    console.log('Before assignment:', { hi: guid2.hi, lo: guid2.lo, _originalValue: guid2._originalValue });
    guid2.value = 'test-guid-456';
    console.log('After assignment:', { hi: guid2.hi, lo: guid2.lo, _originalValue: guid2._originalValue });
    console.log('guid2.value:', guid2.value);

    // Test 3: Create via World.addComponent (like in serialize test)
    console.log('\n=== Test 3: World.addComponent (serialize test scenario) ===');
    const entity = world.createEntity();

    // Create a component directly to see what it should look like
    const directGuid = new Guid();
    directGuid.value = 'test-guid-789';
    console.log('Direct guid after setter:', { hi: directGuid.hi, lo: directGuid.lo, _originalValue: directGuid._originalValue, value: directGuid.value });

    world.addComponent(entity, Guid, { value: 'test-guid-789' });
    const guid3 = world.getComponent(entity, Guid)!;
    console.log('guid3:', { hi: guid3.hi, lo: guid3.lo, _originalValue: guid3._originalValue });
    console.log('guid3.value:', guid3.value);
    console.log('guid3 instanceof Guid:', guid3 instanceof Guid);
    console.log('guid3.constructor.name:', guid3.constructor.name);
    console.log('typeof guid3.value:', typeof guid3.value);
    console.log('guid3 has own property "value":', guid3.hasOwnProperty('value'));

    // Test 4: Manual Object.assign on real Guid instance
    console.log('\n=== Test 4: Manual Object.assign ===');
    const guid4 = new Guid();
    console.log('Before Object.assign - guid4.value:', guid4.value);
    console.log('Before Object.assign - hasOwnProperty value:', guid4.hasOwnProperty('value'));
    Object.assign(guid4, { value: 'test-assign' });
    console.log('After Object.assign - guid4.value:', guid4.value);
    console.log('After Object.assign - hasOwnProperty value:', guid4.hasOwnProperty('value'));
    console.log('typeof guid4.value:', typeof guid4.value);
  });
});