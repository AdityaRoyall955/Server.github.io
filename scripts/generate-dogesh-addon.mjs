import { mkdir, writeFile, cp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const out = join(root, 'public', 'dogesh-addon')
const bp = join(out, 'Dogesh_BP')
const rp = join(out, 'Dogesh_RP')
const uuid = () => randomUUID()
const BP_UUID = 'a4b9db7c-4e30-4ec7-946b-2af59e420001'
const RP_UUID = 'a4b9db7c-4e30-4ec7-946b-2af59e420002'
const BP_MODULE = 'a4b9db7c-4e30-4ec7-946b-2af59e420003'
const RP_MODULE = 'a4b9db7c-4e30-4ec7-946b-2af59e420004'

async function put(file, value) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

await rm(out, { recursive: true, force: true })
await mkdir(join(bp, 'entities'), { recursive: true })
await mkdir(join(bp, 'scripts'), { recursive: true })
await mkdir(join(rp, 'entity'), { recursive: true })
await mkdir(join(rp, 'models', 'entity'), { recursive: true })
await mkdir(join(rp, 'textures', 'entity'), { recursive: true })
await mkdir(join(rp, 'texts'), { recursive: true })

await put(join(bp, 'manifest.json'), {
  format_version: 2,
  header: { name: 'Dogesh Behavior Pack', description: 'Cute dog-wolf AI companion with WebSocket bridge events.', uuid: BP_UUID, version: [1, 0, 0], min_engine_version: [1, 26, 0] },
  modules: [{ type: 'data', uuid: BP_MODULE, version: [1, 0, 0] }, { type: 'script', language: 'javascript', entry: 'scripts/main.js', uuid: uuid(), version: [1, 0, 0] }],
  dependencies: [{ uuid: RP_UUID, version: [1, 0, 0] }, { module_name: '@minecraft/server', version: '2.0.0' }]
})
await put(join(rp, 'manifest.json'), {
  format_version: 2,
  header: { name: 'Dogesh Resource Pack', description: 'Cute dog-wolf model, collar, animation, and language.', uuid: RP_UUID, version: [1, 0, 0], min_engine_version: [1, 26, 0] },
  modules: [{ type: 'resources', uuid: RP_MODULE, version: [1, 0, 0] }]
})

await put(join(bp, 'entities', 'dogesh.json'), {
  format_version: '1.21.0',
  'minecraft:entity': {
    description: { identifier: 'dogesh:dogesh', is_spawnable: true, is_summonable: true, is_experimental: false },
    components: {
      'minecraft:type_family': { family: ['dogesh', 'wolf', 'mob'] },
      'minecraft:health': { value: 80, max: 80 },
      'minecraft:collision_box': { width: 0.6, height: 0.85 },
      'minecraft:nameable': {},
      'minecraft:movement': { value: 0.3 },
      'minecraft:navigation.walk': { is_trekkable: true, can_path_over_water: true, avoid_damage_blocks: true },
      'minecraft:movement.basic': {},
      'minecraft:jump.static': {},
      'minecraft:can_climb': {},
      'minecraft:behavior.float': { priority: 0 },
      'minecraft:behavior.panic': { priority: 1, speed_multiplier: 1.4 },
      'minecraft:behavior.follow_owner': { priority: 4, speed_multiplier: 1.2, start_distance: 6, stop_distance: 2 },
      'minecraft:behavior.owner_hurt_by_target': { priority: 5 },
      'minecraft:behavior.owner_hurt_target': { priority: 6 },
      'minecraft:behavior.nearest_attackable_target': { priority: 7, must_see: true, reselect_targets: true, within_radius: 16, entity_types: [{ filters: { test: 'is_family', subject: 'other', value: 'monster' }, max_dist: 16 }] },
      'minecraft:behavior.melee_attack': { priority: 8, speed_multiplier: 1.25, track_target: true },
      'minecraft:behavior.pickup_items': { priority: 9, max_dist: 8, goal_radius: 2, excluded_items: [] },
      'minecraft:behavior.random_stroll': { priority: 10, speed_multiplier: 0.8 },
      'minecraft:behavior.random_look_around': { priority: 11 },
      'minecraft:tameable': { probability: 1.0, tame_items: ['bone'] },
      'minecraft:interact': { interactions: [{ on_interact: { event: 'dogesh:happy_bark', target: 'self' }, use_item: false, swing: true }] },
      'minecraft:celebrate': { duration: 3, sound: 'mob.wolf.bark', jump_interval: { range_min: 1, range_max: 2 } },
      'minecraft:damage_sensor': { triggers: [{ cause: 'all', deals_damage: true, on_damage: { event: 'dogesh:damaged', target: 'self' } }] },
      'minecraft:behavior.look_at_player': { priority: 12, look_distance: 8, probability: 0.8 },
      'minecraft:physics': {},
      'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true }
    },
    events: {
      'dogesh:initialize': { add: { component_groups: ['dogesh:initialized'] } },
      'dogesh:happy_bark': { sequence: [{ add: { component_groups: ['dogesh:celebrating'] } }, { queue_command: { command: ['playsound mob.wolf.bark @a ~ ~ ~ 1 1.2', 'particle minecraft:heart_particle ~ ~1 ~'] } }, { remove: { component_groups: ['dogesh:celebrating'] } }] },
      'dogesh:digging_animation': { queue_command: { command: ['playsound dig.grass @a ~ ~ ~ 0.7 1.1', 'particle minecraft:block_destruct ~ ~0.15 ~'] } },
      'dogesh:damaged': { queue_command: { command: ['playsound mob.wolf.whine @a ~ ~ ~ 1 1'] } }
    },
    component_groups: {
      'dogesh:initialized': { 'minecraft:variant': { value: 0 } },
      'dogesh:celebrating': { 'minecraft:celebrate': { duration: 3, sound: 'mob.wolf.bark', jump_interval: { range_min: 1, range_max: 2 } } }
    }
  }
})

await put(join(rp, 'entity', 'dogesh.entity.json'), {
  format_version: '1.10.0',
  'minecraft:client_entity': {
    description: {
      identifier: 'dogesh:dogesh',
      materials: { default: 'wolf' },
      textures: {
        default: 'textures/entity/dogesh',
        tame: 'textures/entity/dogesh',
        angry: 'textures/entity/dogesh'
      },
      geometry: { default: 'geometry.wolf' },
      animations: {
        look_at_target: 'animation.common.look_at_target',
        walk: 'animation.wolf.walk',
        sitting: 'animation.wolf.sitting',
        shaking: 'animation.wolf.shaking'
      },
      animation_controllers: [{ setup: { animations: ['look_at_target'] } }],
      render_controllers: ['controller.render.wolf'],
      spawn_egg: { texture: 'spawn_egg', texture_index: 0 }
    }
  }
})
await put(join(rp, 'texts', 'languages.json'), '["en_US","hi_IN"]\n')
await put(join(rp, 'texts', 'en_US.lang'), 'entity.dogesh.dogesh.name=Dogesh\n')
await put(join(rp, 'texts', 'hi_IN.lang'), 'entity.dogesh.dogesh.name=Dogesh\n')
await put(join(rp, 'textures', 'entity', 'dogesh.png.mcmeta'), JSON.stringify({ animation: { frametime: 2 } }))

await cp(join(root, 'public', 'dogesh-texture.png'), join(rp, 'textures', 'entity', 'dogesh.png'))

await put(join(bp, 'scripts', 'main.js'), `import { world, system } from '@minecraft/server';

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
    if (dog.getDynamicProperty(OWNER_KEY) === undefined) dog.setDynamicProperty(OWNER_KEY, ownerIdFor(player));
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
  const dog = dogeshEntities()[0];
  if (isValidDog(dog)) {
    sendBridgeEvent('DogeshPosition', {
      entityId: dog.id,
      location: { x: Math.round(dog.location.x), y: Math.round(dog.location.y), z: Math.round(dog.location.z) },
      ownerId: dog.getDynamicProperty(OWNER_KEY) ?? null
    });
  }
}, 20);
`)

await put(join(out, 'README.md'), '# Dogesh Bedrock Add-on\\n\\nTarget: Minecraft Bedrock 1.26.33. Dogesh is a cute dog-wolf companion with persistent Script API identity.\\n\\n## Install\\n1. Import Dogesh.mcaddon into Bedrock.\\n2. Activate both Dogesh Behavior Pack and Dogesh Resource Pack in the world.\\n3. Enable Beta APIs / Script API if your 1.26.33 build exposes that toggle.\\n4. Enable cheats and operator permissions because commandRequest packets execute world commands.\\n5. Summon with /summon dogesh:dogesh ~ ~ ~. The pack also recognizes the ai_dog tag.\\n\\n## Bridge contract\\nThe supplied Node bridge remains the command brain. Commands should target @e[type=dogesh:dogesh,c=1] and use event entity @e[type=dogesh:dogesh,c=1] dogesh:happy_bark, event entity @e[type=dogesh:dogesh,c=1] dogesh:digging_animation, setblock, fill, and give only after server-side validation.\\n\\nThe Script API emits JSON event envelopes through the supported server event channel. Your bridge should parse messages beginning with the invisible-prefix packet and route DogeshDamaged, BlockInteracted, DogeshInteraction, and DogeshPosition back to Groq.\\n\\n## Owner security\\nDo not authorize by display name alone. Store the owner Bedrock UUID/id in your Termux environment as DOGESH_OWNER_ID, compare it with the Script API owner_id dynamic property, and reject destructive tools unless both match.\\n\\n## Localhost caveat\\n127.0.0.1 means the machine running Bedrock. If Minecraft runs on a different phone/PC from Termux, use that host LAN IP instead.\\n')


const zip = join(root, 'public', 'Dogesh.mcaddon')
if (existsSync(zip)) await rm(zip)
execFileSync('zip', ['-qr', zip, 'Dogesh_BP', 'Dogesh_RP'], { cwd: out })
console.log(`Created ${zip}`)
