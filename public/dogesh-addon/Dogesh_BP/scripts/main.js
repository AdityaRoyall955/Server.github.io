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
  return [...world.getDimension('overworld').getEntities({ type: DOGESH_ID })];
}

function ensureDogesh() {
  const dogs = dogeshEntities();
  for (const dog of dogs) {
    if (dog.getDynamicProperty('is_dogesh') !== true) dog.setDynamicProperty('is_dogesh', true);
    if (!dog.hasTag(BRAIN_TAG)) dog.addTag(BRAIN_TAG);
    if (!dog.nameTag) dog.nameTag = 'Dogesh';
  }
}

function ownerIdFor(player) {
  return String(player.id || player.name);
}

function isOwner(player, dog) {
  const owner = dog.getDynamicProperty(OWNER_KEY);
  return owner === undefined || owner === ownerIdFor(player);
}

function bindOwner(player) {
  for (const dog of dogeshEntities()) {
    if (dog.getDynamicProperty(OWNER_KEY) === undefined) dog.setDynamicProperty(OWNER_KEY, ownerIdFor(player));
  }
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) bindOwner(player);
  ensureDogesh();
});

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (hurtEntity.typeId !== DOGESH_ID || eventCooldown > 0) return;
  eventCooldown = EVENT_COOLDOWN;
  sendBridgeEvent('DogeshDamaged', { entityId: hurtEntity.id, attackerId: damageSource?.damagingEntity?.id ?? null, message: 'Bhai mujhe mara!' });
});

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  const dog = dogeshEntities()[0];
  if (!dog || !isOwner(player, dog)) return;
  sendBridgeEvent('BlockInteracted', { playerId: ownerIdFor(player), blockId: block.typeId, location: block.location });
});

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (target.typeId !== DOGESH_ID) return;
  if (target.getDynamicProperty(OWNER_KEY) === undefined) target.setDynamicProperty(OWNER_KEY, ownerIdFor(player));
  target.triggerEvent('dogesh:happy_bark');
  sendBridgeEvent('DogeshInteraction', { playerId: ownerIdFor(player), entityId: target.id });
});

system.runInterval(() => {
  if (eventCooldown > 0) eventCooldown--;
  ensureDogesh();
  const dog = dogeshEntities()[0];
  if (dog) sendBridgeEvent('DogeshPosition', { entityId: dog.id, location: dog.location, ownerId: dog.getDynamicProperty(OWNER_KEY) ?? null });
}, 20);
