import { world, system } from '@minecraft/server';

const DOGESH_ID = 'dogesh:dogesh';
const OWNER_KEY = 'dogesh_owner_id';
const BRAIN_TAG = 'ai_dog';
const EVENT_COOLDOWN = 20;
let eventCooldown = 0;

function sendBridgeEvent(type, body = {}) {
  // Bedrock's supported /wsserver channel is command-driven. These tellraw packets
  // are consumed by the companion bridge and keep the pack usable without raw sockets.
  const packet = JSON.stringify({ header: { version: 1, messageType: 'event', messagePurpose: 'event', eventName: type }, body });
  world.sendMessage('§0' + packet);
}

function dogeshEntities() {
  const dogs = [];
  for (const dimensionId of ['overworld', 'nether', 'the_end']) {
    try {
      dogs.push(...world.getDimension(dimensionId).getEntities({ type: DOGESH_ID }));
    } catch {
      // A dimension can be unavailable during early world startup.
    }
  }
  return dogs;
}

function isValidDog(dog) {
  try {
    return Boolean(dog?.isValid() && dog.typeId === DOGESH_ID);
  } catch {
    return false;
  }
}

function ensureDogesh() {
  for (const dog of dogeshEntities()) {
    if (!isValidDog(dog)) continue;
    if (dog.getDynamicProperty('is_dogesh') !== true) dog.setDynamicProperty('is_dogesh', true);
    if (!dog.hasTag(BRAIN_TAG)) dog.addTag(BRAIN_TAG);
    if (!dog.nameTag) dog.nameTag = 'Dogesh';
  }
}

function ownerIdFor(player) {
  return String(player.id || player.name);
}

function isOwner(player, dog) {
  if (!isValidDog(dog)) return false;
  const owner = dog.getDynamicProperty(OWNER_KEY);
  return owner === undefined || owner === ownerIdFor(player);
}

function bindOwner(player) {
  for (const dog of dogeshEntities()) {
    if (!isValidDog(dog)) continue;
    if (dog.getDynamicProperty(OWNER_KEY) === undefined) dog.setDynamicProperty(OWNER_KEY, ownerIdFor(player));
  }
}

function recoverDogToOwner(player) {
  const ownerId = ownerIdFor(player);
  for (const dog of dogeshEntities()) {
    if (!isValidDog(dog) || dog.getDynamicProperty(OWNER_KEY) !== ownerId) continue;
    try {
      if (dog.dimension.id !== player.dimension.id) {
        dog.teleport(player.location, { dimension: player.dimension, facingLocation: player.location });
        sendBridgeEvent('DogeshDimensionRecovered', { ownerId, dimensionId: player.dimension.id });
      }
    } catch {
      // The player or target chunk may be transitioning between dimensions.
    }
  }
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) bindOwner(player);
  ensureDogesh();
});

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (!isValidDog(hurtEntity) || eventCooldown > 0) return;
  eventCooldown = EVENT_COOLDOWN;
  sendBridgeEvent('DogeshDamaged', { entityId: hurtEntity.id, attackerId: damageSource?.damagingEntity?.id ?? null, message: 'Bhai mujhe mara!' });
});

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  const dog = dogeshEntities()[0];
  if (!dog || !isOwner(player, dog)) return;
  sendBridgeEvent('BlockInteracted', { playerId: ownerIdFor(player), blockId: block.typeId, location: block.location });
});

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (!isValidDog(target)) return;
  if (target.getDynamicProperty(OWNER_KEY) === undefined) target.setDynamicProperty(OWNER_KEY, ownerIdFor(player));
  target.triggerEvent('dogesh:happy_bark');
  sendBridgeEvent('DogeshInteraction', { playerId: ownerIdFor(player), entityId: target.id });
});

system.runInterval(() => {
  if (eventCooldown > 0) eventCooldown--;
  ensureDogesh();
  for (const player of world.getAllPlayers()) recoverDogToOwner(player);
  const dog = dogeshEntities()[0];
  if (isValidDog(dog)) {
    sendBridgeEvent('DogeshPosition', {
      entityId: dog.id,
      location: { x: Math.round(dog.location.x), y: Math.round(dog.location.y), z: Math.round(dog.location.z) },
      ownerId: dog.getDynamicProperty(OWNER_KEY) ?? null
    });
  }
}, 20);
